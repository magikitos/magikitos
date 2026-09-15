"use strict";
const assert = require("node:assert/strict");
const { Adventure } = require("../public/assets/js/adventure/game");
const { Journey } = require("../public/assets/js/adventure/journey");
// Exercise the actual tap/arrival dispatch without a browser, server or model request.
(async () => {
  let visits = 0,
    distance = 80,
    dialogue;
  const game = Object.create(Adventure.prototype);
  const guardian = {
    id: "guardian",
    x: 130,
    y: 80,
    neighbor: true,
    onInteract: () => visits++,
  };
  Object.assign(game, {
    ready: true,
    transitioning: false,
    state: { flags: {}, inventory: {} },
    player: { x: 50, y: 80 },
    roll: {},
    river: { active: false },
    homestead: { tap: () => false },
    journey: new Journey(),
    inventory: {},
    neighbors: [],
    guardian,
    renderer: { hit: (entity) => entity === guardian },
    world: {
      data: { indoor: true },
      width: 20,
      height: 18,
      entities: [],
      state: { flags: {} },
      distanceTo: () => distance,
      approach: () => [{ x: 100, y: 80 }],
    },
    pauseMovement() {
      this.cancelPath();
    },
    closeContent() {},
    lines: (key) => [key],
    s: {},
    openDialogue: (lines) => (dialogue = lines),
  });
  game.tap({ x: 130, y: 80 });
  assert.equal(
    visits,
    0,
    "A distant click approaches; it never runs an arrival callback immediately",
  );
  assert.equal(
    game.journey.target,
    guardian,
    "The visitor is pickable like other neighbors",
  );
  assert.equal(game.journey.path.length, 1);
  await game.interact(guardian);
  assert.equal(visits, 1, "Arrival opens the visitor interaction exactly once");
  assert.equal(game.journey.path.length, 0);
  distance = 5;
  game.tap({ x: 130, y: 80 });
  assert.equal(visits, 2, "A nearby tap uses the same interaction dispatcher");
  game.inventory.held = "lighter";
  await game.interact(guardian);
  assert.equal(
    visits,
    2,
    "Using an inventory object is not a request to open a conversation",
  );
  assert.deepEqual(dialogue, ["noUse"]);
  game.world.approach = () => {
    throw Error("Decorative exterior must not start pathfinding");
  };
  for (const point of [
    { x: -1, y: 80 },
    { x: 321, y: 80 },
    { x: 50, y: -1 },
    { x: 50, y: 289 },
  ]) {
    game.tap(point);
    assert.equal(game.journey.path.length, 0);
    assert.equal(visits, 2);
  }
  console.log(
    "PASS: cutaway exterior taps are inert; visitor click/approach/arrival share one inventory-aware dispatch.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
