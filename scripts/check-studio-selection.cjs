"use strict";
const assert = require("node:assert/strict");
const { members, translation } = require("../tools/adventure-studio/selection");
const fence = require("../public/assets/js/adventure/fences");
const {
  collisionBodies,
} = require("../public/assets/js/adventure/collision-grid");
const { World } = require("../public/assets/js/adventure/model");
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const { FenceEditor } = require("../tools/adventure-studio/fence-editor");
const {
  validateChanges,
  diff,
} = require("../tools/adventure-studio/scene-edits");
const rows = [
  { layer: "entities", e: { id: "a", x: 16, y: 16 } },
  { layer: "scenery", e: { id: "b", x: 16, y: 16 } },
  { layer: "entities", e: { id: "c", x: 64, y: 48 } },
];
assert.equal(members(rows, [rows[0]], false).length, 1);
assert.equal(members(rows, [rows[0]], true).length, 2);
assert.equal(members(rows, [rows[0], rows[2]], true).length, 3);
assert.deepEqual(
  translation(
    [
      { x: 1, y: 1 },
      { x: 4, y: 3 },
    ],
    -9,
    0,
    { width: 20, height: 20 },
  ),
  { x: -1, y: 0 },
);
assert.deepEqual(
  translation(
    [
      {
        x: 4,
        y: 3,
        fence: {
          points: [
            [-3, 0],
            [2, 4],
          ],
        },
      },
    ],
    -9,
    0,
    { width: 20, height: 20 },
  ),
  { x: -1, y: 0 },
  "Clamp the complete fence, not only its anchor",
);
const line = {
    points: [
      [0, 0],
      [8, 0],
      [12, 4],
      [12, 12],
    ],
  },
  entity = { id: "f", sprite: "garden-fence", x: 160, y: 160, fence: line };
const g = fence.geometry(line);
assert.equal(
  g.posts.filter((p) => p[0] === 8 && p[1] === 0).length,
  1,
  "One shared corner post",
);
assert(g.rails.some(([a, b]) => a[0] !== b[0] && a[1] !== b[1]));
assert(g.rails.some(([a, b]) => a[0] === b[0] && a[1] !== b[1]));
assert.strictEqual(
  fence.parts(entity),
  fence.parts(entity),
  "Static render assemblies are cached",
);
const first = fence.parts(entity);
entity.x += 16;
assert.notStrictEqual(fence.parts(entity), first);
assert(collisionBodies(entity).every((p) => p.collisionSource === entity));
const drawing = [];
const canvas = new Proxy(
  {},
  {
    get:
      (_, key) =>
      (...args) =>
        drawing.push([key, ...args]),
  },
);
for (const points of [
  line.points,
  [
    [0, 0],
    [0, 0],
  ],
]) {
  FenceEditor.prototype.draw.call(
    { enabled: true, points, view: { zoom: 1 }, selected: null },
    canvas,
  );
  assert.equal(
    drawing.filter(([k]) => k === "save").length,
    drawing.filter(([k]) => k === "restore").length,
    "A temporarily invalid dragged corner never leaks canvas state",
  );
}
for (const invalid of [
  { points: [] },
  {
    points: [
      [0, 0],
      [0, 0],
    ],
  },
  {
    points: [
      [0, 0],
      [Infinity, 0],
    ],
  },
  {
    points: [
      [0, 0],
      [10, 0],
    ],
    hack: true,
  },
])
  assert.throws(() => fence.validateFence(invalid));
assert.throws(() => fence.validateFence(line, { width: 10, height: 10 }, 0, 0));
const snap = snapshot(process.cwd()),
  id = "studio-test-fence";
const changes = validateChanges(snap, {
  overworld: {
    added: {
      [id]: {
        family: "fence-line",
        artVariant: "ramas",
        x: 40,
        y: 70,
        fence: line,
      },
    },
  },
});
const proposed = diff(snap, changes)[0].proposedScene.entities.find(
  (e) => e.id === id,
);
assert.deepEqual(proposed.fence, line);
assert(!proposed.solid);
const world = new World({
  ...snap.world.scenes.overworld,
  entities: [proposed],
  scenery: [],
});
world.refresh({ flags: {}, inventory: {} });
assert(!world.canStand(44 * 16, 70 * 16), "Fence rail blocks crossing");
assert(
  world.canStand(44 * 16, 73 * 16),
  "No solid rectangular fill across the enclosure",
);
assert(
  Object.keys(
    require("../data/aventura/assets/woodland-tree-chestnut.json").frames,
  ).includes("forest-chestnut"),
);
assert(
  Object.keys(
    require("../data/aventura/assets/woodland-tree-willow.json").frames,
  ).includes("forest-willow"),
);
console.log(
  "PASS multi-selection/group clamping, continuous fence geometry/collisions/cache/validation/export, and independent tree variants.",
);
