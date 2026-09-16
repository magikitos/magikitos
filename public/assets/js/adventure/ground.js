"use strict";
const { TILE, coastX, riverOffset, hash } = require("./geometry");
const colors = {
  grass: ["#68884e", "#6a8a4f", "#6c8c51", "#6e8e52", "#709054"],
  path: ["#b2a16b", "#c3af7b", "#cebb88"],
  water: ["#a0c4ac", "#78b4a6", "#509b9c", "#3c888f", "#347780"],
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const palette = Object.fromEntries(
  Object.entries(colors).map(([k, v]) => [k, v.map(rgb)]),
);
const BANK = rgb("#526c45"),
  EDGE = rgb("#a8b285"),
  SAND = rgb("#cbbd8c");
function noise(x, y, seed = 0) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
/** Positive inside water, negative on land. No per-frame scans or downloaded textures. */
function shoreDistance(data, x, y) {
  return shoreRow(data, y * TILE)(x * TILE);
}
function nearbyPaths(data, ox, oy) {
  const segments = [];
  for (const path of data.paths || [])
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1].map((v) => v * TILE),
        b = path[i].map((v) => v * TILE);
      if (
        Math.max(a[0], b[0]) + 24 < ox ||
        Math.min(a[0], b[0]) - 24 > ox + 256 ||
        Math.max(a[1], b[1]) + 24 < oy ||
        Math.min(a[1], b[1]) - 24 > oy + 256
      )
        continue;
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      segments.push({
        ax: a[0],
        ay: a[1],
        dx,
        dy,
        inverse: 1 / (dx * dx + dy * dy || 1),
        left: Math.min(a[0], b[0]) - 24,
        right: Math.max(a[0], b[0]) + 24,
        top: Math.min(a[1], b[1]) - 24,
        bottom: Math.max(a[1], b[1]) + 24,
      });
    }
  return segments;
}
/** Hoist coast interpolation and river sine terms out of the per-pixel loop. */
function shoreRow(data, py) {
  const y = py / TILE;
  const coasts = (data.coasts || []).map((c) => ({
    edge: coastX(c, y) * TILE,
    west: c.side === "west",
  }));
  const rivers = (data.rivers || []).map((r) => ({
    left: (r.rect[0] + riverOffset(r, y)) * TILE,
    width: r.rect[2] * TILE,
    vertical: Math.min(y - r.rect[1], r.rect[1] + r.rect[3] - y) * TILE,
  }));
  const ellipse = (p) => ({
    cx: p.x * TILE,
    inverse: 1 / (p.rx * TILE),
    dy: ((y - p.y) / p.ry) ** 2,
    radius: Math.min(p.rx, p.ry) * TILE,
  });
  const ponds = (data.waters || []).map(ellipse),
    islands = (data.islands || []).map(ellipse);
  return (x) => {
    let d = -10000;
    for (const c of coasts) d = Math.max(d, c.west ? c.edge - x : x - c.edge);
    for (const r of rivers) {
      const dx = x - r.left;
      d = Math.max(d, Math.min(dx, r.width - dx, r.vertical));
    }
    for (const p of ponds) {
      const dx = (x - p.cx) * p.inverse;
      d = Math.max(d, (1 - Math.sqrt(dx * dx + p.dy)) * p.radius);
    }
    if (data.baseWater) {
      let water = 10000;
      for (const p of islands) {
        const dx = (x - p.cx) * p.inverse;
        water = Math.min(water, (Math.sqrt(dx * dx + p.dy) - 1) * p.radius);
      }
      d = Math.max(d, water);
    }
    return d;
  };
}
/** Native-pixel material raster. Only the 9×9 shade lattice is hashed, not 4 corners per pixel. */
function paintGround(c, world, ox, oy) {
  const data = world.data,
    segments = nearbyPaths(data, ox, oy),
    seed = hash(data.seed);
  const image = c.createImageData(256, 256),
    pixels = image.data;
  const lattice = new Float64Array(81),
    blend = new Float64Array(32),
    row = new Float64Array(9);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++)
      lattice[y * 9 + x] = noise(ox / 32 + x, oy / 32 + y, seed);
  for (let x = 0; x < 32; x++) {
    const t = x / 32;
    blend[x] = t * t * (3 - 2 * t);
  }
  for (let y = 0; y < 256; y++) {
    const py = oy + y,
      gy = y >> 5,
      sy = blend[y & 31],
      water = shoreRow(data, py);
    const roads = segments.filter((s) => py >= s.top && py <= s.bottom);
    for (let i = 0; i < 9; i++)
      row[i] = lattice[gy * 9 + i] * (1 - sy) + lattice[(gy + 1) * 9 + i] * sy;
    for (let x = 0; x < 256; x++) {
      const px = ox + x,
        gx = x >> 5,
        sx = blend[x & 31],
        variation = row[gx] * (1 - sx) + row[gx + 1] * sx;
      const shore = water(px);
      let color = palette.grass[Math.min(4, Math.floor(variation * 5))];
      if (shore >= 0) {
        const depth = shore + (variation - 0.5) * 4;
        color =
          palette.water[
            depth < 2 ? 0 : depth < 7 ? 1 : depth < 19 ? 2 : depth < 40 ? 3 : 4
          ];
      } else {
        let road = Infinity;
        for (const s of roads) {
          if (px < s.left || px > s.right) continue;
          const dx = px - s.ax,
            dy = py - s.ay,
            t = Math.max(0, Math.min(1, (dx * s.dx + dy * s.dy) * s.inverse));
          const rx = dx - t * s.dx,
            ry = dy - t * s.dy;
          road = Math.min(road, rx * rx + ry * ry);
        }
        if (road < 441) {
          const width =
            15 + (variation - 0.5) * 7 + (noise(px, py, seed) > 0.94 ? 1 : 0);
          if (road < (width + 2) ** 2)
            color =
              road > width * width
                ? palette.grass[1]
                : palette.path[
                    road > (width - 2) ** 2
                      ? 0
                      : road > (width - 5) ** 2
                        ? 1
                        : 2
                  ];
        }
        if (data.baseWater && shore > -24) color = SAND;
        if (shore > -5) color = shore > -1.5 ? BANK : EDGE;
      }
      const at = (y * 256 + x) * 4;
      pixels[at] = color[0];
      pixels[at + 1] = color[1];
      pixels[at + 2] = color[2];
      pixels[at + 3] = 255;
    }
  }
  c.putImageData(image, 0, 0);
}
module.exports = { paintGround, shoreDistance, noise };
