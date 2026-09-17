"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const catalog = JSON.parse(fs.readFileSync(".local/build/world.json"));
const { nearbyPosition } = require("./browser-world.cjs");
const errors = [];
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const [width, height] of [
      [1440, 900],
      [1024, 768],
      [768, 1024],
      [390, 844],
      [844, 390],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
      });
      await page.route("**/*", (r) =>
        ["127.0.0.1", "magikitos.ddev.site"].includes(
          new URL(r.request().url()).hostname,
        )
          ? r.continue()
          : r.abort(),
      );
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        const pending = sessionStorage.getItem("picnic-seed");
        if (pending) {
          localStorage.setItem("magikitos.adventure", pending);
          sessionStorage.removeItem("picnic-seed");
        }
      });
      let state = {
        scene: "overworld",
        position: { x: 27 * 16, y: 53 * 16 },
        flags: {},
        muted: true,
      };
      await page.goto(origin + "/aventura");
      async function position(x, y) {
        state.position = { x: x * 16, y: y * 16 };
        await page.evaluate(
          (s) => sessionStorage.setItem("picnic-seed", JSON.stringify(s)),
          state,
        );
        await page.reload();
        await require("./browser-entry.cjs").enterWorld(page);
      }
      async function click(id, dy = 4) {
        const s = await page.evaluate(() =>
          window.MagikitosAdventure.inspect(),
        );
        const e = s.entities.find((e) => e.id === id);
        assert(e, id);
        const r = await page.locator("#world-canvas").boundingBox();
        const x = ((e.x - s.camera.x) * r.width) / s.view.width;
        const y = ((e.y - dy - s.camera.y) * r.height) / s.view.height;
        assert(
          x >= 0 && x <= r.width && y >= 0 && y <= r.height,
          id + " visible at " + width,
        );
        await page.mouse.click(r.x + x, r.y + y);
        await page.waitForFunction(
          () => !!window.MagikitosAdventure.inspect().dialogue,
          null,
          { timeout: 15000 },
        );
      }
      async function near(id) {
        const point = nearbyPosition(catalog.scenes.overworld, state, id);
        await position(point.x / 16, point.y / 16);
      }
      async function save() {
        await page.keyboard.press("Enter");
        state = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("magikitos.adventure")),
        );
      }
      await near("picnic-knife");
      await click("picnic-knife");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.knife === 1,
      );
      await save();
      await near("picnic-lighter");
      await click("picnic-lighter");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.lighter === 1,
      );
      await save();
      await near("picnic-mushroom");
      await click("picnic-mushroom", 20); // Elf-height mushroom: tap the cap, not the old oversized canopy.
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.mushroom === 1,
      );
      await save();
      await near("picnic-twig");
      await click("picnic-twig");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.twig === 1,
      );
      await save();
      await near("picnic-barbecue");
      await click("picnic-barbecue");
      await page.locator("[data-action='light']").click();
      await page.waitForFunction(
        () =>
          window.MagikitosAdventure.inspect().flags.fireLit &&
          !!window.MagikitosAdventure.inspect().dialogue,
      );
      await page.locator("[data-action='cook']").click();
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.skewer === 1,
      );
      await save();
      await near("picnic-neighbor");
      await click("picnic-neighbor");
      await page.locator("[data-action='give']").click();
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().flags.picnicFed,
      );
      await save();
      // Brizno suelta sus remos y nada más: el bosque no acuña setines (17-sep-2026).
      assert.equal(state.inventory.oars, 1);
      assert.equal(state.wallet.balance, 0);
      assert(state.timers.picnic > Date.now() + 4.99 * 3600000);
      assert.equal(state.inventory.knife, 1);
      assert.equal(state.inventory.lighter, 1);
      await position(25, 53);
      assert(
        !(
          await page.evaluate(
            () => window.MagikitosAdventure.inspect().entities,
          )
        ).some((e) => e.id === "human-smoker"),
      );
      const deadline = state.timers.picnic;
      assert.equal(
        (await page.evaluate(() => window.MagikitosAdventure.inspect().timers))
          .picnic,
        deadline,
      );
      // A prepared second meal waits in the test profile; the full repeat recipe is covered by pure tests.
      state.inventory.skewer = 1;
      await near("picnic-neighbor");
      await click("picnic-neighbor");
      assert.equal(await page.locator("[data-action='give']").count(), 0);
      // Advance the test browser's clock, not game state or the user's session.
      await page.evaluate((t) => {
        const original = Date.now;
        Date.now = () => Math.max(original(), t);
      }, deadline + 1);
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().timers.picnic,
      );
      assert(
        !(
          await page.evaluate(
            () => window.MagikitosAdventure.inspect().entities,
          )
        ).some((e) => e.id === "human-smoker"),
      );
      await page.waitForSelector("[data-action='give']");
      await page.locator("[data-action='give']").click();
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().timers.picnic > Date.now(),
      );
      const repeat = await page.evaluate(() =>
        window.MagikitosAdventure.inspect(),
      );
      assert.equal(repeat.wallet.balance, 0, "Ni la segunda brocheta acuña nada");
      assert.equal(repeat.inventory.knife, 1);
      assert.equal(repeat.inventory.lighter, 1);
      assert(!repeat.inventory.skewer);
      await page.close();
      console.log(
        "PASS picnic pointer recipe, oars, departure, reload and live hunger expiry " +
          width +
          "×" +
          height,
      );
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
