"use strict";
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const {
  World,
  TILE,
  FOOTPRINT,
  coastX,
  actorBounds,
  collisionBounds,
} = require("../public/assets/js/adventure/model");
const { move } = require("../public/assets/js/adventure/movement");
const { RollMotion } = require("../public/assets/js/adventure/locomotion");
const {
  SAVE_KEY,
  cleanSave,
  readSave,
} = require("../public/assets/js/adventure/save");
const catalog = JSON.parse(
  execFileSync(
    "php",
    ["-r", 'echo json_encode(require "data/aventura/world.php");'],
    { encoding: "utf8" },
  ),
);
const state = cleanSave(null, catalog);
const world = new World(catalog.scenes.overworld);
const coast = world.data.coasts[0];
assert.equal(SAVE_KEY, "magikitos.adventure");
const keys = [];
readSave(catalog, {
  getItem(key) {
    keys.push(key);
    return null;
  },
});
assert.deepEqual(keys, [SAVE_KEY], "Exactly one save record, even when absent");
assert(
  !Object.hasOwn(state, "version") && !Object.hasOwn(state.wallet, "revision"),
);
assert.deepEqual(
  actorBounds(100, 100),
  collisionBounds({ actor: true, x: 100, y: 100 }),
  "Player and NPC feet use one geometry",
);
for (let y = 0; y <= world.height; y += 0.25) {
  assert(
    world.waterAt(world.width - 0.1, y),
    "Lake continues to east boundary",
  );
  for (let x = coastX(coast, y); x < world.width; x += 0.5) {
    if (
      (world.data.bridges || []).some(
        (b) =>
          x >= b.rect[0] &&
          x < b.rect[0] + b.rect[2] &&
          y >= b.rect[1] &&
          y < b.rect[1] + b.rect[3],
      )
    )
      continue;
    assert(
      world.waterAt(x, y),
      "No walkable opposite shore anywhere in the mainland",
    );
  }
}
let checked = 0;
for (const data of Object.values(catalog.scenes).filter((s) => !s.indoor)) {
  const w = new World(data);
  for (const prop of w.props) {
    if ((prop.sprite || '').includes('reed')) continue;
    assert(!w.waterAt(prop.x / TILE, prop.y / TILE), data.id + ': dry decoration anchor ' + prop.id);
  }
  for (let y = 0; y < data.height * TILE; y += 8)
    for (let x = 0; x < data.width * TILE; x += 8) {
      if (!w.canStand(x, y)) continue;
      // Check the whole visible sole, independently of the runtime perimeter probe.
      for (let dx = -FOOTPRINT.halfWidth; dx <= FOOTPRINT.halfWidth; dx += 2)
        for (
          let dy = -FOOTPRINT.halfHeight;
          dy <= FOOTPRINT.halfHeight;
          dy += 2
        )
          assert(
            !w.waterAt((x + dx) / TILE, (y + dy) / TILE),
            data.id + ": both boots stay on land",
          );
      checked++;
    }
}
for (const y of [20, 30, 38, 50, 60, 72, 90]) {
  for (let dir = 0; dir < 8; dir++) {
    const actor = {
      actor: true,
      x: (coastX(coast, y) - 1.5) * TILE,
      y: y * TILE,
    };
    if (!world.canStand(actor.x, actor.y)) continue;
    const a = (dir * Math.PI) / 4,
      roll = new RollMotion();
    roll.start(Math.cos(a), Math.sin(a));
    while (roll.current) {
      roll.step(world, actor, 0.05, () => {});
      assert(
        world.canStand(actor.x, actor.y),
        "Roll respects coast each substep",
      );
    }
    move(world, actor, Math.cos(a) * 80, Math.sin(a) * 80, () => {});
    assert(
      world.canStand(actor.x, actor.y),
      "Walking and diagonal sliding respect coast",
    );
  }
}
const fountain = world.entities.find((e) => e.id === "fountain");
assert(
  world.pathDistance(fountain.x / TILE, fountain.y / TILE) > 2.5,
  "Fountain stands on its green centre, not on a road",
);
const corners = [
  [60, 36],
  [68, 36],
  [69, 43],
  [61, 44],
].map(([x, y]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE }));
for (let i = 0; i < corners.length; i++)
  assert(
    world.path(corners[i], corners[(i + 1) % corners.length])?.length,
    "Plaza can be circled on both sides",
  );
console.log(
  "PASS: single save contract, shared feet, " +
    checked +
    " dry standing points, open coast, shoreline rolls, connected fountain plaza.",
);
