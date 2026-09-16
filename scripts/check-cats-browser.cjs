"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";

// Real input and real animation clock. Only the initial saved position is a fixture;
// no debug setters, direct encounter invocation or production identity is used.
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  fs.mkdirSync(".local/cat-review", { recursive: true });
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
        ["GET", "HEAD"].includes(r.request().method()) &&
        [new URL(origin).hostname, "127.0.0.1", "magikitos.ddev.site"].includes(
          new URL(r.request().url()).hostname,
        )
          ? r.continue()
          : r.abort(),
      );
      await page.addInitScript(() => {
        if (!localStorage.getItem("magikitos.adventure"))
          localStorage.setItem(
            "magikitos.adventure",
            JSON.stringify({
              scene: "overworld",
              position: { x: 20 * 16, y: 28.5 * 16 },
              muted: true,
            }),
          );
      });
      await page.goto(origin + "/aventura");
      await page.waitForFunction(
        () => window.MagikitosAdventure?.inspect().ready,
      );
      const inspect = () =>
        page.evaluate(() => window.MagikitosAdventure.inspect());
      assert.equal((await inspect()).cats.length, 1);
      await page.waitForFunction(
        () => Boolean(window.MagikitosAdventure.inspect().carried),
        null,
        { timeout: 35000 },
      );
      const caught = await inspect();
      await page.waitForTimeout(650);
      await page.screenshot({ path: `.local/cat-review/carry-${width}.png` });
      await page.keyboard.down("ArrowLeft");
      await page.keyboard.down(" ");
      await page.waitForTimeout(450);
      await page.keyboard.up("ArrowLeft");
      await page.keyboard.up(" ");
      const carried = await inspect();
      assert(carried.carried, "Cannot escape the carry with movement keys");
      const cat = carried.cats.find((c) => c.id === carried.carried);
      assert(
        Math.hypot(carried.player.x - cat.x, carried.player.y - cat.y) < 1,
      );
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().carried,
        null,
        { timeout: 15000 },
      );
      const released = await inspect();
      assert(
        Math.hypot(
          released.player.x - caught.player.x,
          released.player.y - caught.player.y,
        ) > 100,
        "A real setback, not damage",
      );
      assert.deepEqual(released.inventory, caught.inventory);
      await page.waitForTimeout(600);
      assert.equal(
        (await inspect()).carried,
        null,
        "Release grace prevents immediate recapture",
      );
      await page.reload();
      await page.waitForFunction(
        () => window.MagikitosAdventure?.inspect().ready,
      );
      assert.equal((await inspect()).carried, null);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.close();
      console.log(
        `PASS cat capture, carry input lock, safe setback, grace and reload ${width}×${height}`,
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
