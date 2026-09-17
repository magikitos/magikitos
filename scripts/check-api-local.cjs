"use strict";
/** Read-only contract checks against LOCAL DDEV. No valid mint, rating, chat, checkout or analytics writes. */
const assert = require("node:assert/strict"),
  https = require("node:https"),
  http = require("node:http");
const base = new URL(process.env.WEB_ORIGIN || "https://magikitos.ddev.site");
if (
  !["127.0.0.1", "localhost"].includes(base.hostname) &&
  !base.hostname.endsWith(".ddev.site")
)
  throw Error("Local API only");
let requests = 0;
function get(endpoint, params = {}, options = {}) {
  const url = new URL("/api/world/" + endpoint, base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  requests++;
  return new Promise((resolve, reject) => {
    const req = (url.protocol === "https:" ? https : http).request(
      url,
      { rejectUnauthorized: false, ...options },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            assert.match(
              res.headers["content-type"] || "",
              /application\/json/,
            );
            resolve({
              status: res.statusCode,
              data: body ? JSON.parse(body) : null,
              headers: res.headers,
            });
          } catch (error) {
            reject(
              Error(
                url.pathname + ": " + error.message + " " + body.slice(0, 200),
              ),
            );
          }
        });
      },
    );
    req.on("error", reject);
    req.end(options.body);
  });
}
(async () => {
  const examples = {};
  for (const lang of ["es", "en", "de", "fr", "it", "pt"]) {
    const boot = await get("bootstrap", { lang });
    assert.equal(boot.status, 200);
    assert.equal(boot.data.locale, lang);
    assert(boot.data.destinations.recordStory);
    assert(!("world" in boot.data));
    for (const kind of ["cuento", "chiste", "expresion"]) {
      const batch = await get("discover", { lang, kind });
      assert.equal(batch.status, 200);
      assert(batch.data.items.length <= 6);
      for (const item of batch.data.items) {
        assert.equal(item.lang, lang);
        assert.equal(item.kind, kind);
        assert(item.audio);
        assert(!("html" in item));
        assert(!("user_id" in item));
        assert(!("email" in item));
      }
      if (batch.data.items[0]) {
        const first = batch.data.items[0];
        examples[lang + ":" + kind] = first;
        const single = await get("item", {
          lang,
          kind,
          id: first.id,
          ...(first.voiceId ? { voice: first.voiceId } : {}),
        });
        assert.equal(single.status, 200);
        assert.equal(single.data.item.id, first.id);
        const excluded = await get("discover", {
          lang,
          kind,
          exclude: first.id,
          round: 2,
        });
        assert.equal(excluded.status, 200);
        assert(!excluded.data.items.some((i) => i.id === first.id));
      }
      const index = await get("index", { lang, kind });
      assert.equal(index.status, 200);
      assert(Array.isArray(index.data.items));
      const browse = await get("browse", { lang, kind });
      assert.equal(browse.status, 200);
      assert(browse.data.items.length <= 24);
      const search = await get("browse", { lang, kind, q: "a" });
      assert.equal(search.status, 200);
      if (index.data.items[0]) {
        const filtered = await get("browse", {
          lang,
          kind,
          [kind === "expresion" ? "region" : "category"]:
            index.data.items[0].id,
        });
        assert.equal(filtered.status, 200);
        if (kind === "expresion")
          for (const item of filtered.data.items)
            if (item.voiceId)
              assert.equal(
                item.regionSlug,
                index.data.items[0].id,
                "Region selection must also select a voice from that region",
              );
      }
    }
    // El catálogo sirve UNA cosa: láminas. La tienda salió de aquí el 17-sep-2026 y
    // `kind=products` se rechaza abajo, con el resto de lo que no existe.
    {
      const catalog = await get("catalog", { lang, kind: "art" });
      assert.equal(catalog.status, 200);
      for (const item of catalog.data.items) {
        assert(Number.isSafeInteger(item.id) && item.id > 0);
        assert.equal(typeof item.title, "string");
        assert(item.image && item.thumb);
        assert(!("url" in item));
        assert(!("price" in item), "Nothing here has a price");
      }
      assert(!("collection" in catalog.data));
      const ignored = await get("catalog", {
        lang,
        kind: "art",
        collection: 999999999,
      });
      assert.equal(ignored.status, 200);
      assert.deepEqual(
        ignored.data,
        catalog.data,
        "Retired collection selector is ignored",
      );
    }
    console.log("PASS local public API", lang);
  }
  const invalid = [
    ["bootstrap", { lang: "xx" }, 400],
    ["discover", { lang: "es", kind: "invalid" }, 400],
    ["catalog", { lang: "es", kind: "products" }, 400],
    ["browse", { lang: "es", kind: "cuento", cursor: -1 }, 400],
    ["browse", { lang: "es", kind: "cuento", cursor: 10001 }, 400],
    ["browse", { lang: "es", kind: "cuento", q: "x", category: "x" }, 400],
    ["item", { lang: "es", kind: "cuento", id: 999999999 }, 404],
    ["discover", { lang: "es", kind: "cuento", exclude: "1,nope" }, 400],
    ["identity", {}, 405],
    ["vote", {}, 405],
    ["guardian", {}, 405],
  ];
  for (const [endpoint, params, status] of invalid)
    assert.equal((await get(endpoint, params)).status, status, endpoint);
  for (const body of ["[1]", "{", "null", JSON.stringify({ create: "yes" })]) {
    const res = await get(
      "identity",
      {},
      { method: "POST", headers: { "content-type": "application/json" }, body },
    );
    assert.equal(res.status, 400);
  }
  assert.equal(
    (
      await get(
        "bootstrap",
        { lang: "es" },
        { headers: { Origin: "https://evil.invalid" } },
      )
    ).status,
    403,
  );
  const read = await get(
    "identity",
    {},
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    },
  );
  assert.equal(read.status, 200);
  assert.equal(read.data.created, false);
  assert.equal(read.data.user, null);
  const cors = await get(
    "vote",
    {},
    { method: "OPTIONS", headers: { Origin: base.origin } },
  );
  assert.equal(cors.status, 204);
  assert.equal(cors.headers["access-control-allow-origin"], base.origin);
  console.log(
    "PASS",
    requests,
    "local contract reads and rejected writes; no accounts, votes or LLM calls created.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
