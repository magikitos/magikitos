"use strict";
const assert = require("node:assert/strict");
const { World } = require("../public/assets/js/adventure/model");
const { Journey, RETRY_SECONDS } = require("../public/assets/js/adventure/journey");
const { Adventure } = require("../public/assets/js/adventure/game");
const { RollMotion, RUN_SPEED } = require("../public/assets/js/adventure/locomotion");
const { tryPush } = require("../public/assets/js/adventure/movables");
const { move } = require("../public/assets/js/adventure/movement");

function fixture(entities = []) {
  const world = new World({ id: "test", width: 32, height: 24, indoor: true,
    paths: [], waters: [], clearings: [], regions: [], entities, seed: 1 });
  const actor = { x: 88, y: 184, actor: true };
  world.actors = [actor];
  return { world, actor, journey: new Journey() };
}
const obstacle = (id, x = 12, y = 11.5, extra = {}) => ({
  id, x, y, solid: [-0.5, -0.5, 1, 1], rules: [{ effects: [] }], ...extra,
});
const destination = { x: 392, y: 184 };
function start(f, intent = { kind: "ground", point: destination }) {
  assert(f.journey.start(f.world, f.actor, intent), "Reachable intention starts");
}
function finish(f, { fps = 60, during = () => {}, ...options } = {}) {
  const arrivals = [], positions = [];
  for (let i = 0; i < fps * 20 && f.journey.intent; i++) {
    during(i, f);
    const result = f.journey.step(f.world, f.actor, 1 / fps, RUN_SPEED, options);
    if (result.arrived) arrivals.push(result.arrived);
    positions.push({ x: f.actor.x, y: f.actor.y });
    assert(f.world.canStand(f.actor.x, f.actor.y, f.actor), "No body/shore penetration");
  }
  assert.equal(f.journey.intent, null, "Journey reaches its destination");
  return { arrivals, positions };
}
for (const fps of [20, 30, 60, 120]) {
  const f = fixture([obstacle("sign"), obstacle("pot", 17, 11.5, { pushable: true })]);
  start(f);
  const { arrivals, positions } = finish(f, { fps, resolveCollision: () => {
    throw Error("A ground click must never try to push any object");
  } });
  assert.deepEqual(arrivals, []);
  assert.deepEqual({ x: f.actor.x, y: f.actor.y }, destination);
  assert(positions.some(p => Math.abs(p.y - destination.y) > 12), "Detours around solid props");
}
{
  // A thin off-center body whose occupied cell doesn't cover the player's feet.
  const f = fixture([obstacle("edge", 12, 10.92, { solid: [-0.5, -0.1, 1, 0.2] })]);
  start(f); finish(f);
}
{
  const f = fixture(); start(f);
  // Walk into a route already planned, not merely an obstacle present at click time.
  const neighbor = { id: "visitor", x: 200, y: 184, neighbor: true };
  f.world.actors.push(neighbor);
  assert.equal(f.journey.pace.running, true);
  const { arrivals, positions } = finish(f);
  assert.deepEqual(arrivals, []);
  assert(positions.some(p => Math.abs(p.y - 184) > 12), "Reroutes around a new resident");
}
{
  const f = fixture(); start(f);
  const neighbor = { id: "visitor", ...destination, neighbor: true };
  f.world.actors.push(neighbor);
  // Wait at an occupied destination; don't silently choose a different endpoint.
  for (let i = 0; i < 600; i++) f.journey.step(f.world, f.actor, 1 / 120, RUN_SPEED);
  assert.equal(f.journey.intent.kind, "ground");
  assert.equal(f.journey.pace.speed(f.actor, f.journey.path), RUN_SPEED, "Waiting is not arrival; it preserves the chosen gait");
  assert.deepEqual(f.journey.intent.point, destination);
  assert(f.journey.replans <= Math.ceil(5 / RETRY_SECONDS), "Searches are throttled, not per-frame");
  f.world.actors.pop(); finish(f);
  assert.deepEqual({ x: f.actor.x, y: f.actor.y }, destination);
}
{
  const f = fixture([obstacle("selected", 24, 11.5), obstacle("incidental")]);
  const selected = f.world.entities[0];
  start(f, { kind: "interact", entity: selected });
  const { arrivals } = finish(f);
  assert.deepEqual(arrivals, [selected], "Only the deliberately clicked entity arrives, exactly once");
  assert(!f.journey.step(f.world, f.actor, 1 / 60, RUN_SPEED).arrived);
}
{
  const f = fixture(), neighbor = { id: "selected", x: 250, y: 184, neighbor: true };
  f.world.actors.push(neighbor); start(f, { kind: "interact", entity: neighbor });
  neighbor.x = 390;
  assert.deepEqual(finish(f).arrivals, [neighbor], "A moved target is re-approached, not forgotten");
}
{
  const f = fixture([obstacle("pot", 12, 11.5, { pushable: true })]);
  const selected = f.world.entities[0], before = selected.x;
  start(f, { kind: "push", entity: selected });
  finish(f, { resolveCollision: (entity, dx, dy) => {
    assert.equal(entity, selected);
    return tryPush(f.world, f.actor, entity, dx, dy, f.world.state);
  } });
  assert(selected.x > before + 12, "An explicit push still moves the selected box");
}
{
  const f = fixture(); start(f);
  const game = Object.assign(Object.create(Adventure.prototype), {
    ready: true, world: f.world, player: f.actor, journey: f.journey,
    river: { active: false },
    roll: new RollMotion(), keys: new Set(), blocked: () => false, unlockAudio() {},
  });
  game.startRoll();
  assert(game.roll.current);
  assert.equal(f.journey.intent.kind, "ground", "Roll keeps click intention");
  f.world.actors.push({ id: "crossing", x: 160, y: 184, neighbor: true });
  for (let i = 0; i < 60 && game.roll.current; i++)
    game.roll.step(f.world, f.actor, 1 / 60, () => {});
  game.finishRoll();
  assert.equal(f.journey.pace.rollPending, false, "Detour never adds another automatic roll");
  finish(f);
  assert.deepEqual({ x: f.actor.x, y: f.actor.y }, destination);
}
{
  const f = fixture(); start(f);
  const path = JSON.stringify(f.journey.path);
  assert.equal(f.journey.step(f.world, f.actor, 0, RUN_SPEED).moved, false);
  assert.equal(JSON.stringify(f.journey.path), path, "Zero elapsed time cannot consume or replan a route");
  assert.equal(f.journey.replans, 0);
  f.journey.clear();
  const before = { ...f.actor };
  for (let i = 0; i < 100; i++) f.journey.step(f.world, f.actor, 0.05, RUN_SPEED);
  assert.deepEqual(f.actor, before, "A cancelled route cannot reappear after retry");
}
{
  const f = fixture([obstacle("temporary", 24, 11.5, { hiddenWhen: { flags: { gone: true } } })]);
  start(f, { kind: "interact", entity: f.world.entities[0] });
  f.world.state.flags.gone = true;
  assert(!f.journey.step(f.world, f.actor, 0.05, RUN_SPEED).arrived);
  assert.equal(f.journey.intent, null, "An inactive target is cancelled, never interacted with");
}
{
  const f = fixture([obstacle("sign", 7, 11.5)]);
  const game = Object.assign(Object.create(Adventure.prototype), {
    world: f.world, state: f.world.state, journey: f.journey,
    interact: entity => { game.contacted = entity; },
  });
  move(f.world, f.actor, 40, 0, entity => game.contact(entity));
  assert.equal(game.contacted, f.world.entities[0], "Keyboard bump dialogue remains intentional");
  game.contacted = null;
  move(f.world, f.actor, 40, 0, entity => game.contact(entity));
  assert.equal(game.contacted, null, "The same contact latch still prevents repeated bump dialogue");
}
console.log("PASS journeys: static/live avoidance, footprint edges, throttled wait/resume, exact target dispatch, deliberate pushing, roll resumption, cancellation and keyboard bumps at 20/30/60/120 Hz.");
