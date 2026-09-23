"use strict";
/**
 * La vida de los vecinos (`life.js`) sobre las escenas de verdad: todas las pantallas viven sin
 * romperse, lo que hace cada vecino sale del reloj compartido (dos pantallas ven lo mismo), nadie
 * comparte un sitio, los sitios se derivan del cuerpo de cada mueble y la vida cuesta casi nada.
 */
const assert = require("node:assert/strict");
const { compileWorld } = require("../tools/world.cjs");
const { World } = require("../public/assets/js/adventure/model");
const { createNeighbors } = require("../public/assets/js/adventure/neighbors");
const { ResidentLife, spotsFor } = require("../public/assets/js/adventure/life");
const catalog = compileWorld(process.cwd());
// The release's real sprite owners: which faces have seated, digging and angler sheets decides
// who may sit, dig and fish. `frame` answers as if every sheet had already streamed in.
const manifest = JSON.parse(require("node:fs").readFileSync("public/assets/aventura/manifest.json"));
const owned = new Set(Object.values(manifest.packs).flatMap((p) => p.sprites));
const sprites = { has: (n) => owned.has(n), frame: (n) => (owned.has(n) ? {} : null), manifest };
assert(catalog.life?.kinds && catalog.life.weights, "life.json travels with the world");

function simulate(sceneId, start, steps = 1600) {
  const world = new World(catalog.scenes[sceneId]);
  world.refresh({ flags: {}, inventory: {} });
  const residents = createNeighbors(world, { world: catalog }, [], () => 0.5);
  world.actors = residents;
  let t = 0;
  const game = {
    catalog, world, journey: {}, dialogue: null, player: { x: -9999, y: -9999 },
    camera: { x: -99999, y: -99999 }, // nobody on screen: everyone is placed, not walked
    renderer: { width: 480, height: 300, sprites },
    serverClock: { now: () => start + t },
  };
  const life = new ResidentLife(game), timeline = [];
  for (let i = 0; i < steps; i++) {
    t += 250;
    life.update(0.25);
    for (const n of residents) if (n.path.length) Object.assign(n, n.path.pop(), { path: [] });
    const taken = new Map();
    for (const n of life.residents(world))
      if (n.life?.key && n.life.arrived) {
        assert(!taken.has(n.life.key), `${sceneId}: two residents on the same spot ${n.life.key}`);
        taken.set(n.life.key, n.id);
      }
    if (i % 40 === 0) timeline.push(life.residents(world).map((n) => n.id + ":" + (n.life?.kind || "-")).join(","));
  }
  return { world, life, residents, timeline };
}

const start = 1800000000000;
let kinds = new Set(), total = 0;
for (const sceneId of Object.keys(catalog.scenes)) {
  const t0 = process.hrtime.bigint();
  const { life, residents, timeline } = simulate(sceneId, start);
  const perTick = Number(process.hrtime.bigint() - t0) / 1e6 / 1600;
  assert(perTick < 1, `${sceneId}: life costs ${perTick.toFixed(3)} ms per tick`);
  total += life.residents({ actors: residents }).length;
  for (const line of timeline) for (const cell of line.split(",")) if (cell) kinds.add(cell.split(":")[1]);
}
// Nobody fakes what their face has no drawing for, and a seat is sat ON, drawn in front of it.
for (const sceneId of ["overworld", "river-willows"]) {
  const { life, residents } = simulate(sceneId, start + 7e6, 800);
  for (const n of life.residents({ actors: residents })) {
    if (n.life?.kind === "sit") assert(owned.has(`person-${n.variant}-down-sit-0`), `${n.id} sits without a seated sheet`);
    if (n.life?.kind === "tend") assert(owned.has(`person-${n.variant}-down-work-0`), `${n.id} digs without a work sheet`);
    if (n.life?.kind === "fish") {
      assert(owned.has(`person-${n.variant}-left-fish-0`), `${n.id} fishes without an angler sheet`);
      assert(["left", "right"].includes(n.life.direction), "Angler sheets face sideways");
    }
    if (n.seated) {
      assert.equal(n.x, n.life.seat.x); assert.equal(n.y, n.life.seat.y);
      assert(n.depth > n.y, "A seated resident is drawn in front of its seat");
      assert(/-sit-[0-3]$/.test(n.activitySprite), "Seated with the seated sheet");
    }
  }
}
for (const kind of ["stroll", "chat", "sit", "tend", "nap", "fish", "socialize"])
  assert(kinds.has(kind), "Somebody somewhere does: " + kind);

