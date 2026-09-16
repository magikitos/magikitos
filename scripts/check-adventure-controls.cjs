"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const {
  World,
  TILE,
  FOOTPRINT,
} = require("../public/assets/js/adventure/model");
const {
  RollMotion,
  DoublePress,
  ROLL_DISTANCE,
} = require("../tools/adventure-studio/experiments/forest-scale/archived-locomotion");
const { DIRECTIONS } = require("../public/assets/js/adventure/characters");
assert(!require("../public/assets/js/adventure/locomotion").RollMotion, "Rolling remains archived, not a production ability");
const { cleanWallet } = require("../public/assets/js/adventure/economy");
const { dialogueText } = require("../public/assets/js/adventure/dialogue");
const catalog = JSON.parse(
  execFileSync(
    "php",
    ["-r", 'echo json_encode(require "data/aventura/world.php");'],
    { encoding: "utf8" },
  ),
);
const manifest = JSON.parse(
  fs.readFileSync("public/assets/aventura/manifest.json"),
);
const sprites = new Set(
  Object.values(manifest.packs).flatMap((p) => p.sprites),
);
const flat = () =>
  new World({
    id: "test",
    width: 80,
    height: 80,
    indoor: true,
    seed: 1,
    paths: [],
    waters: [],
    clearings: [],
    regions: [],
    entities: [],
  });
