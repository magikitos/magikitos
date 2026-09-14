"use strict";
const { TILE, actorBounds, collisionBounds, overlaps } = require("./geometry");
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
          if (entity === ignore || seen.has(entity)) continue;
          seen.add(entity);
          if (overlaps(feet, this.bounds.get(entity))) return entity;
        }
    return null;
  }
}
module.exports = { CollisionGrid };
