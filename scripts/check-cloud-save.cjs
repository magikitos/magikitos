"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { CloudSave } = require("../public/assets/js/adventure/cloud-save");
const clone = (v) => JSON.parse(JSON.stringify(v));
const catalog = JSON.parse(fs.readFileSync(".local/build/world.json"));
const elements = new Map(),
  storage = new Map();
const element = () => ({
  hidden: false,
  textContent: "",
  addEventListener() {},
  replaceChildren() {},
  append() {},
});
global.document = {
  getElementById: (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  },
  createElement: element,
};
global.window = { addEventListener() {} };
global.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, v),
};
// Deterministic scheduler: no real waits/polling are needed for the state-machine tests.
global.setTimeout = () => 1;
global.clearTimeout = () => {};
let owner = 1,
  remote = null,
  writes = 0,
  disconnectAfterCommit = false;
const game = {
  catalog,
  config: { locale: "es" },
  state: cleanSave(null, catalog),
  ready: false,
  text: (s) => s,
  scenes: { cache: new Map() },
  session: { get: () => "test-token" },
  self: { account: { async read() {}, async claim() {}, user: { id: 1 } } },
  api: {
    async request(endpoint, body) {
      if (endpoint === "identity") return { user: { id: owner } };
      if (endpoint === "game-state")
        return { profile: clone(remote), recoveries: [] };
      if (endpoint === "game-save") {
        if (remote?.operationId === body.operationId)
          return {
            profile: clone(remote),
            acknowledgedRevision: remote.revision,
          };
        if (body.baseRevision !== (remote?.revision || 0))
          throw Object.assign(Error("conflict"), { status: 409 });
        remote = {
          id: "a".repeat(32),
          revision: (remote?.revision || 0) + 1,
          state: clone(body.state),
          operationId: body.operationId,
        };
        writes++;
        if (disconnectAfterCommit) {
          disconnectAfterCommit = false;
          throw Object.assign(Error("network"), { status: 0 });
        }
        return {
          profile: clone(remote),
          acknowledgedRevision: remote.revision,
        };
      }
      throw Error(endpoint);
    },
  },
};
(async () => {
  const cloud = new CloudSave(game);
  await cloud.connect();
  assert.equal(writes, 0, "Reading does not create a save");
  await cloud.flush();
  assert.equal(writes, 1);
  assert.equal(cloud.meta.revision, 1);
  await cloud.flush();
  assert.equal(writes, 1, "Unchanged state is not written repeatedly");
  game.state.wallet.balance = 10;
  disconnectAfterCommit = true;
  await cloud.flush();
  assert.equal(writes, 2);
  assert(cloud.meta.pending);
  const operation = cloud.meta.pending.operationId;
  await cloud.flush();
  assert.equal(writes, 2, "Lost response retries same operation");
  assert.equal(remote.operationId, operation);
  assert.equal(cloud.meta.pending, null);
  game.state.wallet.balance = 12;
  disconnectAfterCommit = true;
  await cloud.flush();
  assert.equal(writes, 3);
  const reloaded = new CloudSave(game);
  await reloaded.connect();
  assert.equal(
    writes,
    3,
    "Reload replays the saved operation without duplicating a reward",
  );
  assert.equal(reloaded.conflict, null);
  assert.equal(reloaded.meta.pending, null);
  cloud.meta = reloaded.meta;
  game.state.wallet.balance = 14;
  await cloud.connect();
  assert.equal(cloud.conflict, null, "Local-only edits are not a competing-device conflict");
  assert.equal(game.state.wallet.balance, 14, "Unchanged remote revision must not discard offline progress");
  remote.state.wallet.balance = 25;
  remote.revision++;
  game.state.wallet.balance = 15;
  await cloud.flush();
  assert(cloud.conflict);
  assert.equal(writes, 3);
  assert.equal(game.state.wallet.balance, 15);
  await cloud.resolve("remote");
  assert.equal(game.state.wallet.balance, 25);
  assert.equal(cloud.status, "cloudSaved");
  assert(cloud.meta.backups.length);
  const backup = cloud.meta.backups[0];
  await cloud.recoverLocal(backup);
  assert.equal(game.state.wallet.balance, 15);
  assert.equal(
    remote.state.wallet.balance,
    15,
    "Restoring local backup also syncs via CAS",
  );
  const beforeSwitch = writes;
  owner = 2;
  remote = null;
  await cloud.connect();
  assert(
    cloud.conflict,
    "A different website identity cannot inherit this browser's progress silently",
  );
  await cloud.flush();
  assert.equal(writes, beforeSwitch);
  cloud.conflict = null;
  cloud.meta.owner = 2;
  cloud.owner = 2;
  await cloud.flush();
  assert.equal(
    writes,
    beforeSwitch,
    "Visitor state never overwrites home state",
  );
  assert(
    !JSON.stringify([...storage.values()]).includes("test-token"),
    "Sync metadata never stores authentication tokens",
  );
  storage.clear();
  remote = {
    id: "c".repeat(32),
    revision: 1,
    state: cleanSave(null, catalog),
  };
  remote.state.wallet.balance = 33;
  game.state = cleanSave(null, catalog);
  const freshDevice = new CloudSave(game);
  await freshDevice.connect();
  assert.equal(
    game.state.wallet.balance,
    33,
    "A fresh device restores its owner's save without a false conflict",
  );
  assert.equal(freshDevice.conflict, null);
  game.ready = true;
  game.pauseMovement = () => {};
  game.scenes.prepare = async () => {
    throw Error("offline asset");
  };
  const stateBefore = clone(game.state);
  await assert.rejects(() => freshDevice.apply(remote));
  assert.deepEqual(
    game.state,
    stateBefore,
    "Una llegada que falla no deja la partida a medias",
  );
  console.log(
    "PASS cloud read/write bounds, lost-response retry, remote conflict, local recovery, identity switch, visit isolation and credential separation",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
