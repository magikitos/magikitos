"use strict";
const { TILE, random, hash } = require("./model");
const { paintGround, paintVoid, voidWaterAt } = require("./ground");
const { chunkRange } = require("./scene-frame");
const { paintInteriorGround } = require("./interior-ground");
/** Cuántas baldosas de 256×256 (256 KB cada una) se guardan como mínimo, aunque la vista sea pequeña. */
const CHUNK_FLOOR = 24;
/**
 * El grano del suelo: 460 briznas deterministas por baldosa, las mismas en una pantalla y en el
 * hueco del plano, para que la costura no se note. `sample(x, y)` dice qué hay bajo ese píxel
 * —`null` si es agua, o uno de los materiales de abajo— y el azar avanza igual pase lo que pase,
 * que es lo que mantiene el dibujo idéntico entre partidas.
 */
const GRASS = { colors: ["#89a364", "#5c7c48"], grass: true, shoulder: false },
  SHOULDER = { ...GRASS, shoulder: true },
  ROAD = { colors: ["#b7a877", "#d4c795"], grass: false, shoulder: false },
  SAND = { colors: ["#c4bb8d", "#e2d4aa"], grass: false, shoulder: false };
function paintTufts(c, rand, sample) {
  for (let i = 0; i < 460; i++) {
    const x = Math.floor(rand() * 256),
      y = Math.floor(rand() * 256),
      blade = sample(x, y);
    if (!blade) {
      if (i % 10 === 0) rand(); // Preserve deterministic land decoration sequence.
      continue;
    }
    c.fillStyle = blade.colors[rand() < 0.5 ? 0 : 1];
    c.fillRect(x, y, 1 + Math.floor(rand() * 2), 1);
    if (blade.grass && (i % 11 === 0 || (blade.shoulder && i % 3 === 0))) {
      c.fillRect(x + 1, y - 2, 1, 3);
      c.fillRect(x + 2, y - 1, 1, 1);
    }
    if (blade.grass && i % 113 === 0) {
      c.fillStyle = "#e0c87d";
      c.fillRect(x, y - 2, 2, 2);
    }
  }
}
/** Static, deterministic ground painter. Bounded native-pixel chunks shared by all scenes. */
class Terrain {
  constructor() {
    this.chunks = new Map();
    this.pinned = new Set();
    this.buildCount = 0;
    this.contexts = new Map();
    this.sceneContexts = new Map();
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
  /** Un claro con caminos nuevos hay que repintarlo: las baldosas se cachean por escena. */
  invalidate(sceneId) {
    for (const key of [...this.chunks.keys()])
      if (key.startsWith(sceneId + ":")) this.chunks.delete(key);
  }
  prune() {
    for (const key of this.chunks.keys()) {
      if (this.chunks.size <= (this.budget || CHUNK_FLOOR)) break;
      if (!this.pinned.has(key)) this.chunks.delete(key);
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
    const c = cv.getContext("2d", { alpha: false });
    const ox = cx * 256,
      oy = cy * 256;
    paintVoid(c, plane, ox, oy);
    paintTufts(c, random(hash(key)), (x, y) =>
      voidWaterAt(plane, ox + x, oy + y) ? null : GRASS,
    );
    this.chunks.set(key, cv);
    this.prune();
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
    const rand = random(hash(key));
    const ox = cx * 256,
      oy = cy * 256;
    c.fillStyle = world.data.indoor
      ? "#835a3c"
      : world.data.baseWater
        ? "#5b9f9a"
        : "#547c4c";
    c.fillRect(0, 0, 256, 256);
    if (world.data.indoor) {
      paintInteriorGround(c, world, ox, oy, background, this.artwork(world.data, sprites));
    } else {
      paintGround(c, world, ox, oy);
      for (const region of world.data.regions)
        if (region.ground === "stone") {
          const [rx, ry, rw, rh] = region.rect;
          c.save();
          c.beginPath();
          c.rect(rx * TILE - ox, ry * TILE - oy, rw * TILE, rh * TILE);
          c.clip();
          c.fillStyle = "#82907a";
          c.fillRect(0, 0, 256, 256);
          for (let y = 0; y < 256; y += 8)
            for (let x = y % 16 ? -6 : 0; x < 256; x += 12) {
              c.fillStyle = ["#a4aa88", "#a0a686", "#959f81"][
                Math.floor(rand() * 3)
              ];
              c.fillRect(x, y, 11, 7);
              c.fillStyle = "#b5b598";
              c.fillRect(x + 1, y, 9, 1);
            }
          c.restore();
        }
      paintTufts(c, rand, (x, y) => {
        const tx = (ox + x) / TILE,
          ty = (oy + y) / TILE;
        if (world.waterAt(tx, ty)) return null;
        // La arena manda sobre el camino: una playa con sendero sigue siendo playa.
        if (
          world.data.baseWater &&
          (world.data.islands || []).every(
            (p) =>
              ((tx - p.x) / (p.rx - 2.5)) ** 2 +
                ((ty - p.y) / (p.ry - 2.5)) ** 2 >=
              1,
          )
        )
          return SAND;
        const pathDistance = world.pathDistance(tx, ty);
        if (pathDistance < 1) return ROAD;
        // Sparse grass tips at the path shoulder; no bright patches over the earth.
        return pathDistance < 1.6 ? SHOULDER : GRASS;
      });
    }
    this.chunks.set(key, cv);
    this.prune();
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
