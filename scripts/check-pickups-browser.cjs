"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const { nearbyPosition, entityScreenPoint } = require("./browser-world.cjs");
const scene = JSON.parse(fs.readFileSync(".local/build/world.json")).scenes
  .overworld;
const read = (page) => page.evaluate(() => window.MagikitosAdventure.inspect());
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  fs.mkdirSync(".local/pickup-review", { recursive: true });
  try {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
      [844, 390],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
      });
      page.on("pageerror", (e) => errors.push(e.message));
      // Even when explicitly testing production: no identity/save/world/analytics writes.
      await page.route("**/*", (r) =>
        new URL(r.request().url()).origin === origin &&
        ["GET", "HEAD"].includes(r.request().method())
          ? r.continue()
          : r.abort(),
      );
      await page.addInitScript(() => {
        const seed = sessionStorage.getItem("pickup-test-seed");
        if (seed) {
          localStorage.setItem("magikitos.adventure", seed);
          sessionStorage.removeItem("pickup-test-seed");
        }
      });
      await page.goto(origin + "/bosque/explorar");
      async function seed(extra = {}, anchor = "picnic-trash-bin") {
        const state = {
          scene: "overworld",
          flags: { skewerCooked: true },
          muted: true,
          ...extra,
        };
        state.position = nearbyPosition(scene, state, anchor);
        await page.evaluate(
          (s) => sessionStorage.setItem("pickup-test-seed", JSON.stringify(s)),
          state,
        );
        await page.reload();
        await require("./browser-entry.cjs").enterWorld(page);
      }
      async function click(id) {
        assert((await read(page)).entities.some((e) => e.id === id), id + " visible");
        const { x, y } = await entityScreenPoint(page, scene, id);
        await page.touchscreen.tap(x, y);
        await page.waitForFunction(
          () => !!window.MagikitosAdventure.inspect().dialogue,
        );
      }
      await seed();
      await page.screenshot({
        path: ".local/pickup-review/bottle-" + width + ".png",
      });
      await click("picnic-trash-bin");
      assert(
        !(await read(page)).inventory.bottle,
        "Bin is not the pickup target",
      );
      await page.keyboard.press("Enter");
      await click("picnic-bin");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.bottle === 1,
      );
      assert(
        !(await read(page)).entities.some((e) => e.id === "picnic-bin"),
        "Ground original disappears",
      );
      await page.keyboard.press("Enter");
      await page.reload();
      await require("./browser-entry.cjs").enterWorld(page);
      assert.equal((await read(page)).inventory.bottle, 1);
      assert(!(await read(page)).entities.some((e) => e.id === "picnic-bin"));
      await seed({ inventory: { boat: 1 } });
      assert(
        !(await read(page)).entities.some((e) => e.id === "picnic-bin"),
        "Old boat save hides litter",
      );
      await seed({ inventory: { knife: 1 } }, "forest-mushrooms-fern");
      await page.screenshot({
        path: ".local/pickup-review/mushroom-" + width + ".png",
      });
      await click("forest-mushrooms-fern");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.mushroom === 1,
      );
      await seed({}, "picnic-twig");
      await click("picnic-twig");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.twig === 1,
      );
      assert(!(await read(page)).entities.some((e) => e.id === "picnic-twig"));
      await page.keyboard.press("Enter");
      await page.reload();
      await require("./browser-entry.cjs").enterWorld(page);
      assert(!(await read(page)).entities.some((e) => e.id === "picnic-twig"));
      for (const [id, item] of [["forest-parchment", "parchment"], ["forest-pen", "pen"]]) {
        await seed({}, id);
        await page.screenshot({ path: `.local/pickup-review/${item}-${width}.png` });
        await click(id);
        await page.waitForFunction(key => window.MagikitosAdventure.inspect().inventory[key] === 1, item);
        assert(!(await read(page)).entities.some(e => e.id === id), "Collected writing tool disappears");
        await page.keyboard.press("Enter");
        await page.reload();
        await require("./browser-entry.cjs").enterWorld(page);
        assert.equal((await read(page)).inventory[item], 1);
        assert(!(await read(page)).entities.some(e => e.id === id), "Reload cannot duplicate the tool");
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.close();
      console.log(
        "PASS ground bottle, bin, old saves, scaled mushroom, twig persistence and touch pickup " +
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