for (let dir = 0; dir < 8; dir++) {
  for (const dt of [1 / 120, 1 / 60, 0.05]) {
    const roll = new RollMotion(),
      world = flat(),
      actor = { x: 400, y: 400, actor: true };
    const a = (dir * Math.PI) / 4;
    assert(!roll.start(0, 0), "No roll at rest");
    assert(roll.start(Math.cos(a), Math.sin(a)));
    assert(!roll.start(1, 0), "An active roll cannot retrigger");
    roll.step(world, actor, 0, () => {});
    assert(
      roll.current,
      "A zero-duration first frame must not cancel the impulse",
    );
    const seen = new Set();
    while (roll.current) {
      const frame = roll.frame();
      assert(sprites.has(frame), "Actual directional roll art: " + frame);
      seen.add(frame);
      roll.step(world, actor, dt, () => {});
    }
    assert.equal(seen.size, 4, "Four authored roll poses");
    assert(
      Math.abs(Math.hypot(actor.x - 400, actor.y - 400) - ROLL_DISTANCE) < 1e-6,
      "Frame-independent distance",
    );
    assert.equal(actor.direction, DIRECTIONS[dir]);
    const end = { ...actor };
    roll.step(world, actor, dt, () => {});
    assert.deepEqual(actor, end, "Holding does not cause another roll");
  }
}
{
  const world = flat(),
    actor = { x: 400, y: 400, actor: true };
  world.entities.push({
    id: "solid-sign",
    x: 432,
    y: 400,
    solid: [0, -1, 1, 2],
    rules: [],
  });
  world.refresh({ flags: {}, inventory: {} });
  const roll = new RollMotion();
  let contacts = 0;
  roll.start(1, 0);
  while (roll.current) roll.step(world, actor, 0.05, () => contacts++);
  assert.equal(contacts, 1);
  assert(actor.x < 430, "Cannot roll through an interactive");
  assert(world.canStand(actor.x, actor.y, actor));
}
{
  const world = flat(),
    actor = { x: 400, y: 400, actor: true },
    roll = new RollMotion();
  world.terrain[25 * world.width + 27] = 1;
  roll.start(1, 0);
  while (roll.current) roll.step(world, actor, 0.05, () => {});
  assert(actor.x < 430, "Cannot roll through water or walls");
}
{
  const world = flat(),
    actor = { x: 400, y: 400, actor: true },
    roll = new RollMotion();
  roll.start(1, 0);
  let entered = false;
  while (roll.current)
    roll.step(
      world,
      actor,
      0.05,
      () => {},
      () => {
        if (actor.x >= 410 && actor.x <= 412) {
          entered = true;
          roll.stop();
          return false;
        }
        return true;
      },
    );
  assert(entered, "Substeps detect even a narrow portal, with no tunneling");
}
for (const scene of Object.values(catalog.scenes).filter(
  (s) => s.indoor && s.entities.some((e) => e.portal === true),
)) {
  const world = new World(scene),
    door = scene.entities.find((e) => e.portal === true);
  const [x, y, w, h] = door.threshold;
  assert(
    Math.abs(
      (y + h) * TILE - ((scene.height - 2) * TILE - FOOTPRINT.halfHeight),
    ) < 1e-6,
    scene.id + ": threshold meets the reachable edge of the floor",
  );
  for (const side of [-1, 1]) {
    const actor = {
      x: (door.x + side) * TILE,
      y: (scene.height - 2) * TILE - FOOTPRINT.halfHeight - 0.1,
      actor: true,
    };
    assert(world.canStand(actor.x, actor.y), scene.id + ": lateral start");
    for (let n = 0; n < 12; n++) {
      actor.x -= side;
      assert(
        world.canStand(actor.x, actor.y),
        scene.id + ": lateral recess reachable",
      );
    }
    assert(
      actor.x >= x * TILE &&
        actor.x <= (x + w) * TILE &&
        actor.y >= y * TILE &&
        actor.y <= (y + h) * TILE,
    );
  }
}
{
  const world = flat(),
    from = { x: 405, y: 408, actor: true };
  const path = world.path(from, { x: 488, y: 408 });
  assert(
    path[0].x > from.x,
    "Mid-step retargeting never sends a rightward roll backwards",
  );
}
const { furnishWorkshop } = require("../public/assets/js/adventure/workshop");
const workshop = furnishWorkshop(
  catalog,
  Array.from({ length: 40 }, (_, i) => ({ id: i + 1 })),
).scenes.workshop;
const workshopExit = workshop.entities.find((e) => e.id === "exit");
assert.equal(
  workshopExit.threshold[1] + workshopExit.threshold[3],
  workshop.height - 2 - FOOTPRINT.halfHeight / TILE,
  "Resized workshop uses shared directional door geometry",
);
const tap = new DoublePress();
assert(!tap.press(100, 100, 0, "touch"));
assert(tap.press(101, 103, 100, "touch"));
assert(
  !tap.press(100, 100, 150, "touch"),
  "Triple press does not produce a second impulse",
);
assert(!tap.press(100, 100, 600, "touch"), "Slow presses stay single");
assert(
  !tap.press(180, 100, 700, "touch"),
  "Unrelated destinations are not a double press",
);
assert(!tap.press(180, 100, 720, "mouse"), "Different pointers do not combine");
assert(tap.press(180, 100, 800, "mouse"));
const wallet = { balance: 0, claimed: { picnic: true } };
assert.deepEqual(
  cleanWallet(wallet, catalog),
  wallet,
  "Validation never invents money",
);
assert.deepEqual(cleanWallet(cleanWallet(wallet, catalog), catalog), wallet);
assert.equal(cleanWallet({ balance: 5, claimed: {} }, catalog).balance, 5);
assert.equal(dialogueText(":reward", catalog), "10");
for (const scene of Object.values(catalog.scenes))
  for (const boat of scene.entities.filter(
    (e) => e.interactAs && e.sprite === "bottle-boat",
  )) {
    const dock = scene.entities.find((e) => e.id === boat.interactAs);
    assert(
      dock.landing && !dock.actions.some(a => a.id === "board"),
    );
  }
assert.equal(
  catalog.scenes.overworld.entities.find((e) => e.id === "home-two").sprite,
  "home-mushroom-canela",
);
assert.equal(
  catalog.scenes.overworld.entities.find((e) => e.id === "fisher-door").sprite,
  "home-pot-terracotta",
);
console.log(
  "PASS: archived roll artwork/experiment preserved; live roll removed; reachable doors, wallet validation, boat landings.",
);
