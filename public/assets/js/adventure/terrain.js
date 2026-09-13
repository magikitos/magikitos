"use strict";
const { TILE, random, hash, riverOffset, coastX } = require("./model");
/** Static, deterministic ground painter. Bounded native-pixel chunks shared by all scenes. */
class Terrain {
  constructor(sprites) {
    this.sprites = sprites;
    this.chunks = new Map();
  }
  chunk(world, cx, cy) {
    const key = world.data.id + ":" + cx + ":" + cy;
    if (this.chunks.has(key)) {
      const v = this.chunks.get(key);
      this.chunks.delete(key);
      this.chunks.set(key, v);
      return v;
    }
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const c = cv.getContext("2d", { alpha: false });
    const rand = random(hash(key));
    const ox = cx * 256,
      oy = cy * 256;
    c.fillStyle = world.data.indoor
      ? "#835a3c"
      : world.data.baseWater
        ? "#5b9f9a"
        : "#547c4c";
    c.fillRect(0, 0, 256, 256);
    if (world.data.indoor) {
      for (let y = 0; y < 256; y += 8)
        for (let x = -(y % 16 ? 16 : 0); x < 256; x += 32) {
          c.fillStyle = ["#a7794e", "#ae8055", "#a27349"][
            Math.floor(rand() * 3)
          ];
          c.fillRect(x, y, 31, 7);
          c.fillStyle = "#bd9161";
          c.fillRect(x + 2, y, 27, 1);
          c.fillStyle = "#8e653f";
          c.fillRect(x + 4, y + 5, 8, 1);
        }
    } else {
      if (!world.data.baseWater)
        for (let y = 0; y < 256; y += 16)
          for (let x = 0; x < 256; x += 16) {
            c.fillStyle = rand() < 0.5 ? "#567e4e" : "#577e4d";
            c.fillRect(x, y, 16, 16);
          }
      // Land islands use the same ellipses as collision geometry; the sand is an inward shoreline.
      for (const island of world.data.islands || []) {
        for (let y = 0; y < 256; y++) {
          const py = (oy + y) / TILE;
          for (const [inset, color] of [
            [0, "#c9c79a"],
            [0.7, "#d7cc99"],
            [2.1, "#71935a"],
            [2.5, "#648751"],
          ]) {
            const ry = island.ry - inset,
              rx = island.rx - inset,
              dy = (py - island.y) / ry;
            if (Math.abs(dy) >= 1) continue;
            const half = rx * Math.sqrt(1 - dy * dy) * TILE;
            c.fillStyle = color;
            c.fillRect(
              Math.round(island.x * TILE - half - ox),
              y,
              Math.round(half * 2),
              1,
            );
          }
        }
      }
      for (const patch of world.data.groundPatches || []) {
        c.fillStyle = patch.color;
        c.beginPath();
        c.ellipse(
          patch.x * TILE - ox,
          patch.y * TILE - oy,
          patch.rx * TILE,
          patch.ry * TILE,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      for (const region of world.data.regions)
        if (region.ground === "stone") {
          const [rx, ry, rw, rh] = region.rect;
          c.save();
          c.beginPath();
          c.rect(rx * TILE - ox, ry * TILE - oy, rw * TILE, rh * TILE);
          c.clip();
          c.fillStyle = "#82907a";
          c.fillRect(0, 0, 256, 256);
          for (let y = 0; y < 256; y += 8)
            for (let x = y % 16 ? -6 : 0; x < 256; x += 12) {
              c.fillStyle = ["#a4aa88", "#a0a686", "#959f81"][
                Math.floor(rand() * 3)
              ];
              c.fillRect(x, y, 11, 7);
              c.fillStyle = "#b5b598";
              c.fillRect(x + 1, y, 9, 1);
            }
          c.restore();
        }
      c.lineJoin = "round";
      c.lineCap = "round";
      // One compound stroke merges every branch before drawing its inner surface.
      c.beginPath();
      for (const path of world.data.paths) {
        path.forEach(([x, y], i) =>
          i
            ? c.lineTo(x * TILE - ox, y * TILE - oy)
            : c.moveTo(x * TILE - ox, y * TILE - oy),
        );
      }
      c.strokeStyle = "#8b9360";
      c.lineWidth = 40;
      c.stroke();
      c.strokeStyle = "#c3b680";
      c.lineWidth = 32;
      c.stroke();
      // Water edges are painted at ONE native pixel, matching the sprites, not 4px terrain blocks.
      for (let y = 0; y < 256; y++)
        for (const p of world.data.waters) {
          const py = (oy + y) / TILE;
          const dy = (py - p.y) / p.ry;
          if (Math.abs(dy) > 1.1) continue;
          for (const [extra, color] of [
            [0.9, "#9aaf80"],
            [0.4, "#aecbad"],
            [0, "#5b9f9a"],
          ]) {
            const rr = p.ry + extra,
              dd = (py - p.y) / rr;
            if (Math.abs(dd) > 1) continue;
            const half = (p.rx + extra) * Math.sqrt(1 - dd * dd) * TILE;
            c.fillStyle = color;
            c.fillRect(
              Math.round(p.x * TILE - half - ox),
              y,
              Math.round(half * 2),
              1,
            );
          }
        }
      for (const coast of world.data.coasts || []) {
        for (let pixel = 0; pixel < 256; pixel++) {
          const edge = coastX(coast, (oy + pixel) / TILE) * TILE - ox;
          for (const [margin, color] of [
            [14, "#789762"],
            [6, "#aecbad"],
            [0, "#5b9f9a"],
          ]) {
            c.fillStyle = color;
            if (coast.side === "west")
              c.fillRect(0, pixel, Math.round(edge + margin), 1);
            else {
              const start = Math.round(edge - margin);
              c.fillRect(start, pixel, 256 - start, 1);
            }
          }
        }
      }
      for (const river of world.data.rivers || []) {
        const [rx, ry, rw, rh] = river.rect;
        for (let pixel = 0; pixel < 256; pixel++) {
          const ty = (oy + pixel) / TILE;
          if (ty < ry || ty >= ry + rh) continue;
          const x = rx + riverOffset(river, ty);
          for (const [margin, color] of [
            [0.8, "#789762"],
            [0.3, "#aecbad"],
            [0, "#5b9f9a"],
          ]) {
            c.fillStyle = color;
            c.fillRect(
              Math.round((x - margin) * TILE - ox),
              pixel,
              Math.round((rw + margin * 2) * TILE),
              1,
            );
          }
        }
      }
      for (let i = 0; i < 1150; i++) {
        const x = Math.floor(rand() * 256),
          y = Math.floor(rand() * 256),
          tx = (ox + x) / TILE,
          ty = (oy + y) / TILE;
        if (world.waterAt(tx, ty)) {
          if (i % 10 === 0) rand(); // Preserve deterministic land decoration sequence.
          continue;
        }
        const road = world.pathDistance(tx, ty) < 1;
        const sand =
          world.data.baseWater &&
          (world.data.islands || []).every(
            (p) =>
              ((tx - p.x) / (p.rx - 2.5)) ** 2 +
                ((ty - p.y) / (p.ry - 2.5)) ** 2 >=
              1,
          );
        c.fillStyle = sand
          ? rand() < 0.5
            ? "#c4bb8d"
            : "#e2d4aa"
          : road
            ? rand() < 0.5
              ? "#b7a877"
              : "#d4c795"
            : rand() < 0.5
              ? "#739059"
              : "#4c7247";
        c.fillRect(x, y, 1 + Math.floor(rand() * 2), 1);
        if (!sand && !road && i % 11 === 0) {
          c.fillRect(x + 1, y - 2, 1, 3);
          c.fillRect(x + 2, y - 1, 1, 1);
        }
        if (!sand && !road && i % 113 === 0) {
          c.fillStyle = "#e0c87d";
          c.fillRect(x, y - 2, 2, 2);
        }
      }
    }
    for (const bridge of world.data.bridges || []) {
      const [bx, by, bw, bh] = bridge.rect,
        x = bx * TILE - ox,
        y = by * TILE - oy,
        w = bw * TILE,
        h = bh * TILE;
      this.sprites.draw(c, bridge.sprite, x, y, w, h);
    }
    this.chunks.set(key, cv);
    if (this.chunks.size > (this.limit || 24))
      this.chunks.delete(this.chunks.keys().next().value);
    return cv;
  }
}
module.exports = { Terrain };
