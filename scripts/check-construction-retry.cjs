"use strict";
const assert = require("node:assert/strict");
const { sendConstruction } = require("../public/assets/js/adventure/construction-request");
const { Community } = require("../public/assets/js/adventure/community");
const failure = (code, status = 409) => Object.assign(Error(code), { code, status });
const request = { operationId: "a".repeat(32), baseRevision: 4, zone: "overworld", zoneRevision: 10,
  operation: "place", object: { kind: "woodland-bench", x: 20, y: 30 } };
(async () => {
  let remembered, calls = [], debit = 0;
  const seen = new Set();
  const options = {
    remember: r => { remembered = r; },
    latest: async zone => ({ zone, revision: 11 }),
    send: async r => {
      assert.equal(r, remembered, "Durable intent precedes every network request");
      calls.push(r);
      if (r.zoneRevision === 10) throw failure("zone_conflict");
      if (!seen.has(r.operationId)) { seen.add(r.operationId); debit++; throw failure("offline", 0); }
      return { ok: true };
    },
  };
  await assert.rejects(sendConstruction(request, options), /offline/);
  assert.equal(calls.length, 2);
  assert.equal(debit, 1);
  assert.notEqual(remembered.operationId, request.operationId);
  assert.equal(remembered.baseRevision, request.baseRevision, "Never rebase someone's account or object version");
  assert.deepEqual(remembered.object, request.object);
  const pending = remembered;
  assert.deepEqual(await sendConstruction(pending, options), { ok: true });
  assert.equal(debit, 1, "Lost reply replays the same receipt, no double charge");
  assert.equal(calls[2], pending);
  for (const [code, status, expected] of [["zone_conflict", 409, 2], ["object_conflict", 409, 1],
    ["revision_conflict", 409, 1], ["heritage_protected", 403, 1], ["too_many", 429, 1], ["offline", 0, 1]]) {
    let count = 0;
    await assert.rejects(sendConstruction(request, { ...options,
      send: async () => { count++; throw failure(code, status); },
    }), e => e.code === code);
    assert.equal(count, expected, "Exactly one silent retry, only for zone_conflict: " + code);
  }
  let count = 0;
  await assert.rejects(sendConstruction(request, { ...options,
    latest: async () => ({ zone: "another-zone", revision: 12 }),
    send: async () => { count++; throw failure("zone_conflict"); },
  }), /invalid_community/);
  assert.equal(count, 1);
  global.localStorage = { setItem() {} };
  const community = { pending: { owner: 1, request }, accept() {},
    game: { materials: { owner: 1 }, api: { request: async endpoint => {
      if (endpoint === "community-build") throw failure("zone_conflict");
      community.game.materials.owner = 2;
      return { zone: "overworld", revision: 11 };
    } } } };
  await assert.rejects(Community.prototype.sendPending.call(community), /pending_identity/);
  assert.equal(community.pending.owner, 1, "Identity change cannot inherit another player's pending debit");
  community.game.materials.owner = 1;
  community.game.api.request = async () => { community.game.materials.owner = 2; return { account: { revision: 90 } }; };
  await assert.rejects(Community.prototype.sendPending.call(community), /pending_identity/);
  assert.equal(community.pending.owner, 1, "Even successful old-account responses cannot enter the new owner's account");
  console.log("PASS construction retry: one zone rebase, unchanged object/account, journal-before-send, lost reply, no double debit, identity isolation and bounded failures.");
})().catch(e => { console.error(e); process.exitCode = 1; });
