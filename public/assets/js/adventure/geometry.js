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
 * ⛔ LA COSTA ES UNA ORILLA, NO UNA REGLA (20-sep-2026, decisión del dueño: «cierra el océano
 * como en diagonal y queda una línea cortante rara sin orillita de río como todas las demás»).
 * Antes cada tramo entre dos puntos autorados era una S de `smoothstep` con la tangente vertical
 * en los extremos, así que la línea iba a tirones: vertical en cada punto y recta en diagonal en
 * medio. Ahora pasa por los mismos puntos con la MISMA interpolación de Hermite monótona que las
 * orillas de los ríos (`river-course.js`), sin rebasar ningún punto, y le suma un vaivén suave de
 * un tercio de casilla que se apaga en los dos extremos para que la boca del río de al lado siga
 * encajando en la costura. Física, pintura y máscara del servidor leen esta misma función.
 */
const coastCourses = new WeakMap();
const COAST_SWAY = 0.34;
function coastCourse(coast) {
  if (coastCourses.has(coast)) return coastCourses.get(coast);
  const points = coast.points;
  const slopes = points.map((p, i) => {
    if (!i || i === points.length - 1) return 0;
    const a = (p[0] - points[i - 1][0]) / (p[1] - points[i - 1][1]);
    const b = (points[i + 1][0] - p[0]) / (points[i + 1][1] - p[1]);
    return a * b > 0 ? (2 * a * b) / (a + b) : 0;
  });
  const course = { points, slopes, top: points[0][1], bottom: points.at(-1)[1] };
  coastCourses.set(coast, course);
  return course;
}
function coastSway(course, y) {
  const fade = Math.max(0, Math.min(1, (y - course.top) / 4, (course.bottom - y) / 4));
  return fade * COAST_SWAY * (Math.sin(y * 0.9 + 1.3) * 0.6 + Math.sin(y * 2.3) * 0.4);
}
function coastX(coast, y) {
  const course = coastCourse(coast),
    { points, slopes } = course;
  if (y <= points[0][1]) return points[0][0];
  if (y >= points.at(-1)[1]) return points.at(-1)[0];
  let i = 1;
  while (i < points.length - 1 && y > points[i][1]) i++;
  const a = points[i - 1],
    b = points[i],
    h = b[1] - a[1],
    t = (y - a[1]) / h,
    t2 = t * t,
    t3 = t2 * t;
  const x =
    (2 * t3 - 3 * t2 + 1) * a[0] +
    (t3 - 2 * t2 + t) * h * slopes[i - 1] +
    (-2 * t3 + 3 * t2) * b[0] +
    (t3 - t2) * h * slopes[i];
  return x + coastSway(course, y);
}
function waterAt(data, x, y) {
  if ((data.bridges || []).some((b) => inRect(x, y, b.rect))) return false;
  if (
    (data.coasts || []).some((c) =>
      c.side === "west" ? x <= coastX(c, y) : x >= coastX(c, y),
    )
  )
    return true;
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
  for (const coast of data.coasts || []) {
    // La envolvente lleva el vaivén de la orilla: la curva pasa por los puntos, pero se mece.
    let min = Math.min(coastX(coast, top), coastX(coast, bottom)) - COAST_SWAY;
    let max = Math.max(coastX(coast, top), coastX(coast, bottom)) + COAST_SWAY;
    for (const [cx, cy] of coast.points)
      if (cy > top && cy < bottom) {
        min = Math.min(min, cx - COAST_SWAY);
        max = Math.max(max, cx + COAST_SWAY);
      }
    if (coast.side === "west" ? left <= max : right >= min) return true;
  }
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
  coastX,
  waterAt,
  dryFootprint,
};
