"use strict";
const geometry = require("./geometry");
const {
  TILE,
  clamp,
  distance,
  segmentDistance,
  collisionBounds,
  actorBounds,
  overlaps,
  FOOTPRINT,
  dryFootprint,
  waterAt,
} = geometry;
const { matches, active } = require("./rules");
const { CollisionGrid, collisionBodies } = require("./collision-grid");
const { resolveAppearance } = require("./elements");
const { restorePositions } = require("./movables");
const room = require("./room-shape");
const { populate } = require("./placement");
const { findPath } = require("./navigation");
const { resolveSceneAnchors } = require("./scene-anchors");
/**
 * Las bandas por las que una pantalla se abre a sus vecinas, una por salida de borde: qué borde,
 * qué tramo de ese borde (en casillas) y por qué modos se cruza. Es geometría de los DATOS, sin
 * mundo vecino delante: sirve igual para abrir el marco, para dar por continuada la banda cuando
 * la vecina aún no está en memoria y para decidir por dónde se dispara el cruce.
 */
function seamBands(data) {
  const w = data.width,
    h = data.height;
  return (data.navigation?.exits || []).map((exit) => {
    const [ax, ay, aw, ah] = exit.area,
      vertical = exit.direction === "up" || exit.direction === "down";
    const from = Math.max(0, Math.floor(vertical ? ax : ay)),
      to = Math.min(vertical ? w : h, Math.ceil(vertical ? ax + aw : ay + ah));
    const modes = new Set(exit.mode === "both" ? ["foot", "boat"] : [exit.mode || "boat"]);
    return {
      exit,
      edge: exit.direction,
      from,
      to,
      modes,
      /** Las casillas del marco (dos de fondo) que caen dentro de la banda. */
      borderTiles(width, height) {
        const tiles = [];
        for (let a = from; a < to; a++)
          for (let d = 0; d < 2; d++)
            tiles.push(
              vertical
                ? [a, exit.direction === "up" ? d : height - 1 - d]
                : [exit.direction === "left" ? d : width - 1 - d, a],
            );
        return tiles;
      },
      /** Si una casilla que queda FUERA de la pantalla es la continuación de esta banda. */
      beyond(tx, ty) {
        const along = vertical ? tx : ty,
          depth =
            exit.direction === "up" ? -ty - 1
            : exit.direction === "down" ? ty - h
            : exit.direction === "left" ? -tx - 1
            : tx - w;
        return along >= from && along < to && depth >= 0 && depth < 2;
      },
    };
  });
}
/**
 * ⛔ EL SUELO PISABLE SE CALCULA UNA VEZ POR PANTALLA (21-sep-2026, medido en Chrome). Son 27.648
 * casillas y cada una pregunta treinta veces si hay agua bajo los pies: 48 ms de reloj en la
 * pradera, 25 en las raíces. Y se rehacía ENTERO en cada llegada, porque la caché de mundos no
 * vale en las pantallas con obra de la comunidad —cuatro de las cinco de fuera—, así que entrar a
 * la pradera costaba dos o tres fotogramas perdidos, siempre, y en un teléfono un cuarto de
 * segundo. Lo que decide este mapa es el marco, las bandas de las costuras, el contorno de un
 * interior y el agua; NI las entidades NI los caminos, que van por `occupancy`. Así que la clave
 * es exactamente eso: si cambia una orilla, se recalcula solo; si llega otro duende, no.
 */
const TERRAIN_FIELDS = [
  "id",
  "width",
  "height",
  "rivers",
  "waters",
  "islands",
  "bridges",
  "interior",
  "indoor",
  "baseWater",
  "navigation",
];
const TERRAIN_GRIDS = 16;
const terrainGrids = new Map();
const terrainKey = (data) =>
  JSON.stringify(TERRAIN_FIELDS.map((field) => data[field] ?? null));
