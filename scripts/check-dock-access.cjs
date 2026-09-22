"use strict";
const assert = require("node:assert/strict");
const { compileWorld } = require("../tools/world.cjs");
const { liveContract } = require("../tools/live-contract.cjs");
const { docks, atDock, enteringDock, dockPath } = require("../public/assets/js/adventure/docks");
const { boardingPoint, dockPoint, validDockEntrance } = require("../public/assets/js/adventure/dock-geometry");
const { World } = require("../public/assets/js/adventure/model");
const { validateElements, elementDiff } = require("../tools/adventure-studio/element-edits");
const path = require("node:path");
const { cross } = require(path.join(process.env.GAME_WEB_REPO || path.resolve("..", "magikitos"), "bosque-vivo/transitions.cjs"));
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const { renderScene } = require("../tools/adventure-studio/scene-edits");
const { dockElements } = require("../tools/adventure-studio/dock-elements");
const world = compileWorld(), base = snapshot(process.cwd());
const entrance = [-1, -0.625, 0.75, 1.25]; // Move toward land: zero is no longer inside.
const edits = validateElements({ "dock-jetty": { planks: { solids: [], entrance, walkable: [0, 0.1, 0.9, 0.8] } } });
assert.equal(elementDiff(edits)[0].file, "data/aventura/element-families.json");
for (const bad of [null, [0, 0, 0, 1], [99, 0, 1, 1], [0, 0, 1, 8]]) assert(!validDockEntrance(bad));
let n = 0;
for (const [id, scene] of Object.entries(world.scenes)) {
  if (!scene.navigation?.landings?.length || !base.world.scenes[id]) continue;
  const preview = renderScene(base, id, {}, edits);
  assert.deepEqual(preview.bridges.find(b => b.sprite === "jetty").entrance, entrance);
  const changed = { ...world, scenes: { ...world.scenes, [id]: preview } },
    contract = liveContract(changed), physical = new World(preview);
  for (const dock of docks(preview)) {
    assert.equal(boardingPoint({ ...dock, boarding: [20, -8, 8, 16] }), null,
      "An access entirely beyond the planks cannot be a walking destination");
    const target = boardingPoint(dock), path = dockPath(physical, { x: dock.land[0] * 16, y: dock.land[1] * 16 }, dock);
    assert(path?.length, id + ": custom access reachable on foot");
    assert.deepEqual(path.at(-1), target);
    assert(enteringDock(dock, target, dock.outward, "foot"));
    assert(!enteringDock(dock, target, { x: -dock.outward.y, y: dock.outward.x }, "foot"));
    assert(!atDock(dock, dock.dry, "foot"), "Edited zone really replaces the old trigger");
    const row = dockElements(preview).find(r => r.e.id === "dock-access-" + dock.id);
    assert.deepEqual(row.e.entrance, entrance);
    assert.deepEqual(contract.scenes[id].transitions.docks[dock.id].arrival, dock.arrival);
    const sailor = { scene: id, x: dock.wet.x, y: dock.wet.y, mode: "boat", pose: "idle", direction: "left",
      capabilities: { boat: true }, movementCredit: 100, moveAt: 1000 };
    assert(cross(sailor, { request: 1, kind: "dock", id: dock.id, scene: id, mode: "foot",
      from: [dock.wet.x, dock.wet.y, "left"], position: [dock.arrival.x, dock.arrival.y] }, contract.scenes, 1000),
      id + ": server accepts the safe arrival derived from edited planks");
    for (const point of [target, dock.dry, dockPoint(dock, -40, 0), dockPoint(dock, -10, 30)]) {
      const actor = { scene: id, x: point.x, y: point.y, mode: "foot", pose: "idle", direction: "right",
        capabilities: { boat: true }, movementCredit: 100, moveAt: 1000 };
      assert.equal(cross(actor, { request: 1, kind: "dock", id: dock.id, scene: id, mode: "boat",
        from: [point.x, point.y, "right"], position: [dock.wet.x, dock.wet.y] }, contract.scenes, 1000),
        atDock(dock, point, "foot"), id + ": client/server threshold parity");
    }
    n++;
  }
}
assert(n >= 5);
console.log(`PASS ${n} docks: shared definition, editor preview, all orientations, custom approach, real server authority.`);
