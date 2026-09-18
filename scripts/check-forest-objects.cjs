"use strict";
const assert = require("node:assert/strict"), path = require("node:path");
const { World } = require("../public/assets/js/adventure/model");
const { ForestObjects } = require("../public/assets/js/adventure/forest-objects");
const { Journey } = require("../public/assets/js/adventure/journey");
const { move } = require("../public/assets/js/adventure/movement");
const { active } = require("../public/assets/js/adventure/rules");
const { sharedObjectContract } = require("../tools/shared-object-contract.cjs");
const { SharedObjects } = require(path.resolve(process.env.GAME_WEB_REPO || "../magikitos", "bosque-vivo/shared-objects.cjs"));
const data = { id: "forest", width: 24, height: 24, seed: 1, indoor: false, paths: [], waters: [], regions: [],
  clearings: [[0, 0, 24, 24]], spawn: { x: 3, y: 3 }, entities: [
    { id: "crate", sprite: "crates", x: 10, y: 10, solid: [-0.5, -0.5, 1, 1], shared: true, pushable: true, rules: [] },
    { id: "private-pot", sprite: "crates", x: 17, y: 17, solid: [-0.5, -0.5, 1, 1], pushable: true, rules: [] },
  ] };
function fixture(Type = ForestObjects) {
  let now = 1000, input = null;
  const packets = [], world = new World(data), player = { x: 146, y: 160, actor: true }, journey = new Journey();
  const game = { world, player, journey, state: { scene: "forest", flags: {}, inventory: {}, objects: {} }, walking: false,
    river: { active: false }, blocked: () => false, movementIntent: () => input || (journey.path[0] &&
      { x: journey.path[0].x - player.x, y: journey.path[0].y - player.y }),
    live: { role: "player", connection: { ready: true, send: p => { packets.push(p); return true; } } } };
  world.actors = [player]; world.refresh(game.state);
  const objects = game.live.objects = new Type(game, () => now); objects.bind(world);
  return { game, world, player, objects, journey, packets, entity: world.entities[0],
    now: () => now, advance: ms => now += ms, input: value => { input = value; },
    snapshot(rows, scene = "forest") { return objects.snapshot({ now: Math.floor(now), scene, objects: rows }); } };
}
function validateSnapshots(Type = ForestObjects) {
  const f = fixture(Type), { world, objects, entity, game } = f;
  assert(!active(entity, game.state)); assert(!world.collisionGrid.bounds.has(entity), "Unknown source position is not a ghost collider");
  assert(world.collisionGrid.bounds.has(world.entities[1]), "Private puzzle unchanged");
  assert(f.snapshot([["crate", 160, 160, 0]])); assert(world.collisionGrid.bounds.has(entity));
  f.advance(50); assert(f.snapshot([["crate", 163, 160, 1]]));
  assert.equal(entity.x, 163, "Collision jumps to confirmed authority, not the visual interpolation");
  assert.equal(objects.visual(entity).x, 160); f.advance(25); objects.update(); assert.equal(objects.visual(entity).x, 161.5);
  for (const rows of [[["private-pot", 163, 160, 1]], [["crate", NaN, 160, 2]], [["crate", 163, 160, -1]],
    [["crate", 165, 160, 1]], [["crate", 165, 160, 2], ["crate", 166, 160, 2]]]) {
    assert(!f.snapshot(rows)); assert.equal(entity.x, 163, "Invalid packet cannot partly change the world");
  }
  assert(!f.snapshot([], "old-scene")); assert.equal(objects.records.size, 1);
  world.refresh(game.state); assert.equal(entity.x, 163);
  const replacement = new World(data); objects.prepare(replacement);
  assert.equal(replacement.entities[0].x, 163); assert.equal(objects.world, world, "Prewarming cannot steal the current binding");
  game.world = replacement; objects.bind(replacement); assert.equal(objects.visual(replacement.entities[0]).x, 163);
  assert.deepEqual(game.state.objects, {}, "No communal position is written into a personal save");
  assert(f.snapshot([])); assert(!replacement.collisionGrid.bounds.has(replacement.entities[0]));
  replacement.refresh(game.state); assert(!replacement.collisionGrid.bounds.has(replacement.entities[0]), "Refresh cannot resurrect out-of-interest bodies");
  assert(f.snapshot([["crate", 166, 160, 8]])); objects.reconnect();
  assert(f.snapshot([["crate", 160, 160, 1]]), "New process may restore an older persisted revision");
  game.live.role = "spectator"; assert.equal(objects.push(replacement.entities[0], 1, 0), false);
  game.live.role = "player"; game.live.connection.ready = false; assert.equal(objects.push(replacement.entities[0], 1, 0), false);
}
function simulate(fps, click = false) {
  const f = fixture(), { game, objects, entity, player, world, journey } = f;
  const server = new SharedObjects({ scenes: { forest: { width: 384, height: 384,
    objects: sharedObjectContract(data, { scene: "forest", protected: [] }) } }, now: f.now });
  const peer = { user: 1, session: "one", transport: {}, scene: "forest", x: player.x, y: player.y,
    pose: "push", mode: "foot", expiresAt: 1e9, observedAt: f.now() }, peers = new Map([[1, peer]]);
  assert(f.snapshot(server.visible("forest", [0, 0, 384, 384])));
  if (click) assert(journey.start(world, player, { kind: "push", entity }));
  else f.input({ x: 1, y: 0 });
  let nextSend = 0, tick = 0, frames = 0;
  const step = () => {
    f.advance(1000 / fps); objects.begin(world);
    const resolveCollision = (e, dx, dy) => objects.push(e, dx, dy);
    game.walking = click ? journey.step(world, player, 1 / fps, 72, { resolveCollision }).moved :
      move(world, player, 72 / fps, 0, () => {}, { resolveCollision });
    objects.update();
    if (f.now() >= nextSend) {
      nextSend = f.now() + 100;
      Object.assign(peer, { x: player.x, y: player.y, observedAt: f.now() });
      objects.transmit();
      for (const packet of f.packets.splice(0)) server.receive(peer, "player", packet);
    }
    server.tick(peers);
    if (f.now() >= tick) { tick = f.now() + 50; assert(f.snapshot(server.visible("forest", [0, 0, 384, 384]))); }
    assert(world.canStand(player.x, player.y, player), "Real input must never penetrate the confirmed box"); frames++;
  };
  // Opposite player holds the box while a real click journey waits for network authority.
  if (click) {
    const opposite = { ...peer, user: 2, session: "two", transport: {}, x: 174 }; peers.set(2, opposite);
    for (let i = 0; i < fps; i++) {
      opposite.observedAt = f.now(); server.receive(opposite, "player", { scene: "forest", object: "crate", direction: "left" });
      step();
    }
    assert(journey.intent, "Waiting for authority cannot finish/cancel a click push");
    assert(journey.replans < 2, "Network wait cannot keep extending/replanning the intended push");
    peers.delete(2); server.cancel(2);
  }
  for (let i = 0; i < fps * 5 && (!click || journey.intent); i++) step();
  assert(entity.x > 170, "Admitted player really moves the server-owned crate");
  if (click) assert.equal(journey.intent, null, "Click push eventually reaches its original endpoint");
  objects.stop(); assert.equal(f.packets.at(-1).object, null, "Stopping immediately cancels the last push");
  assert.deepEqual(game.state.objects, {});
  return frames;
}
function run() {
  validateSnapshots();
  for (const fps of [20, 30, 60, 120]) { simulate(fps); simulate(fps, true); }
  console.log("PASS shared client: authoritative collision, visual interpolation, interest eviction/rebinding, malformed packets, offline/spectator guards and real keyboard/click pushes at 20/30/60/120 Hz.");
}
if (require.main === module) run();
module.exports = { run, fixture, validateSnapshots };