// Shared: the same clock gives the same schedule on two screens.
const a = simulate("river-willows", start, 400), b = simulate("river-willows", start, 400);
assert.deepEqual(a.timeline, b.timeline, "Two screens see the same neighbours doing the same things");

// Places come from bodies: a bench is sat on from its front, a bed tended from its sides.
const bench = spotsFor({ x: 100, y: 100, solid: [-1, -0.5, 2, 0.6] }, "sit");
assert.equal(bench.length, 1); assert.equal(bench[0].direction, "up"); assert(bench[0].y > 100);
assert.equal(spotsFor({ x: 100, y: 100, solid: [-1.8, -1.25, 3.6, 1.6] }, "tend").length, 4);
assert.equal(spotsFor({ x: 100, y: 100, solid: [-1, -1, 2, 2] }, "warm").length, 6);

// ⛔ On screen, residents walk, and every route they ask for is bounded: an uncapped search
// across the meadow froze the arrival for up to 2.6 s on a throttled phone (22-sep-2026).
{
  const world = new World(catalog.scenes.overworld);
  world.refresh({ flags: {}, inventory: {} });
  world.actors = createNeighbors(world, { world: catalog }, [], () => 0.5);
  let t = 0, searches = 0;
  const game = {
    catalog, world, journey: {}, dialogue: null, player: { x: -9999, y: -9999 },
    camera: { x: 0, y: 0 }, // the whole meadow on screen: nobody is placed, everybody walks
    renderer: { width: world.width * 16, height: world.height * 16, sprites },
    serverClock: { now: () => start + t },
  };
  const path = world.path.bind(world);
  world.path = (from, target, limit) => {
    searches++;
    assert(Number.isFinite(limit), "A resident's route search is capped");
    assert(Math.hypot(target.x - from.x, target.y - from.y) <= 36 * 16, "…and never across the map");
    return path(from, target, limit);
  };
  const life = new ResidentLife(game);
  for (let i = 0; i < 1200; i++) {
    t += 250;
    life.update(0.25);
    for (const n of world.actors) if (n.path.length) Object.assign(n, n.path.shift());
  }
  assert(searches > 20, `Residents on screen walk to their places (${searches} routes)`);
  // ⛔ In view, nobody jumps into a pose: hammock and seats are taken where nobody looks.
  for (const n of life.residents(world))
    assert(!["sit", "nap"].includes(n.life?.kind), `${n.id} took a pose in plain view`);
  // …and a resident already in one stays in it while it is seen, whatever its schedule says.
  const napper = life.residents(world)[0];
  life.release(napper);
  napper.life = { kind: "nap", arrived: true, episode: -1, anchor: { x: napper.x, y: napper.y } };
  napper.napAt = { x: napper.x, y: napper.y };
  for (let i = 0; i < 1200; i++) { t += 250; life.update(0.25); }
  assert.equal(napper.life?.kind, "nap", "Seen in the hammock, it does not get up");
  game.camera = { x: -99999, y: -99999 };
  game.renderer.width = game.renderer.height = 10;
  for (let i = 0; i < 400; i++) { t += 250; life.update(0.25); }
  assert.notEqual(napper.life?.kind, "nap", "Out of view, it gets up when its time comes");
}

// Content hosts and residents the Studio placed standing still keep their place.
const willows = new World(catalog.scenes.overworld);
willows.refresh({ flags: {}, inventory: {} });
for (const n of createNeighbors(willows, { world: catalog }, [], () => 0.5))
  if (n.content || n.radius === 0) assert.equal(n.lifeFree, false, "Held in place: " + n.id);
console.log(`PASS resident life: ${Object.keys(catalog.scenes).length} scenes, ${total} free residents, ${[...kinds].length} kinds of life, one person per spot, same schedule on every screen, < 1 ms per tick.`);
