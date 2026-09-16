"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const start = { x: 120, y: 200 }, end = { x: 248, y: 200 };
// Replace only the scene JSON in an ephemeral browser response. The shipped
// entry point, input, renderer, assets and dispatch all run unchanged; no writable
// debug API or test scene enters the game/Studio/user save.
const arena = {
  id: "overworld", width: 32, height: 24, indoor: true, seed: 1,
  paths: [], waters: [], regions: [], clearings: [], spawn: { x: 7.5, y: 12.5 },
  entities: [{ id: "test-sign", sprite: "sign", x: 11.5, y: 12.5,
    solid: [-0.5, -0.5, 1, 1], label: "sign",
    rules: [{ effects: [{ type: "dialogue", key: "neighborGreeting" }] }] }],
  neighbors: [{ id: "test-resident", x: 19.5, y: 12.5, radius: 0 }],
};
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = []; fs.mkdirSync(".local/journeys-review", { recursive: true });
  try {
    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, reducedMotion: "reduce" });
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (!["127.0.0.1", "magikitos.ddev.site"].includes(url.hostname)) return route.abort();
        if (url.pathname.startsWith("/api/"))
          return route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false,"error":"offline"}' });
        if (url.pathname !== "/aventura") return route.continue();
        const response = await route.fetch();
        const body = (await response.text()).replace(
          /(<script type="application\/json" id="adventure-config">)([\s\S]*?)(<\/script>)/,
          (_, open, json, close) => {
            const config = JSON.parse(json); config.world.scenes.overworld = arena;
            config.neighbors = []; config.cast = {};
            return open + JSON.stringify(config).replaceAll("<", "\\u003c") + close;
          },
        );
        return route.fulfill({ response, body });
      });
      await page.addInitScript(position => {
        localStorage.setItem("magikitos.adventure", JSON.stringify({ scene: "overworld", position, flags: {  }, muted: true }));
      }, start);
      await page.goto(origin + "/aventura");
      await require("./browser-entry.cjs").enterWorld(page);
      const inspect = () => page.evaluate(() => window.MagikitosAdventure.inspect());
      const waitArrival = () => page.waitForFunction(() => !window.MagikitosAdventure.inspect().travel.intent, null, { timeout: 10000 });
      // Keep both obstacles and both route endpoints visible on touch and desktop.
      await page.mouse.move(width / 2, height / 2);
      for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(150);
      async function click(point, touch) {
        let s = await inspect();
        if (point.x < s.camera.x + 16 || point.x > s.camera.x + s.view.width - 16) {
          const dx = (s.camera.x + s.view.width / 2 - point.x) * s.scale;
          await page.mouse.move(width / 2, height / 2); await page.mouse.down();
          await page.mouse.move(width / 2 + Math.max(-width * 0.45, Math.min(width * 0.45, dx)), height / 2, { steps: 8 });
          await page.mouse.up(); s = await inspect();
        }
        const r = await page.locator("#world-canvas").boundingBox();
        const x = r.x + (point.x - s.camera.x) * r.width / s.view.width,
          y = r.y + (point.y - s.camera.y) * r.height / s.view.height;
        assert(x > 0 && x < width && y > 0 && y < height, "Visible world point");
        if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
      }
      await page.evaluate(() => {
        window.journeyTrace = [];
        function sample() {
          const s = window.MagikitosAdventure.inspect();
          window.journeyTrace.push({ player: s.player, dialogue: s.dialogue?.entity?.id, intent: s.travel.intent });
          requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      // A sign on the straight line must be skirted; a destination beside a
      // resident's feet must not become a conversation by proximity.
      await click(end, width < 800); await waitArrival();
      let s = await inspect();
      assert(Math.hypot(s.player.x - end.x, s.player.y - end.y) < 1, JSON.stringify(s));
      assert.equal(s.dialogue, null);
      let trace = await page.evaluate(() => window.journeyTrace);
      assert(trace.some(t => Math.abs(t.player.y - start.y) > 12));
      assert(trace.every(t => !t.dialogue), "No transient incidental dialogue");

      // Both input devices use the same route planner. Cross the resident's body
      // and return, then deliberately click that same resident.
      await click({ x: 376, y: 200 }, width >= 800); await waitArrival();
      assert.equal((await inspect()).dialogue, null);
      await click(start, width < 800); await waitArrival();
      assert.equal((await inspect()).dialogue, null);
      await click({ x: 312, y: 186 }, width < 800);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().dialogue?.entity?.id === "test-resident");
      s = await inspect();
      assert.equal(s.pathLength, 0);
      await page.screenshot({ path: `.local/journeys-review/selected-${width}.png` });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(350);
      assert.equal((await inspect()).dialogue, null, "No reopening after arrival/close");
      await click(start, width < 800); await waitArrival();
      await click({ x: 184, y: 187 }, width < 800);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().dialogue?.entity?.id === "test-sign");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      assert.equal((await inspect()).dialogue, null);
      trace = await page.evaluate(() => window.journeyTrace);
      fs.writeFileSync(`.local/journeys-review/trace-${width}.json`, JSON.stringify(trace, null, 2));
      await page.close();
      console.log(`PASS journeys ${width}×${height}: mouse/touch destinations detour around sign and resident; only explicit clicks talk; closing never reopens.`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
