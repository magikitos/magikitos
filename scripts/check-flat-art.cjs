"use strict";
const assert = require("node:assert/strict");
const { WorldApi } = require("../public/assets/js/adventure/api");
const { WorldContent } = require("../public/assets/js/adventure/content");
global.location = { href: "https://local.invalid/bosque/explorar" };
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
  // ⛔ LA TIENDA NO VUELVE POR AQUÍ (17-sep-2026). El catálogo servía también
  // productos, y el cliente los validaba con su propio contrato: nombre, precio,
  // existencias y URL de compra. Hoy la única cosa que este endpoint sabe leer son
  // láminas, así que un lote de productos —aunque el servidor lo mandara— se cae en
  // la puerta en vez de amueblar nada.
  assert.equal(
    typeof content.products,
    "undefined",
    "The client cannot ask for products",
  );
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
  await assert.rejects(
    content.catalogue("products"),
    /invalid_sheet/,
    "A product payload is refused",
  );
  console.log(
    "PASS flat art DTOs, no collection requests, pagination, master fallback, hostile/malformed URLs rejected and the shop refused.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
