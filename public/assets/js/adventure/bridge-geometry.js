"use strict";
// A surface is not a solid: it supplies dry ground over water. Fractions of the
// artwork rectangle make the same authored surface fit every stretched copy.
const FULL_SURFACE = Object.freeze([0, 0, 1, 1]);
function validWalkable(box) {
  return Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) &&
    box[0] >= 0 && box[1] >= 0 && box[2] >= 1 / 32 && box[3] >= 1 / 32 &&
    box[0] + box[2] <= 1 + 1e-9 && box[1] + box[3] <= 1 + 1e-9;
}
function bridgeWalkable(bridge) {
  const [x, y, w, h] = bridge.rect, [u, v, a, b] = bridge.walkable || FULL_SURFACE;
  return [x + u * w, y + v * h, a * w, b * h];
}
module.exports = { FULL_SURFACE, validWalkable, bridgeWalkable };
