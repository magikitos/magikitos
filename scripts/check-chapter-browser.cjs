"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [];
  fs.mkdirSync(".local/chapter-review", { recursive: true });
  const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
  try {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (r) =>
        ["127.0.0.1", "magikitos.ddev.site"].includes(
          new URL(r.request().url()).hostname,
        )
          ? r.continue()
          : r.abort(),
      );
      await page.addInitScript(() => {
        const s = sessionStorage.getItem("chapter-seed");
        if (s) {
          localStorage.setItem("magikitos.adventure", s);
          sessionStorage.removeItem("chapter-seed");
        }
      });
      await page.goto(origin + "/aventura");
      const inspect = () =>
        page.evaluate(() => window.MagikitosAdventure.inspect());
      const ready = () =>
        page.waitForFunction(() => window.MagikitosAdventure?.inspect().ready);
      async function seed(scene, x, y) {
        await page.evaluate(
          (s) => sessionStorage.setItem("chapter-seed", JSON.stringify(s)),
          {
            scene,
            position: { x: x * 16, y: y * 16 },
            flags: {},
            muted: true,
            wallet: { balance: 6 },
          },
        );
        await page.reload();
        await ready();
        assert.equal((await inspect()).scene, scene);
        assert.equal((await inspect()).dialogue, null);
      }
      for (const [name, scene, x, y] of [
        ["picnic", "overworld", 25, 53],
        ["brizno", "overworld", 25, 74],
        ["island", "islet", 34.5, 25.5],
        ["dock", "islet", 18, 25],
      ]) {
        await seed(scene, x, y);
        await page.waitForTimeout(180);
        await page.screenshot({
          path: `.local/chapter-review/${name}-${width}.png`,
        });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        const s = await inspect();
        assert(
          s.assets.loaded.filter((id) => /^actor-1\d\d$/.test(id)).length < 25,
        );
      }
      for (const id of [
        "islet-mushroom-home",
        "islet-leaf-home",
        "islet-pot-home",
      ]) {
        const door = world.scenes.islet.entities.find((e) => e.id === id),
          dest = door.rules
            .flatMap((r) => r.effects)
            .find((e) => e.type === "travel").scene;
        await seed("islet", ...door.arrival);
        await page.locator("#world-canvas").focus();
        await page.keyboard.down("ArrowUp");
        await page.waitForFunction(
          (scene) => window.MagikitosAdventure.inspect().scene === scene,
          dest,
        );
        await page.keyboard.up("ArrowUp");
        await page.waitForTimeout(200);
        await page.screenshot({
          path: `.local/chapter-review/${id}-${width}.png`,
        });
        // Exit by walking down from the room's landing, not by calling engine methods.
        await page.waitForTimeout(700);
        await page.keyboard.down("ArrowDown");
        await page.waitForFunction(
          () => window.MagikitosAdventure.inspect().scene === "islet",
        );
        await page.keyboard.up("ArrowDown");
        const s = await inspect();
        assert(
          Math.hypot(
            s.player.x - door.arrival[0] * 16,
            s.player.y - door.arrival[1] * 16,
          ) < 20,
          "Returns to the same building, not the mainland",
        );
      }
      await page.close();
      console.log(
        `PASS chapter ${width}×${height}: fresh entry, picnic, Brizno, island, lazy cast and three real enter/exit round trips.`,
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
