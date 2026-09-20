"use strict";
const { transformedRect } = require("./entity-art");
const { riverSection, riverEnvelope } = require("./river-course");
const TILE = 16;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function random(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(text) {
  let value = 2166136261;
  for (const c of String(text))
    value = Math.imul(value ^ c.charCodeAt(0), 16777619);
  return value >>> 0;
}
function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = clamp(
    ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1),
    0,
    1,
  );
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
function inRect(x, y, [rx, ry, w, h]) {
  return x >= rx && y >= ry && x < rx + w && y < ry + h;
}
function overlaps(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
function collisionBounds(entity) {
  if (entity.neighbor || entity.actor) return actorBounds(entity.x, entity.y);
  const source = entity.solid || [-0.4, -0.5, 0.8, 0.7];
  const box = transformedRect(entity, {
    x: source[0],
    y: source[1],
    w: source[2],
    h: source[3],
  });
  return {
    x: entity.x + box.x * TILE,
    y: entity.y + box.y * TILE,
    w: box.w * TILE,
    h: box.h * TILE,
  };
}
function insideThreshold(entity, point) {
  if (!entity.threshold) return false;
  const [x, y, w, h] = entity.threshold;
  return (
    point.x >= x * TILE &&
    point.x <= (x + w) * TILE &&
    point.y >= y * TILE &&
    point.y <= (y + h) * TILE
  );
}
function spriteBounds(frame, point) {
  return {
    x: point.x - frame.anchor[0],
    y: point.y - frame.anchor[1],
    w: frame.w,
    h: frame.h,
  };
}

/** Actor foot envelope in native pixels. All movement and actor contacts use this. */
const FOOTPRINT = Object.freeze({
  halfWidth: 6,
  halfHeight: 5,
  shoreMargin: 2,
});
function actorBounds(x, y) {
  return {
    x: x - FOOTPRINT.halfWidth,
    y: y - FOOTPRINT.halfHeight,
    w: FOOTPRINT.halfWidth * 2,
    h: FOOTPRINT.halfHeight * 2,
  };
}
/**
 * ⛔ YA NO HAY COSTAS DE UN SOLO LADO (20-sep-2026). El océano de la pradera era una línea `coasts`
 * con agua hasta el infinito por el este; con la rejilla pasó a ser el lago, un `rivers` de dos
 * orillas cerrado por el este y por el sur. Toda el agua abierta se describe con `rivers` (orillas
 * autoradas con Hermite monótona, `sway` opcional) y `waters` (elipses): un solo camino para la
 * física, la pintura y la máscara del servidor.
 */
function waterAt(data, x, y) {
  if ((data.bridges || []).some((b) => inRect(x, y, b.rect))) return false;
  if (
    (data.rivers || []).some((r) => {
      if (y < r.rect[1] || y >= r.rect[1] + r.rect[3]) return false;
      const banks = riverSection(r, y);
      return x >= banks.left && x < banks.right;
    })
  )
    return true;
  if (
    data.baseWater &&
    !(data.islands || []).some(
      (p) => ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 < 1,
    )
  )
    return true;
  return data.waters.some(
    (p) => ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 < 1,
  );
}
// Sample the entire boot perimeter, not the tile centre: curved shores must stay dry too.
const SHORE_PROBES = [];
const sx = FOOTPRINT.halfWidth + FOOTPRINT.shoreMargin,
  sy = FOOTPRINT.halfHeight + FOOTPRINT.shoreMargin;
for (let x = -sx; x <= sx; x += 2) SHORE_PROBES.push([x, -sy], [x, sy]);
for (let y = -sy + 2; y < sy; y += 2) SHORE_PROBES.push([-sx, y], [sx, y]);
/** Conservative broad phase. Skip shoreline probes only when the whole foot rectangle is dry. */
function waterNearby(data, x, y) {
  const left = (x - sx) / TILE,
    right = (x + sx) / TILE,
    top = (y - sy) / TILE,
    bottom = (y + sy) / TILE;
  if (
    data.baseWater &&
    !(data.islands || []).some((p) =>
      [
        [left, top],
        [right, top],
        [left, bottom],
        [right, bottom],
      ].every(
        ([px, py]) => ((px - p.x) / p.rx) ** 2 + ((py - p.y) / p.ry) ** 2 < 1,
      ),
    )
  )
    return true;
  for (const r of data.rivers || []) {
    const [, ry, , rh] = r.rect,
      banks = riverEnvelope(r);
    if (
      right >= banks.left &&
      left <= banks.right &&
      bottom >= ry &&
      top <= ry + rh
    )
      return true;
  }
  return data.waters.some((p) => {
    const nx = clamp(p.x, left, right),
      ny = clamp(p.y, top, bottom);
    return ((nx - p.x) / p.rx) ** 2 + ((ny - p.y) / p.ry) ** 2 <= 1;
  });
}
function dryFootprint(data, x, y) {
  if (!waterNearby(data, x, y)) return true;
  return SHORE_PROBES.every(
    ([dx, dy]) => !waterAt(data, (x + dx) / TILE, (y + dy) / TILE),
  );
}
module.exports = {
  TILE,
  clamp,
  distance,
  random,
  hash,
  segmentDistance,
  inRect,
  overlaps,
  collisionBounds,
  spriteBounds,
  insideThreshold,
  FOOTPRINT,
  actorBounds,
  waterAt,
  dryFootprint,
};
