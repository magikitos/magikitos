"use strict";
const assert = require("node:assert/strict");
const { resolveSceneAnchors } = require("../public/assets/js/adventure/scene-anchors");
const { World, TILE, collisionBounds, overlaps } = require("../public/assets/js/adventure/model");
const { families, makeElement, resolveAppearance } = require("../public/assets/js/adventure/elements");
const { collisionBodies } = require("../public/assets/js/adventure/collision-grid");
const { createNeighbors } = require("../public/assets/js/adventure/neighbors");
const catalog = require("../tools/world.cjs").compileWorld();
const scene = catalog.scenes.overworld, original = JSON.stringify(scene);
function check(data) {
  const world = new World(data), fire = data.entities.find(e => e.id === "story-fire"),
    { night, gatherings } = world.data;
  assert.deepEqual([night.x, night.y], [fire.x, fire.y]);
  assert.deepEqual(night.fire, [fire.x, fire.y]);
  const gathering = gatherings.find(g => g.id === "storytellers");
  assert.deepEqual([gathering.x, gathering.y], [fire.x, fire.y]);
  const people = createNeighbors(world, { world: catalog }, [], () => 0.5).filter(n => n.content === "stories");
  assert(people.length >= 6 && people.length <= 10);
  assert(people.every(n => n.lookAt.x === fire.x * TILE && n.lookAt.y === fire.y * TILE));
  return world;
}
const world = check(scene);
assert.equal(JSON.stringify(scene), original, "Resolving does not modify raw scene or source snapshots");
const moved = structuredClone(scene);
const fire = moved.entities.find(e => e.id === "story-fire");
fire.x += 3; fire.y -= 2;
check(moved);
assert.equal(JSON.stringify(scene), original);
assert.throws(() => resolveSceneAnchors({ ...scene, night: { anchor: "missing" } }), /Missing scene anchor/);
for (const variant of families["studio-delimiter-rock-corner"].variants) {
  const e = resolveAppearance(makeElement("studio-delimiter-rock-corner", "test-corner", 0, 0, variant.id), "fixture");
  const bodies = collisionBodies(e).map(collisionBounds);
  assert.equal(bodies.length, 2);
  assert(bodies.every(b => !overlaps(b, { x: -4, y: -4, w: 8, h: 8 })), "A corner keeps its inner opening walkable");
  const changed = resolveAppearance({ ...e, artVariant: variant.id === "north-west" ? "south-east" : "north-west" }, "fixture");
  assert.notDeepEqual(changed.solids, e.solids, "An orientation change replaces old resolved collision data");
}
for (const cat of scene.entities.filter(e => e.animal?.species === "cat"))
  assert(cat.animal.patrol.every(([x, y]) => Math.hypot(x - cat.x, y - cat.y) < 16), "Patrol follows the relocated picnic");
console.log("PASS anchored night/fire/story circle, Studio move/reload, immutable source data, corner cavities and relocated cat patrols.");
