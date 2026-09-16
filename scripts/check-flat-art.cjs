"use strict";
const assert = require("node:assert/strict");
const { WorldApi } = require("../public/assets/js/adventure/api");
const { WorldContent } = require("../public/assets/js/adventure/content");
global.location = { href: "https://local.invalid/aventura" };
(async () => {
  const requests = [];
  let response = {
    items: [
      { id: 10, title: "Sheet", image: "/master.avif", thumb: "/thumb.avif" },
    ],
    nextCursor: 24,
  };
  const api = new WorldApi({ locale: "es" }, {}, async (url) => {
    requests.push(url);
    return new Response(JSON.stringify(response), {
      headers: { "content-type": "application/json" },
    });
  });
  const content = new WorldContent({ api });
  const result = await content.catalogue("art");
  assert.equal(result.items[0].thumb, "https://local.invalid/thumb.avif");
  assert.equal(result.items[0].image, "https://local.invalid/master.avif");
  assert(!("collection" in result));
  assert(!requests[0].searchParams.has("collection"));
  response = { items: [], nextCursor: null };
  assert.equal((await content.catalogue("art", null, 24)).nextCursor, null);
  assert.equal(requests.at(-1).searchParams.get("cursor"), "24");
  const sheet = {
    id: 10,
    title: "Sheet",
    image: "/master.avif",
    thumb: "/master.avif",
  };
  response = { items: [sheet], nextCursor: null };
  assert.equal(
    (await content.catalogue("art")).items[0].thumb,
    "https://local.invalid/master.avif",
    "Server fallback is accepted",
  );
  for (const patch of [
    { image: null },
    { thumb: null },
    { thumb: "https://evil.invalid/x" },
    { image: "javascript:alert(1)" },
    { title: null },
    { id: -1 },
  ]) {
    response = { items: [{ ...sheet, ...patch }], nextCursor: null };
    await assert.rejects(content.catalogue("art"));
  }
  response = { items: [sheet], nextCursor: 24 };
  await assert.rejects(content.catalogue("art", null, 24), /invalid_catalogue/);
  response = {
    items: [
      {
        id: 1,
        name: "Duende",
        price: 100,
        currency: "EUR",
        quantity: 1,
        url: "/tienda",
        image: null,
      },
    ],
    nextCursor: null,
  };
  assert.equal(
    (await content.products())[0].price,
    100,
    "Product contract is unchanged",
  );
  console.log(
    "PASS flat art DTOs, no collection requests, pagination, master fallback, hostile/malformed URLs rejected and products unchanged.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
