"use strict";
const assert = require("node:assert/strict");
const {
  MaterialAccount,
} = require("../public/assets/js/adventure/material-account");
global.window = { addEventListener() {} };
const store = new Map();
global.localStorage = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, v),
};
const empty = () => ({
  revision: 0,
  inventory: {},
  progress: { flags: {}, timers: {}, rewards: {} },
  resources: {},
  setines: 0,
  trust: 0,
});
function game(state = {}) {
  store.clear();
  return {
    state: { flags: {}, inventory: {}, timers: {}, resources: {}, wallet: { balance: 0, claimed: {} }, ...state },
    cloud: { owner: 1 },
    session: { get: () => "token-one" },
    text: (x) => x,
    toast() {},
    world: { refresh() {} },
    ready: false,
  };
}
(async () => {
  for (const state of [
    { inventory: { lighter: 1 } },
    { inventory: { knife: 1, mushroom: 1 } },
    {
      inventory: { lighter: 1, knife: 1, skewer: 1 },
      flags: { fireLit: true, skewerCooked: true },
    },
    {
      inventory: { boat: 1, knife: 1, lighter: 1 },
      flags: { picnicFed: true },
    },
  ]) {
    const g = game(state);
    g.api = { request: async () => ({ account: empty() }) };
    const m = new MaterialAccount(g);
    await m.connect();
    const verbs = m.queue.map((e) => e.entity + ":" + e.action);
    if (state.inventory.skewer)
      assert(
        verbs.includes("picnic-barbecue:cook") &&
          !verbs.includes("picnic-neighbor:give"),
      );
    if (state.inventory.boat)
      assert(
        verbs.includes("picnic-neighbor:give") &&
          verbs.includes("river-dock:craft"),
      );
    assert(
      verbs.length < 12,
      "Finite migration commands, never arbitrary inventory upload",
    );
  }
  {
    const g = game({ inventory: { boat: 1 }, flags: { picnicFed: true } }),
      legacy = {
        ...empty(),
        inventory: { boat: 1, oars: 1 },
        progress: { flags: { picnicFed: true } },
      };
    g.api = { request: async () => ({ account: legacy }) };
    const m = new MaterialAccount(g);
    await m.connect();
    assert.equal(
      m.queue.length,
      0,
      "Frozen server migration is never replayed as another meal",
    );
  }
  {
    const g = game({ inventory: { boat: 1, knife: 1, lighter: 1 }, flags: { picnicFed: true } });
    g.api = { request: async () => ({ account: empty() }) };
    const m = new MaterialAccount(g), late = { operationId: "late-action", scene: "human-hedge", entity: "cat-water-bowl", action: "interact" },
      early = { operationId: "original-knife", scene: "overworld", entity: "picnic-knife", action: "interact" };
    m.queue = [late, early]; m.owner = 1;
    await m.connect();
    assert.equal(m.queue.at(-1), late, "Late-zone command waits behind its missing prerequisites");
    assert.equal(m.queue.find(e => e.entity === "picnic-knife"), early, "Original pending receipt is preserved");
    const queue = JSON.stringify(m.queue);
    await m.connect();
    assert.equal(JSON.stringify(m.queue), queue, "Reconnection does not mint duplicate recovery operations");
    assert(m.queue.findIndex(e => e.entity === "river-dock") < m.queue.indexOf(late));
    m.queue = Array.from({ length: 192 }, (_, i) => ({ operationId: "keep-" + i, scene: "overworld", entity: "leaf-" + i, action: "interact" }));
    const full = JSON.stringify(m.queue);
    await assert.rejects(m.connect(), /recovery_queue_full/);
    assert.equal(JSON.stringify(m.queue), full, "A full journal is never truncated to make recovery fit");
  }
  for (const fault of ["unknown_action", "requirements_not_met", "not_found", "archive-full", "archive-write-failed"]) {
    const g = game(), m = new MaterialAccount(g), received = [];
    const account = { ...empty(), revision: 13, inventory: { boat: 1, oars: 1 }, setines: 7 };
    const old = { operationId: "retired-mushroom", scene: "overworld", entity: "picnic-mushroom", action: "interact", baseRevision: 13 };
    const next = { operationId: "valid-next", scene: "overworld", entity: "picnic-twig", action: "interact" };
    g.api = { request: async (endpoint, entry) => {
      if (endpoint === "game-account") return { account };
      received.push(entry.operationId);
      if (entry.operationId === old.operationId)
        throw Object.assign(Error("rejected"), { status: fault === "requirements_not_met" ? 409 : 404,
          code: ["not_found", "requirements_not_met"].includes(fault) ? fault : "unknown_action" });
      return { account: { ...account, revision: 14, inventory: { ...account.inventory, twig: 1 } } };
    } };
    m.owner = 1; m.queue = [old, next]; m.persist();
    const archiveKey = "magikitos.adventure.actions.rejected", writer = localStorage.setItem;
    if (fault === "archive-full") store.set(archiveKey, JSON.stringify(Array(192).fill({ owner: 2, entry: {} })));
    if (fault === "archive-write-failed") localStorage.setItem = (key, value) => {
      if (key === archiveKey) throw Error("quota");
      writer(key, value);
    };
    try { await m.flush(); } finally { localStorage.setItem = writer; }
    if (!["unknown_action", "requirements_not_met"].includes(fault)) {
      assert.equal(m.queue.length, 2, "Generic 404 or archive failure must preserve the pending command");
      assert.deepEqual(received, [old.operationId]);
      continue;
    }
    assert.equal(m.queue.length, 0);
    assert.equal(m.error, null);
    assert.equal(g.state.wallet.balance, 7);
    assert.deepEqual(g.state.inventory, { boat: 1, oars: 1, twig: 1 });
    const archived = JSON.parse(store.get(archiveKey));
    assert.equal(archived.length, 1);
    assert.deepEqual(archived[0].entry, old, "Exact rejected receipt remains recoverable");
    assert.equal(archived[0].owner, 1);
    // Crash between archiving and removing the queue entry must not duplicate
    // the recovery copy or touch the original idempotency key.
    m.queue = [old]; m.persist();
    const afterCrash = new MaterialAccount(g); await afterCrash.flush();
    assert.equal(afterCrash.queue.length, 0);
    assert.equal(JSON.parse(store.get(archiveKey)).length, 1);
    const calls = received.length;
    await new MaterialAccount(g).flush();
    assert.equal(received.length, calls, "A clean reload never resends a retired command");
  }
  const g = game(),
    m = new MaterialAccount(g);
  let account = empty(),
    writes = 0,
    drop = true;
  const receipts = new Set();
  g.api = {
    request: async (endpoint, entry) => {
      if (endpoint === "game-account")
        return { account: structuredClone(account) };
      if (!receipts.has(entry.operationId)) {
        receipts.add(entry.operationId);
        writes++;
        account = {
          ...account,
          revision: account.revision + 1,
          inventory: { twig: writes },
        };
      }
      if (drop) {
        drop = false;
        throw Object.assign(Error("offline"), { code: "offline" });
      }
      return { account: structuredClone(account) };
    },
  };
  await m.connect();
  await m.flush();
  assert.equal(m.busy, null, "Empty flush does not remain permanently busy");
  m.record(
    "overworld",
    { id: "picnic-twig" },
    {},
    { effects: [{ type: "item" }] },
  );
  await m.flush();
  assert.equal(m.queue.length, 1);
  assert.equal(writes, 1);
  const operation = m.queue[0].operationId;
  const recovered = new MaterialAccount(g);
  await recovered.flush();
  assert.equal(recovered.queue.length, 0);
  assert.equal(writes, 1);
  assert(receipts.has(operation));
  recovered.record(
    "overworld",
    { id: "twig-fern" },
    {},
    { effects: [{ type: "item" }] },
  );
  await recovered.flush();
  assert.equal(writes, 2, "Further actions flush after an empty queue");
  assert.equal(g.state.inventory.twig, 2);
  recovered.queue = [{ operationId: "old-account-pending" }];
  recovered.persist();
  g.cloud.owner = 2;
  g.session.get = () => "token-two";
  await recovered.connect();
  assert.equal(recovered.queue.length, 0);
  assert(store.has("magikitos.adventure.actions.recovery"));
  g.cloud.conflict = {};
  assert.equal(
    await recovered.ready(),
    false,
    "Cannot spend through unresolved identity/save conflict",
  );
  recovered.queue = Array(192).fill({});
  assert(!recovered.canRecord({ effects: [{ type: "item" }] }));
  assert(recovered.canRecord({ effects: [{ type: "dialogue" }] }));
  console.log(
    "PASS material outbox: partial/legacy migration, retired-action archive, generic 404 retention, archive failure/crash safety, empty flush, lost ack/reload, exact retry, next pickup, identity isolation and bounded capacity",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
