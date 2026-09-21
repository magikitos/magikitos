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
/** Static bodies are indexed on refresh; moving actors stay a small live list. */
class CollisionGrid {
  constructor() {
    this.cells = new Map();
    this.bounds = new Map();
  }
  add(entity) {
    const rect = collisionBounds(entity);
    this.bounds.set(entity, rect);
    for (
      let y = Math.floor(rect.y / TILE);
      y <= Math.floor((rect.y + rect.h) / TILE);
      y++
    )
      for (
        let x = Math.floor(rect.x / TILE);
        x <= Math.floor((rect.x + rect.w) / TILE);
        x++
      ) {
        const key = x + ":" + y,
          list = this.cells.get(key) || [];
        list.push(entity);
        this.cells.set(key, list);
      }
  }
  remove(entity) {
    const r = this.bounds.get(entity);
    if (!r) return;
    for (
      let y = Math.floor(r.y / TILE);
      y <= Math.floor((r.y + r.h) / TILE);
      y++
    )
      for (
        let x = Math.floor(r.x / TILE);
        x <= Math.floor((r.x + r.w) / TILE);
        x++
      ) {
        const key = x + ":" + y,
          list = this.cells.get(key)?.filter((e) => e !== entity);
        if (list?.length) this.cells.set(key, list);
        else this.cells.delete(key);
      }
    this.bounds.delete(entity);
  }
  at(x, y, ignore) {
    const feet = actorBounds(x, y),
      seen = new Set();
    for (
      let gy = Math.floor(feet.y / TILE);
      gy <= Math.floor((feet.y + feet.h) / TILE);
      gy++
    )
      for (
        let gx = Math.floor(feet.x / TILE);
        gx <= Math.floor((feet.x + feet.w) / TILE);
        gx++
      )
        for (const entity of this.cells.get(gx + ":" + gy) || []) {
          if (
            entity === ignore ||
            (ignore && entity.collisionSource === ignore) ||
            seen.has(entity)
          )
            continue;
          seen.add(entity);
          if (overlaps(feet, this.bounds.get(entity))) return entity;
        }
    return null;
  }
}
module.exports = { CollisionGrid, collisionBodies };
