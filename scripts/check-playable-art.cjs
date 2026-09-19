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
assert(selected.length > 0, "The approved protagonist selection is not empty");
assert.equal(new Set(actions.variants).size, selected.length, "No duplicate protagonists");
assert(selected.every(p => ["M", "F"].includes(p.gender)), "Original resident identities are preserved");
assert.equal(residents.profiles.filter(p => !p.playableOnly).length, 100, "Playable selection must not remove any of the 100 NPCs");
assert.deepEqual(Object.keys(actions.actions).sort(), ["carried", "discover", "needs", "push", "row", "run", "work"]);
assert.equal(Object.values(actions.actions).reduce((count, spec) => count + spec.grid[0] * spec.grid[1], 0), 124);
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const known = new Set(), accepted = new Set();
for (const [sheets, active] of [[actions.sheets, true], [actions.rejectedSheets, false]]) {
  for (const sheet of sheets) {
    assert(!known.has(sheet.id), "A source has exactly one review outcome");
    known.add(sheet.id);
    assert(profiles.has(sheet.variant) && actions.actions[sheet.action]);
    if (active) assert(actions.variants.includes(sheet.variant), "Only approved protagonists have active action art");
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
/**
 * ⛔ LA PUERTA MIDE EL ELENCO QUE SE OFRECE, NO LAS CANDIDATURAS AÚN EN PRODUCCIÓN.
 *
 * Exigir todas las hojas pendientes para dejar publicar convierte una entrega en rehén de una producción de
 * arte que va por su cuenta: el dueño sube hojas cuando puede, y el juego tiene que poder salir
 * con las que hay. Lo que de verdad NO puede pasar es ofrecer un duende a medio dibujar, y eso es
 * lo que se comprueba: **cada personaje elegible tiene sus siete acciones**. El elenco elegible
 * lo deriva el mundo de lo que hay horneado, así que crece solo el día que entra su arte.
 *
 * Y lo que falta se sigue DICIENDO en voz alta. Una puerta que se relaja sin contarlo es una
 * puerta que miente: el número de abajo es el que dice cuánto queda para el elenco completo.
 */
const roster = JSON.parse(fs.readFileSync(".local/build/world.json")).playerArt;
if (!process.argv.includes("--sources-only")) {
  for (const id of roster.enabledVariants)
    for (const action of Object.keys(actions.actions))
      assert(
        accepted.has(`${id}/${action}`),
        `An offered duende must be fully drawn: ${id} is missing ${action}`,
      );
  assert(
    roster.enabledVariants.includes(roster.defaultVariant),
    "The duende everyone starts with must be offered",
  );
  assert(roster.enabledVariants.length > 0, "Somebody has to be playable");
}
const pendientes = selected.length - roster.enabledVariants.length;
console.log(
  `PASS source integrity and roster: ${roster.enabledVariants.length} duendes elegibles y completos ` +
    `(${accepted.size}/${expected} hojas del elenco final; faltan ${pendientes} personajes). ` +
    `Visual review remains required.`,
);
