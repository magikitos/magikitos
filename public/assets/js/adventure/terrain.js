"use strict";
const { TILE } = require("./model");
const { chunkRange } = require("./scene-frame");
const { paintInteriorGround } = require("./interior-ground");
const {
  paintTufts, paintOutdoorChunk, paintVoidChunk, groundData, planeGround,
  GRASS, SHOULDER, ROAD, SAND,
} = require("./terrain-paint");
/** Cuántas baldosas de 256×256 (256 KB cada una) se guardan como mínimo, aunque la vista sea pequeña. */
const CHUNK_FLOOR = 24;
/** Baldosas pedidas al worker a la vez: suficiente para el anillo de una vista, sin colas largas. */
const WORKER_IN_FLIGHT = 8;

/**
 * The terrain worker, when this browser can paint off the main thread. Its bundled source is
 * injected at build time (`tools/bundle.cjs`); without it —a plain test bundle, Node, an old
 * browser without OffscreenCanvas— the ground is painted on the main thread exactly as before.
 */
function createTerrainWorker() {
  try {
    if (
      typeof __TERRAIN_WORKER_SOURCE__ === "undefined" ||
      typeof Worker === "undefined" ||
      typeof OffscreenCanvas === "undefined" ||
      !new OffscreenCanvas(1, 1).getContext("2d")
    )
      return null;
    // eslint-disable-next-line no-undef
    const url = URL.createObjectURL(new Blob([__TERRAIN_WORKER_SOURCE__], { type: "text/javascript" }));
    return new Worker(url);
  } catch (_) {
    return null;
  }
}
/** Static, deterministic ground painter. Bounded native-pixel chunks shared by all scenes. */
class Terrain {
  constructor({ worker = createTerrainWorker() } = {}) {
    this.chunks = new Map();
    this.pinned = new Set();
    this.buildCount = 0;
    this.contexts = new Map();
    this.sceneContexts = new Map();
    // Off-thread painting: tiles asked of the worker and not back yet, by key; and a generation
    // per scene, so a tile painted before `invalidate` (new community paths) is thrown away.
    this.worker = worker;
    this.requests = new Map();
    this.generations = new Map();
    this.job = 0;
    this.planeSent = null;
    if (worker) {
      worker.onmessage = ({ data }) => this.received(data);
      // A worker that breaks hands everything back to the main thread; nothing stays pending.
      worker.onerror = () => this.abandonWorker();
    }
  }
  abandonWorker() {
    this.worker?.terminate();
    this.worker = null;
    for (const request of this.requests.values()) request.resolve(false);
    this.requests.clear();
  }
  received({ job, bitmap, error }) {
    for (const [key, request] of this.requests) {
      if (request.job !== job) continue;
      this.requests.delete(key);
      const fresh = bitmap && !this.chunks.has(key) && (this.generations.get(request.scene) || 0) === request.generation;
      if (fresh) this.store(key, bitmap);
      else bitmap?.close();
      if (error) console.warn("Terrain worker:", key, error);
      request.resolve(Boolean(fresh));
      return;
    }
    bitmap?.close();
  }
  /** Asks the worker for one tile. Resolves true once it is cached, false if it was not painted. */
  request(key, message, scene = null) {
    const pending = this.requests.get(key);
    if (pending) return pending.promise;
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    const job = ++this.job;
    this.requests.set(key, { job, scene, generation: this.generations.get(scene) || 0, resolve, promise });
    this.worker.postMessage({ ...message, job, key });
    return promise;
  }
  requestChunk(world, cx, cy) {
    const key = world.data.id + ":" + cx + ":" + cy;
    return this.request(key, { type: "chunk", data: groundData(world.data), origin: world.origin || null, cx, cy }, world.data.id);
  }
  requestVoid(plane, cx, cy) {
    if (this.planeSent !== plane) {
      this.worker.postMessage({ type: "plane", plane: planeGround(plane) });
      this.planeSent = plane;
    }
    return this.request("void:" + cx + ":" + cy, { type: "void", cx, cy });
  }
  /**
   * One tile ready before it is needed, off the main thread when possible: the arrival of a
   * journey, painted while the old scene keeps drawing. Interiors paint here (they need sprites).
   */
  async ensure(world, cx, cy, sprites) {
    if (this.has(world, cx, cy)) return;
    if (this.worker && !world.data.indoor && (await this.requestChunk(world, cx, cy))) return;
    this.chunk(world, cx, cy, sprites);
  }
  store(key, value) {
    this.chunks.set(key, value);
    this.prune();
  }
  drop(key) {
    const value = this.chunks.get(key);
    this.chunks.delete(key);
    value?.close?.(); // An ImageBitmap from the worker owns its pixels until closed.
  }
  /**
   * Un fotograma pinta varias pantallas a la vez (mundo continuo): se empieza vaciando lo anclado
   * y cada pantalla que se vaya a pintar ancla sus trozos con `pin` antes de que se pinte nada.
   */
  beginFrame() {
    this.pinned.clear();
    this.frameBuilds = this.buildCount;
    this.prune();
  }
  /**
   * ⛔ ANCLAR NO EXPULSA (20-sep-2026). Anclar solo apunta lo que este fotograma va a enseñar y
   * sube el presupuesto; la expulsión ocurre al INSERTAR una baldosa nueva, cuando ya está todo
   * anclado. Antes cada `pin` podaba en el acto con el presupuesto de lo anclado HASTA ESE MOMENTO:
   * con una vecina a la vista, anclar su suelo expulsaba las baldosas de la pantalla que pisas
   * —que aún no estaban ancladas—, y estas volvían a construirse en el mismo fotograma, ~240 por
   * segundo, quietos o andando. Ese era el trompicón junto a las costuras. El presupuesto lleva
   * además un anillo de holgura para que las baldosas que acaban de salir de la vista no se
   * repinten al dar media vuelta.
   */
  pin(world, view) {
    const range = chunkRange(world, view);
    for (let y = range.top; y <= range.bottom; y++)
      for (let x = range.left; x <= range.right; x++)
        this.pinned.add(world.data.id + ":" + x + ":" + y);
    this.rebudget();
  }
  /**
   * El presupuesto sigue a lo anclado: lo que este fotograma enseña, un anillo de holgura para que
   * lo que acaba de salir de la vista no se repinte al dar media vuelta, y un suelo mínimo.
   */
  rebudget() {
    this.budget = Math.max(CHUNK_FLOOR, this.pinned.size * 3 + 16);
  }
  /**
   * Una baldosa POR ADELANTADO y por fotograma, del anillo que rodea lo que se ve, y solo si este
   * fotograma no ha tenido que construir ninguna a la vista: así una fila entera de baldosas
   * nuevas no entra de golpe en el mismo fotograma al andar, que era el otro trompicón (una fila
   * de cinco o seis baldosas de 256×256 pintadas píxel a píxel en un solo fotograma).
   */
  prefetch(targets, sprites) {
    if (this.worker) return this.prefetchOffThread(targets);
    if (this.buildCount !== this.frameBuilds) return false;
    for (const target of targets) {
      const r = target.range;
      for (let y = r.top - 1; y <= r.bottom + 1; y++)
        for (let x = r.left - 1; x <= r.right + 1; x++) {
          if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) continue;
          if (target.plane) {
            if (!target.inside(x, y)) continue;
            if (this.chunks.has("void:" + x + ":" + y)) continue;
            this.voidChunk(target.plane, x, y);
            return true;
          }
          const world = target.world;
          if (world.data.indoor) continue;
          if (x < 0 || y < 0 || x > Math.ceil((world.width * TILE) / 256) - 1 || y > Math.ceil((world.height * TILE) / 256) - 1) continue;
          if (this.chunks.has(world.data.id + ":" + x + ":" + y)) continue;
          this.chunk(world, x, y, sprites);
          return true;
        }
    }
    return false;
  }
  /** With a worker the whole ring is asked for at once: painting it costs this thread nothing. */
  prefetchOffThread(targets) {
    let asked = false;
    for (const target of targets) {
      const r = target.range;
      for (let y = r.top - 1; y <= r.bottom + 1; y++)
        for (let x = r.left - 1; x <= r.right + 1; x++) {
          if (this.requests.size >= WORKER_IN_FLIGHT) return asked;
          if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) continue;
          if (target.plane) {
            if (!target.inside(x, y) || this.chunks.has("void:" + x + ":" + y)) continue;
            this.requestVoid(target.plane, x, y);
            asked = true;
            continue;
          }
          const world = target.world;
          if (world.data.indoor) continue;
          if (x < 0 || y < 0 || x > Math.ceil((world.width * TILE) / 256) - 1 || y > Math.ceil((world.height * TILE) / 256) - 1) continue;
          if (this.has(world, x, y)) continue;
          this.requestChunk(world, x, y);
          asked = true;
        }
    }
    return asked;
  }
  has(world, cx, cy) {
    return this.chunks.has(world.data.id + ":" + cx + ":" + cy);
  }
  /** Un claro con caminos nuevos hay que repintarlo: las baldosas se cachean por escena. */
  invalidate(sceneId) {
    this.generations.set(sceneId, (this.generations.get(sceneId) || 0) + 1);
    for (const key of [...this.chunks.keys()])
      if (key.startsWith(sceneId + ":")) this.drop(key);
  }
  prune() {
    for (const key of [...this.chunks.keys()]) {
      if (this.chunks.size <= (this.budget || CHUNK_FLOOR)) break;
      if (!this.pinned.has(key)) this.drop(key);
    }
  }
  context(data, sprites) {
    const name = data.interior?.background;
    if (!name || !sprites?.frame(name)) return null;
    if (!this.contexts.has(name)) {
      const source = sprites.icon(name),
        canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext("2d");
      ctx.filter = "blur(1.2px)";
      ctx.drawImage(source, -2, -2, source.width + 4, source.height + 4);
      this.contexts.set(name, canvas);
      if (this.contexts.size > 3)
        this.contexts.delete(this.contexts.keys().next().value);
    }
    return this.contexts.get(name);
  }
  /**
   * ⛔ UN INTERIOR PUEDE SER UN DIBUJO (19-sep-2026, el almacén-regadera): `interior.artwork` es un
   * sprite que ES la sala —paredes, suelo y luz pintadas— y se estampa una vez sobre la caja del
   * marco (`inset`), sin el suelo ni las paredes procedimentales. El contorno (`outline`) sigue
   * mandando en la colisión y en la luz, que es lo que hace que un dibujo sea una habitación.
   */
  artwork(data, sprites) {
    const name = data.interior?.artwork;
    if (!name || !sprites?.frame(name)) return null;
    if (!this.artworks) this.artworks = new Map();
    if (!this.artworks.has(name)) {
      this.artworks.set(name, sprites.icon(name));
      if (this.artworks.size > 3) this.artworks.delete(this.artworks.keys().next().value);
    }
    return this.artworks.get(name);
  }
  background(data, sprites) {
    const background = data.indoor ? this.context(data, sprites) : null;
    if (
      background &&
      this.sceneContexts.get(data.id) !== data.interior.background
    ) {
      // The immediate terrain preview can precede lazy background art. Invalidate just this scene once.
      this.invalidate(data.id);
      this.sceneContexts.set(data.id, data.interior.background);
    }
    return background;
  }
  /**
   * Un trozo del HUECO del plano (mundo continuo): suelo que continúa el borde más cercano, con
   * el mismo grano de hierba que las pantallas y sin caminos. Se cachea con las demás baldosas,
   * en coordenadas del plano, y se ancla por fotograma igual que ellas (`pinVoid`).
   */
  voidChunk(plane, cx, cy) {
    const key = "void:" + cx + ":" + cy;
    if (this.chunks.has(key)) {
      const v = this.chunks.get(key);
      this.chunks.delete(key);
      this.chunks.set(key, v);
      return v;
    }
    this.buildCount++;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    paintVoidChunk(cv.getContext("2d", { alpha: false }), plane, key, cx * 256, cy * 256);
    this.store(key, cv);
    return cv;
  }
  pinVoid(range) {
    for (let y = range.top; y <= range.bottom; y++)
      for (let x = range.left; x <= range.right; x++) this.pinned.add("void:" + x + ":" + y);
    this.rebudget();
  }
  chunk(world, cx, cy, sprites) {
    const background = this.background(world.data, sprites);
    const key = world.data.id + ":" + cx + ":" + cy;
    if (this.chunks.has(key)) {
      const v = this.chunks.get(key);
      this.chunks.delete(key);
      this.chunks.set(key, v);
      return v;
    }
    this.buildCount++;
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const c = cv.getContext("2d", { alpha: false });
    if (world.data.indoor) {
      c.fillStyle = "#835a3c";
      c.fillRect(0, 0, 256, 256);
      paintInteriorGround(c, world, cx * 256, cy * 256, background, this.artwork(world.data, sprites));
    } else paintOutdoorChunk(c, world, key, cx * 256, cy * 256);
    this.store(key, cv);
    return cv;
  }
}
/** Art arrives independently of terrain; cached ground never has to be repainted for a bridge. */
function drawBridges(c, world, sprites, view) {
  for (const bridge of world.data.bridges || []) {
    const [bx, by, bw, bh] = bridge.rect,
      x = bx * TILE,
      y = by * TILE,
      w = bw * TILE,
      h = bh * TILE;
    if (
      x + w < view.x ||
      x > view.x + view.width ||
      y + h < view.y ||
      y > view.y + view.height
    )
      continue;
    sprites.draw(c, bridge.sprite, x, y, w, h);
  }
}
module.exports = { Terrain, drawBridges, paintTufts, GRASS, SHOULDER, ROAD, SAND };
