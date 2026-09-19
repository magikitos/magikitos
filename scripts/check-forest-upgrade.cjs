"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { planReaction, active } = require("../public/assets/js/adventure/rules");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { collected } = require("../public/assets/js/adventure/resources");
const { ServerClock } = require("../public/assets/js/adventure/server-clock");
const { growthDeadline, germinating, drawGrowing } = require("../public/assets/js/adventure/construction-growth");
const { gameContract } = require("../tools/game-contract.cjs");
const world = JSON.parse(execFileSync("php", ["-r", 'echo json_encode(require "data/aventura/world.php");']));
const contract = gameContract(world);
const node = world.scenes.overworld.entities.find(e => e.id === "forest-mushrooms-fern");
// El ciclo de las setas es dato (ocho horas desde el 19-sep-2026, decisión del dueño): se lee del nodo.
const cycle = node.resource.renewMs, now = 100 * cycle + 1000;
assert.equal(cycle, 8 * 3600000, "Mushrooms regrow every eight hours");
const fresh = () => cleanSave(null, world);
let state = fresh();
const reaction = (e, context = {}) => {
  const plan = planReaction(e, state, world, { now, ...context });
  if (plan) state = plan.state;
  return plan;
};
assert(!reaction(node).state.inventory.mushroom, "No knife, no mushrooms");
assert(!collected(state, node.resource, now), "The hint does not spend the node");
state.inventory.knife = 1;
reaction(node);
assert.equal(state.inventory.mushroom, 1);
assert(!active(node, state, { now }), "Harvest disappears");
assert.equal(reaction(node), null, "Cannot harvest twice in one cycle");
const wallClock = Date.now;
try {
  Date.now = () => now;
  state = cleanSave(JSON.parse(JSON.stringify(state)), world);
} finally { Date.now = wallClock; }
assert(!active(node, state, { now }), "Reload preserves a harvested patch in its cycle");
const next = world.scenes.overworld.entities.find(e => e.id === "forest-mushrooms-root");
reaction(next);
assert.equal(state.inventory.mushroom, 2, "Independent patches stack in one counter");
const fire = world.scenes.overworld.entities.find(e => e.id === "picnic-barbecue");
const neighbor = world.scenes.overworld.entities.find(e => e.id === "picnic-neighbor");
state.flags.fireLit = true;
state.inventory.twig = 1;
reaction(fire, { action: "cook" });
assert.equal(state.inventory.mushroom, 1, "Recipe consumes just one mushroom");
reaction(neighbor, { action: "give" });
assert(!active(node, state, { now }), "Giving the skewer cannot respawn mushrooms");
assert(!active(node, state, { now: 101 * cycle - 1 }));
assert(active(node, state, { now: 101 * cycle }), "Renews at the regional cycle");
state.inventory.mushroom = 99;
assert.equal(reaction(node, { now: 101 * cycle }), null, "Full bag cannot consume a renewed node");
state.inventory.mushroom = 98;
reaction(node, { now: 101 * cycle });
assert.equal(state.inventory.mushroom, 99);
assert.equal(state.inventory.knife, 1, "Knife remains reusable");
const patches = Object.values(world.scenes).flatMap(s => s.entities.filter(e => e.family === "ground-mushrooms"));
assert(patches.length >= 7);
assert(new Set(patches.map(e => e.artVariant)).size >= 4);
for (const [scene, data] of Object.entries(world.scenes))
  for (const e of data.entities.filter(e => e.family === "ground-mushrooms")) {
    assert.equal(e.resource.renewMs, cycle);
    assert.equal(e.resource.keepVisible, false);
    assert.deepEqual(contract.adventure.entities[scene][e.id].resource, e.resource);
  }
assert(!world.scenes.overworld.entities.some(e => e.id === "picnic-mushroom"));
assert.equal(world.items.mushroom.max, 99);

state = fresh();
for (const id of ["woodland-rake", "woodland-grass-seeds"]) {
  const e = world.scenes.overworld.entities.find(e => e.id === id);
  reaction(e);
  assert(!active(e, state, { now }));
  assert.equal(reaction(e), null);
}
assert.equal(state.inventory.rake, 1);
assert.equal(state.inventory.grassSeed, 10);
delete state.inventory.grassSeed;
assert(!active(world.scenes.overworld.entities.find(e => e.id === "woodland-grass-seeds"), state, { now }),
  "Spending every grass seed does not reset a historical pickup");
