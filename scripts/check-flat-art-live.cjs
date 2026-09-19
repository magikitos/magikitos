"use strict";
/** Explicit host, read-only real API/art verification. No identity, vote, chat or payment writes. */
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const { World, TILE } = require("../public/assets/js/adventure/model");
const [host, shell = "/bosque/explorar"] = process.argv.slice(2);
if (!host)
  throw Error(
    "Usage: node scripts/check-flat-art-live.cjs ORIGIN [STATIC_SHELL_PATH]",
  );
const origin = new URL(host).origin;
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
(async () => {
  let baseline;
  for (const lang of ["es", "en", "de", "fr", "it", "pt"]) {
    const response = await fetch(
      origin + "/api/world/catalog?kind=art&lang=" + lang,
      { signal: AbortSignal.timeout(15000) },
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    assert(!("collection" in data));
    assert(data.items.length > 0 && data.items.length <= 24);
    for (const item of data.items)
      assert(item.id && item.image && item.thumb && item.title);
    const art = data.items.map(({ id, image, thumb }) => ({
      id,
      image,
      thumb,
    }));
    if (baseline)
      assert.deepEqual(art, baseline, "One artwork catalogue across locales");
    baseline = art;
  }
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ]) {
      const p = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
      });
      const errors = [],
        catalogs = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("response", (r) => {
        if (
          new URL(r.url()).pathname.startsWith("/assets/images/colorear/") &&
          r.status() >= 400
        )
          errors.push(r.status() + " " + r.url());
      });
      await p.route("**/*", (r) => {
        const u = new URL(r.request().url());
        if (
          u.origin !== origin ||
          !["GET", "HEAD"].includes(r.request().method())
        )
          return r.abort();
        if (u.pathname === "/api/world/catalog") catalogs.push(u);
        return r.continue();
      });
      const room = world.contentRooms.art,
        w = new World(world.scenes[room.scene]),
        e = w.entities.find((e) => e.id === room.focus);
      await p.addInitScript(
        (s) => localStorage.setItem("magikitos.adventure", JSON.stringify(s)),
        {
          scene: room.scene,
          position: { x: e.x, y: e.y + TILE * 3 },
          muted: true,
        },
      );
      await p.goto(origin + shell);
      await require("./browser-entry.cjs").enterWorld(p);
      assert.equal(
        await p.evaluate(() => window.MagikitosAdventure.inspect().dialogue),
        null,
      );
      const s = await p.evaluate(() => window.MagikitosAdventure.inspect()),
        r = await p.locator("#world-canvas").boundingBox();
      await p.mouse.click(
        r.x + ((e.x - s.camera.x) / s.view.width) * r.width,
        r.y + ((e.y - 9 - s.camera.y) / s.view.height) * r.height,
      );
      const grid = p.locator(".world-native-catalogue");
      await grid.waitFor();
      assert.equal(await grid.locator("button").count(), baseline.length);
      assert.equal(
        new URL(await grid.locator("img").first().getAttribute("src")).pathname,
        baseline[0].thumb,
      );
      await grid.locator("button").first().click();
      await p.waitForFunction(() => {
        const i = document.querySelector(".world-experience-object img");
        return i?.complete && i.naturalWidth > 0;
      });
      assert.equal(
        new URL(
          await p.locator(".world-experience-object img").getAttribute("src"),
        ).pathname,
        baseline[0].image,
      );
      assert.equal(
        new URL(
          await p
            .getByRole("link", { name: /Imprimir en la web/ })
            .getAttribute("href"),
        ).pathname,
        "/colorear",
      );
      assert(catalogs.every((u) => !u.searchParams.has("collection")));
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await p.screenshot({
        path: ".local/screenshots/flat-art-live-" + width + ".png",
      });
      assert.deepEqual(errors, []);
      await p.close();
      console.log(
        "PASS real flat catalogue and artwork " +
          width +
          "×" +
          height +
          ", " +
          baseline.length +
          " sheets; all writes blocked.",
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
