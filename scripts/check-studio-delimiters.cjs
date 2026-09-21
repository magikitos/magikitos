"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"),
  { collisionBodies } = require("../public/assets/js/adventure/collision-grid");
const { families, makeElement, variantOptions } = require("../tools/adventure-studio/catalog"),
  { validateChanges, renderScene, diff, placement } = require("../tools/adventure-studio/scene-edits"),
  { isTree } = require("../tools/adventure-studio/visibility"),
  { World } = require("../public/assets/js/adventure/model"),
  { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const base = snapshot(process.cwd()), changes = { overworld: { entities: {}, scenery: {}, added: {} } };
const delimiters = Object.fromEntries(Object.entries(families).filter(([, f]) => f.boundary));
const spriteNames = [], definitions = {};
for (const file of fs.readdirSync("data/aventura/assets").filter(f => f.startsWith("delimiter-")))
  Object.assign(definitions, JSON.parse(fs.readFileSync(path.join("data/aventura/assets", file))).frames);
for (const [id, family] of Object.entries(delimiters)) {
  assert.equal(family.category, "Delimitadores");
  assert.equal(family.studioOnly, undefined, "One production catalogue, no preview fork");
  assert.equal(family.randomVariants, false, "A corner/length is always an explicit choice");
  assert(!variantOptions(family).some(v => v.id === "auto"));
  assert.deepEqual(family.template.rules, []);
  assert(!family.template.pushable && !family.template.portal, "Boundaries are fixed scenery");
  for (const variant of family.variants) {
    spriteNames.push(variant.sprite);
    const e = makeElement(id, "studio-test-" + spriteNames.length, 12, 14, variant.id);
    assert.equal(isTree(e), id.includes("canopy"));
    changes.overworld.added[e.id] = { family: id, ...placement(e) };
    const def = definitions[variant.sprite];
    assert(def && fs.existsSync(def.source));
    assert(def.size[0] >= 100 && def.size[1] >= 100);
    assert.deepEqual(def.anchor, def.size.map(n => Math.floor(n / 2)));
  }
}
assert.equal(spriteNames.length, 16);
assert.equal(new Set(spriteNames).size, 16);
assert(variantOptions(families["forest-tree"]).some(v => v.id === "auto"), "Existing random families keep their behavior");
const clean = validateChanges(base, changes), world = new World(renderScene(base, "overworld", clean));
for (const [id, value] of Object.entries(clean.overworld.added)) {
  const e = world.entities.find(e => e.id === id);
  assert.equal(e.artSprite, families[value.family].variants.find(v => v.id === value.artVariant).sprite);
  const bodies = collisionBodies(e);
  const v = families[value.family].variants.find(v => v.id === value.artVariant);
  assert.equal(bodies.length, v.solids.length);
  if (value.family.endsWith("corner")) assert(bodies.length >= 2, "Corners leave their inner clearing open");
  assert(bodies.every(b => b.solid[2] > 0 && b.solid[3] > 0));
}
const exported = diff(base, clean)[0];
assert.equal(exported.previewFamilies, undefined);
assert.equal(exported.proposedScene.entities.filter(e => e.id.startsWith("studio-test-")).length, 16);
const changed = structuredClone(clean);
const item = Object.values(changed.overworld.added)[0];
item.artVariant = "auto";
assert.throws(() => validateChanges(base, changed), /Variante/);
item.artVariant = "long"; item.scale = 0.5;
assert.equal(Object.values(validateChanges(base, changed).overworld.added)[0].scale, 0.5);
const production = JSON.stringify(require("../public/assets/aventura/manifest.json"));
assert(spriteNames.every(name => production.includes('"' + name + '"')), "All delimiters are available to the shared runtime");
console.log("PASS Studio delimiters: 16 fixed finite pieces, explicit variants, compound footprints, scaling, save/diff/render, tree filter and shared game catalogue.");
