"use strict";
const { TILE } = require("./geometry");

/** The perimeter and interior must stay dry, including the final partial sample. */
function placementClear(rect, test) {
  if (![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) || rect.w <= 0 || rect.h <= 0) return false;
  for (let y = rect.y; y <= rect.y + rect.h; y += Math.min(4, rect.h))
    for (let x = rect.x; x <= rect.x + rect.w; x += Math.min(4, rect.w)) if (!test(x, y)) return false;
  return test(rect.x + rect.w, rect.y) && test(rect.x, rect.y + rect.h) && test(rect.x + rect.w, rect.y + rect.h);
}
function placementProbes(rect) {
  const points = [];
  placementClear(rect, (x, y) => { points.push([x, y]); return true; });
  return points;
}

/** Shared by local pushing and the server-contract compiler; no second doorway margin. */
function entranceBounds(data) {
  const result = (data.entities || []).filter(e => e.threshold).map(e => {
    const [x, y, w, h] = e.threshold;
    return { x: (x - 0.7) * TILE, y: (y - 1) * TILE, w: (w + 1.4) * TILE, h: (h + 2) * TILE };
  });
  if (data.spawn) result.push({ x: (data.spawn.x - 0.8) * TILE, y: (data.spawn.y - 0.8) * TILE, w: 1.6 * TILE, h: 1.6 * TILE });
  return result;
}
module.exports = { placementProbes, placementClear, entranceBounds };
