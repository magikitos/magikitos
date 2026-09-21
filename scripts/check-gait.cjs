"use strict";
const assert = require("node:assert/strict");
const { GAITS, DIRECTIONS, advanceGait, recordStep, gaitPose, characterFrame, runFrame } = require("../public/assets/js/adventure/characters");
const { move, follow } = require("../public/assets/js/adventure/movement");
const { Journey } = require("../public/assets/js/adventure/journey");
const { WALK_SPEED, RUN_SPEED } = require("../public/assets/js/adventure/locomotion");
const { ForestPeople } = require("../public/assets/js/adventure/forest-people");
const { protocol } = require("../public/assets/js/adventure/forest-connection");
const manifest = require("../public/assets/aventura/manifest.json");
const catalog = require("../.local/build/world.json");
const owners = new Set(Object.values(manifest.packs).flatMap(p => p.sprites));
const clear = { collisionAt: () => null, canStand: () => true, clearSegment: () => true };
const near = (a, b, why) => assert(Math.abs(a - b) < 1e-8, `${why}: ${a} vs ${b}`);
// A phase is circular: accumulated floating-point error may represent 0 as 1-epsilon.
const nearPhase = (a, b, why) => near(Math.min(Math.abs(a-b), Math.abs(a-b-1), Math.abs(a-b+1)), 0, why);

for (const [pace, speed] of [["walk", WALK_SPEED], ["run", RUN_SPEED]]) {
  assert(speed / GAITS[pace].stride * 4 <= 12, "Each pose lasts >= 83 ms at full speed");
  for (const fps of [20, 30, 60, 120, 144]) {
    for (const diagonal of [false, true]) {
      const actor = { x: 0, y: 0 }, step = speed / fps / (diagonal ? Math.SQRT2 : 1);
      const poses = new Set();
      for (let i = 0; i < fps; i++) {
        move(clear, actor, step, diagonal ? step : 0, undefined, { gait: pace });
        poses.add(gaitPose(actor, pace));
      }
      near(actor.walkDistance, speed, "Speed and diagonal normalization are unchanged");
      nearPhase(actor.gaitPhase, speed / GAITS[pace].stride % 1, `${pace} at ${fps} FPS`);
      assert.equal(poses.size, pace === "walk" ? 3 : 4, "Every authored leg pose is visible");
      const old = { ...actor };
      assert(!move({ ...clear, collisionAt: () => ({ id: "wall" }) }, actor, 5, 0, undefined, { gait: pace }));
      near(actor.gaitPhase, old.gaitPhase, "A blocked actor cannot tread on the spot");
      near(actor.walkDistance, old.walkDistance, "A blocked actor travels zero pixels");
    }
    const actor = { x: 0, y: 0 }, path = Array.from({ length: 400 }, (_, i) => ({ x: i + 1, y: 0 }));
    for (let i = 0; i < fps; i++) follow(clear, actor, path, 1 / fps, speed, undefined, undefined, { gait: pace });
    nearPhase(actor.gaitPhase, speed / GAITS[pace].stride % 1, "Waypoints cannot reset or accelerate legs");
  }
  const actor = { x: 0, y: 0 }, journey = new Journey();
  journey.intent = { kind: "ground", point: { x: 400, y: 0 } };
  journey.path = [journey.intent.point];
  journey.step(clear, actor, 0.05, speed, { gait: pace });
  near(actor.gaitPhase, speed * 0.05 / GAITS[pace].stride, "Click journeys forward the requested gait");
}

const actor = { direction: "down", walkDistance: 99999, gaitPhase: 0.3 };
assert.equal(gaitPose(actor, "walk"), 2);
assert.equal(gaitPose(actor, "run"), 1, "Space keeps the same quarter-cycle, not a new lifetime-distance modulo");
recordStep(actor, GAITS.run.stride / 100, 0, "run");
near(actor.gaitPhase, 0.31, "Pace change advances continuously");
recordStep(actor, 0, -GAITS.walk.stride / 100, "walk");
near(actor.gaitPhase, 0.32, "Turning and slowing retain phase");
recordStep(actor, 0, 0);
near(actor.gaitPhase, 0.32, "Idle does not advance");
assert.equal(characterFrame(100, actor, false), "person-100-up");
assert.equal(runFrame(actor, false), null);

for (const variant of catalog.playerArt.enabledVariants) {
  for (const direction of DIRECTIONS) for (let slot = 0; slot < 4; slot++) {
    const a = { variant, direction, gaitPhase: slot / 4 };
    assert(owners.has(characterFrame(variant, a, true)), `Walk art ${variant}/${direction}/${slot}`);
    assert(owners.has(runFrame(a, true)), `Run art ${variant}/${direction}/${slot}`);
  }
}

// Same rendered distance -> same leg, whether keyboard, click or network. No
// per-identity exceptions, no animation progressing after a dropped connection.
let clock = 0;
const peers = new ForestPeople(v => v, () => clock), id = "a".repeat(24);
const packet = (x, pose) => ({ scene: "test", people: [[id, x, 100, 2, protocol.poses.indexOf(pose), 100, 0]] });
const snap = (x, pose) => assert(peers.snapshot(packet(x, pose), "test", { width: 1000, height: 1000 }));
snap(100, "walk"); peers.update();
const local = { variant: 100, direction: "right" };
for (const pace of ["walk", "run", "walk"]) {
  const from = peers.list[0].x;
  snap(from + 16, pace);
  for (let step = 0; step < 4; step++) {
    clock += protocol.limits.playerSnapshotMs / 4;
    peers.update(); advanceGait(local, 4, pace);
    assert.equal(peers.list[0].sprite, pace === "run" ? runFrame(local, true) : characterFrame(100, local, true));
    const painted = peers.list[0].sprite;
    peers.update();
    assert.equal(peers.list[0].sprite, painted, "A zero-delta paint between packets cannot flash idle");
  }
}
const phase = peers.list[0].gaitPhase;
clock += 1000; peers.update();
assert.equal(peers.list[0].sprite, "person-100-right");
near(peers.list[0].gaitPhase, phase, "Network loss cannot animate feet without travel");
snap(peers.list[0].x + 10, "run"); clock += 50; peers.update(true);
assert.equal(peers.list[0].sprite, "person-100-right", "Reduced-motion peer stays still without changing its location");

console.log(`PASS gait: ${catalog.playerArt.enabledVariants.length} protagonists × 8 directions; walk/run phase continuity, 20–144 FPS, diagonals, stops, collisions, multi-waypoint journeys and peer parity.`);
