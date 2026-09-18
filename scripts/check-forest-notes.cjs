"use strict";
const assert = require("node:assert/strict");
const { ForestActions } = require("../public/assets/js/adventure/forest-actions");
const { ForestBody } = require("../public/assets/js/adventure/forest-body");
const { ForestNotes } = require("../public/assets/js/adventure/forest-notes");
const { noteDto, characters } = require("../public/assets/js/adventure/forest-data");
const { ServerClock } = require("../public/assets/js/adventure/server-clock");
const { needStatus } = require("../public/assets/js/adventure/needs");
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const memory = () => {
  const data = new Map();
  return { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k), data };
};
const failure = (code, status, details) => Object.assign(Error(code), { code, status, details });
const account = (revision, leaf = 2) => ({ revision, inventory: { leaf }, progress: {} });
function fixture(send) {
  const g = { cloud: { owner: 42, conflict: false }, session: { get: () => "synthetic-token" },
    api: { request: send }, state: { inventory: {} } };
  g.materials = { account: account(1), ready: async () => true,
    accept: value => { g.materials.account = value; },
    reconcile: () => { g.state.inventory = { ...g.materials.account.inventory }; } };
  return g;
}
const now = 1800000000000, HOUR = 3600000;
const needs = { pee: { last: now - 9 * HOUR, due: now - HOUR },
  poop: { last: now - 12 * HOUR, due: now - HOUR } };
const policy = { maxCharacters: 500, writeWithinMs: 300000, reachTiles: 2, tools: ["pen", "parchment"], stickItem: "twig" };
const row = { id: "a".repeat(32), zone: "woods", x: 100, y: 100, createdAt: now, expiresAt: now + 86400000,
  text: null, author: { handle: "someone", name: "Somebody" } };

