"use strict";
const assert = require("node:assert/strict");
const { ActorArt, baseActorFrame } = require("../public/assets/js/adventure/actor-art");
const manifest = require("../public/assets/aventura/manifest.json");
const owners = new Map(Object.entries(manifest.packs).flatMap(([id, pack]) => pack.sprites.map((name) => [name, id])));
(async () => {
  let calls = [], resolve = [];
  const sprites = {
    manifest, owners, pinned: new Set(), packs: new Map(),
    residency: { holds: new Map(), limit: 96 * 1024 * 1024 },
    packageFor: (name) => owners.get(name),
    load: (id) => {
      calls.push(id);
      return new Promise((done) => resolve.push(() => { sprites.packs.set(id, {}); done(); }));
    },
    frame: (name) => sprites.packs.has(owners.get(name)),
  };
  const art = new ActorArt(sprites);
  const view = { x: 1000, y: 1000, width: 400, height: 400 };
  const person = (id, x, y) => ({ x, y, sprite: `person-${id}-down` });
  const entities = [person(100, 3000, 1200), person(105, 1200, 1200), person(110, 1210, 1210), person(120, 1230, 1230)];
  art.update(entities, view, (e) => e.sprite, 0);
  assert.deepEqual(calls, ["actor-105", "actor-110"], "Only visible nearest residents, two concurrent requests");
  art.update(entities, view, (e) => e.sprite, 100);
  assert.equal(calls.length, 2, "No per-frame fetch storm");
  for (const done of resolve.splice(0)) done();
  await new Promise(setImmediate);
  art.update(entities, view, (e) => e.sprite, 200);
  assert.equal(calls.at(-1), "actor-120");
  assert(!calls.includes("actor-100"), "Offscreen cast never downloads");
  for (const done of resolve.splice(0)) done();
  await new Promise(setImmediate);
  art.update(entities, { ...view, x: 2800 }, (e) => e.sprite, 400);
  assert.equal(calls.at(-1), "actor-100", "Panning follows the new viewport, not the player or scene");
  for (const done of resolve.splice(0)) done();
  await new Promise(setImmediate);
  assert.equal(baseActorFrame("person-110-up-left-push-2"), "person-110-up-left");
  assert.equal(baseActorFrame("person-110-discover-2"), "person-110-down");
  assert.equal(baseActorFrame("oak"), null);
  assert.equal(art.frame("person-110-up-left-push-2"), "person-110-up-left", "Missing action keeps the same actor's base");
  assert.equal(art.frame("oak"), "oak");
  assert.equal(art.frame("person-100-down-carried-0"), "person-100-down-carried-0", "Missing carried art cannot flash a standing actor");
  assert.equal(art.frame("person-12-down-sit-0"), "person-12-down-sit-0", "Seated characters keep their pose");
  sprites.packs.set("actor-0-run", {});
  assert.equal(art.frame("person-0-left-run-2"), "person-0-left-run-2");
  calls = [];
  const rower = { x: 1200, y: 1200, sprite: "person-100-down-row-0",
    vesselArt: { hull: "boat-bottle-down-0" } };
  art.update([rower], view, e => e.sprite, 600);
  assert.deepEqual(calls, ["vessel-bottle", "actor-100-row"], "A visible swimmer prepares both independent layers");
  for (const done of resolve.splice(0)) done();
  await new Promise(setImmediate);
  calls = [];
  sprites.residency.limit = 1;
  art.update([person(199, 1200, 1200)], view, (e) => e.sprite, 800);
  assert.deepEqual(calls, [], "Unaffordable appearance cannot trigger decode/retry churn");
  console.log("PASS: viewport-based actor streaming, closest-first, bounded concurrency, panning, action fallback and admission.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
