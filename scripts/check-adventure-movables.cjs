"use strict";
const assert = require("node:assert/strict");
const {
  World,
  TILE,
  collisionBounds,
  actorBounds,
  overlaps,
} = require("../public/assets/js/adventure/model");
const {
  tryPush,
  canPlace,
  cleanPositions,
  pushPath,
} = require("../public/assets/js/adventure/movables");
const { move, follow } = require("../public/assets/js/adventure/movement");
const {
  skirtEdge,
  releaseContact,
} = require("../public/assets/js/adventure/obstacles");
const { Adventure } = require("../public/assets/js/adventure/game");
const data = (entities = []) => ({
  id: "test",
  width: 32,
  height: 28,
  indoor: true,
  seed: 1,
  paths: [],
  waters: [],
  clearings: [],
  regions: [],
  spawn: { x: 4, y: 20 },
  entities,
});
const box = (id, x, y) => ({
  id,
  sprite: "crates",
  x,
  y,
  solid: [-0.5, -0.5, 1, 1],
  pushable: true,
  rules: [],
});
const state = () => ({ flags: {}, inventory: {}, objects: {} });
{
  const authored = { ...box("communal-pot", 12, 12), shared: true }, world = new World(data([authored])), s = state();
  const object = world.entities[0], player = { x: 177, y: 192, actor: true };
  assert.equal(tryPush(world, player, object, 2, 0, s), false, "Local pushing cannot mutate a communal prop");
  assert.deepEqual(s.objects, {});
  s.objects.test = { "communal-pot": { x: 300, y: 300 } };
  world.relocate(object, 200, 192); world.refresh(s);
  assert.equal(object.x, 200, "Private save cannot override server-owned position on refresh");
  assert.deepEqual(cleanPositions(s.objects, { scenes: { test: world.data } }, s), {}, "Shared positions never survive in private saves");
}
function consistent(world) {
  const fresh = new World(world.data);
  fresh.refresh(world.state);
  assert.deepEqual(
    [...world.blocked],
    [...fresh.blocked],
    "Incremental navigation equals a full rebuild",
  );
  for (let y = 32; y < world.height * TILE - 32; y += 9)
    for (let x = 32; x < world.width * TILE - 32; x += 9)
      assert.equal(
        world.collisionAt(x, y)?.id,
        fresh.collisionAt(x, y)?.id,
        "No stale collider after moving",
      );
}
for (const [dx, dy] of [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]) {
  const world = new World(data([box("pot", 12, 12)])),
    s = state();
  world.refresh(s);
  const object = world.entities[0],
    player = { x: object.x - dx * 15, y: object.y - dy * 14, actor: true };
  world.actors = [player];
  for (let i = 0; i < 25; i++)
    move(world, player, dx * 2, dy * 2, () => {}, {
      resolveCollision: (e, x, y) => tryPush(world, player, e, x, y, s),
    });
  assert(s.objects.test.pot, "Pushing persists a position");
  assert(!overlaps(actorBounds(player.x, player.y), collisionBounds(object)));
  world.actors = [];
  consistent(world);
  const restored = cleanPositions(
    s.objects,
    { scenes: { test: world.data } },
    s,
  );
  assert.deepEqual(
    restored,
    JSON.parse(JSON.stringify(s.objects)),
    "Position survives validated reload",
  );
}
{
  const world = new World(data([box("a", 12, 12), box("b", 15, 12)])),
    s = state();
  world.refresh(s);
  // Stored final positions must be checked together, not against each object's original place.
  assert.deepEqual(
    cleanPositions(
      { test: { a: { x: 240, y: 192 }, b: { x: 288, y: 192 } } },
      { scenes: { test: world.data } },
      s,
    ),
    { test: { a: { x: 240, y: 192 }, b: { x: 288, y: 192 } } },
  );
  const invalid = {
    test: {
      a: { x: Infinity, y: 100 },
      b: { x: 1e100, y: 1e100 },
      unknown: { x: 200, y: 200 },
    },
    absent: { a: { x: 200, y: 200 } },
  };
  assert.deepEqual(
    cleanPositions(invalid, { scenes: { test: world.data } }, s),
    {},
  );
  assert.deepEqual(
    cleanPositions(
      { test: { a: { x: 0, y: 0 } } },
      { scenes: { test: world.data } },
      s,
    ),
    {},
  );
  const object = world.entities[0];
  assert(
    !canPlace(world, object, world.entities[1].x, world.entities[1].y),
    "No box on box",
  );
  assert(!canPlace(world, object, 4 * TILE, 20 * TILE), "Spawn stays free");
  world.data.waters.push({ x: 10, y: 10, rx: 3, ry: 3 });
  assert(
    !canPlace(world, object, 10 * TILE, 10 * TILE),
    "Entire body stays dry",
  );
  world.data.waters = [];
  world.entities.push({
    id: "door",
    x: 7 * TILE,
    y: 12 * TILE,
    threshold: [6.5, 11.5, 1, 1],
    portal: true,
    rules: [],
  });
  assert(
    !canPlace(world, object, 7 * TILE, 12 * TILE),
    "Entrance and its approach stay free",
  );
}
for (const start of [
  [8, 12],
  [16, 12],
  [12, 8],
  [12, 16],
  [5, 5],
]) {
  const world = new World(data([box("pot", 12, 12)])),
    s = state();
  world.refresh(s);
  const object = world.entities[0],
    original = { x: object.x, y: object.y },
    player = { x: start[0] * TILE, y: start[1] * TILE, actor: true };
  world.actors = [player];
  const path = pushPath(world, player, object);
  assert(path?.length, "Tap can approach a side");
  for (let frame = 0; frame < 800 && path.length; frame++)
    follow(
      world,
      player,
      path,
      1 / 60,
      60,
      () => {},
      () => true,
      { resolveCollision: (e, x, y) => tryPush(world, player, e, x, y, s) },
    );
  assert(!path.length, "Tap sequence completes");
  assert(
    Math.hypot(object.x - original.x, object.y - original.y) > 14,
    "Tap actually pushes, not merely approaches",
  );
  assert(!overlaps(actorBounds(player.x, player.y), collisionBounds(object)));
  world.actors = [];
  consistent(world);
}
{
  const sign = {
    id: "sign",
    sprite: "sign",
    x: 12,
    y: 12,
    solid: [-0.5, -0.5, 1, 1],
    edgeSlide: true,
    rules: [{ effects: [] }],
  };
  const world = new World(data([sign])),
    entity = world.entities[0],
    player = { x: entity.x - 12, y: entity.y + 14, actor: true };
  assert(world.canStand(player.x, player.y));
  for (let i = 0; i < 8; i++)
    move(world, player, 0, -2, () => {}, { edgeSlide: () => true });
  assert(player.x < entity.x - 13, "Border assistance skirts the corner");
  assert(world.canStand(player.x, player.y), "Sign never becomes non-solid");
  const large = { ...entity, edgeSlide: false };
  assert(
    !skirtEdge(world, player, large, 0, -2),
    "No assistance through large objects",
  );
  assert.equal(
    releaseContact(world, { x: entity.x, y: entity.y + 14 }, "sign"),
    "sign",
  );
  assert.equal(
    releaseContact(world, { x: entity.x, y: entity.y + 80 }, "sign"),
    null,
  );
  const game = Object.create(Adventure.prototype);
  let calls = 0;
  Object.assign(game, {
    world,
    contactLatch: null,
    state: state(),
    interact: () => calls++,
  });
  game.contact(entity);
  game.contact(entity);
  assert.equal(calls, 1, "Holding against a sign doesn't loop");
  game.contactLatch = releaseContact(
    world,
    { x: entity.x, y: entity.y + 80 },
    game.contactLatch,
  );
  game.contact(entity);
  assert.equal(calls, 2, "Leaving and returning allows a new interaction");
}
console.log(
  "PASS: four-direction pushes, tap approach/push, dry bodies, entrance protection, incremental occupancy, simultaneous saved positions, untrusted input, edge assist and contact latches.",
);
