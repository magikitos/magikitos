"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const {
  cameraMetrics,
  clampCamera,
} = require("../public/assets/js/adventure/camera");
const {
  cameraLimits,
  chunkRange,
} = require("../public/assets/js/adventure/scene-frame");
const { shoreDistance } = require("../public/assets/js/adventure/ground");
const { World, TILE } = require("../public/assets/js/adventure/model");
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
for (const size of [
  [320, 568],
  [390, 844],
  [844, 390],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [2560, 1440],
])
  for (const scene of Object.values(world.scenes))
    for (const ratio of [NaN, 0.01, 0.45, 0.7, 1, 2]) {
      const [width, height] = size,
        metrics = cameraMetrics({ width, height }, scene, ratio);
      assert(metrics.ratio <= 1 && metrics.ratio >= metrics.minimum);
      assert.deepEqual(
        metrics,
        cameraMetrics({ width, height }, new World(scene), ratio),
      );
      const cam = clampCamera({ x: 999999, y: -999999 }, scene, metrics);
      if (scene.indoor) {
        const maxScale = width < 600 ? 1.5 : 2;
        assert(
          metrics.scale <= maxScale,
          "Small rooms never force giant character pixels",
        );
        assert(metrics.scale >= maxScale * 0.7);
        assert.deepEqual(
          metrics,
          cameraMetrics({ width, height }, scene, ratio, 1.35),
          "Opening a reading activity must not zoom a house back in",
        );
        const limits = cameraLimits(scene, metrics);
        assert.equal(cam.x, limits.x[1]);
        assert.equal(cam.y, limits.y[0]);
        for (const axis of ["x", "y"]) {
          const dimension = axis === "x" ? "width" : "height";
          if (metrics[dimension] >= scene[dimension] * TILE + 32) {
            assert.equal(
              cam[axis],
              (scene[dimension] * TILE - metrics[dimension]) / 2,
              "A room that fits is centered independently on each axis",
            );
          }
        }
        const range = chunkRange(scene, {
          ...cam,
          width: metrics.width,
          height: metrics.height,
        });
        assert(range.left * 256 <= cam.x && range.top * 256 <= cam.y);
        assert((range.right + 1) * 256 >= cam.x + metrics.width);
        assert((range.bottom + 1) * 256 >= cam.y + metrics.height);
      } else {
        assert(metrics.width <= scene.width * TILE + 1e-7);
        assert(metrics.height <= scene.height * TILE + 1e-7);
        assert(cam.x >= 0 && cam.y >= 0);
        assert(cam.x + metrics.width <= scene.width * TILE + 1e-7);
        assert(cam.y + metrics.height <= scene.height * TILE + 1e-7);
      }
    }
const outdoor = new World(world.scenes.overworld);
for (let y = 3; y < outdoor.height - 3; y += 0.5)
  for (let x = 3; x < outdoor.width - 3; x += 0.5) {
    if (
      (outdoor.data.bridges || []).some(
        (b) =>
          x >= b.rect[0] &&
          x < b.rect[0] + b.rect[2] &&
          y >= b.rect[1] &&
          y < b.rect[1] + b.rect[3],
      )
    )
      continue;
    const distance = shoreDistance(outdoor.data, x, y);
    if (Math.abs(distance) < 0.01) continue;
    assert.equal(
      distance > 0,
      outdoor.waterAt(x, y),
      "Paint and physical water use the same shoreline",
    );
  }
console.log(
  "PASS: outdoor coverage + restrained, fully painted interior framing; seven viewports × seven scenes × six zoom requests; terrain/water geometry parity.",
);
const { Terrain } = require("../public/assets/js/adventure/terrain");
for (const scene of Object.values(world.scenes).filter((s) => s.indoor)) {
  const room = new World(scene),
    cache = new Terrain();
  for (const point of [
    [-10, 40],
    [40, -10],
    [scene.width * TILE + 10, 40],
    [40, scene.height * TILE + 10],
  ]) {
    assert.equal(
      room.canStand(...point),
      false,
      "Cutaway garden is not walkable map expansion",
    );
  }
  const metrics = cameraMetrics({ width: 1440, height: 900 }, room, 0.7);
  const cam = clampCamera({ x: 0, y: 0 }, room, metrics);
  const range = chunkRange(room, {
    ...cam,
    width: metrics.width,
    height: metrics.height,
  });
  cache.beginFrame(room, {
    ...cam,
    width: metrics.width,
    height: metrics.height,
  });
  assert.equal(
    cache.pinned.size,
    (range.right - range.left + 1) * (range.bottom - range.top + 1),
  );
  assert(
    [...cache.pinned].some((k) => k.includes(":-")),
    "Negative presentation chunks are pinned",
  );
  for (const key of cache.pinned) cache.chunks.set(key, { cached: true });
  for (let i = 0; i < 50; i++) cache.chunks.set("old:" + i, {});
  cache.prune();
  for (const key of cache.pinned) assert(cache.chunks.has(key));
}
const terrain = new Terrain(),
  sample = { data: { id: "large" }, width: 128, height: 96 };
terrain.beginFrame(sample, { x: 0, y: 0, width: 1780, height: 1050 });
assert(
  terrain.pinned.size > 24,
  "Zoom-out genuinely exceeds the former cache limit",
);
for (const key of terrain.pinned) terrain.chunks.set(key, { cached: true });
for (let i = 0; i < 20; i++) terrain.chunks.set("old:" + i, {});
terrain.prune();
assert(terrain.chunks.size <= terrain.budget);
for (const key of terrain.pinned) assert(terrain.chunks.has(key));
for (let round = 0; round < 3; round++)
  for (const key of terrain.pinned) {
    const [, x, y] = key.split(":");
    assert(terrain.chunk(sample, +x, +y).cached);
  }
assert.equal(
  terrain.buildCount,
  0,
  "Repeated frames never rebuild visible chunks",
);
terrain.beginFrame(sample, { x: 0, y: 0, width: 400, height: 250 });
assert(terrain.chunks.size <= 24, "Zoom-in releases surplus cache entries");
console.log(
  "PASS: visible terrain pinning prevents zoom-out cache thrashing and stays bounded.",
);
const {
  CollisionGrid,
} = require("../public/assets/js/adventure/collision-grid");
const {
  collisionBounds,
  actorBounds,
  overlaps,
} = require("../public/assets/js/adventure/geometry");
const index = new CollisionGrid(),
  props = [
    { id: "small", x: 80.25, y: 70.5, solid: [-0.5, -0.5, 1, 1] },
    {
      id: "mirrored",
      x: 150,
      y: 110,
      solid: [-1, -2, 3, 2.5],
      scale: 1.25,
      flip: true,
    },
    { id: "rotated", x: 60, y: 150, solid: [-1, -0.5, 2, 1], rotation: 90 },
  ];
props.forEach((e) => index.add(e));
for (let y = 40; y < 190; y += 1.5)
  for (let x = 30; x < 210; x += 1.5) {
    const hit = props.some((e) =>
      overlaps(actorBounds(x, y), collisionBounds(e)),
    );
    assert.equal(
      Boolean(index.at(x, y)),
      hit,
      "Spatial index agrees with precise transformed bodies",
    );
  }
assert.equal(
  index.at(80.25, 70.5, props[0]),
  null,
  "Ignored actor/body cannot self-collide",
);
console.log(
  "PASS: exact collision index matches brute-force geometry, including subpixel offsets and transforms.",
);
