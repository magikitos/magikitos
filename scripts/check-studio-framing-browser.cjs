"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { chromium } = require("playwright"), { startStudio } = require("./browser-studio.cjs");
const origin = process.env.STUDIO_TEST_ORIGIN || "http://127.0.0.1:47843";
if (new URL(origin).hostname !== "127.0.0.1" || new URL(origin).port === "47832") throw Error("Isolated Studio only");
(async () => {
  const studio = process.env.STUDIO_TEST_ORIGIN ? null : await startStudio({ port: 47843,
    temp: fs.mkdtempSync(path.join(os.tmpdir(), "magikitos-framing-test-")), timeoutMs: 300000 });
  const browser = await chromium.launch({ channel: "chrome", headless: true }), errors = [];
  fs.mkdirSync(".local/probe-review", { recursive: true });
  try {
    for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1000 });
      page.on("pageerror", e => errors.push(e.message));
      await page.addInitScript(() => {
        window.paintedBodies = new Set();
        const original = CanvasRenderingContext2D.prototype.strokeRect;
        CanvasRenderingContext2D.prototype.strokeRect = function(...args) {
          if (["#36e6ff", "#9de0f5"].includes(this.strokeStyle)) paintedBodies.add(JSON.stringify(args));
          return original.apply(this, args);
        };
      });
      await page.goto(origin); await page.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
      await page.locator("#scene").selectOption("overworld");
      await page.evaluate(() => MagikitosStudio.select("workshop-door"));
      const point = await page.evaluate(async () => {
        const { snapshot } = await (await fetch("/api/workspace")).json();
        const e = snapshot.world.scenes.overworld.entities.find(e => e.id === "workshop-door");
        const s = MagikitosStudio.inspect(), r = document.getElementById("map").getBoundingClientRect();
        return { x: r.left + (e.x * 16 - s.camera.x) * s.zoom,
          y: r.top + (e.y * 16 - 12 - s.camera.y) * s.zoom };
      });
      if (width < 1000) { await page.touchscreen.tap(point.x, point.y); await page.touchscreen.tap(point.x, point.y); }
      else await page.mouse.dblclick(point.x, point.y);
      await page.waitForFunction(() => MagikitosStudio.inspect().bodyEditing);
      const s = await page.evaluate(() => MagikitosStudio.inspect());
      assert.equal(s.bodyScope, "log-home/taller");
      assert.equal(s.bodySolids.length, 3, "Every authored diagonal segment preserved");
      assert.equal(await page.locator('#body-boxes [data-box]').count(), 4, "Three bodies plus entrance");
      const b = s.bodyBounds;
      assert(Math.abs(b.x + b.w / 2 - s.camera.x - s.viewSize.width / 2) < 0.01);
      assert(Math.abs(b.y + b.h / 2 - s.camera.y - s.viewSize.height / 2) < 0.01);
      assert(b.x >= s.camera.x && b.x + b.w <= s.camera.x + s.viewSize.width);
      assert(b.y >= s.camera.y && b.y + b.h <= s.camera.y + s.viewSize.height);
      // Every rectangle is drawn, even though only one gets handles.
      await page.waitForFunction(() => MagikitosStudio.inspect().bodySolids.every(r => paintedBodies.has(JSON.stringify(r))));
      assert(!s.dirty, "Opening an editor does not move/save the element");
      await page.screenshot({ path: `.local/probe-review/compound-${width}.png` });
      await page.keyboard.press("Escape");
      await page.evaluate(() => MagikitosStudio.select("dock-access-woodland", "docks"));
      const dockPoint = await page.evaluate(() => {
        const r = document.getElementById("map").getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.dblclick(dockPoint.x, dockPoint.y);
      await page.waitForFunction(() => MagikitosStudio.inspect().bodyScope === "dock-jetty/planks");
      assert(await page.locator('[data-box="walkable"]').isVisible());
      await page.close(); console.log(`PASS Studio double tap ${width}×${height}: compound boxes, framing, docks, no authored changes`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); studio?.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
