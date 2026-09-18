"use strict";
const assert = require("node:assert/strict");
const { Community } = require("../public/assets/js/adventure/community");
const { CommunitySync } = require("../public/assets/js/adventure/community-sync");
const { AmbientActivities } = require("../public/assets/js/adventure/ambient-activities");
const { World } = require("../public/assets/js/adventure/model");
const { Journey } = require("../public/assets/js/adventure/journey");
const { collisionBounds } = require("../public/assets/js/adventure/geometry");
const settle = () => new Promise(resolve => setImmediate(resolve));
const id = n => n.toString(16).padStart(32, "0");
function fixture(Sync = CommunitySync) {
  let now = 1000, identity = "synthetic-owner";
  const requests = [], invalidated = [];
  const scenes = Object.fromEntries(["forest", "river"].map(name => [name, { id: name, width: 64, height: 64,
    indoor: false, seed: 1, paths: [[[4, 4], [12, 12]]], waters: [], clearings: [[0, 0, 64, 64]], regions: [],
    entities: [{ id: "shared", x: 40, y: 40, sprite: "crates", solid: [-0.5, -0.5, 1, 1], pushable: true, shared: true },
      { id: "private", x: 45, y: 45, sprite: "crates", solid: [-0.5, -0.5, 1, 1], pushable: true }] }]));
  const definition = { shape: "rect", footprint: [-0.5, -0.5, 1, 1], rotations: [0], variants: [{ id: "one", sprite: "crates" }],
    slots: [[0, 1, "up"]], capabilities: ["sit"] };
  const c = Object.create(Community.prototype);
  const g = c.game = { catalog: { scenes }, state: { scene: "forest", flags: {}, inventory: {}, movables: {} },
    session: { get: () => identity }, serverClock: { sync() {} },
    renderer: { terrain: { invalidate: scene => invalidated.push(scene) } },
    api: { request(endpoint, body, options) {
      assert.equal(endpoint, "community"); assert.equal(options.auth, true);
      return new Promise((resolve, reject) => requests.push({ body, options, resolve, reject }));
    } }, player: { x: 64, y: 64 }, neighbors: [], river: { active: false },
    cats: { locked: true, carrier: { phase: "carry", path: [{ x: 200, y: 300 }] }, enter() { throw Error("Cat reset"); } },
    journey: new Journey(), community: c };
  c.catalog = { maxObjectsPerZone: 320, zones: { forest: { scene: "forest" }, river: { scene: "river" } },
    definitions: { bench: definition, fence: { shape: "polyline", sprite: "twig-fence", family: "twig-fence", rotations: [0], variants: [{ id: "one" }] },
      trail: { shape: "polyline", paint: "path", rotations: [0], variants: [{ id: "one" }] } } };
  c.snapshots = new Map(); c.activities = new AmbientActivities(g);
  c.revalidate = () => {}; c.paint = () => {};
  const item = (n, extra = {}) => ({ id: id(n), kind: "bench", variant: "one", x: 10 + n * 3, y: 15, rotation: 0, revision: 1, ...extra });
  const snapshot = (revision, objects = [], zone = "forest") => ({ zone, now: 1800000000000 + now, revision, objects });
  c.accept(snapshot(0)); g.world = new World(c.sceneData(scenes.forest)); g.world.refresh(g.state);
  g.world.actors = [g.player]; g.renderer.world = g.world; c.refreshWorld();
  const sync = c.sync = new Sync(c, () => now);
  const notice = (revision, scene = "forest") => sync.notice({ type: "zona", scene, zone: scene, revision });
  const update = async (ms = 0) => { now += ms; sync.update(); await settle(); };
  return { c, g, sync, requests, snapshot, item, notice, update, invalidated, identity: value => { identity = value; } };
}
async function synchronization(Sync = CommunitySync) {
  const f = fixture(Sync), { c, g, sync, requests, snapshot, notice, update } = f;
  for (const bad of [null, f.item(1, { kind: "__proto__" }), f.item(1, { rotation: 3 }), f.item(1, { variant: "missing" }),
    f.item(1, { revision: 1.5 }), f.item(1, { kind: "fence", points: [[0, 0], [NaN, 4]] })]) {
    assert.throws(() => c.accept(snapshot(3, [f.item(2), bad])), /invalid_community_object/);
    assert.equal(c.snapshot.revision, 0, "Invalid later item cannot partially accept a snapshot");
  }
  assert.throws(() => c.accept(snapshot(3, [f.item(1), f.item(1)])), /invalid_community_object/);
  for (const packet of [null, { zone: ["forest"], scene: "forest", revision: 1 }, { zone: "constructor", scene: "forest", revision: 1 }, { zone: "forest", scene: "river", revision: 1 },
    { zone: "forest", scene: "forest", revision: -1 }, { zone: "forest", scene: "forest", revision: 1.5 }])
    assert.equal(sync.notice(packet), false);
  await update(); assert.equal(requests.length, 0);
  for (let n = 1; n <= 20; n++) notice(n);
  await update(); await update(1000); assert.equal(requests.length, 1, "One fetch for a burst of notices, even when HTTP is slow");
  requests[0].resolve(snapshot(10, [f.item(1)])); await settle();
  c.busy = true; await update(); assert.equal(c.snapshot.revision, 0, "Response cannot interrupt a local mutation");
  c.busy = false; await update(); assert.equal(c.snapshot.revision, 10);
  assert.equal(requests.length, 2, "Fetch latest outstanding revision, not nineteen intermediates");
  c.accept(snapshot(21, [f.item(2)])); c.refreshWorld();
  requests[1].resolve(snapshot(20, [f.item(1)])); await settle(); await update();
  assert.equal(c.snapshot.revision, 21, "Slow GET must not rewind an own mutation");
  assert(!g.world.entities.some(e => e.community === id(1)), "Removed objects cannot reappear");
  await update(5000); assert.equal(requests.length, 2, "No idle polling after catching up");
  notice(22); await update(); f.identity("another-owner");
  requests[2].resolve(snapshot(22)); await settle(); await update();
  assert.equal(c.snapshot.revision, 21, "Response belongs to the identity which fetched it");
  sync.reset(); notice(22); await update(); const old = requests[3];
  sync.reset(); assert(old.options.signal.aborted); notice(23); await update();
  old.resolve(snapshot(100)); await settle(); assert(sync.loading, "Stale finally cannot clear a new in-flight request");
  requests[4].resolve(snapshot(23)); await settle(); await update(); assert.equal(c.snapshot.revision, 23);

  notice(24); await update(1000); const departing = requests.at(-1);
  g.state.scene = "river"; c.accept(snapshot(0, [], "river")); g.world = new World(c.sceneData(g.catalog.scenes.river));
  const destination = g.world; departing.resolve(snapshot(24, [f.item(3)])); await settle(); await update();
  assert.equal(g.world, destination); assert(!g.world.entities.some(e => e.community), "Old scene result must not enter the new world");
  assert.equal(c.snapshots.get("forest").revision, 24, "Bounded scene cache can retain a valid late result");
  notice(1, "river"); await update(1000); requests.at(-1).reject(Error("offline")); await settle();
  const failedCount = requests.length; await update(999); assert.equal(requests.length, failedCount, "Failure retry is delayed");
  await update(1); assert.equal(requests.length, failedCount + 1);
  requests.at(-1).resolve(snapshot(50, [], "forest")); await settle(); await update();
  assert.equal(c.snapshot.revision, 0, "Wrong-zone HTTP response is rejected");
  assert.equal(c.snapshots.get("forest").revision, 24, "Wrong-zone response cannot poison another scene's cache either");
  await update(2000); requests.at(-1).resolve(snapshot(1, [{ id: "invalid" }], "river")); await settle(); await update();
  assert.equal(c.snapshot.revision, 0, "Malformed HTTP data never reaches rendering");
  await update(4000); requests.at(-1).resolve(snapshot(1, [], "river")); await settle(); await update();
  assert.equal(c.snapshot.revision, 1);

  const account = fixture(Sync);
  account.c.accept(account.snapshot(8, [account.item(1, { mine: true })])); account.c.refreshWorld();
  const oldBody = account.g.world.entities.find(e => e.community);
  account.identity("new-account"); account.sync.reset(true); await account.update();
  assert.equal(account.requests.length, 1, "Account change refetches an unchanged world even without a socket notice");
  assert(account.g.world.entities.includes(oldBody), "While refetching, physical furniture does not disappear");
  account.requests[0].resolve(account.snapshot(8, [account.item(1, { mine: false })])); await settle(); await account.update();
  let shown; account.c.inspect = value => { shown = value; }; oldBody.onInteract();
  assert.equal(shown.mine, false, "Account change cannot inherit another player's ownership controls");
}
function layers() {
  const f = fixture(), { c, g, snapshot, item } = f, world = g.world;
  const authored = [...world.entities], props = world.props, actors = world.actors, terrain = world.navigationTerrain;
  const carrier = g.cats.carrier, saved = JSON.stringify(g.state);
  const set = (revision, objects) => { c.accept(snapshot(revision, objects)); c.refreshWorld(); };
  const bench = item(1), other = item(2), fence = item(3, { kind: "fence", x: 25, y: 25, points: [[0, 0], [3, 1], [4, 3]] });
  set(1, [bench, other, fence]);
  const old = world.entities.find(e => e.community === bench.id), stable = world.entities.find(e => e.community === other.id);
  const fenceBodies = world.colliders.filter(e => e.community === fence.id);
  assert(fenceBodies.length > 2, "Actual compound fence bodies are installed");
  const walker = { x: 50, y: 50, path: [{ x: 80, y: 80 }], activity: { key: `${old.id}:0` } };
  const sitter = { x: 60, y: 60, path: [], activity: { key: `${stable.id}:0` }, activitySprite: "seated" };
  g.neighbors = [walker, sitter]; c.activities.reserved.set(walker.activity.key, "walker"); c.activities.reserved.set(sitter.activity.key, "sitter");
  g.journey.start(world, g.player, { kind: "interact", entity: old });
  const route = g.journey.path;
  set(2, [bench, other, fence]);
  assert.equal(g.journey.path, route); assert.equal(g.journey.target, old, "Unchanged target stays identical");
  assert.equal(world.entities.find(e => e.id === stable.id), stable);
  // Metadata changes do not move furniture; its interaction must still use current ownership.
  const protectedBench = { ...bench, heritage: true, mine: false, author: { name: "Synthetic author" } };
  set(2, [protectedBench, other, fence]);
  assert.equal(g.journey.target, old); assert(walker.activity, "Heritage notice must not throw a seated NPC off the bench");
  let inspected; c.inspect = value => { inspected = value; };
  old.onInteract(); assert.equal(inspected, protectedBench, "Stable visual reference reads the newest author/protection data");
  const moved = { ...bench, x: bench.x + 4, revision: 2 };
  set(3, [moved, other]);
  assert.notEqual(g.journey.target, old); assert.equal(g.journey.target.x, moved.x * 16);
  assert.equal(world.collisionGrid.at(old.x, old.y), null, "Old body is removed, not duplicated");
  assert(world.collisionGrid.at(moved.x * 16, moved.y * 16));
  assert(!walker.activity); assert.equal(walker.path.length, 0);
  assert.equal(sitter.activitySprite, "seated", "Unrelated seated resident is not reset");
  for (const body of fenceBodies) assert(!world.collisionGrid.bounds.has(body), "Every segment of the removed fence leaves the index");
  set(4, [other, item(4, { kind: "trail", points: [[0, 0], [4, 0]] })]);
  assert.equal(g.journey.target, null, "Removed clicked furniture cancels only that journey");
  assert.equal(world.data.communityPaths.length, 1);
  assert.equal(world.pathDistance(18, 15), Math.hypot(6, 3), "Community paint does not change authored placement paths");
  for (let revision = 5; revision < 20; revision++) set(revision, revision % 2 ? [] : [fence]);
  set(20, []);
  assert.equal(g.world, world); assert.equal(g.renderer.world, world); assert.equal(world.props, props);
  assert.equal(world.actors, actors); assert.equal(world.navigationTerrain, terrain);
  assert.equal(g.cats.carrier, carrier); assert.equal(JSON.stringify(g.state), saved);
  assert.deepEqual(world.entities, authored, "All authored object references survive repeated community mutations");
  const rebuilt = new World(c.sceneData(g.catalog.scenes.forest)); rebuilt.refresh(g.state);
  assert.deepEqual(world.blocked, rebuilt.blocked, "Incremental navigation occupancy equals a full independent rebuild");
  assert.deepEqual([...world.collisionGrid.bounds.values()].sort((a, b) => a.x - b.x),
    rebuilt.colliders.map(collisionBounds).sort((a, b) => a.x - b.x));
}
async function run(Sync = CommunitySync) { await synchronization(Sync); layers(); }
if (require.main === module) run().then(() => console.log("PASS live community revisions: bounded requests, races, identities, scene changes, unchanged actors, compound colliders, targeted activities and navigation parity."))
  .catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { run, fixture, synchronization, layers };
