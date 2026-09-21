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
  renderScene,
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
// La entrada de una puerta se dibuja a mano (20-sep-2026): se valida, se enseña en vivo y se
// escribe como `entrance` en la escena, nunca como geometría derivada.
const cottage = base.world.scenes.overworld.entities.find((e) => e.id === "home-one");
const drawn = [-1.25, 0.5, 1.5, 0.375];
const entrance = validateChanges(base, {
  overworld: { entities: { "home-one": { ...placement(cottage), entrance: drawn } } },
});
assert.deepEqual(entrance.overworld.entities["home-one"].entrance, drawn);
const preview = renderScene(base, "overworld", entrance).entities.find((e) => e.id === "home-one");
assert.deepEqual(preview.threshold, [cottage.x - 1.25, cottage.y + 0.5, 1.5, 0.375], "La vista previa enseña el umbral dibujado");
assert.equal(preview.entryDirection, -1);
assert.deepEqual(preview.arrival, [cottage.x - 0.5, cottage.y + 0.5 + 0.375 + 2], "La llegada sale de la franja");
const written = diff(base, entrance)[0].proposedScene.entities.find((e) => e.id === "home-one");
assert.deepEqual(written.entrance, drawn, "La propuesta escribe entrance en la escena");
assert(!Object.hasOwn(written, "threshold") && !Object.hasOwn(written, "arrival"), "La propuesta no escribe geometría derivada");
assert.throws(
  // 3 casillas YA es legal desde el 22-sep-2026; lo que se rechaza es pasarse de ahí.
  () => validateChanges(base, { overworld: { entities: { "home-one": { ...placement(cottage), entrance: [0, 0, 3.25, 0.25] } } } }),
  /fuera de rango/,
);
/**
 * ⛔ Y UNA ENTRADA DENTRO DEL CUERPO TAMPOCO PASA (22-sep-2026). El umbral prueba el PUNTO del
 * duende, que no entra en un sólido: dibujada ahí, la puerta no abre nunca y nada lo avisa. Se
 * comprueba con `dy` a la altura del cuerpo de la cabaña, que es justo el error que cometió el
 * dueño en la casa de hojas.
 */
assert.throws(
  () => validateChanges(base, { overworld: { entities: { "home-one": { ...placement(cottage), entrance: [0, -0.5, 1, 0.25] } } } }),
  /no se puede pisar/,
);
assert.throws(
  () => validateChanges(base, { house: { entities: { "human-bed": { ...placement(bed), entrance: [0, 0, 1, 0.25] } } } }),
  /puertas/,
);
const moved = validateChanges(base, {
  overworld: { entities: { "home-one": { ...placement(cottage), x: cottage.x + 2 } } },
});
assert.equal(
  renderScene(base, "overworld", moved).entities.find((e) => e.id === "home-one").threshold[0],
  cottage.threshold[0] + 2,
  "Mover la casa mueve su umbral en la vista previa",
);
const reset = validateChanges(base, {
  overworld: { entities: { "home-one": { ...placement(cottage), entrance: undefined } } },
});
assert.deepEqual(reset, {}, "Volver a la entrada automática sin haberla dibujado no es un cambio");
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
