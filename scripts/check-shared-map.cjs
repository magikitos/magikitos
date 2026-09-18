"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { World } = require("../public/assets/js/adventure/model"), { cleanPositions } = require("../public/assets/js/adventure/movables");
const { SharedObjects } = require("../../magikitos/bosque-vivo/shared-objects.cjs");
const build = path.resolve(__dirname, "../.local/build");
const world = JSON.parse(fs.readFileSync(path.join(build, "world.json")));
const pointer = JSON.parse(fs.readFileSync(path.join(build, "current.json")));
const contract = JSON.parse(fs.readFileSync(path.join(build, "releases", pointer.id, "game-contract.json")));
let now = 1800000000000;
const objects = new SharedObjects({ scenes: contract.live.scenes, now: () => now });
const expected = { overworld: ["clearing-willow-crate", "art-moveable-planter"], "river-willows": ["meadow-harbor-crate"] };
for (const [scene, ids] of Object.entries(expected)) {
  const model = new World(world.scenes[scene]), forbiddenSave = {};
  for (const id of ids) {
    const e = model.entities.find(e => e.id === id), prop = objects.prop(scene, id), state = objects.scenes.get(scene);
    assert(e?.shared && e.pushable && e.solid && prop, "Real authored movable must have live authority: " + id);
    assert.equal(e.x, prop.x); assert.equal(e.y, prop.y);
    const steps = [[16, 0], [-16, 0], [0, 16], [0, -16]];
    assert(steps.filter(([x, y]) => objects.canPlace(state, prop, prop.x + x, prop.y + y)).length >= 2,
      "Authored props need room, not a trapped decoration: " + id);
    forbiddenSave[id] = { x: e.x + 16, y: e.y };
    const [ox, oy, w, h] = prop.bounds;
    const a = { user: 1, scene, x: prop.x + ox - 6, y: prop.y + oy + h / 2, mode: "foot", pose: "push",
      expiresAt: now + 60000, observedAt: now, transport: {}, session: "a" };
    const b = { ...a, user: 2, x: prop.x + ox + w + 6, transport: {}, session: "b" };
    const start = prop.x;
    objects.receive(a, "player", { scene, object: id, direction: "right" });
    objects.receive(b, "player", { scene, object: id, direction: "left" });
    now += 50; objects.tick(new Map([[1, a], [2, b]]));
    assert.equal(prop.x, start, "Opposition cancels on the actual authored body: " + id);
    objects.cancel(1); objects.cancel(2);
  }
  assert.deepEqual(cleanPositions({ [scene]: forbiddenSave }, world, { flags: {}, inventory: {} }), {},
    "Old/private saves cannot restore any authored communal object");
}
const privatePots = new World(world.scenes["human-hedge"]).entities.filter(e => e.pushable);
assert.equal(privatePots.length, 5); assert(privatePots.every(e => !e.shared));
assert(!contract.live.scenes["human-hedge"].objects, "The cats' personal puzzle is not part of public physics");
console.log("PASS authored shared map: three family-derived movable bodies in two scenes, free approaches, real opposing forces, no private-save positions and five independent puzzle pots.");
