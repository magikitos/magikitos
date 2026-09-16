"use strict";
const { overlaps } = require("./geometry");
function bounds(object, definition) {
  let [x, y, w, h] = definition.footprint;
  if (object.rotation === 1) [x, y, w, h] = [-y - h, x, h, w];
  return { x: object.x + x, y: object.y + y, w, h };
}
const rect = ([x, y, w, h]) => ({ x, y, w, h });
function validateConstruction(items, zoneId, catalog) {
  const zone = catalog.zones[zoneId];
  if (!zone) return "unknown_zone";
  if (items.length > catalog.maxObjectsPerZone) return "zone_full";
  const occupied = [];
  for (const object of items) {
    const def = catalog.definitions[object.kind];
    if (!def) return "invalid_kind";
    if (
      !def.variants.some((v) => v.id === object.variant) ||
      !def.rotations.includes(object.rotation)
    )
      return "invalid_variant";
    if (!def.surfaces.includes(zone.surface)) return "wrong_surface";
    if (
      ![object.x, object.y].every(
        (n) =>
          Number.isFinite(n) && n >= 0 && n <= 2048 && Number.isInteger(n * 2),
      )
    )
      return "invalid_position";
    const b = bounds(object, def),
      a = rect(zone.editable);
    if (
      b.x < a.x ||
      b.y < a.y ||
      b.x + b.w > a.x + a.w ||
      b.y + b.h > a.y + a.h
    )
      return "outside_zone";
    if (zone.protected.some((r) => overlaps(b, rect(r))))
      return "protected_access";
    if (occupied.some((r) => overlaps(b, r))) return "objects_overlap";
    if (zone.terrain)
      for (let y = b.y; y <= b.y + b.h; y += 0.25)
        for (let x = b.x; x <= b.x + b.w; x += 0.25)
          if (zone.terrain[Math.floor(y)]?.[Math.floor(x)] !== "1")
            return "blocked_terrain";
    occupied.push(b);
  }
  return accessConnected(zone, occupied) ? null : "blocked_access";
}
const terrainCache = new WeakMap();
/** Dense half-tile occupancy: O(cells + stamped footprints), not a hash/string
 * flood fill testing every object at every step of every pointer movement. */
function accessConnected(zone, occupied) {
  let base = terrainCache.get(zone);
  if (!base) {
    const [x, y, w, h] = zone.editable;
    const left = x * 2, top = y * 2, columns = w * 2 + 1, rows = h * 2 + 1;
    const cells = new Uint8Array(columns * rows);
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++)
      if (zone.terrain && zone.terrain[Math.floor((top + row) / 2)]?.[Math.floor((left + col) / 2)] !== "1")
        cells[row * columns + col] = 1;
    base = { left, top, columns, rows, cells };
    terrainCache.set(zone, base);
  }
  const {left, top, columns, rows} = base, cells = base.cells.slice();
  for (const b of occupied) {
    const x0 = Math.max(0, Math.floor((b.x - .4) * 2) + 1 - left);
    const x1 = Math.min(columns - 1, Math.ceil((b.x + b.w + .4) * 2) - 1 - left);
    const y0 = Math.max(0, Math.floor((b.y - .4) * 2) + 1 - top);
    const y1 = Math.min(rows - 1, Math.ceil((b.y + b.h + .4) * 2) - 1 - top);
    for (let y = y0; y <= y1; y++) cells.fill(1, y * columns + x0, y * columns + x1 + 1);
  }
  const at = ([x,y]) => (y * 2 - top) * columns + x * 2 - left;
  const start = at(zone.access[0]);
  if (cells[start]) return false;
  const queue = new Uint32Array(cells.length);
  queue[0] = start; cells[start] = 2;
  let tail = 1;
  const enqueue = i => { if (!cells[i]) { cells[i] = 2; queue[tail++] = i; } };
  for (let head = 0; head < tail; head++) {
    const i = queue[head], x = i % columns;
    if (x) enqueue(i - 1);
    if (x + 1 < columns) enqueue(i + 1);
    if (i >= columns) enqueue(i - columns);
    if (i + columns < cells.length) enqueue(i + columns);
  }
  return zone.access.every(p => cells[at(p)] === 2);
}
module.exports = { bounds, validateConstruction };