(async () => {
  // This fake loses the reply AFTER committing, not before: it proves exactly-once debit.
  const storage = memory(), sent = [], receipts = new Map();
  let debits = 0, lose = true;
  const g = fixture(async (endpoint, request) => {
    sent.push(JSON.stringify({ endpoint, request }));
    if (!receipts.has(request.operationId)) {
      debits++; receipts.set(request.operationId, { account: account(2, 1), now, needs, trace: row });
    }
    if (lose) { lose = false; throw failure("network", 0); }
    return receipts.get(request.operationId);
  });
  let actions = new ForestActions(g, storage);
  await assert.rejects(actions.run("forest-relief", { kind: "poop" }), /network/);
  assert(actions.ownPending);
  assert.equal(g.state.inventory.leaf, undefined, "No speculative local debit");
  await assert.rejects(actions.run("forest-relief", { kind: "poop" }), /forest_action_pending/);
  actions = new ForestActions(g, storage); // Simulated full reload, same identity.
  const replay = await actions.retry();
  assert.equal(replay.data.trace.id, row.id);
  assert.equal(debits, 1);
  assert.equal(sent[0], sent[1], "Same endpoint, operation id, revision and payload on retry");
  assert.equal(g.state.inventory.leaf, 1);
  assert.equal(actions.pending, null);

  const conflictRequests = [];
  const conflictGame = fixture(async (_, request) => {
    conflictRequests.push({ ...request });
    if (conflictRequests.length === 1) throw failure("account_conflict", 409, { account: account(7) });
    return { account: account(8) };
  });
  await new ForestActions(conflictGame, memory()).run("forest-message", { traceId: row.id, text: "Hola 🌱" });
  assert.equal(conflictRequests.length, 2);
  assert.equal(conflictRequests[1].baseRevision, 7);
  assert.notEqual(conflictRequests[0].operationId, conflictRequests[1].operationId);
  assert.equal(conflictRequests[0].text, conflictRequests[1].text);
  let oldCalls = 0;
  const agedGame = fixture(async () => {
    if (++oldCalls === 1) throw failure("network", 0);
    throw failure("account_conflict", 409, { account: account(300, 1) });
  });
  const aged = new ForestActions(agedGame, memory());
  await assert.rejects(aged.run("forest-relief", { kind: "poop" }), /network/);
  await assert.rejects(aged.retry(), /account_conflict/);
  assert.equal(oldCalls, 2, "A forgotten receipt must never be rebased and charged as a new action");
  assert.equal(aged.pending, null);
  assert.equal(agedGame.state.inventory.leaf, 1);

  // In-flight ownership changes cannot write a previous person's bag or resurrect their action.
  const waiting = deferred(), ownerStorage = memory();
  const ownerGame = fixture(() => waiting.promise), owners = new ForestActions(ownerGame, ownerStorage);
  const pending = owners.run("forest-relief", { kind: "poop" });
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(owners.run("forest-relief", { kind: "poop" }), /forest_action_pending/);
  ownerGame.cloud.owner = 99;
  waiting.resolve({ account: account(2, 1) });
  await assert.rejects(pending, /identity_changed/);
  assert.equal(ownerGame.materials.account.revision, 1);
  assert.equal(owners.pending.owner, 42);
  assert.equal(owners.ownPending, null);
  ownerGame.api.request = async () => ({ account: account(2) });
  await owners.run("forest-message", { traceId: row.id, text: "Different person" });
  const archived = [...ownerStorage.data.values()].join("");
  assert(archived.includes('"owner":42'));
  assert(!archived.includes("synthetic-token"), "Never journal credentials");

  let unsafeSent = 0;
  const unsafe = fixture(async () => { unsafeSent++; return { account: account(2) }; });
  await assert.rejects(new ForestActions(unsafe, { getItem: () => null, setItem() { throw Error("disk full"); } })
    .run("forest-relief", { kind: "poop" }), /disk full/);
  assert.equal(unsafeSent, 0, "A journal that cannot be persisted must not send a mutation");
  const switching = fixture(async () => { throw Error("must not send"); });
  switching.materials.ready = async () => { switching.cloud.owner = 99; return true; };
  const switchedActions = new ForestActions(switching, memory());
  await assert.rejects(switchedActions.run("forest-relief", { kind: "poop" }), /identity_changed/);
  assert.equal(switchedActions.pending, null, "Identity switch while flushing must not journal under the new person");
  const malformed = new ForestActions(fixture(async () => ({ account: account(2) })), memory(), () => { throw Error("bad DTO"); });
  await assert.rejects(malformed.run("forest-relief", { kind: "poop" }), /bad DTO/);
  assert(malformed.ownPending, "An unusable acknowledgement remains replayable");
  const rejected = new ForestActions(fixture(async () => { throw failure("forest_banned", 403); }), memory());
  await assert.rejects(rejected.run("forest-relief", { kind: "poop" }), /forest_banned/);
  assert.equal(rejected.pending, null);

  const scene = { width: 144, height: 112 };
  const raw = '  <img src=x onerror="alert(1)"> :reward\n🌱مرحبا\n  ';
  assert.equal(noteDto({ ...row, text: raw }, "woods", scene, policy).text, raw, "No rewriting or content interpretation");
  assert.equal(characters("🌱".repeat(500)), 500, "Same Unicode character unit as PHP mb_strlen");
  for (const invalid of [{ x: Infinity }, { y: -1 }, { zone: "elsewhere" }, { expiresAt: now + 86400001 },
    { text: {} }, { text: "🌱".repeat(501) }, { id: "bad" }, { author: { name: {}, handle: null } }])
    assert.throws(() => noteDto({ ...row, ...invalid }, "woods", scene, policy));
  assert(!("rules" in noteDto({ ...row, rules: ["evil"] }, "woods", scene, policy)));

  global.localStorage = memory();
  let mono = 200;
  const bodyGame = fixture(async () => ({ account: account(2) }));
  Object.assign(bodyGame, { catalog: { needs: { hours: { pee: [6, 10], poop: [8, 16] } } },
    serverClock: new ServerClock(() => mono), self: { paint() {} }, live: { connection: { ready: true } },
    dirty: false });
  const body = new ForestBody(bodyGame);
  body.identity = body.key();
  body.accept({ needs, now });
  assert.equal(needStatus(bodyGame.state.needs, body.now()), "poop");
  mono += 400;
  assert.equal(body.now(), now + 400);
  const clock = Date.now;
  Date.now = () => now + 7 * 86400000;
  try { assert.equal(body.now(), now + 400, "Changing the calendar cannot advance connected needs"); }
  finally { Date.now = clock; }
  const oldRead = deferred();
  bodyGame.api.request = () => oldRead.promise;
  const read = body.read();
  body.reading.abort(); body.reading = null;
  const newer = { pee: { last: now, due: now + 8 * HOUR }, poop: { last: now, due: now + 12 * HOUR } };
  body.accept({ needs: newer, now });
  oldRead.resolve({ needs, now: now - 1 }); await read;
  assert.deepEqual(bodyGame.state.needs, newer, "Old GET cannot resurrect a fulfilled need");
  assert.throws(() => body.accept({ needs: { ...newer, pee: { last: now, due: now } }, now }));
  bodyGame.live.connection.ready = false;
  bodyGame.api.request = () => { throw Error("Offline body must stay private"); };
  await body.read();
  assert.deepEqual(bodyGame.state.needs, newer);

  const notes = Object.create(ForestNotes.prototype);
  const notesGame = { cloud: { owner: 42 }, catalog: { messages: policy }, state: { inventory: { pen: 1, parchment: 1, twig: 1 } },
    player: { x: 100, y: 100 }, serverClock: { now: () => now }, body: { actions: {} }, live: { role: "player", connection: { ready: true } } };
  Object.assign(notes, { game: notesGame, own: { owner: 42, trace: { ...row } }, zone: "woods", records: new Map([[row.id, { ...row }]]), refresh() {} });
  assert.equal(notes.writable(row.id), true);
  notesGame.live.role = "spectator";
  assert.equal(notes.writable(row.id), false);
  notesGame.live.role = "player";
  notesGame.player.x += 33;
  assert.equal(notes.writable(row.id), false);
  notesGame.player.x = 100;
  notesGame.cloud.owner = 99;
  assert.equal(notes.writable(row.id), false);
  assert.equal(notes.writable(undefined), false);
  notesGame.cloud.owner = 42;
  notes.published({ traceId: row.id, text: raw });
  assert.equal(notes.records.get(row.id).text, raw);
  assert.equal(notes.own.trace.expiresAt, row.expiresAt, "Publishing never renews the dropping");
  assert.equal(notes.entities[0].sprite, "poop-message");
  assert.equal(notes.entities[0].literal, true);
  assert.equal(notes.writable(row.id), false);
  notesGame.serverClock.now = () => row.expiresAt - 15000;
  notes.rebuild();
  assert.equal(notes.entities[0].opacity, 0.5);
  notesGame.serverClock.now = () => row.expiresAt;
  notes.rebuild();
  assert.equal(notes.entities.length, 0, "Expiry does not wait for polling or cron");
  delete global.localStorage;
  console.log("PASS forest notes: lost acknowledgement/reload spends once, revision retry, identity isolation, durable journal failure, literal Unicode DTOs, monotonic body deadlines, stale-read rejection, writer ownership/reach/role, immutable expiry.");
})().catch(error => { console.error(error); process.exitCode = 1; });
