"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const {
  validateChanges,
  renderScene,
  diff,
  placement,
} = require("../tools/adventure-studio/scene-edits");
const { validatePaths } = require("../tools/adventure-studio/path-edits");
const {
  WorkspaceStore,
  rebase,
} = require("../tools/adventure-studio/workspace.cjs");
const base = snapshot(process.cwd()),
  scene = base.world.scenes.overworld,
  original = JSON.stringify(base);
const paths = structuredClone(scene.paths);
paths[0][0][0] += 0.25;
const changes = validateChanges(base, { overworld: { paths } });
assert.deepEqual(changes.overworld.paths, paths);
assert.deepEqual(
  validateChanges(base, { overworld: { paths: scene.paths } }),
  {},
);
assert.deepEqual(
  validateChanges(base, { overworld: { paths: [] } }).overworld.paths,
  [],
);
assert.deepEqual(
  validatePaths(scene, [
    [
      [0, 0],
      [scene.width, scene.height],
    ],
  ]),
  [
    [
      [0, 0],
      [scene.width, scene.height],
    ],
  ],
);
assert.deepEqual(
  validatePaths(scene, [
    [
      [1.23456, 2],
      [3, 4],
    ],
  ]),
  [
    [
      [1.235, 2],
      [3, 4],
    ],
  ],
);
for (const bad of [
  null,
  {},
  [[[1, 2]]],
  [
    [
      [1, 2],
      [1, 2],
    ],
  ],
  [
    [
      [-1, 0],
      [2, 2],
    ],
  ],
  [
    [
      [0, 0],
      [Infinity, 2],
    ],
  ],
  [
    [
      ["1", 2],
      [3, 4],
    ],
  ],
  [
    [
      [1, 2, 3],
      [2, 3],
    ],
  ],
  Array(129).fill([
    [1, 2],
    [2, 3],
  ]),
  [Array(257).fill([1, 2])],
  Array(9).fill(Array.from({ length: 256 }, (_, i) => [i % 2, 1])),
])
  assert.throws(() => validatePaths(scene, bad));
assert.throws(
  () => validateChanges(base, { house: { paths: [] } }),
  /exteriores/,
);
const rendered = renderScene(base, "overworld", changes),
  proposal = diff(base, changes)[0];
assert.deepEqual(rendered.paths, paths);
assert.deepEqual(
  rendered.scenery,
  base.scenery.overworld,
  "No vegetation regeneration",
);
assert.deepEqual(rendered.entities, scene.entities);
assert.equal(
  JSON.stringify(base),
  original,
  "Pure editing never mutates source",
);
assert.deepEqual(proposal.placements, []);
assert.deepEqual(proposal.paths, { before: scene.paths, after: paths });
assert.deepEqual(proposal.proposedScene.paths, paths);
assert.deepEqual(
  proposal.proposedScene.entities,
  base.sources.overworld.data.entities,
);
assert.deepEqual(
  proposal.proposedScene.scenery,
  base.scenery.overworld.map(
    ({ artSprite, homePosition, ...source }) => source,
  ),
  "Sources preserve placements without renderer bookkeeping",
);
const bed = base.world.scenes.house.entities.find((e) => e.id === "human-bed");
const moved = diff(base, {
  house: { entities: { [bed.id]: { ...placement(bed), x: bed.x + 0.25 } } },
})[0].proposedScene.entities.find((e) => e.id === bed.id);
const raw = base.sources.house.data.entities.find((e) => e.id === bed.id);
assert.deepEqual(
  moved,
  { ...raw, x: bed.x + 0.25 },
  "Only changed placement fields, no inherited body overrides",
);
const work = { baseHash: base.baseHash, revision: 1, changes, sprites: {} };
const current = structuredClone(base);
current.baseHash = "b".repeat(64);
current.world.scenes.overworld.entities[0].x += 0.25;
assert.deepEqual(
  rebase(work, base, current).workspace.changes,
  changes,
  "Unrelated placement keeps path edit",
);
current.world.scenes.overworld.paths = structuredClone(paths);
assert.deepEqual(
  rebase(work, base, current).workspace.changes,
  {},
  "Applied roads disappear from diff",
);
current.world.scenes.overworld.paths[0][0][0] += 0.25;
const conflict = rebase(work, base, current);
assert.deepEqual(conflict.conflicts, ["overworld/paths"]);
assert.deepEqual(
  conflict.workspace,
  work,
  "Concurrent topology edit never silently merges or loses work",
);
const empty = { ...work, changes: { overworld: { paths: [] } } };
current.world.scenes.overworld.paths = [];
assert.deepEqual(rebase(empty, base, current).workspace.changes, {});
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "magikitos-paths-test-"));
try {
  const store = new WorkspaceStore(temp),
    loaded = store.load(base);
  const saved = store.save({ ...loaded.workspace, changes, sprites: {} });
  assert.deepEqual(new WorkspaceStore(temp).load(base).workspace, saved);
  assert.deepEqual(store.diff().scenes[0].paths.after, paths);
  const removed = store.save({
    ...saved,
    changes: { overworld: { paths: [] } },
  });
  assert.deepEqual(store.diff().scenes[0].paths.after, []);
  assert.deepEqual(new WorkspaceStore(temp).load(base).workspace, removed);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log(
  "PASS: bounded paths, full deletion, pure previews/diffs, frozen scenery, minimal entity overrides, autosave and atomic three-way topology rebase.",
);
