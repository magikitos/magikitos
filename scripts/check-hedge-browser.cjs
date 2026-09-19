"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const read = (page) => page.evaluate(() => window.MagikitosAdventure.inspect());
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  fs.mkdirSync(".local/hedge-review", { recursive: true });
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
        const key = "magikitos.adventure";
        const seed = sessionStorage.getItem("hedge-seed");
        if (seed) {
          localStorage.setItem(key, seed);
          sessionStorage.removeItem("hedge-seed");
        }
        if (!localStorage.getItem(key))
          localStorage.setItem(
            key,
            JSON.stringify({
              scene: "human-hedge",
              position: { x: 57 * 16, y: 52 * 16 },
              inventory: { boat: 1 },
              muted: true,
            }),
          );
      });
      await page.goto(origin + "/bosque/explorar");
      const ready = () =>
        require("./browser-entry.cjs").enterWorld(page);
      await ready();
      assert.equal((await read(page)).cats.length, 4);
      const pot = (await read(page)).entities.find(
        (e) => e.id === "cover-pot-1",
      );
      await page.keyboard.down("ArrowUp");
      await page.waitForFunction(
        () =>
          !!window.MagikitosAdventure.inspect().objects["human-hedge"]?.[
            "cover-pot-1"
          ],
        null,
        { timeout: 8000 },
      );
      await page.keyboard.up("ArrowUp");
      assert(
        (await read(page)).entities.find((e) => e.id === pot.id).y < pot.y,
      );
      await page.reload();
      await ready();
      assert((await read(page)).objects["human-hedge"][pot.id]);
      await page.locator("#self-toggle").click();
      await page.locator("#puzzle-reset").click();
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().transitioning,
      );
      assert.equal((await read(page)).objects["human-hedge"], undefined);
      assert.equal(
        (await read(page)).entities.find((e) => e.id === pot.id).y,
        pot.y,
      );
      for (const [id, x, y, item] of [
        ["cat-water-bowl", 62, 35, "bowl"],
        ["garden-seeds", 89, 33, "seeds"],
      ]) {
        await page.evaluate(
          ({ x, y }) => {
            const s = JSON.parse(localStorage.getItem("magikitos.adventure"));
            s.position = { x: x * 16, y: y * 16 };
            sessionStorage.setItem("hedge-seed", JSON.stringify(s));
          },
          { x, y },
        );
        await page.reload();
        await ready();
        const s = await read(page),
          e = s.entities.find((e) => e.id === id),
          r = await page.locator("#world-canvas").boundingBox();
        await page.mouse.click(
          r.x + ((e.x - s.camera.x) * r.width) / s.view.width,
          r.y + ((e.y - 8 - s.camera.y) * r.height) / s.view.height,
        );
        await page.waitForFunction(
          (item) => window.MagikitosAdventure.inspect().inventory[item] === 1,
          item,
          { timeout: 15000 },
        );
        await page.keyboard.press("Enter");
      }
      await page.reload();
      await ready();
      const done = await read(page);
      assert.equal(done.inventory.bowl, 1);
      assert.equal(done.inventory.seeds, 1);
      assert(done.flags.bowlFound && done.flags.seedsFound);
      // ⛔ LOS GATOS SE QUEDAN (17-sep-2026, decisión del dueño). Desaparecían al llevarte el
      // cuenco y las semillas, y ellos siguen viviendo ahí: el jardín se quedaba vacío de golpe.
      assert.equal(done.cats.length, 4, "Los cuatro gatos siguen en su jardín");
      assert(
        !done.entities.some((e) =>
          ["cat-water-bowl", "garden-seeds"].includes(e.id),
        ),
      );
      await page.screenshot({
        path: `.local/hedge-review/complete-${width}.png`,
      });
      await page.close();
      console.log(
        `PASS hedge ${width}×${height}: four cats that stay, push/save/reset, bowl/seeds pickup and persistent completion`,
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
