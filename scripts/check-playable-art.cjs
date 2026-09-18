"use strict";
/** Full delivery gate by default. --sources-only checks provenance during production of the art. */
const assert = require("node:assert/strict"), fs = require("node:fs"), crypto = require("node:crypto");
const directory = "data/aventura/art/residents/";
const residents = JSON.parse(fs.readFileSync(directory + "catalog.json"));
const actions = JSON.parse(fs.readFileSync(directory + "actions/catalog.json"));
const manifest = JSON.parse(fs.readFileSync("public/assets/aventura/manifest.json"));
const profiles = new Map(residents.profiles.map((profile) => [profile.id, profile]));
const selected = actions.variants.map((id) => profiles.get(id));
assert(selected.every(Boolean));
assert.equal(selected.length, 30);
assert.equal(new Set(actions.variants).size, 30);
for (const gender of ["M", "F"]) assert.equal(selected.filter((p) => p.gender === gender).length, 15);
const families = new Map();
for (const p of selected) families.set(p.family, (families.get(p.family) || 0) + 1);
assert.equal(families.size, 20);
assert([...families.values()].every((count) => count === 1 || count === 2));
for (const gender of ["M", "F"])
  assert.equal(new Set(selected.filter((p) => p.gender === gender && families.get(p.family) === 2).map((p) => p.family)).size, 5);
assert.deepEqual(Object.keys(actions.actions).sort(), ["carried", "discover", "needs", "push", "row", "run", "work"]);
assert.equal(Object.values(actions.actions).reduce((count, spec) => count + spec.grid[0] * spec.grid[1], 0), 124);
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const known = new Set(), accepted = new Set();
for (const [sheets, active] of [[actions.sheets, true], [actions.rejectedSheets, false]]) {
  for (const sheet of sheets) {
    assert(!known.has(sheet.id), "A source has exactly one review outcome");
    known.add(sheet.id);
    assert(actions.variants.includes(sheet.variant) && actions.actions[sheet.action]);
    const profile = profiles.get(sheet.variant);
    assert.equal(digest(directory + "actions/sources/" + sheet.id + ".png"), sheet.sourceSha256);
    assert.equal(digest(directory + "actions/" + sheet.id + ".prompt.txt"), sheet.promptSha256);
    assert.equal(digest(directory + "sources/" + profile.source + ".png"), sheet.referenceSha256);
    if (sheet.editSource) {
      assert(/^[a-z0-9-]+$/.test(sheet.editSource));
      assert.equal(digest(directory + "actions/sources/" + sheet.editSource + ".png"), sheet.editSourceSha256);
    }
    if (!active) { assert(sheet.rejectedReason); continue; }
    const key = `${sheet.variant}/${sheet.action}`;
    assert(!accepted.has(key), "Only one accepted source per action");
    accepted.add(key);
    const pack = manifest.packs[`actor-${sheet.variant}-${sheet.action}`];
    assert(pack, "Accepted source must have a baked package: " + key);
    const spec = actions.actions[sheet.action];
    assert.equal(pack.sprites.length, spec.grid[0] * spec.grid[1]);
    const qa = JSON.parse(fs.readFileSync(directory + "actions/cutouts/" + sheet.id + ".json"));
    assert.equal(qa.reference, profile.source);
    assert.equal(qa.sourceSha256, sheet.sourceSha256);
    assert.equal(qa.referenceSha256, sheet.referenceSha256);
    assert.equal(Object.keys(qa.poses).length, pack.sprites.length);
    const patched = new Set(), definitions = JSON.parse(fs.readFileSync(`data/aventura/assets/actor-${sheet.variant}-${sheet.action}.json`));
    for (const patch of sheet.overrides || []) {
      assert(!known.has(patch.id), 'Each directional correction has a unique immutable source'); known.add(patch.id);
      assert.equal(digest(directory + 'actions/sources/' + patch.id + '.png'), patch.sourceSha256);
      assert.equal(digest(directory + 'actions/' + patch.id + '.prompt.txt'), patch.promptSha256);
      assert.equal(patch.referenceSha256, sheet.referenceSha256);
      if (patch.editSource) assert.equal(digest(directory + 'actions/sources/' + patch.editSource + '.png'), patch.editSourceSha256);
      assert.equal(qa.overrides[patch.id], patch.sourceSha256);
      const patchQa = JSON.parse(fs.readFileSync(directory + 'actions/cutouts/' + patch.id + '.json'));
      assert.equal(patchQa.sourceSha256, patch.sourceSha256);
      assert.equal(Object.keys(patchQa.poses).length, patch.grid[0] * patch.grid[1]);
      for (const [name, pose] of Object.entries(patchQa.poses)) {
        assert(pack.sprites.includes(name) && !patched.has(name), 'Correction replaces an existing pose exactly once'); patched.add(name);
        assert.deepEqual(qa.poses[name], pose);
        assert.equal(definitions.frames[name].source, directory + 'actions/cutouts/' + patch.id + '.png');
      }
    }
    for (const name of pack.sprites) if (!patched.has(name))
      assert.equal(definitions.frames[name].source, directory + 'actions/cutouts/' + sheet.id + '.png', 'Unpatched directions keep their approved source');
    for (const name of pack.sprites) {
      assert(qa.poses[name], "Every actual pose is measured: " + name);
      assert(Math.abs(qa.poses[name].support - (spec.anchor || residents.anchor)[1]) < 0.00001);
    }
  }
}
const expected = selected.length * Object.keys(actions.actions).length;
if (!process.argv.includes("--sources-only")) {
  assert.equal(accepted.size, expected, "INCOMPLETE playable art: every target needs all seven accepted and baked sheets");
  for (const id of actions.variants)
    for (const action of Object.keys(actions.actions)) assert(accepted.has(`${id}/${action}`));
}
console.log(`PASS source integrity and roster: ${accepted.size}/${expected} playable action sheets accepted and baked${accepted.size < expected ? " — FULL DELIVERY INCOMPLETE" : ""}. Visual review remains required.`);
