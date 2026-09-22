"use strict";
const { TILE, actorBounds, collisionBounds, overlaps } = require("./geometry");
/** Open arches/fences can have separate feet without making their open centre solid. */
function collisionBodies(entity) {
  if (entity.fence)
    return require("./fences")
      .geometry(entity.fence)
      .bodies.map((solid) => ({ ...entity, solid, collisionSource: entity }));
  if (!entity.solids) return [entity];
  // ⛔ UNA LISTA VACÍA ES «ESTE ELEMENTO NO ESTORBA» (21-sep-2026). El Studio deja quitarle todas
  // las cajas a un elemento a propósito —una alfombra, un charco pintado— y eso tiene que poder
  // decirse. Lo que sigue siendo un error de datos es llevar cuerpo simple Y compuesto.
  if (Array.isArray(entity.solids) && !entity.solids.length) return [];
  if (
    entity.pushable ||
    entity.actor ||
    entity.neighbor ||
    entity.solid ||
    !Array.isArray(entity.solids)
  )
    throw new Error("Invalid compound body: " + entity.id);
  return entity.solids.map((solid) => {
    if (
      !Array.isArray(solid) ||
      solid.length !== 4 ||
      !solid.every(Number.isFinite) ||
      solid[2] <= 0 ||
      solid[3] <= 0
    )
      throw new Error("Invalid collision part: " + entity.id);
    return { ...entity, solid, collisionSource: entity };
  });
}
/**
 * Numeric cell key: the grid is asked on every step of every actor, and a `"x:y"` string per cell
 * per query was garbage the collector had to sweep while walking. Offsets keep negative cells
 * (bodies that hang past the edge) distinct.
 */
const cellKey = (x, y) => (y + 32768) * 65536 + (x + 32768);
/** Static bodies are indexed on refresh; moving actors stay a small live list. */
class CollisionGrid {
  constructor() {
    this.cells = new Map();
    this.bounds = new Map();
    this.seen = [];
  }
  add(entity) {
    const rect = collisionBounds(entity);
    this.bounds.set(entity, rect);
    for (let y = Math.floor(rect.y / TILE); y <= Math.floor((rect.y + rect.h) / TILE); y++)
      for (let x = Math.floor(rect.x / TILE); x <= Math.floor((rect.x + rect.w) / TILE); x++) {
        const key = cellKey(x, y),
          list = this.cells.get(key);
        if (list) list.push(entity);
        else this.cells.set(key, [entity]);
      }
  }
  remove(entity) {
    const r = this.bounds.get(entity);
    if (!r) return;
    for (let y = Math.floor(r.y / TILE); y <= Math.floor((r.y + r.h) / TILE); y++)
      for (let x = Math.floor(r.x / TILE); x <= Math.floor((r.x + r.w) / TILE); x++) {
        const key = cellKey(x, y),
          list = this.cells.get(key)?.filter((e) => e !== entity);
        if (list?.length) this.cells.set(key, list);
        else this.cells.delete(key);
      }
    this.bounds.delete(entity);
  }
  at(x, y, ignore) {
    const feet = actorBounds(x, y),
      seen = this.seen;
    seen.length = 0;
    const top = Math.floor(feet.y / TILE),
      bottom = Math.floor((feet.y + feet.h) / TILE),
      left = Math.floor(feet.x / TILE),
      right = Math.floor((feet.x + feet.w) / TILE);
    for (let gy = top; gy <= bottom; gy++)
      for (let gx = left; gx <= right; gx++) {
        const list = this.cells.get(cellKey(gx, gy));
        if (!list) continue;
        for (const entity of list) {
          if (entity === ignore || (ignore && entity.collisionSource === ignore) || seen.includes(entity)) continue;
          seen.push(entity);
          if (overlaps(feet, this.bounds.get(entity))) return entity;
        }
      }
    return null;
  }
}
module.exports = { CollisionGrid, collisionBodies };
