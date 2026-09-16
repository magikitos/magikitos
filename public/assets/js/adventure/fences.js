"use strict";
/** Fence polylines use tile-relative vertices; posts remain upright at every angle. */
const TILE = 16,
  cache = new WeakMap(),
  partCache = new WeakMap();
function validateFence(fence, scene, x, y) {
  if (
    !fence ||
    Object.keys(fence).some((k) => k !== "points") ||
    !Array.isArray(fence.points) ||
    fence.points.length < 2 ||
    fence.points.length > 64
  )
    throw Error("Una valla necesita entre 2 y 64 puntos");
  let length = 0;
  fence.points.forEach((p, i) => {
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      !p.every(Number.isFinite) ||
      p.some((v) => Math.abs(v) > 256)
    )
      throw Error("Punto de valla inválido");
    if (
      scene &&
      (x + p[0] < 0 ||
        y + p[1] < 0 ||
        x + p[0] >= scene.width ||
        y + p[1] >= scene.height)
    )
      throw Error("La valla sale del escenario");
    if (i) {
      const a = fence.points[i - 1],
        d = Math.hypot(p[0] - a[0], p[1] - a[1]);
      if (d < 0.25) throw Error("Los postes están demasiado juntos");
      length += d;
    }
  });
  if (length > 256)
    throw Error("Divide una valla tan larga en varios trazados");
  return {
    points: fence.points.map((p) => p.map((v) => Math.round(v * 1000) / 1000)),
  };
}
function geometry(fence) {
  if (cache.has(fence)) return cache.get(fence);
  validateFence(fence);
  const posts = [],
    rails = [],
    bodies = [],
    seen = new Set();
  const post = (p) => {
    const k = p.map((v) => Math.round(v * 1000)).join(":");
    if (!seen.has(k)) {
      seen.add(k);
      posts.push(p);
    }
  };
  for (let i = 1; i < fence.points.length; i++) {
    const a = fence.points[i - 1],
      b = fence.points[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.ceil(length / 4),
      lerp = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (let n = 0; n <= count; n++) post(lerp(n / count));
    for (let n = 0; n < count; n++)
      rails.push([lerp(n / count), lerp((n + 1) / count)]);
    const probes = Math.ceil(length / 0.4);
    for (let n = 0; n <= probes; n++) {
      const [x, y] = lerp(n / probes);
      bodies.push([x - 0.25, y - 0.25, 0.5, 0.5]);
    }
  }
  const xs = posts.map((p) => p[0] * TILE),
    ys = posts.map((p) => p[1] * TILE);
  const data = {
    posts,
    rails,
    bodies,
    bounds: {
      x: Math.min(...xs) - 6,
      y: Math.min(...ys) - 32,
      w: Math.max(...xs) - Math.min(...xs) + 12,
      h: Math.max(...ys) - Math.min(...ys) + 38,
    },
  };
  cache.set(fence, data);
  return data;
}
function bounds(e) {
  const r = e.fencePart?.bounds || geometry(e.fence).bounds;
  return { ...r, x: r.x + e.x, y: r.y + e.y };
}
function parts(e) {
  if (!e.fence) return [e];
  const cached = partCache.get(e);
  if (cached?.fence === e.fence && cached.x === e.x && cached.y === e.y)
    return cached.parts;
  const g = geometry(e.fence),
    out = [];
  for (const [a, b] of g.rails) {
    const x = ((a[0] + b[0]) * TILE) / 2,
      y = ((a[1] + b[1]) * TILE) / 2;
    const endpoints = [a, b].map((p) => [p[0] * TILE - x, p[1] * TILE - y]);
    out.push({
      ...e,
      fence: undefined,
      x: e.x + x,
      y: e.y + y,
      fencePart: {
        endpoints,
        bounds: {
          x: Math.min(...endpoints.map((p) => p[0])) - 4,
          y: Math.min(...endpoints.map((p) => p[1])) - 29,
          w: Math.abs(endpoints[1][0] - endpoints[0][0]) + 8,
          h: Math.abs(endpoints[1][1] - endpoints[0][1]) + 33,
        },
      },
    });
  }
  for (const p of g.posts)
    out.push({
      ...e,
      fence: undefined,
      x: e.x + p[0] * TILE,
      y: e.y + p[1] * TILE,
      depth: e.y + p[1] * TILE + 0.1,
      fencePart: { post: true, bounds: { x: -6, y: -32, w: 12, h: 38 } },
    });
  partCache.set(e, { fence: e.fence, x: e.x, y: e.y, parts: out });
  return out;
}
function drawPart(c, e) {
  const part = e.fencePart;
  if (!part) return;
  c.save();
  c.translate(Math.round(e.x), Math.round(e.y));
  c.lineCap = "round";
  c.lineJoin = "round";
  const stroke = (a, b, color, width, dy = 0) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(Math.round(a[0]), Math.round(a[1] + dy));
    c.lineTo(Math.round(b[0]), Math.round(b[1] + dy));
    c.stroke();
  };
  if (part.post) {
    stroke([0, 1], [-1, -29], "#493323", 8);
    stroke([-1, 0], [-2, -29], "#87603b", 5);
    stroke([-3, -3], [-3, -28], "#b18a50", 2);
    stroke([-4, -23], [3, -23], "#c5ab70", 2);
    stroke([-4, -20], [3, -20], "#725236", 2);
    c.fillStyle = "#486746";
    c.fillRect(-4, -2, 3, 3);
    c.fillStyle = "#c7a06c";
    c.fillRect(-3, -31, 5, 2);
  } else {
    for (const lift of [-23, -11]) {
      const [a, b] = part.endpoints;
      stroke(a, b, "#443223", 7, lift + 1);
      stroke(a, b, "#956d43", 5, lift);
      stroke(a, b, "#b99760", 1.5, lift - 1.5);
      for (let n = 1; n < 5; n++) {
        const t = n / 5,
          x = a[0] + (b[0] - a[0]) * t,
          y = a[1] + (b[1] - a[1]) * t + lift;
        c.fillStyle = n % 2 ? "#705139" : "#ad8450";
        c.fillRect(Math.round(x), Math.round(y), 3, 1);
      }
    }
  }
  c.restore();
}
function hit(e, p, tolerance = 10) {
  return geometry(e.fence).rails.some(([a, b]) => {
    const x = p.x - e.x,
      y = p.y - e.y + 12,
      dx = (b[0] - a[0]) * TILE,
      dy = (b[1] - a[1]) * TILE;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((x - a[0] * TILE) * dx + (y - a[1] * TILE) * dy) / (dx * dx + dy * dy),
      ),
    );
    return (
      Math.hypot(x - a[0] * TILE - t * dx, y - a[1] * TILE - t * dy) <
      tolerance + 8
    );
  });
}
module.exports = { validateFence, geometry, bounds, parts, drawPart, hit };
