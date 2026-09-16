"use strict";
const assert = require("node:assert/strict"),
  { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const read = (p) => p.evaluate(() => window.MagikitosAdventure.inspect());
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [];
  try {
    for (const [width, height, touch] of [
      [1440, 900, false],
      [390, 844, true],
      [1024, 768, true],
      [844, 390, false],
    ]) {
      const p = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
      });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.route("**/*", (r) =>
        ["127.0.0.1", "magikitos.ddev.site"].includes(
          new URL(r.request().url()).hostname,
        )
          ? r.continue()
          : r.abort(),
      );
      await p.addInitScript(() => {
        if (!localStorage.getItem("magikitos.adventure"))
          localStorage.setItem(
            "magikitos.adventure",
            JSON.stringify({
              scene: "overworld",
              position: { x: 29 * 16, y: 78.5 * 16 },
              flags: {  },
              muted: true,
            }),
          );
      });
      await p.goto(origin + "/aventura");
      await require("./browser-entry.cjs").enterWorld(p);
      const initial = await read(p),
        id = "clearing-willow-crate",
        before = initial.entities.find((e) => e.id === id);
      if (touch) {
        const r = await p.locator("#world-canvas").boundingBox();
        await p.touchscreen.tap(
          r.x + ((before.x - initial.camera.x) * r.width) / initial.view.width,
          r.y +
            ((before.y - 13 - initial.camera.y) * r.height) /
              initial.view.height,
        );
      } else await p.keyboard.down("ArrowUp");
      await p.waitForFunction(
        (id) => !!window.MagikitosAdventure.inspect().objects.overworld?.[id],
        id,
        { timeout: 6000 },
      );
      await p.keyboard.up("ArrowUp");
      await p.waitForTimeout(touch ? 600 : 0);
      const moved = (await read(p)).entities.find((e) => e.id === id);
      assert(moved.y < before.y, "Push forward, not teleport or pull");
      assert.equal(moved.x, before.x, "Stay on one axis");
      await p.reload();
      await require("./browser-entry.cjs").enterWorld(p);
      assert(
        Math.abs(
          (await read(p)).entities.find((e) => e.id === id).y - moved.y,
        ) < 0.001,
        "Pushed position survives reload at saved precision",
      );
      await p.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("magikitos.adventure"));
        s.position = { x: 27.25 * 16, y: 68 * 16 };
        localStorage.setItem("magikitos.adventure", JSON.stringify(s));
      });
      await p.reload();
      await require("./browser-entry.cjs").enterWorld(p);
      await p.keyboard.down("ArrowUp");
      await p.waitForFunction(
        () => !!window.MagikitosAdventure.inspect().dialogue,
      );
      await p.keyboard.up("ArrowUp");
      await p.keyboard.press("Enter");
      await p.keyboard.down("ArrowUp");
      await p.waitForTimeout(600);
      await p.keyboard.up("ArrowUp");
      assert.equal(
        (await read(p)).dialogue,
        null,
        "Continuing against closed sign cannot reopen it",
      );
      await p.close();
      console.log(
        "PASS push " +
          (touch ? "touch" : "keyboard") +
          ", save/reload and contact latch " +
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
