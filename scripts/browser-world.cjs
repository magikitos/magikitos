"use strict";
const assert = require("node:assert/strict");
const { World, TILE } = require("../public/assets/js/adventure/model");

/** Test fixtures follow authored anchors instead of retaining stale map coordinates. */
function nearbyPosition(data, state, id) {
  const world = new World(data);
  world.refresh({ flags: {}, inventory: {}, ...state });
  const entity = world.entities.find((e) => e.id === id);
  assert(entity, "Existing test anchor: " + id);
  for (const [dx, dy] of [
    [0, 3],
    [2, 3],
    [-2, 3],
    [0, 4],
    [3, 0],
    [-3, 0],
  ]) {
    const point = { x: entity.x + dx * TILE, y: entity.y + dy * TILE };
    if (world.canStand(point.x, point.y)) return point;
  }
  throw new Error("No safe test approach to " + id);
}
module.exports = { nearbyPosition };
