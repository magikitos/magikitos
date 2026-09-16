"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47842";
const read = (page) => page.evaluate(() => window.MagikitosAdventure.inspect());
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  fs.mkdirSync(".local/pickup-review", { recursive: true });
  try {
    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [844, 390]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
      page.on("pageerror", (e) => errors.push(e.message));
      // Even when explicitly testing production: no identity/save/world/analytics writes.
      await page.route("**/*", (r) => new URL(r.request().url()).origin === origin &&
        ["GET", "HEAD"].includes(r.request().method()) ? r.continue() : r.abort());
      await page.addInitScript(() => {
        const seed = sessionStorage.getItem("pickup-test-seed");
        if (seed) {
          localStorage.setItem("magikitos.adventure", seed);
          sessionStorage.removeItem("pickup-test-seed");
        }
      });
      await page.goto(origin + "/aventura");
      async function seed(extra = {}, position = { x: 19 * 16, y: 33.5 * 16 }) {
        await page.evaluate((s) => sessionStorage.setItem("pickup-test-seed", JSON.stringify(s)),
          { scene: "overworld", position, flags: { skewerCooked: true }, muted: true, ...extra });
        await page.reload();
        await require("./browser-entry.cjs").enterWorld(page);
      }
      async function click(id, dy) {
        const s = await read(page), e = s.entities.find((e) => e.id === id);
        assert(e, id + " visible");
        const r = await page.locator("#world-canvas").boundingBox();
        await page.touchscreen.tap(r.x + (e.x - s.camera.x) * r.width / s.view.width,
          r.y + (e.y - dy - s.camera.y) * r.height / s.view.height);
        await page.waitForFunction(() => !!window.MagikitosAdventure.inspect().dialogue);
      }
      await seed();
      await page.screenshot({ path: ".local/pickup-review/bottle-" + width + ".png" });
      await click("picnic-trash-bin", 36);
      assert(!(await read(page)).inventory.bottle, "Bin is not the pickup target");
      await page.keyboard.press("Enter");
      await click("picnic-bin", 14);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().inventory.bottle === 1);
      assert(!(await read(page)).entities.some((e) => e.id === "picnic-bin"), "Ground original disappears");
      await page.keyboard.press("Enter");
      await page.reload();
      await require("./browser-entry.cjs").enterWorld(page);
      assert.equal((await read(page)).inventory.bottle, 1);
      assert(!(await read(page)).entities.some((e) => e.id === "picnic-bin"));
      await seed({ inventory: { boat: 1 } });
      assert(!(await read(page)).entities.some((e) => e.id === "picnic-bin"), "Old boat save hides litter");
      await seed({ inventory: { knife: 1 } }, { x: 33 * 16, y: 70.5 * 16 });
      await page.screenshot({ path: ".local/pickup-review/mushroom-" + width + ".png" });
      await click("picnic-mushroom", 17);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().inventory.mushroom === 1);
      await seed({}, { x: 30.5 * 16, y: 73 * 16 });
      await click("picnic-twig", 4);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().inventory.twig === 1);
      assert(!(await read(page)).entities.some((e) => e.id === "picnic-twig"));
      await page.keyboard.press("Enter");
      await page.reload();
      await require("./browser-entry.cjs").enterWorld(page);
      assert(!(await read(page)).entities.some((e) => e.id === "picnic-twig"));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.close();
      console.log("PASS ground bottle, bin, old saves, scaled mushroom, twig persistence and touch pickup " + width + "×" + height);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