assert(world.items.rake.reusable);

for (const [id, item] of [["forest-parchment", "parchment"], ["forest-pen", "pen"]]) {
  const entity = world.scenes.overworld.entities.find(e => e.id === id);
  assert(entity?.rules?.length, `${id} has compiled pickup rules, not only a Studio sprite`);
  assert.deepEqual(contract.adventure.entities.overworld[id].rules, entity.rules);
  assert(active(entity, state, { now }));
  reaction(entity);
  assert.equal(state.inventory[item], 1);
  assert(world.items[item].reusable);
  assert(!active(entity, state, { now }));
  assert.equal(reaction(entity), null, "A writing tool cannot be picked up twice");
}
assert.deepEqual(contract.adventure.messages.tools, ["parchment", "pen"]);
assert.deepEqual(contract.adventure.needs, world.needs);

let elapsed = 10;
const clock = new ServerClock(() => elapsed), hour = 3_600_000;
const createdAt = "2026-09-18T10:00:00Z", epoch = Date.parse(createdAt);
assert.equal(clock.now(), null, "No fabricated calendar before first server sample");
clock.sync(epoch);
const definition = world.construction.definitions["forest-flowers"];
const plant = { x: 25, y: 30, growsAt: growthDeadline({ createdAt }, definition) };
assert(germinating(plant, clock.now()));
const realDateNow = Date.now;
try {
  Date.now = () => epoch + 100 * hour;
  assert(germinating(plant, clock.now()), "Advancing device wall time cannot grow the plant");
  Date.now = () => 0;
  elapsed += hour - 1;
  assert(germinating(plant, clock.now()), "One millisecond before maturity");
  elapsed++;
  assert(!germinating(plant, clock.now()), "Exactly one server hour");
} finally { Date.now = realDateNow; }
assert.throws(() => clock.sync(NaN), /invalid_server_time/);
assert.throws(() => growthDeadline({ createdAt: "2026-09-18 10:00:00" }, definition), /invalid_plant_time/);
assert.equal(growthDeadline({ createdAt, x: 200 }, definition), plant.growsAt, "Moving preserves age");
const painted = [];
const ctx = { save() {}, restore() {}, fillRect: (...args) => painted.push(args) };
assert(drawGrowing(ctx, plant, epoch));
assert(painted.length >= 3, "Unripe plant actually paints soil");
painted.length = 0;
assert(!drawGrowing(ctx, plant, epoch + hour));
assert.equal(painted.length, 0, "Mature plant yields to its normal sprite");
for (const [kind, seed] of [["forest-flowers", "primroseSeed"], ["daisy-flowers", "daisySeed"], ["bell-flowers", "bellSeed"]]) {
  const d = world.construction.definitions[kind];
  assert.equal(d.growAfterMs, hour);
  assert.equal(d.solid, false);
  assert.deepEqual(d.cost, { [seed]: 1 });
  assert(world.scenes.overworld.entities.some(e => e.rules.some(r => r.effects.some(f => f.item === seed && f.amount > 0))), "Seeds are actually obtainable");
}
assert.equal(fs.readFileSync("docs/world-api.openapi.json", "utf8"), fs.readFileSync("../magikitos/docs/world-api.openapi.json", "utf8"));
assert.equal(fs.readFileSync("docs/forest-protocol.json", "utf8"), fs.readFileSync("../magikitos/docs/forest-protocol.json", "utf8"));
assert.equal(contract.live.start, world.start);
for (const [id, scene] of Object.entries(world.scenes)) {
  assert.equal(contract.live.scenes[id].width, scene.width * 16);
  assert.equal(contract.live.scenes[id].height, scene.height * 16);
  assert.deepEqual(contract.live.scenes[id].spawn, { x: scene.spawn.x * 16, y: scene.spawn.y * 16 });
  assert.equal(contract.live.scenes[id].maxFootSpeed, require("../public/assets/js/adventure/locomotion").RUN_SPEED);
}
console.log("PASS forest upgrade: multi-patch mushrooms, eight-hour bits, reusable tools, exact meal regression, capped bag, historical pickups, obtainable flower seeds, server-clock growth and mirrored API.");
