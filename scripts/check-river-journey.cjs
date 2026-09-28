"use strict";
const assert = require("node:assert/strict");
const { compileWorld } = require("../tools/world.cjs");
const { World, TILE } = require("../public/assets/js/adventure/model");
const { waterAt } = require("../public/assets/js/adventure/geometry");
const { canFloat } = require("../public/assets/js/adventure/river-navigation");
const { riverVisitors, riverBodies } = require("../public/assets/js/adventure/river-life");
const { journeyLength } = require("../public/assets/js/adventure/river-journey");
const catalog = compileWorld(), scenes = Object.values(catalog.scenes).filter(s => s.riverLife?.[0]?.journey);
const resident = scenes[0].riverLife[0], period = journeyLength(resident.journey) / resident.speed;
const worlds = new Map(scenes.map(s => {
  const w = new World(s), origin = s.riverLife[0].journey.origin;
  w.refresh({ flags: {}, inventory: {}, timers: {}, wallet: { balance: 0, claimed: {} } });
  w.waterBeyond = (x, y) => scenes.some(other => {
    const offset = other.riverLife[0].journey.origin;
    return waterAt(other, x + origin.x - offset.x, y + origin.y - offset.y);
  });
  return [s.id, w];
}));
const visits = new Set(); let previous = null;
for (let time = 0; time < period + .5; time += .25) {
  const visible = scenes.flatMap(scene => riverVisitors(scene, time).map(boat => ({ scene, boat })));
  assert.equal(visible.length, 1, "Exactly one visible river resident, including every scene seam and both turns");
  const { scene, boat } = visible[0], origin = scene.riverLife[0].journey.origin;
  assert.equal(boat.id, resident.id); assert.equal(boat.opacity, 1, "No disappearance disguised as a fade");
  assert(canFloat(worlds.get(scene.id), boat.x, boat.y), "The entire hull stays in navigable water: " + scene.id);
  assert(boat.sprite.startsWith(boat.direction === "up" ? "walnut-return-" : "walnut-boat-"));
  visits.add(scene.id + "/" + boat.direction);
  const body = riverBodies(scene, time).find(b => b.id === boat.id);
  assert.deepEqual([body.x, body.y], [boat.x, boat.y], "The visible boat and its collider follow one path");
  const position = { x: boat.x + origin.x * TILE, y: boat.y + origin.y * TILE };
  if (previous) {
    const speed = Math.hypot(position.x - previous.x, position.y - previous.y) / .25;
    assert(speed > 30 && speed < 34, "Calm, continuous speed through turns, seams and cycle boundary: " + speed);
  }
  previous = position;
}
assert.equal(visits.size, scenes.length * 2, "Every stretch is visited downstream and on the return");
const meadow = catalog.scenes["river-willows"], mill = meadow.entities.find(e => e.id === "mill-door");
assert(!waterAt(meadow, mill.x, mill.y), "The mill entrance stays on dry land");
const wheel = mill.attachments.find(a => a.waterwheel);
assert(waterAt(meadow, mill.x + (wheel.offset[0] + 3) / TILE, mill.y + (wheel.offset[1] + 39) / TILE),
  "The animated wheel's immersion line is inside the actual river");
const { riverSection } = require("../public/assets/js/adventure/river-course");
const wetY = mill.y + (wheel.offset[1] + 44 * .86) / TILE;
const slope = (riverSection(meadow.rivers[0], wetY + .15).left - riverSection(meadow.rivers[0], wetY - .15).left) / .3;
assert(Math.abs(Math.atan2(1, -slope) - Math.atan2(.24, .68)) < .12,
  "The wheel plane follows the local riverbank instead of crossing it");
for (const u of [-24, 0, 24]) assert(waterAt(meadow,
  mill.x + (wheel.offset[0] + .68 * u) / TILE,
  mill.y + (wheel.offset[1] + 44 * .86 - .24 * u) / TILE), "The whole projected immersion line is in water");
for (const [dx, dy] of [[-3, -.5], [0, 0], [4, -.5], [6.4, -.7], [7, -2]])
  assert(!waterAt(meadow, mill.x + dx, mill.y + dy), "Main stone foundations stay on dry land");
console.log("PASS river journey: one resident, full downstream/return circuit, continuous seams/turns, no fades, calm speed, navigable hull and waterwheel immersion.");