class World {
  constructor(data) {
    data = resolveSceneAnchors(data);
    this.data = data;
    this.width = data.width;
    this.height = data.height;
    this.entities = data.entities.map(e => this.createEntity(e));
    this.architecture = (data.walls || []).map((wall, i) => ({
      id: "wall-" + i,
      x: wall.rect[0] * TILE,
      y: wall.rect[1] * TILE,
      solid: [0, 0, wall.rect[2], wall.rect[3]],
      rules: [],
      wall,
      depth: (wall.rect[1] + wall.rect[3]) * TILE,
    }));
    this.props = [];
    this.blocked = new Uint8Array(this.width * this.height);
    this.segments = [];
    for (const path of data.paths)
      for (let i = 1; i < path.length; i++)
        this.segments.push([path[i - 1], path[i]]);
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        this.blocked[y * this.width + x] = Number(
          x < 2 || y < 2 || x >= this.width - 2 || y >= this.height - 2,
        );
      }
    const boundaries = this.blocked.slice();
    populate(this);
    // Vegetation occupancy guides procedural placement, but is not terrain.
    // Its exact physical bodies enter the shared collision index below.
    this.blocked = boundaries;
    this.terrain = boundaries.slice();
    /**
     * ⛔ LAS COSTURAS SE ABREN (19-sep-2026, mundo continuo). El marco de dos casillas que cierra
     * cada pantalla se queda cerrado en todo el borde MENOS en la banda de cada salida a pie: por
     * ahí se sigue andando hasta la pantalla de al lado sin muro invisible. Se abre DESPUÉS de
     * repartir la vegetación, que respeta el marco cerrado: así en la banda no nace un arbusto
     * que la tape. Lo que hay más allá del borde lo contesta `terrainWalkable` preguntando a la
     * vecina enlazada, o dando por hecho que la banda continúa mientras no lo esté.
     */
    this.seams = [];
    this.bands = seamBands(data);
    for (const band of this.bands)
      if (band.modes.has("foot"))
        for (const [x, y] of band.borderTiles(this.width, this.height)) {
          this.blocked[y * this.width + x] = 0;
          this.terrain[y * this.width + x] = 0;
        }
    // Static navigation is built once. Picking up a leaf only refreshes entity occupancy.
    const key = terrainKey(data),
      cached = terrainGrids.get(key);
    if (cached) this.blocked.set(cached);
    else {
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < this.width; x++)
          if (!this.terrainCanStand((x + 0.5) * TILE, (y + 0.5) * TILE))
            this.setBlocked(x, y);
      terrainGrids.set(key, this.blocked.slice());
      if (terrainGrids.size > TERRAIN_GRIDS)
        terrainGrids.delete(terrainGrids.keys().next().value);
    }
    this.navigationTerrain = this.blocked.slice();
    this.refresh({ flags: {}, inventory: {} });
  }
  createEntity(definition) {
    const e = resolveAppearance(definition, this.data.id);
    return { ...e, x: e.x * TILE, y: e.y * TILE,
      ...(e.pushable ? { homePosition: { x: e.x * TILE, y: e.y * TILE } } : {}) };
  }
  /** Replace only a changed entity layer. Terrain, actors and all other references stay live.
   * Compound bodies (including fence segments) belong to their source entity. */
  replaceEntities(removed, added) {
    if (!removed.size && !added.length) return;
    for (const body of [...this.colliders])
      if (removed.has(body.collisionSource || body)) this.setBody(body, false);
    this.entities = this.entities.filter(e => !removed.has(e)).concat(added);
    for (const entity of added) for (const body of collisionBodies(entity))
      if (body.solid && active(body, this.state) && (!body.solidWhen || matches(this.state, body.solidWhen)))
        this.setBody(body, true);
    this.colliders = [...this.colliders]; // Invalidate consumers caching static vision blockers.
  }
  region(x, y) {
    return (
      this.data.regions.find(
        (r) =>
          x >= r.rect[0] &&
          y >= r.rect[1] &&
          x < r.rect[0] + r.rect[2] &&
          y < r.rect[1] + r.rect[3],
      )?.id || (this.data.indoor ? this.data.id : "forest")
    );
  }
  waterAt(x, y) {
    return waterAt(this.data, x, y);
  }
  pathDistance(x, y) {
    let best = Infinity;
    for (const [a, b] of this.segments)
      best = Math.min(best, segmentDistance(x, y, a, b));
    return best;
  }
  setBlocked(x, y) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height)
      this.blocked[y * this.width + x] = 1;
  }
  walkable(x, y) {
    return (
      x >= 0 &&
      y >= 0 &&
      x < this.width &&
      y < this.height &&
      !this.blocked[y * this.width + x]
    );
  }
  canStand(x, y, ignore = null) {
    return this.terrainCanStand(x, y) && !this.collisionAt(x, y, ignore);
  }
  terrainCanStand(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const { halfWidth: hw, halfHeight: hh } = FOOTPRINT;
    return (
      [
        [-hw, -hh],
        [hw, -hh],
        [-hw, hh],
        [hw, hh],
      ].every(([dx, dy]) =>
        this.terrainWalkable(
          Math.floor((x + dx) / TILE),
          Math.floor((y + dy) / TILE),
        ),
      ) &&
      [
        [-hw, -hh],
        [hw, -hh],
        [-hw, hh],
        [hw, hh],
      ].every(([dx, dy]) => room.contains(this.data, x + dx, y + dy)) &&
      dryFootprint(this.data, x, y)
    );
  }
  refresh(state) {
    this.state = state;
    restorePositions(this, state);
    this.blocked = this.navigationTerrain.slice();
    this.occupancy = new Uint16Array(this.blocked.length);
    this.collisionGrid = new CollisionGrid();
    this.colliders = [
      ...this.architecture,
      ...this.props,
      ...this.entities,
    ].flatMap(collisionBodies).filter(
      (e) =>
        e.solid &&
        active(e, state) &&
        (!e.solidWhen || matches(state, e.solidWhen)),
    );
    for (const entity of this.colliders) {
      this.collisionGrid.add(entity);
      this.markBody(entity, 1);
    }
  }
  markBody(entity, delta) {
    const r = collisionBounds(entity);
    for (
      let y = Math.max(0, Math.floor(r.y / TILE));
      y < Math.min(this.height, (r.y + r.h) / TILE);
      y++
    )
      for (
        let x = Math.max(0, Math.floor(r.x / TILE));
        x < Math.min(this.width, (r.x + r.w) / TILE);
        x++
      ) {
        const i = y * this.width + x;
        this.occupancy[i] += delta;
        this.blocked[i] = Number(
          this.navigationTerrain[i] || this.occupancy[i] > 0,
        );
      }
  }
  relocate(entity, x, y) {
    if (!this.collisionGrid.bounds.has(entity)) {
      entity.x = x;
      entity.y = y;
      return;
    }
    this.markBody(entity, -1);
    this.collisionGrid.remove(entity);
    entity.x = x;
    entity.y = y;
    this.markBody(entity, 1);
    this.collisionGrid.add(entity);
  }
  /** Incremental activation of a single movable body, without rebuilding static scenery. */
  setBody(entity, enabled) {
    const present = this.collisionGrid.bounds.has(entity);
    if (present === enabled) return;
    if (enabled) {
      this.colliders.push(entity); this.collisionGrid.add(entity); this.markBody(entity, 1);
    } else {
      this.markBody(entity, -1); this.collisionGrid.remove(entity);
      const i = this.colliders.indexOf(entity); if (i !== -1) this.colliders.splice(i, 1);
    }
  }
  terrainWalkable(x, y) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height)
      return !this.terrain[y * this.width + x];
    // ⛔ MÁS ALLÁ DEL BORDE SIGUE EL BOSQUE (mundo continuo). Una casilla fuera de la pantalla se le
    // pregunta a la vecina enlazada en sus propias coordenadas; sin vecina en memoria, la banda de
    // la costura se da por continuada y el resto del borde sigue siendo pared.
    const seam = this.seamFor(x, y);
    if (seam) return seam.world.terrainWalkable(x - seam.dx, y - seam.dy);
    return this.bands.some((band) => band.beyond(x, y));
  }
  /**
   * Enlaza esta pantalla con las vecinas del plano que están en memoria (`scenes.link`): cada
   * costura trae la vecina y su desplazamiento en casillas. Desde aquí colisiones y agua se
   * consultan a través del borde, y el renderizador sabe qué pintar al lado.
   */
  link(seams) {
    this.seams = seams;
  }
  /** La costura cuya vecina contiene una casilla exterior a esta pantalla, o null. */
  seamFor(tx, ty) {
    for (const seam of this.seams) {
      const lx = tx - seam.dx,
        ly = ty - seam.dy;
      if (lx >= 0 && ly >= 0 && lx < seam.world.width && ly < seam.world.height) return seam;
    }
    return null;
  }
  /** Un punto en píxeles que cae fuera de esta pantalla, traducido a la vecina que lo contiene. */
  beyond(point) {
    const seam = this.seamFor(Math.floor(point.x / TILE), Math.floor(point.y / TILE));
    return seam
      ? { seam, world: seam.world, x: point.x - seam.dx * TILE, y: point.y - seam.dy * TILE }
      : null;
  }
  /** Si hay agua en una casilla que queda fuera de la pantalla: la vecina lo sabe; sin ella, la banda de barca continúa. */
  waterBeyond(tx, ty) {
    const seam = this.seamFor(Math.floor(tx), Math.floor(ty));
    if (seam) return seam.world.waterAt(tx - seam.dx, ty - seam.dy);
    return this.bands.some((band) => band.modes.has("boat") && band.beyond(Math.floor(tx), Math.floor(ty)));
  }
  /**
   * Quién te para aquí: lo que está clavado en el suelo (la rejilla) y quien está VIVO en la
   * escena (`actors`: tú, los vecinos y los animales).
   *
   * ⛔ DOS EXCEPCIONES, Y LAS DOS TIENEN NOMBRE. `passable` es de quien no debe estorbarte
   * ahora mismo aunque tenga cuerpo — el gato que acaba de soltarte y está a tu lado, que si no
   * te dejaría encajado. Y los ANIMALES se cruzan entre ellos: dos gatos que patrullan rutas que
   * se tocan acabarían empujándose contra la valla, y un gato atascado se ve peor que dos gatos
   * que se cruzan. Contra ti no se cruza ninguno, que es lo que importa.
   */
  collisionAt(x, y, ignore = null) {
    return (
      this.collisionGrid.at(x, y, ignore) ||
      (this.actors || []).find(
        (e) =>
          e !== ignore &&
          !e.passable &&
          !(e.animal && ignore?.animal) &&
          overlaps(actorBounds(x, y), collisionBounds(e)),
      ) ||
      this.collisionBeyond(x, y, ignore) ||
      null
    );
  }
  /**
   * Un cuerpo de la pantalla de al lado pegado a la costura también te para: el banco que alguien
   * dejó en su primera fila es un banco aunque tú estés todavía en la última de la tuya. Solo se
   * pregunta a menos de dos casillas del borde, que es hasta donde llegan los pies.
   */
  collisionBeyond(x, y, ignore) {
    if (!this.seams.length) return null;
    const near = 2 * TILE;
    if (
      x >= near &&
      y >= near &&
      x < this.width * TILE - near &&
      y < this.height * TILE - near
    )
      return null;
    for (const seam of this.seams) {
      const lx = x - seam.dx * TILE,
        ly = y - seam.dy * TILE,
        w = seam.world.width * TILE,
        h = seam.world.height * TILE;
      if (lx < -near || ly < -near || lx >= w + near || ly >= h + near) continue;
      const hit =
        seam.world.collisionGrid.at(lx, ly, ignore) ||
        (seam.world.actors || []).find(
          (e) =>
            e !== ignore &&
            !e.passable &&
            !(e.animal && ignore?.animal) &&
            overlaps(actorBounds(lx, ly), collisionBounds(e)),
        );
      if (hit) return hit;
    }
    return null;
  }
  distanceTo(point, entity) {
    const r = collisionBounds(entity);
    return Math.hypot(
      point.x - clamp(point.x, r.x, r.x + r.w),
      point.y - clamp(point.y, r.y, r.y + r.h),
    );
  }
  path(from, target) {
    return findPath(this, from, target);
  }
  approach(from, target, radius = 3, minDistance = 0) {
    const candidates = [],
      tx = Math.floor(target.x / TILE),
      ty = Math.floor(target.y / TILE);
    for (let y = ty - radius; y <= ty + radius; y++)
      for (let x = tx - radius; x <= tx + radius; x++)
        if (this.walkable(x, y)) {
          const point = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
          if (
            this.canStand(point.x, point.y, from) &&
            (target.solid || target.neighbor
              ? this.distanceTo(point, target) >= 4 &&
                this.distanceTo(point, target) < TILE * 1.5
              : distance(point, target) >= minDistance)
          )
            candidates.push(point);
        }
    candidates.sort(
      (a, b) =>
        distance(a, target) - distance(b, target) ||
        distance(a, from) - distance(b, from),
    );
    for (const point of candidates) {
      const path = this.path(from, point);
      if (path) return path;
    }
    return null;
  }
  clearSegment(from, to, ignore = from) {
    const dx = to.x - from.x,
      dy = to.y - from.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
    for (let i = 1; i <= steps; i++)
      if (
        !this.canStand(
          from.x + (dx * i) / steps,
          from.y + (dy * i) / steps,
          ignore,
        )
      )
        return false;
    return true;
  }
}
module.exports = { World, ...geometry };
