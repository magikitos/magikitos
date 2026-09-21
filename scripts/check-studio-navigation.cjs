"use strict";
const assert = require("node:assert/strict");
const { sceneLinks } = require("../tools/adventure-studio/scene-links");
const { isTree, visibleWorld } = require("../tools/adventure-studio/visibility");
const { families } = require("../public/assets/js/adventure/elements");
const { MapViewport } = require("../tools/adventure-studio/viewport");
const { compileWorld } = require("../tools/world.cjs");

for (const family of ["forest-tree", "canopy-tree"])
  for (const variant of families[family].variants) {
    assert(isTree({ sprite: variant.sprite }), variant.sprite);
    assert(isTree({ family, artVariant: variant.id }), family + "/" + variant.id);
  }
for (const sprite of ["bush", "giant-fern", "fern", "giant-clover", "flowers",
  "mushrooms", "cottage", "workshop", "home-mushroom-canela", "unknown"])
  assert(!isTree({ sprite }), sprite + " must stay visible");

const tree = { id: "oak", sprite: "oak", x: 40, y: 60 },
  plant = { id: "fern", sprite: "fern", x: 180, y: 90 },
  bigTree = { id: "willow", family: "canopy-tree", sprite: "forest-willow", x: 300, y: 90 },
  world = { props: [tree, plant], entities: [bigTree], architecture: [],
    data: { id: "fixture" }, blocked: new Uint8Array([1, 0, 1]) };
const original = structuredClone(world), filtered = visibleWorld(world, true);
assert.deepEqual(filtered.props, [plant]);
assert.deepEqual(filtered.entities, []);
assert.strictEqual(filtered.props[0], plant, "Visible items retain editing references");
assert.strictEqual(filtered.data, world.data);
assert.strictEqual(filtered.blocked, world.blocked, "Collisions are untouched");
assert.strictEqual(visibleWorld(world, false), world, "Showing trees restores the exact authoring world");
assert.deepEqual(world, original, "The filter does not remove data");

const view = Object.assign(Object.create(MapViewport.prototype), {
  world, game: { world }, selection: [{ e: tree, layer: "scenery" }, { e: plant, layer: "scenery" }],
  onSelect() {}, renderer: { sprites: { frame: () => ({ anchor: [8, 16], crop: [0, 0, 16, 16], w: 16, h: 16 }) } },
});
view.setTreesHidden(true);
assert.deepEqual(view.selection.map(p => p.e.id), [plant.id], "Hidden selection cannot be deleted/moved");
assert.deepEqual(view.elements().map(p => p.e.id), [plant.id], "Picking, marquee and linked moves share visibility");
assert.equal(view.hit({ x: tree.x, y: tree.y - 4 }), undefined, "Hidden tree cannot intercept a click");
view.setTreesHidden(false);
assert.equal(view.elements().length, 3);
assert.equal(view.hit({ x: tree.x, y: tree.y - 4 }).e.id, tree.id, "Shown trees can be picked again");
assert.deepEqual(world, original);

const { scenes } = compileWorld(process.cwd());
assert.deepEqual(sceneLinks(scenes, "overworld").filter(l => l.kind === "edge"), [
  { scene: "river-willows", direction: "up", kind: "edge" },
]);
assert(sceneLinks(scenes, "river-roots").some(l => l.scene === "human-hedge" && l.direction === "right"));
assert(sceneLinks(scenes, "human-hedge").some(l => l.scene === "river-roots" && l.direction === "left"));
assert(sceneLinks(scenes, "cottage").some(l => l.scene === "overworld" && l.kind === "door"));
assert(sceneLinks(scenes, "house").some(l => l.scene === "attic"));
assert(sceneLinks(scenes, "attic").some(l => l.scene === "house"));
assert.deepEqual(sceneLinks(scenes, "missing"), []);
assert.deepEqual(sceneLinks({ a: { navigation: { exits: [{ scene: "missing" }, { scene: "a" }] } } }, "a"), []);
for (const id of Object.keys(scenes)) {
  const links = sceneLinks(scenes, id);
  assert.equal(new Set(links.map(l => l.scene)).size, links.length, "One shortcut per destination");
  assert(links.every(l => scenes[l.scene] && l.scene !== id));
}
console.log("PASS Studio navigation: real deduplicated exits/doors, all tree variants, plants/homes retained, non-mutating render filter and invisible-selection safety.");
