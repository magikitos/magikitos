"use strict";
const { inRect, overlaps } = require("./geometry");
const rectangle = ([x, y, w, h]) => ({ x, y, w, h });
const fields = new Set(["id", "kind", "variant", "space", "x", "y"]);
/** Pure placement rules, shared by the player editor, Studio preview and fixtures. */
function placementBounds(item, catalog) {
  const kind = catalog.stock[item.kind];
  const [dx, dy, w, h] = kind.solid || [-0.5, -0.5, 1, 1];
  return {
    x: item.x + dx * kind.scale,
    y: item.y + dy * kind.scale,
    w: w * kind.scale,
    h: h * kind.scale,
  };
}
function validateLayout(layout, catalog) {
  if (
    !layout ||
    Object.keys(layout).some((k) => k !== "objects") ||
    !Array.isArray(layout.objects) ||
    layout.objects.length > catalog.maxObjects
  )
    throw new Error("invalid_layout");
  const ids = new Set(),
    counts = {},
    occupied = [];
  for (const item of layout.objects) {
    if (
      !item ||
      Object.keys(item).some((k) => !fields.has(k)) ||
      typeof item.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,48}$/.test(item.id) ||
      ids.has(item.id)
    )
      throw new Error("invalid_object");
    ids.add(item.id);
    const kind =
      Object.hasOwn(catalog.stock, item.kind) && catalog.stock[item.kind];
    const space = catalog.spaces[item.space];
    if (
      !kind ||
      !space ||
      !kind.spaces.includes(item.space) ||
      !kind.variants.some((v) => v.id === item.variant)
    )
      throw new Error("invalid_kind");
    counts[item.kind] = (counts[item.kind] || 0) + 1;
    if (counts[item.kind] > kind.count) throw new Error("stock_exceeded");
    if (
      ![item.x, item.y].every(
        (n) =>
          Number.isFinite(n) &&
          n / catalog.grid === Math.round(n / catalog.grid),
      )
    )
      throw new Error("invalid_position");
    const b = placementBounds(item, catalog),
      [x, y, w, h] = space.editable;
    if (b.x < x || b.y < y || b.x + b.w > x + w || b.y + b.h > y + h)
      throw new Error("outside_plot");
    if (space.protected.some((r) => overlaps(b, rectangle(r))))
      throw new Error("protected_access");
    if (kind.solid) {
      if (occupied.some((o) => o.space === item.space && overlaps(b, o.bounds)))
        throw new Error("objects_overlap");
      occupied.push({ space: item.space, bounds: b });
    }
  }
  // Preserve navigable access even when individually legal furniture forms a closed ring.
  for (const [id, space] of Object.entries(catalog.spaces)) {
    const blockers = occupied
      .filter((o) => o.space === id)
      .map((o) => o.bounds);
    const clear = (x, y) =>
      inRect(x, y, space.editable) &&
      !blockers.some((b) =>
        overlaps({ x: x - 0.5, y: y - 0.5, w: 1, h: 1 }, b),
      );
    const [start, end] = space.access,
      queue = [start],
      seen = new Set([start.join(",")]);
    if (!clear(...start) || !clear(...end)) throw new Error("blocked_access");
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy,
          key = `${nx},${ny}`;
        if (!seen.has(key) && clear(nx, ny)) {
          seen.add(key);
          queue.push([nx, ny]);
        }
      }
    }
    if (!seen.has(end.join(","))) throw new Error("blocked_access");
  }
  return JSON.parse(JSON.stringify(layout));
}
module.exports = { placementBounds, validateLayout };
