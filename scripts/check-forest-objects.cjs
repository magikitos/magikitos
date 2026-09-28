"use strict";
const assert = require("node:assert/strict"), path = require("node:path");
const { World } = require("../public/assets/js/adventure/model");
const { ForestObjects } = require("../public/assets/js/adventure/forest-objects");
const { Journey } = require("../public/assets/js/adventure/journey");
const { move } = require("../public/assets/js/adventure/movement");
const { WALK_SPEED } = require("../public/assets/js/adventure/locomotion");
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
  assert.strictEqual(objects.visualPlayer(), game.player, "A world change drops any previous visual push offset");
  assert.deepEqual(game.state.objects, {}, "No communal position is written into a personal save");
  assert(f.snapshot([])); assert(!replacement.collisionGrid.bounds.has(replacement.entities[0]));
  replacement.refresh(game.state); assert(!replacement.collisionGrid.bounds.has(replacement.entities[0]), "Refresh cannot resurrect out-of-interest bodies");
  assert(f.snapshot([["crate", 166, 160, 8]])); objects.reconnect();
  assert.strictEqual(objects.visualPlayer(), game.player, "Reconnecting drops any previous visual push offset");
  assert(f.snapshot([["crate", 160, 160, 1]]), "New process may restore an older persisted revision");
  game.live.role = "spectator"; assert.equal(objects.push(replacement.entities[0], 1, 0), false);
  game.live.role = "player"; game.live.connection.ready = false; assert.equal(objects.push(replacement.entities[0], 1, 0), false);
}
function validateSmoothMotion(Type = ForestObjects) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
  for (const fps of [20, 30, 60, 120]) for (const packetMs of [50, 100]) for (const reducedMotion of [false, true]) {
    const f = fixture(Type), { objects, entity, game, player, world } = f;
    const along = point => point.x * dx + point.y * dy;
    Object.assign(player, { x: 160 - dx * 14, y: 160 - dy * 13 });
    game.reducedMotion = reducedMotion;
    f.input({ x: dx, y: dy });
    f.snapshot([["crate", 160, 160, 0]]);
    let nextPacket = packetMs, previous = along(entity), previousPose = false, stalls = 0, poseResets = 0;
    const contactGaps = [];
    for (let frame = 1; frame <= fps * 2; frame++) {
      const elapsed = frame * 1000 / fps;
      f.advance(1000 / fps);
      if (elapsed + 0.001 >= nextPacket) {
        f.snapshot([["crate", 160 + dx * nextPacket * 0.06, 160 + dy * nextPacket * 0.06, Math.round(nextPacket / packetMs)]]);
        nextPacket += packetMs;
      }
      objects.begin(world);
      game.walking = move(world, player, dx * 84 / fps, dy * 84 / fps, () => {}, {
        resolveCollision: (e, dx, dy) => objects.push(e, dx, dy),
      });
      objects.update();
      const x = along(objects.visual(entity)), movingPose = Boolean(player.pushing?.moved);
      if (elapsed > 400) {
        if (x - previous < 0.001) stalls++;
        if (previousPose && !movingPose) poseResets++;
        assert(x >= previous, "Confirmed forward pushes never render a backward step");
        contactGaps.push(x - along(objects.visualPlayer()));
      }
      assert(x <= along(entity) + 0.001, "The visual object never predicts an unconfirmed position");
      assert(world.canStand(player.x, player.y, player), "Smoothing never changes authoritative collision");
      previous = x; previousPose = movingPose;
    }
    const label = `${dx},${dy}: ${fps} Hz, packets every ${packetMs} ms, reduced motion ${reducedMotion}`;
    assert.equal(stalls, 0, "No frozen frames during a steady push: " + label);
    assert.equal(poseResets, 0, "The pushing pose does not flash idle between packets: " + label);
    assert(Math.max(...contactGaps) - Math.min(...contactGaps) < 0.001,
      "The rendered player and camera keep a stable distance from the pushed object: " + label);
    f.input(null); objects.stop(); f.advance(1000); objects.begin(world); objects.update();
    assert.equal(along(objects.visual(entity)), along(entity), "A stopped stream settles at the last confirmed position");
    assert(Math.abs(along(objects.visualPlayer()) - along(player)) < 0.001, "Releasing settles the visual player onto the real body");
    assert.deepEqual(game.state.objects, {}, "Smoothing never persists a communal prop");
  }
  const f = fixture(Type), { objects, entity, game } = f;
  f.snapshot([["crate", 160, 160, 0]]);
  f.advance(10000); f.snapshot([["crate", 163, 160, 1]]);
  f.advance(50); objects.update();
  assert.equal(objects.visual(entity).x, 163, "A push after a long rest does not interpolate over the idle time");
  f.advance(50); objects.begin(f.world); objects.update();
  assert(!game.player.pushing, "A stationary object does not invent a pushing pose");
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
  let nextSend = 0, tick = 0, frames = 0, lastPacket = null;
  const deliver = () => {
    for (const packet of f.packets.splice(0)) {
      lastPacket = packet;
      server.receive(peer, "player", packet);
    }
  };
  const step = () => {
    f.advance(1000 / fps); objects.begin(world);
    const resolveCollision = (e, dx, dy) => objects.push(e, dx, dy);
    game.walking = click ? journey.step(world, player, 1 / fps, WALK_SPEED, { resolveCollision }).moved :
      move(world, player, WALK_SPEED / fps, 0, () => {}, { resolveCollision });
    objects.update();
    if (f.now() >= nextSend) {
      nextSend = f.now() + 100;
      Object.assign(peer, { x: player.x, y: player.y, observedAt: f.now() });
      objects.transmit();
      deliver();
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
  // A completed click journey may already have sent cancellation in this tick.
  // Verify the delivered state, not whether a duplicate happens to remain queued.
  const wasSent = Boolean(objects.sent);
  objects.stop();
  if (wasSent) assert.equal(f.packets.at(-1)?.object, null, "Stopping queues cancellation immediately");
  deliver();
  assert.equal(lastPacket?.object, null, "The final command cancels the last push");
  assert(!server.intents.has(peer.user), "No server push intent survives stopping");
  assert.deepEqual(game.state.objects, {});
  return frames;
}
function run() {
  validateSnapshots();
  validateSmoothMotion();
  for (const fps of [20, 30, 60, 120]) { simulate(fps); simulate(fps, true); }
  console.log("PASS shared client: authoritative collision, continuous four-direction rendering/poses at 20/30/60/120 Hz and 50/100 ms snapshots, reduced motion, release, interest eviction/rebinding, malformed packets, offline/spectator guards and real keyboard/click pushes.");
}
if (require.main === module) run();
module.exports = { run, fixture, validateSnapshots, validateSmoothMotion };
