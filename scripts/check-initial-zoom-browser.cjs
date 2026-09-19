"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const { chromium } = require("playwright");
const { cameraMetrics } = require("../public/assets/js/adventure/camera");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const scene = JSON.parse(fs.readFileSync(".local/build/world.json")).scenes.overworld;
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  fs.mkdirSync(".local/zoom-review", { recursive: true });
  try {
    for (const [width, height] of [[320,568],[390,844],[844,390],[768,1024],[1440,900],[2560,1440],[3440,1440]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", route => ["127.0.0.1", "magikitos.ddev.site"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      await page.addInitScript(spawn => localStorage.setItem("magikitos.adventure", JSON.stringify({
        scene: "overworld", position: { x: spawn.x * 16, y: spawn.y * 16 },
        flags: {  }, muted: true,
      })), scene.spawn);
      await page.goto(origin + "/bosque/explorar");
      await require("./browser-entry.cjs").enterWorld(page);
      const inspect = () => page.evaluate(() => window.MagikitosAdventure.inspect());
      const initial = await inspect();
      assert.equal(initial.scale, cameraMetrics({ width, height }, scene).scale);
      await page.screenshot({ path: `.local/zoom-review/initial-${width}.png` });
      // Automatic framing follows real orientation/window changes until the user zooms.
      const resized = { width: height, height: width };
      await page.setViewportSize(resized);
      await page.waitForTimeout(150);
      assert.equal((await inspect()).scale, cameraMetrics(resized, scene).scale);
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      await page.mouse.move(width / 2, height / 2);
      for (let n = 0; n < 8; n++) await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(120);
      let s = await inspect();
      assert(s.scale < initial.scale);
      assert(s.camera.x >= 0 && s.camera.y >= 0);
      assert(s.camera.x + s.view.width <= s.bounds.width + 1);
      assert(s.camera.y + s.view.height <= s.bounds.height + 1);
      for (let n = 0; n < 10; n++) await page.mouse.wheel(0, -1000);
      await page.waitForTimeout(120);
      s = await inspect();
      assert.equal(s.scale, cameraMetrics({ width, height }, scene, 1).scale);
      assert(s.scale > initial.scale, "Closer manual view is still available");
      await page.setViewportSize(resized);
      await page.waitForTimeout(150);
      s = await inspect();
      assert.equal(s.scale, cameraMetrics(resized, scene, 1).scale, "Resize respects a manual zoom choice");
      assert.deepEqual(s.player, initial.player, "Zoom never changes the saved position");
      await page.close();
      console.log(`PASS initial framing ${width}×${height}: automatic orientation/resize, manual override, coverage and unchanged player.`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
