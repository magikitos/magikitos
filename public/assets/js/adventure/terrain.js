"use strict";
const { TILE, random, hash } = require("./model");
const { paintGround } = require("./ground");
const { chunkRange } = require("./scene-frame");
const { paintInteriorGround } = require("./interior-ground");
/** Static, deterministic ground painter. Bounded native-pixel chunks shared by all scenes. */
class Terrain {
  constructor() {
    this.chunks = new Map();
    this.pinned = new Set();
    this.buildCount = 0;
    this.contexts = new Map();
    this.sceneContexts = new Map();
  }
  beginFrame(world, view) {
    this.pinned.clear();
    const range = chunkRange(world, view);
    for (let y = range.top; y <= range.bottom; y++)
      for (let x = range.left; x <= range.right; x++)
        this.pinned.add(world.data.id + ":" + x + ":" + y);
    this.budget = Math.max(this.limit || 24, this.pinned.size + 4);
    this.prune();
  }
  /** Un claro con caminos nuevos hay que repintarlo: las baldosas se cachean por escena. */
  invalidate(sceneId) {
    for (const key of [...this.chunks.keys()])
      if (key.startsWith(sceneId + ":")) this.chunks.delete(key);
  }
  prune() {
    for (const key of this.chunks.keys()) {
      if (this.chunks.size <= (this.budget || this.limit || 24)) break;
      if (!this.pinned.has(key)) this.chunks.delete(key);
    }
  }
  context(data, sprites) {
    const name = data.interior?.background;
    if (!name || !sprites?.frame(name)) return null;
    if (!this.contexts.has(name)) {
      const source = sprites.icon(name),
        canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext("2d");
      ctx.filter = "blur(1.2px)";
      ctx.drawImage(source, -2, -2, source.width + 4, source.height + 4);
      this.contexts.set(name, canvas);
      if (this.contexts.size > 3)
        this.contexts.delete(this.contexts.keys().next().value);
    }
    return this.contexts.get(name);
  }
  background(data, sprites) {
    const background = data.indoor ? this.context(data, sprites) : null;
    if (
      background &&
      this.sceneContexts.get(data.id) !== data.interior.background
    ) {
      // The immediate terrain preview can precede lazy background art. Invalidate just this scene once.
      for (const cached of this.chunks.keys())
        if (cached.startsWith(data.id + ":")) this.chunks.delete(cached);
      this.sceneContexts.set(data.id, data.interior.background);
    }
    return background;
  }
  chunk(world, cx, cy, sprites) {
    const background = this.background(world.data, sprites);
    const key = world.data.id + ":" + cx + ":" + cy;
    if (this.chunks.has(key)) {
      const v = this.chunks.get(key);
      this.chunks.delete(key);
      this.chunks.set(key, v);
      return v;
    }
    this.buildCount++;
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
      paintInteriorGround(c, world, ox, oy, background);
    } else {
      paintGround(c, world, ox, oy);
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
      for (let i = 0; i < 460; i++) {
        const x = Math.floor(rand() * 256),
          y = Math.floor(rand() * 256),
          tx = (ox + x) / TILE,
          ty = (oy + y) / TILE;
        if (world.waterAt(tx, ty)) {
          if (i % 10 === 0) rand(); // Preserve deterministic land decoration sequence.
          continue;
        }
        const pathDistance = world.pathDistance(tx, ty);
        const road = pathDistance < 1;
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
              ? "#89a364"
              : "#5c7c48";
        c.fillRect(x, y, 1 + Math.floor(rand() * 2), 1);
        // Sparse grass tips at the path shoulder; no bright patches over the earth.
        if (
          !sand &&
          !road &&
          (i % 11 === 0 || (pathDistance < 1.6 && i % 3 === 0))
        ) {
          c.fillRect(x + 1, y - 2, 1, 3);
          c.fillRect(x + 2, y - 1, 1, 1);
        }
        if (!sand && !road && i % 113 === 0) {
          c.fillStyle = "#e0c87d";
          c.fillRect(x, y - 2, 2, 2);
        }
      }
    }
    this.chunks.set(key, cv);
    this.prune();
    return cv;
  }
}
/** Art arrives independently of terrain; cached ground never has to be repainted for a bridge. */
function drawBridges(c, world, sprites, view) {
  for (const bridge of world.data.bridges || []) {
    const [bx, by, bw, bh] = bridge.rect,
      x = bx * TILE,
      y = by * TILE,
      w = bw * TILE,
      h = bh * TILE;
    if (
      x + w < view.x ||
      x > view.x + view.width ||
      y + h < view.y ||
      y > view.y + view.height
    )
      continue;
    sprites.draw(c, bridge.sprite, x, y, w, h);
  }
}
module.exports = { Terrain, drawBridges };
