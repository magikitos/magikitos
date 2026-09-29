"use strict";
const assert = require("node:assert/strict");
const { compileWorld } = require("../tools/world.cjs");
const { World, TILE } = require("../public/assets/js/adventure/model");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { strollHosts, hostFrame } = require("../public/assets/js/adventure/host-stroll");
const catalog = compileWorld();
function simulation(fps) {
  const world = new World(catalog.scenes.mill);
  world.refresh(cleanSave(null, catalog));
  const host = world.entities.find(e => e.id === "avelino");
  const game = { world, player: { x: 240, y: 408 }, journey: {} };
  world.actors = [game.player];
  const frames = new Set(), positions = new Set();
  for (let i = 0; i < fps * 35; i++) {
    const before = { x: host.x, y: host.y };
    strollHosts(game, 1 / fps);
    assert(Math.hypot(host.x - before.x, host.y - before.y) <= 15 / fps + 1e-8, "No teleport or sudden jump");
    assert(world.canStand(host.x, host.y, host), "Stays on the workshop floor, outside all furniture");
    assert.equal(world.collisionAt(host.x, host.y), host, "The blocking body follows every step");
    frames.add(hostFrame(host)); positions.add(Math.round(host.x) + "," + Math.round(host.y));
  }
  assert(positions.size > 80 && [...frames].filter(f => f.includes("walk")).length >= 6, "Real steps in multiple headings");
  const before = { x: host.x, y: host.y };
  game.journey.target = host;
  for (let i = 0; i < fps * 5; i++) strollHosts(game, 1 / fps);
  assert.deepEqual({ x: host.x, y: host.y }, before, "Waits while the player approaches to talk");
  assert(!host.moving);
  game.journey.target = null;
  game.player = { x: host.x + 22, y: host.y };
  for (let i = 0; i < fps * 5; i++) strollHosts(game, 1 / fps);
  assert.deepEqual({ x: host.x, y: host.y }, before, "Does not walk away from a nearby conversation");
  assert.equal(host.direction, "right");
  // A blocked route can wait/replan; it never drags the sprite through a new obstacle.
  const blocker = { id: "obstacle", x: host.x + 15, y: host.y, solid: [-.5, -.5, 1, 1] };
  world.setBody(blocker, true);
  game.player = { x: 240, y: 408 };
  host.hostMotion.path = [{ x: host.x + 40, y: host.y }]; host.hostMotion.pause = 0;
  for (let i = 0; i < fps / 2; i++) strollHosts(game, 1 / fps);
  assert(host.x < blocker.x - 8 && !host.moving, "Stops in front of a live obstruction");
}
for (const fps of [30, 60, 120]) simulation(fps);
const { frames } = require("../data/aventura/assets/avelino.json");
const report = require("../data/aventura/art/avelino/cutouts/registration.json");
assert.equal(Object.keys(report.poses).length, 32);
for (const [name, pose] of Object.entries(report.poses)) {
  assert(Math.abs(pose.height - 48) < 1e-8);
  assert.equal(pose.baseline, 54);
  assert.deepEqual(frames[name].size, [52, 56]);
  assert.deepEqual(frames[name].anchor, [26, 54]);
}
// Sample the visible lower edge of the actual building, including its brass front corner.
const exterior = new World(catalog.scenes["river-willows"]);
for (const [x, y] of [[71.206, 95], [71.81, 94.782], [72.778, 94.335], [73.987, 93.863],
  [75.197, 93.392], [76.406, 92.932], [77.615, 92.473], [78.825, 92.025]])
  assert(!exterior.waterAt(x, y), "The music box's entire plinth stays on dry land");
const mill = catalog.scenes["river-willows"].entities.find(e => e.id === "mill-door");
const stand = mill.attachments.find(a => a.millTrestle);
for (const [x, y] of [[-24, 34.3], [-9, 44], [15, 35.3]])
  assert(exterior.waterAt(mill.x + (stand.offset[0] + x) / TILE, mill.y + (stand.offset[1] + y) / TILE),
    "All three support piles enter the river");
console.log("PASS Avelino motion: stable poses, real gait at 30/60/120Hz, collisions, conversation stops, dry house and submerged piles.");
