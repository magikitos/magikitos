"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const { assertRetiredActionsAbsent } = require("./browser-art.cjs");
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["127.0.0.1", "localhost", "magikitos.ddev.site"].includes(new URL(origin).hostname))
  throw Error("Local browser test only");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  fs.mkdirSync(".local/actor-stream-review", { recursive: true });
  try {
    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
      for (const scene of ["tavern", "overworld"]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1000, ignoreHTTPSErrors: true });
      page.setDefaultTimeout(15000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin || !["GET", "HEAD"].includes(route.request().method())) return route.abort();
        if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: '{"ok":false,"error":"offline"}', contentType: "application/json" });
        return route.continue();
      });
        await page.addInitScript(({ scene, spawn }) => {
          localStorage.setItem("magikitos.adventure", JSON.stringify({
            scene, position: { x: spawn.x * 16, y: spawn.y * 16 }, muted: true,
          }));
        }, { scene, spawn: world.scenes[scene].spawn });
        await page.goto(origin + "/aventura");
        await enterWorld(page);
        await page.waitForFunction(() => {
          const s = window.MagikitosAdventure.inspect();
          return s.neighbors.filter((e) => e.x >= s.camera.x - 96 && e.x <= s.camera.x + s.view.width + 96 &&
            e.y >= s.camera.y - 96 && e.y <= s.camera.y + s.view.height + 96)
            .every((e) => s.assets.loaded.includes("actor-" + e.variant));
        });
        let peak = 0;
        for (let i = 0; i < 15; i++) {
          const state = await page.evaluate(() => window.MagikitosAdventure.inspect());
          const used = state.assets.bytes + state.assets.reservedBytes;
          peak = Math.max(peak, used);
          assert(used <= state.assets.budget, "All decodes and prewarming stay within the byte limit");
          assert(!state.assets.active.some((id) => /^actor-1\d\d$/.test(id)), "No NPC package is permanently pinned by its scene");
          await page.waitForTimeout(150);
        }
        const s = await page.evaluate(() => window.MagikitosAdventure.inspect());
        assert.equal(s.scene, scene, "Seed the requested scene with exactly one initializer");
        if (scene === "tavern") {
          assert(s.neighbors.length >= 10, "A genuine populated scene, not an empty test map");
          assert(s.assets.loaded.filter((id) => /^actor-1\d\d$/.test(id)).length >= 3, "Visible people really arrived");
        }
        await assertRetiredActionsAbsent(page);
        await page.screenshot({ path: `.local/actor-stream-review/${scene}-${width}.png` });
        console.log(`PASS actor streaming ${scene} ${width}×${height}: peak ${(peak / 1048576).toFixed(1)} MiB`);
      await page.close();
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
