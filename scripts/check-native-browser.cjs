"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { chromium } = require("playwright");
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
const { World } = require("../public/assets/js/adventure/model");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const errors = [],
  requests = [],
  screens = path.resolve(".local/screenshots");
fs.mkdirSync(screens, { recursive: true });
let browser;
async function scene(group, viewport = { width: 1440, height: 900 }) {
  const room = world.contentRooms[group],
    model = new World(world.scenes[room.scene]),
    entity = model.entities.find((e) => e.id === room.focus);
  let position;
  for (let d = 35; d < 100 && !position; d += 10)
    for (const [dx, dy] of [
      [0, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
    ]) {
      const p = { x: entity.x + dx * d, y: entity.y + dy * d };
      if (model.canStand(p.x, p.y)) {
        position = p;
        break;
      }
    }
  const page = await browser.newPage({ viewport, hasTouch: true });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) =>
    requests.push({ type: r.resourceType(), url: r.url(), method: r.method() }),
  );
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "magikitos.ddev.site"].includes(url.hostname))
      return route.abort();
    if (
      route.request().method() === "POST" &&
      url.pathname !== "/api/world/identity"
    )
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: '{"ok":false,"error":"test_no_writes"}',
      });
    return route.continue();
  });
  await page.addInitScript(
    (state) =>
      localStorage.setItem("magikitos.adventure", JSON.stringify(state)),
    { scene: room.scene, position, flags: {}, muted: true },
  );
  await page.goto(origin + "/aventura");
  await require("./browser-entry.cjs").enterWorld(page);
  await page.waitForTimeout(400);
  const s = await page.evaluate(() => window.MagikitosAdventure.inspect());
  const e = s.entities.find((e) => e.id === room.focus);
  const r = await page.locator("#world-canvas").boundingBox();
  await page.mouse.click(
    r.x + ((e.x - s.camera.x) / s.view.width) * r.width,
    r.y + ((e.y - 9 - s.camera.y) / s.view.height) * r.height,
  );
  await page
    .waitForFunction(
      () => !document.getElementById("world-content").hidden,
      {},
      { timeout: 12000 },
    )
    .catch(async (error) => {
      console.log(
        group,
        viewport,
        await page.evaluate(() => window.MagikitosAdventure.inspect()),
      );
      await page.screenshot({ path: path.join(screens, "native-failure.png") });
      throw error;
    });
  await page.waitForFunction(
    () =>
      document.getElementById("world-content").getAttribute("aria-busy") !==
      "true",
  );
  return page;
}
(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    for (const group of ["stories", "jokes", "expressions", "art"]) {
      const p = await scene(group, viewport);
      let text = await p.locator("#world-content").innerText();
      assert(
        !text.includes("Reintentar"),
        group + " should load real content: " + text,
      );
      assert.equal(
        await p
          .locator(
            "#world-content iframe,#world-content script, .world-folio-path, .world-folio-bar",
          )
          .count(),
        0,
      );
      if (group === "art") {
        const grid = p.locator(".world-native-catalogue");
        assert(
          (await grid.locator("button").count()) > 0,
          "Sheets appear without a collection step",
        );
        assert(
          !(await p.locator("#world-content").innerText()).includes(
            "Colecciones",
          ),
        );
        const firstThumb = await grid
          .locator("img")
          .first()
          .getAttribute("src");
        assert(firstThumb && firstThumb.includes("/colorear/"));
        await p.locator(".world-native-catalogue button").first().click();
        await p
          .locator(".world-experience-object img")
          .waitFor({ state: "visible" });
        await p.getByRole("link", { name: /Imprimir en la web/ }).waitFor();
        assert.equal(
          new URL(
            await p
              .getByRole("link", { name: /Imprimir en la web/ })
              .getAttribute("href"),
          ).pathname,
          "/colorear",
        );
        assert.equal(await p.locator("[data-world-detail]").count(), 0);
      } else {
        /**
         * ⛔ ESTA PRUEBA LLEVABA UNA DEPENDENCIA DEL ENTORNO ESCONDIDA DENTRO DE UN `getByRole`.
         *
         * Una sala puede recibirte de tres formas y las tres son correctas: con una pieza puesta
         * (los audios), con el índice abierto (el diccionario, que no reproduce nada solo) o
         * vacía, y solo en la última existe el botón «Elegir». Así que pasaba contra una base sin
         * contenido y moría por tiempo contra una copia de producción. Ahora se va al índice por
         * la puerta que HAYA —o ya se está en él— y el resto del recorrido es el mismo.
         */
        if (!(await p.locator(".world-native-search").count())) {
          await p.locator("[data-world-next]").waitFor();
          const vacia = await p
            .getByRole("button", { name: "Elegir", exact: true })
            .count();
          await p
            .getByRole("button", {
              name: vacia ? "Elegir" : "Índice",
              exact: true,
            })
            .click();
        }
        await p.locator(".world-native-search").waitFor();
        await p.getByRole("searchbox").fill("a");
        await p.locator(".world-native-search button").click();
        await p.waitForFunction(
          () =>
            document
              .getElementById("world-content")
              .getAttribute("aria-busy") !== "true",
        );
        await p.locator(".world-native-list button").first().click();
        if (group === "expressions")
          assert.equal(
            await p.locator("[data-world-rating]").isVisible(),
            false,
            "Voice voting waits until heard fully",
          );
      }
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "No page overflow",
      );
      const box = await p.locator(".world-experience").boundingBox();
      assert(box.width <= viewport.width + 1);
      await p.screenshot({
        path: path.join(
          screens,
          "native-" + group + "-" + viewport.width + ".png",
        ),
      });
      await p.keyboard.press("Escape");
      assert.equal(await p.locator("#world-content").isVisible(), false);
      assert.equal(new URL(p.url()).search, "");
      console.log(
        "PASS native activity",
        group,
        viewport.width,
        viewport.height,
      );
      await p.close();
    }
  }
  assert.deepEqual(errors, []);
  assert(!requests.some((r) => r.url.includes("/api/world/content")));
  assert(
    !requests.some((r) =>
      /\/(global|social|seta-rating|voice-player|estudio)\.min\.(js|css)/.test(
        r.url,
      ),
    ),
  );
  assert(!requests.some((r) => /\/api\/(track|track-play)/.test(r.url)));
  assert(!requests.some((r) => new URL(r.url).searchParams.has("collection")));
  console.log(
    "PASS independent native activity UI, local real content, safe links, no website runtime, no tracking.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => browser?.close());
