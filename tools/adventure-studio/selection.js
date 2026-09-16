"use strict";
const key = (p) => p.layer + "/" + (p.id ?? p.e.id);
const identifies = (p) => ({ id: p.e?.id ?? p.id, layer: p.layer });
function members(elements, selection, linked = false) {
  const keys = new Set(selection.map(key));
  const chosen = elements.filter((p) => keys.has(key(p)));
  return elements.filter(
    (p) =>
      keys.has(key(p)) ||
      (linked &&
        chosen.some((q) => Math.hypot(q.e.x - p.e.x, q.e.y - p.e.y) < 1)),
  );
}
/** Clamp a translation once for the whole group, never distort its spacing. */
function translation(rows, dx, dy, scene) {
  const points = rows.flatMap((p) =>
    p.fence ? p.fence.points.map(([x, y]) => ({ x: p.x + x, y: p.y + y })) : p,
  );
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  return {
    x: Math.max(
      -Math.min(...xs),
      Math.min(scene.width - 0.0625 - Math.max(...xs), dx),
    ),
    y: Math.max(
      -Math.min(...ys),
      Math.min(scene.height - 0.0625 - Math.max(...ys), dy),
    ),
  };
}
module.exports = { key, identifies, members, translation };
