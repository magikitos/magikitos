"use strict";
const cache = new WeakMap();
function curve(points) {
  if (cache.has(points)) return cache.get(points);
  const samples = [], n = points.length;
  let distance = 0;
  for (let i = 0; i < n; i++) {
    const a = points[(i + n - 1) % n], b = points[i], c = points[(i + 1) % n], d = points[(i + 2) % n];
    for (let step = 0; step < 12; step++) {
      const t = step / 12, t2 = t * t, t3 = t2 * t;
      const p = [0, 1].map(k => .5 * (2 * b[k] + (-a[k] + c[k]) * t +
        (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3));
      if (samples.length) distance += Math.hypot(p[0] - samples.at(-1).x, p[1] - samples.at(-1).y);
      samples.push({ x: p[0], y: p[1], distance });
    }
  }
  distance += Math.hypot(samples[0].x - samples.at(-1).x, samples[0].y - samples.at(-1).y);
  samples.push({ ...samples[0], distance });
  const result = { samples, length: distance };
  cache.set(points, result);
  return result;
}
function journeyAt(journey, distance) {
  const { samples, length } = curve(journey.points);
  const at = ((distance % length) + length) % length;
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].distance <= at) lo = mid; else hi = mid;
  }
  const a = samples[lo], b = samples[hi], t = (at - a.distance) / (b.distance - a.distance);
  return { x: a.x + (b.x - a.x) * t - journey.origin.x,
    y: a.y + (b.y - a.y) * t - journey.origin.y, dx: b.x - a.x, dy: b.y - a.y };
}
module.exports = { journeyAt, journeyLength: journey => curve(journey.points).length };
