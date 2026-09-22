"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { Adventure } = require("../public/assets/js/adventure/game");
const { Journey } = require("../public/assets/js/adventure/journey");
const {
  World,
  TILE,
  insideThreshold,
} = require("../public/assets/js/adventure/model");
const {
  acceptsEntry,
  portalPath,
  ENTRANCE_LIMITS,
} = require("../public/assets/js/adventure/portals");
const { move, follow } = require("../public/assets/js/adventure/movement");
const catalog = JSON.parse(fs.readFileSync(".local/build/world.json"));
let checked = 0;
for (const scene of Object.values(catalog.scenes)) {
  const world = new World(scene);
  for (const door of world.entities.filter((e) => e.entryDirection)) {
    const [x, y, w, h] = door.threshold,
      dir = door.entryDirection;
    assert.equal(dir, scene.indoor ? 1 : -1);
    // ⛔ El tope sale de ENTRANCE_LIMITS, no de un número aquí: subió de 2 a 3 el 22-sep-2026 y
    // esta línea se puso roja por una puerta de 2,75 perfectamente legal.
    assert(
      w <= ENTRANCE_LIMITS.width[1] && h <= ENTRANCE_LIMITS.height[1],
      "Door requires physical proximity, not a large radius",
    );
    const center = {
      x: (x + w / 2) * TILE,
      y: (y + h / 2) * TILE,
      actor: true,
    };
    assert(
      world.canStand(center.x, center.y, center),
      scene.id + "/" + door.id + " reachable threshold",
    );
    const game = Object.create(Adventure.prototype);
    Object.assign(game, {
      world,
      journey: new Journey(),
      river: { checkFoot: () => false },
      state: { flags: {}, inventory: {} },
      player: { ...center },
      portalLatch: new Set(),
      interact: () => {
        game.entered = true;
      },
    });
    for (const motion of [
      null,
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: -dir },
      { x: 1, y: dir * 0.3 },
    ]) {
      assert.equal(acceptsEntry(door, motion), false);
      assert.equal(
        game.checkThresholds(motion),
        false,
        scene.id + ": resting, sideways, retreating must not teleport",
      );
    }
    assert(game.checkThresholds({ x: 0, y: dir }));
    game.journey.intent = { kind: "ground", point: center };
    assert(!game.checkThresholds({ x: 0, y: dir }), "A ground route cannot enter an incidental doorway");
    game.journey.intent = { kind: "interact", entity: door };
    assert(!game.checkThresholds({ x: 0, y: dir }), "Only a deliberate portal intention crosses automatically");
    game.journey.intent = { kind: "portal", entity: door };
    assert(game.checkThresholds({ x: 0, y: dir }), "A clicked door retains directional entry");
    game.journey.clear();
    assert(acceptsEntry(door, { x: 1, y: dir }));
    game.entered = false;
    game.player = { ...center, x: center.x - 12 };
    move(world, game.player, 24, 0, () => {}, {
      onStep: (m) => !game.checkThresholds(m),
    });
    assert(!game.entered, "Walking all the way across a door is inert");
    for (const side of [-1, 1]) {
      const from = {
        x: center.x + side * 24,
        y: center.y - dir * 24,
        actor: true,
      };
      if (!world.canStand(from.x, from.y, from)) continue;
      world.actors = [from];
      const route = portalPath(world, from, door);
      assert(route.length, scene.id + "/" + door.id + " tap route from side");
      const last = route.at(-1),
        lead = route.at(-2);
      assert.equal(last.x, lead.x);
      assert((last.y - lead.y) * dir > 0);
      game.player = from;
      game.entered = false;
      for (let i = 0; i < 1000 && route.length && !game.entered; i++)
        follow(
          world,
          game.player,
          route,
          1 / 60,
          72,
          () => {},
          (motion) => !game.checkThresholds(motion),
        );
      assert(
        game.entered,
        "The path crosses the threshold in its intended direction",
      );
      assert(
        insideThreshold(door, game.player),
        scene.id + "/" + door.id + " route reaches narrow threshold",
      );
      assert(game.checkThresholds({ x: 0, y: dir }));
    }
    const standing = { ...center };
    world.actors = [standing];
    assert(
      portalPath(world, standing, door).length,
      "Door route must ignore the player already occupying its endpoint",
    );
    world.actors = [];
    checked++;
  }
}
assert(checked >= 8);
console.log(
  "PASS:",
  checked,
  "directional doors: no idle/sideways/reverse activation, narrow reachable thresholds and front-routed taps.",
);
