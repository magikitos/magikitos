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
  knowledge: ["simple-woodwork"],
  progress: { flags: {}, timers: {}, rewards: {} },
  resources: {},
  setines: 0,
  trust: 0,
});
function game(state = {}) {
  store.clear();
  return {
    state: { flags: {}, inventory: {}, ...state },
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
    "PASS material outbox: partial/legacy migration, empty flush, lost ack/reload, exact retry, next pickup, identity isolation and bounded capacity",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
