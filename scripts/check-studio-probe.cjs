"use strict";
const assert = require("node:assert/strict");
const { ProbeWorld, previewBody } = require("../tools/adventure-studio/probe-world");
const { World } = require("../public/assets/js/adventure/model");
const { docks } = require("../public/assets/js/adventure/docks");
const { boardingPoint, walkableBox, walkableDefinition } = require("../public/assets/js/adventure/dock-geometry");
const { bridgeWalkable, validWalkable } = require("../public/assets/js/adventure/bridge-geometry");
const { compileWorld } = require("../tools/world.cjs");
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const { renderScene } = require("../tools/adventure-studio/scene-edits");
const scene = { id: "probe-test", width: 64, height: 64, paths: [], scenery: [], entities: [
  { id: "wall", sprite: "sign", x: 10, y: 10, solid: [-1, -1, 2, 1] },
  { id: "door", sprite: "doorway", x: 20, y: 20, portal: "house", threshold: [19.5, 20, 1, 0.5], entryDirection: -1 },
] };
const pristine = JSON.stringify(scene), sim = new ProbeWorld(scene);
sim.place({ x: 160, y: 180 });
for (let i = 0; i < 30; i++) sim.step(1 / 60, { x: 0, y: -1 }, false);
assert.equal(sim.contact.id, "wall"); assert(sim.actor.y >= 165); assert(sim.valid);
const world = new World(scene);
assert(world.canStand(sim.actor.x, sim.actor.y));
assert(!world.canStand(sim.actor.x, sim.actor.y - 2));
sim.place({ x: 320, y: 324 });
sim.step(1 / 60, { x: 1, y: 0 }, false); assert(!sim.trigger, "Sideways does not enter");
sim.step(1 / 60, { x: 0, y: -1 }, false); assert.equal(sim.trigger.id, "door");
assert.equal(sim.world.data.id, scene.id, "No actual scene transition");
sim.step(1 / 60, { x: 0, y: 0 }, false); assert(sim.trigger, "Tap trigger remains visible long enough to read");
sim.place({ x: 450, y: 450 });
assert(sim.travel({ x: 470, y: 450 }));
const destination = { ...sim.journey.goal };
for (let i = 0; i < 60; i++) sim.step(1 / 60, { x: 0, y: 0 }, false);
assert.equal(sim.actor.x, destination.x); assert.equal(sim.actor.y, destination.y);
assert.equal(JSON.stringify(scene), pristine, "Testing never mutates source scenes");
const scope = { kind: "sprite", sprite: "sign" };
const preview = previewBody(scene, scope, { solids: [[-2, -1, 4, 1]] });
assert.deepEqual(preview.entities[0].solids, [[-2, -1, 4, 1]]);
assert(!preview.entities[0].solid); assert.deepEqual(scene.entities[0].solid, [-1, -1, 2, 1]);
const compiled = compileWorld(), base = snapshot(process.cwd());
const body = { solids: [], entrance: [-1, -0.625, 0.75, 1.25], walkable: [0, 0.1, 0.9, 0.8] };
const elementScope = { kind: "element", family: "dock-jetty", variant: "planks" };
for (const [id, data] of Object.entries(compiled.scenes)) {
  if (!data.navigation?.landings?.length || !base.world.scenes[id]) continue;
  const initial = renderScene(base, id), draft = previewBody(initial, elementScope, body);
  const committed = renderScene(base, id, {}, { "dock-jetty": { planks: body } });
  assert.deepEqual(draft.bridges, committed.bridges, "Unsaved/saved preview use same projection");
  const probe = new ProbeWorld(draft);
  for (const dock of docks(draft)) {
    const roundtrip = walkableDefinition(dock, walkableBox(dock));
    assert.deepEqual(roundtrip, body.walkable);
    assert(probe.world.canStand(dock.arrival.x, dock.arrival.y), id + ": edited safe arrival");
    const target = boardingPoint(dock); assert(target, id);
    probe.place(target); probe.step(1 / 60, dock.outward, false);
    assert.equal(probe.trigger?.id, dock.id, id + ": actual boarding trigger");
  }
}
const wet = { ...scene, entities: [], baseWater: true, bridges: [{ rect: [5, 5, 10, 5], walkable: [0.2, 0.2, 0.6, 0.6] }] };
const physical = new World(wet);
assert(physical.canStand(160, 120));
assert(!physical.canStand(96, 120), "Artwork outside walkable surface does not support feet");
assert.deepEqual(bridgeWalkable(wet.bridges[0]), [7, 6, 6, 3]);
const shore = new ProbeWorld(wet);
shore.place({ x: 160, y: 120 });
for (let i = 0; i < 90; i++) shore.step(1 / 60, { x: 0, y: 1 }, false);
assert(shore.valid && shore.terrainBlocked, "Shore rejects the next step without moving the feet into water");
for (const box of [[0, 0, 1.1, 1], [-0.1, 0, 1, 1], [0, 0, 0, 1], [0, NaN, 1, 1]]) assert(!validWalkable(box));
console.log("PASS Studio probe: shared feet, collision, direction-guarded doors/docks, draft/saved parity, walkable water surface, no game state writes.");
