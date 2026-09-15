"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const {
  makeElement,
  resolveAppearance,
  frameName,
  families,
} = require("../public/assets/js/adventure/elements");
const {
  validateChanges,
  diff,
  renderScene,
  placement,
  removable,
} = require("../tools/adventure-studio/scene-edits");
const { rebase } = require("../tools/adventure-studio/workspace.cjs");
const base = snapshot(process.cwd()),
  prior = JSON.stringify(base),
  scene = "overworld";
for (const [id, family] of Object.entries(families)) {
  assert(family.variants.length, id + ": nonempty family");
  assert.equal(
    new Set(family.variants.map((v) => v.id)).size,
    family.variants.length,
  );
  for (const v of family.variants)
    assert(base.sprites[v.sprite], id + ": has authored sprite " + v.sprite);
  const e = makeElement(id, "studio-test-family", 30, 30, "auto");
  assert.equal(
    frameName(resolveAppearance(e, scene)),
    frameName(resolveAppearance(e, scene)),
    "Reload keeps deterministic variety",
  );
  for (const alias of family.aliases) {
    assert.equal(
      frameName(
        resolveAppearance(
          { sprite: alias, id: "original", rules: [], x: 1, y: 1 },
          scene,
        ),
      ),
      family.variants.find((v) => v.id === family.defaults[alias])?.sprite ||
        alias,
      "Existing authored alias keeps its declared default variant",
    );
  }
}
const variations = new Set(
  Array.from({ length: 40 }, (_, i) =>
    frameName(
      resolveAppearance(
        makeElement("forest-tree", "studio-tree-" + i, 30, 30),
        scene,
      ),
    ),
  ),
);
assert(variations.size >= 4, "Auto actually distributes related variants");
const id = "studio-test-new-pot";
const archId = "studio-test-flower-arch";
const arch = makeElement("garden-trellis", archId, 32, 32);
const archChanges = validateChanges(base, {
  overworld: {
    added: { [archId]: { family: "garden-trellis", ...placement(arch) } },
  },
});
assert.deepEqual(
  renderScene(base, scene, archChanges).entities.find((e) => e.id === archId)
    .solids,
  families["garden-trellis"].template.solids,
  "Studio preserves both arch posts without inventing a solid centre",
);
const added = makeElement("planter", id, 36, 48, "auto");
const changes = validateChanges(base, {
  overworld: { added: { [id]: { family: "planter", ...placement(added) } } },
});
assert.equal(
  renderScene(base, scene, changes).entities.find((e) => e.id === id).pushable,
  true,
);
const output = diff(base, changes)[0];
assert(output.added[id]);
assert.equal(
  output.proposedScene.entities.find((e) => e.id === id).family,
  "planter",
);
assert(
  !output.proposedScene.scenery.some((e) => e.artSprite || e.homePosition),
  "Runtime bookkeeping never enters scene sources",
);
const moved = validateChanges(base, {
  overworld: {
    added: {
      [id]: {
        ...changes.overworld.added[id],
        x: 37.25,
        artVariant: families.planter.variants[0].id,
      },
    },
  },
});
assert.equal(
  renderScene(base, scene, moved).entities.find((e) => e.id === id).x,
  37.25,
);
assert.throws(
  () =>
    validateChanges(base, {
      overworld: {
        added: {
          [id]: { family: "planter", x: 30, y: 30, artVariant: "alien" },
        },
      },
    }),
  /Variante/,
);
assert.throws(
  () =>
    validateChanges(base, {
      overworld: {
        added: { [id]: { family: "planter", x: 30, y: 30, rules: [] } },
      },
    }),
  /desconocido/,
);
assert.throws(
  () =>
    validateChanges(base, {
      overworld: { added: { [id]: { family: "ferry", x: 30, y: 30 } } },
    }),
  /desconocido/,
);
assert.throws(
  () =>
    validateChanges(base, {
      house: { added: { [id]: { family: "log-home", x: 10, y: 10 } } },
    }),
  /exterior/,
);
assert.throws(
  () =>
    validateChanges(base, {
      overworld: { removed: [{ id: "picnic-mushroom", layer: "entities" }] },
    }),
  /funcional/,
);
const decor = base.scenery[scene].find((e) =>
  removable(base, scene, "scenery", e.id),
);
assert(decor);
const removed = validateChanges(base, {
  overworld: { removed: [{ id: decor.id, layer: "scenery" }] },
});
assert(
  !renderScene(base, scene, removed).scenery.some((e) => e.id === decor.id),
);
assert(
  !diff(base, removed)[0].proposedScene.scenery.some((e) => e.id === decor.id),
);
const work = { baseHash: base.baseHash, revision: 1, changes, sprites: {} };
const current = structuredClone(base);
current.baseHash = "a".repeat(64);
current.world.scenes[scene].entities.push(
  resolveAppearance({ ...added }, scene),
);
current.sources[scene].data = output.proposedScene;
assert.deepEqual(
  rebase(work, base, current).workspace.changes,
  {},
  "Applied addition disappears from proposal",
);
const unrelated = structuredClone(base);
unrelated.baseHash = "b".repeat(64);
assert.deepEqual(
  rebase(work, base, unrelated).workspace.changes,
  changes,
  "Unapplied addition survives rebase",
);
const missing = structuredClone(base);
delete missing.world.scenes[scene];
assert(
  rebase(work, base, missing).conflicts.length,
  "Removed scene yields a recoverable conflict",
);
const changed = structuredClone(base);
changed.baseHash = "c".repeat(64);
changed.scenery[scene].find((e) => e.id === decor.id).rules = [{ effects: [] }];
assert(
  rebase({ ...work, changes: removed }, base, changed).conflicts.length,
  "A newly functional prop cannot be deleted by an old proposal",
);
assert.equal(
  JSON.stringify(base),
  prior,
  "Proposal work does not mutate sources",
);
console.log(
  "PASS: complete family registry, deterministic variants, original anchors, palette additions, safe removals, clean scene diffs, rebase and conflict preservation.",
);
