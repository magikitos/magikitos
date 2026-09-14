"use strict";
const assert = require("node:assert/strict");
const { Account } = require("../public/assets/js/adventure/account");
const {
  WorldApi,
  ApiError,
  piece,
  webUrl,
} = require("../public/assets/js/adventure/api");
const { Session, Heard } = require("../public/assets/js/adventure/session");
global.location = { href: "http://127.0.0.1:47834/aventura" };
global.document = { getElementById: () => null };
const data = new Map(),
  storage = {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
(async () => {
  const session = new Session(storage);
  session.set("fixture-session");
  assert.equal(session.get(), "fixture-session");
  data.delete("magikitos_session");
  assert.equal(session.get(), "", "Website logout is observed immediately");
  const heard = new Heard("es", storage);
  for (let n = 1; n < 410; n++) heard.add("cuento", n);
  assert.equal(heard.get("cuento").length, 400);
  let calls = [],
    reply = { ok: true, user: null, token: null },
    proofs = 0;
  const api = new WorldApi(
    { locale: "es", apiBase: "/api/world" },
    session,
    async (url, options) => {
      calls.push({ url: new URL(url), ...options });
      return new Response(JSON.stringify(reply), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  );
  const game = {
    api,
    session,
    config: { locale: "es", destinations: {} },
    proof: {
      request: async () => {
        proofs++;
        return "fixture-proof";
      },
    },
    text: (k) => k,
  };
  const account = new Account(game);
  await account.read();
  assert.equal(proofs, 0);
  assert.deepEqual(JSON.parse(calls[0].body), { locale: "es" });
  assert.equal(calls[0].url.pathname, "/api/world/identity");
  reply = {
    ok: true,
    user: { name: "Fixture", handle: "fixture" },
    token: "new-session",
    created: true,
  };
  await account.claim();
  assert.equal(proofs, 1);
  assert.equal(session.get(), "new-session");
  assert.equal(account.user.name, "Fixture");
  assert.deepEqual(JSON.parse(calls[1].body), {
    locale: "es",
    create: true,
    turnstile_token: "fixture-proof",
  });
  await api.request("guardian-thread", { term_id: 42 }, { auth: true });
  assert.equal(calls[2].headers.Authorization, "Bearer new-session");
  assert.equal(calls[2].url.searchParams.get("lang"), "es");
  assert.throws(() => api.once("identity"), ApiError);
  for (const value of [
    "javascript:alert(1)",
    "https://evil.invalid/x",
    "//evil.invalid",
    "https://user:pass@127.0.0.1/x",
  ])
    assert.equal(webUrl(value, location.href), null);
  const dto = {
    id: 1,
    voiceId: null,
    kind: "cuento",
    lang: "es",
    title: "<script>not markup</script>",
    url: "/cuento/fixture",
    audio: null,
    secret: "never copy",
  };
  assert.equal(piece(dto, api).secret, undefined);
  assert.throws(() => piece({ ...dto, lang: "en" }, api), ApiError);
  assert.throws(() => api.cursor({ nextCursor: 5 }, 5), ApiError);
  const bad = new WorldApi(
    { locale: "es" },
    session,
    async () =>
      new Response("<html>", { headers: { "content-type": "text/html" } }),
  );
  await assert.rejects(() => bad.request("bootstrap"), /invalid_response/);
  game.proof.request = async () => {
    throw Error("fixture challenge cancelled");
  };
  const before = calls.length;
  await account.claim();
  assert.equal(calls.length, before);
  assert.equal(account.busy, false);
  console.log(
    "PASS: standalone API contract, shared login/logout, heard bounds, explicit identity/proof, safe DTOs and URLs, invalid HTML rejection; all network mocked.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
