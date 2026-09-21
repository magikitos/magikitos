"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { World } = require("../public/assets/js/adventure/model");
const { collisionBounds } = require("../public/assets/js/adventure/geometry");
const { canPlace } = require("../public/assets/js/adventure/movables");
const { catalogGround } = require("../public/assets/js/adventure/construction-ground");
const { sharedObjectContract, compileGround } = require("../tools/shared-object-contract.cjs");
const { WALK_SPEED } = require("../public/assets/js/adventure/locomotion");
const { PUSH_SPEED_RATIO } = require("../public/assets/js/adventure/movables");
const web = process.env.GAME_WEB_REPO || path.resolve(__dirname, "../../magikitos");
const { DryGround } = require(path.join(web, "bosque-vivo/object-geometry.cjs"));
const { SharedObjects } = require(path.join(web, "bosque-vivo/shared-objects.cjs"));
const box = { id: "fixture-crate", sprite: "crates", x: 8, y: 8, solid: [-0.5, -0.5, 1, 1], pushable: true, shared: true, rules: [] };
const data = { id: "fixture", width: 20, height: 18, indoor: false, seed: 1, paths: [], waters: [{ x: 14, y: 8, rx: 2, ry: 3 }],
  clearings: [[0, 0, 20, 18]], regions: [], spawn: { x: 4, y: 4 }, entities: [box] };
const zone = { scene: data.id, protected: [] }, compiled = sharedObjectContract(data, zone);
const inherited = { id: "family-crate", family: "crate", sprite: "crates", x: 8, y: 8, shared: true, rules: [] };
const inheritedData = { ...data, entities: [inherited] }, inheritedBody = new World(inheritedData).entities[0];
assert.deepEqual(sharedObjectContract(inheritedData, zone).props[inherited.id].bounds,
  Object.values(collisionBounds({ ...inheritedBody, x: 0, y: 0 })), "Map declarations inherit the exact World/Studio family footprint");
const model = new World(data), object = model.entities.find(e => e.id === box.id);
const authority = new SharedObjects({ scenes: { fixture: { width: 320, height: 288, objects: compiled } } });
const state = authority.scenes.get("fixture"), prop = authority.prop("fixture", box.id);
let parity = 0;
for (let y = 0; y < 288; y += 3) for (let x = 0; x < 320; x += 3) {
  assert.equal(authority.canPlace(state, prop, x, y), canPlace(model, object, x, y), `Placement parity at ${x},${y}`); parity++;
}
assert.equal(compiled.pushSpeed, WALK_SPEED * PUSH_SPEED_RATIO);
assert.deepEqual(compiled.props[box.id].bounds, Object.values(collisionBounds({ ...object, x: 0, y: 0 })));
assert.deepEqual(sharedObjectContract({ ...data, entities: [{ ...box, shared: false }] }, zone).props, {}, "Personal puzzle props are not exported; the zone still has construction authority");
assert.equal(sharedObjectContract({ ...data, entities: [] }, null), null, "Non-community scenes do not need construction metadata");
for (const extra of [{ pushable: false }, { hiddenWhen: { flags: { done: true } } }, { resource: "node" }, { actor: true }, { rules: [{ effects: [] }] }])
  assert.throws(() => sharedObjectContract({ ...data, entities: [{ ...box, ...extra }] }, zone), /Shared prop/);
assert.throws(() => sharedObjectContract(data, null), /outdoor community zone/);
const groundAtHome = entities => {
  const ground = catalogGround({ scenes: { fixture: { ...data, entities } } }, "fixture");
  return ground.cells[8 * ground.width + 8] === 1;
};
assert.equal(groundAtHome([box]), groundAtHome([]), "Communal object's authored home must not leave a permanent terrain hole");
assert.equal(groundAtHome([{ ...box, shared: false }]), false, "Private puzzle colliders remain in authored construction terrain");

// Check the actual curved lake/river boundaries too, rather than only synthetic rectangles.
const world = JSON.parse(fs.readFileSync(path.join(__dirname, "../.local/build/world.json")));
const start = performance.now();
for (const id of ["overworld", "river-willows"]) {
  const real = new World(world.scenes[id]), mask = compileGround(real), ground = new DryGround(mask, real.width * 16, real.height * 16);
  let count = 0;
  for (let y = 0; y < ground.height; y += 7) for (let x = 0; x < ground.width; x += 7) {
    assert.equal(ground.at(x, y), real.terrainCanStand(x, y), `${id}: native terrain mismatch ${x},${y}`); count++;
  }
  console.log(`PASS ${id}: ${count} real terrain samples; ${Buffer.byteLength(JSON.stringify(mask))} server-only bytes`);
}
console.log(`PASS ${parity} local/server prop placements; compilation took ${Math.round(performance.now() - start)} ms; private puzzles stay private.`);
