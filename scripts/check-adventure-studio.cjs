"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const {
  validateChanges,
  placement,
  diff,
} = require("../tools/adventure-studio/scene-edits");
const {
  validateSprites,
  croppedFrame,
  spriteDiff,
} = require("../tools/adventure-studio/sprite-edits");
const {
  WorkspaceStore,
  rebase,
} = require("../tools/adventure-studio/workspace.cjs");
const base = snapshot(process.cwd());
const bed = base.world.scenes.house.entities.find((e) => e.id === "human-bed");
const changes = {
  house: {
    entities: { "human-bed": { ...placement(bed), x: bed.x + 1 } },
    scenery: {},
  },
};
const edits = validateChanges(base, changes);
assert.equal(diff(base, edits)[0].placements[0].after.x, bed.x + 1);
assert.throws(
  () =>
    validateChanges(base, {
      house: { entities: { exit: { x: 5, solid: [0, 0, 1, 1] } } },
    }),
  /protegidos/,
);
assert.throws(
  () =>
    validateChanges(base, {
      house: { entities: { "human-bed": { solid: [0, 0, 0, 1] } } },
    }),
  /Colisión/,
);
const collision = validateChanges(base, {
  house: { entities: { "human-bed": { solid: [-1, -2, 2, 2.5] } } },
});
assert.deepEqual(collision.house.entities["human-bed"].solid, [-1, -2, 2, 2.5]);
assert.throws(
  () =>
    validateChanges(base, {
      house: { entities: { "human-bed": { rules: [] } } },
    }),
  /desconocida/,
);
const sprites = validateSprites(base, { bed: { crop: [3, 2, 50, 58] } });
assert.equal(
  spriteDiff(base, sprites)[0].file,
  "data/aventura/assets/woodland-bed.json",
);
assert.throws(
  () => validateSprites(base, { bed: { crop: [-1, 0, 10, 10] } }),
  /Recorte/,
);
assert.throws(
  () => validateSprites(base, { bed: { crop: [0, 0, 9999, 10] } }),
  /Recorte/,
);
assert.throws(
  () => validateSprites(base, { "person-0-down": { crop: [0, 0, 5, 5] } }),
  /Recorte/,
);
const f = {
  pixelRatio: 2,
  x: 50,
  y: 40,
  w: 40,
  h: 50,
  anchor: [20, 47],
  trim: [5, 4],
  nativeSize: [50, 60],
};
const crop = croppedFrame(f, [8, 6, 20, 25]);
assert.equal(crop.x - f.x, 6);
assert.equal(crop.y - f.y, 4);
assert.equal(crop.anchor[0], 17);
assert.equal(crop.anchor[1], 45);
assert.equal(
  (crop.x - f.x) / f.pixelRatio - f.anchor[0],
  -crop.anchor[0],
  "Visible pixels keep their world position",
);
assert.throws(() => croppedFrame(f, [0, 0, 1, 1]), /vacío/);
const work = { baseHash: base.baseHash, revision: 1, changes: edits, sprites };
const changed = structuredClone(base);
changed.baseHash = "a".repeat(64);
changed.world.scenes.house.entities.find((e) => e.id === bed.id).x = bed.x + 1;
changed.sources.house.data.entities.find((e) => e.id === bed.id).x = bed.x + 1;
const rebased = rebase(work, base, changed);
assert.deepEqual(rebased.conflicts, []);
assert.deepEqual(rebased.workspace.changes, {});
assert.deepEqual(
  rebased.workspace.sprites,
  sprites,
  "Unapplied crop survives scene application",
);
changed.world.scenes.house.entities.find((e) => e.id === bed.id).x = bed.x + 2;
assert(rebase(work, base, changed).conflicts.includes("house/human-bed/x"));
const temporary = fs.mkdtempSync(
  path.join(os.tmpdir(), "magikitos-studio-test-"),
);
const store = new WorkspaceStore(temporary);
let loaded = store.load(base);
assert.equal(loaded.workspace.revision, 1);
const saved = store.save({ ...loaded.workspace, changes: edits, sprites });
assert.equal(saved.revision, 2);
assert.throws(
  () => store.save({ ...loaded.workspace, changes: {}, sprites: {} }),
  (e) => e.status === 409,
);
assert.equal(
  store.load(base).workspace.revision,
  2,
  "Reload opens the same workspace",
);
assert.equal(store.diff().sprites.length, 1);
assert(
  fs.readdirSync(store.history).length === 1,
  "Recoverable history is kept out of the user's workflow",
);
// One workspace keeps several scenes; applying one must never consume the rest.
const fountain = base.world.scenes.overworld.entities.find(
  (e) => e.id === "fountain",
);
const multiple = validateChanges(base, {
  ...edits,
  overworld: {
    entities: { fountain: { ...placement(fountain), x: fountain.x - 1 } },
  },
});
const multiSave = store.save({ ...saved, changes: multiple });
const reopened = new WorkspaceStore(temporary);
assert.deepEqual(reopened.load(base).workspace.changes, multiple);
assert.deepEqual(
  reopened
    .diff()
    .scenes.map((s) => s.scene)
    .sort(),
  ["house", "overworld"],
);
const appliedHouse = structuredClone(base);
appliedHouse.baseHash = "b".repeat(64);
appliedHouse.world.scenes.house.entities.find((e) => e.id === bed.id).x =
  bed.x + 1;
appliedHouse.sources.house.data.entities.find((e) => e.id === bed.id).x =
  bed.x + 1;
const remaining = reopened.load(appliedHouse);
assert.deepEqual(remaining.conflicts, []);
assert.equal(remaining.workspace.revision, multiSave.revision + 1);
assert.deepEqual(remaining.workspace.changes, {
  overworld: multiple.overworld,
});
assert.deepEqual(remaining.workspace.sprites, sprites);
assert.equal(
  new WorkspaceStore(temporary).load(appliedHouse).workspace.changes.overworld
    .entities.fountain.x,
  fountain.x - 1,
);
console.log(
  "PASS: single multi-scene workspace, partial-application preservation, scene/crop/collision validation, anchors, autosave contract, revision conflicts, recovery and three-way rebase.",
);
