"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { chromium } = require("playwright"), { startStudio } = require("./browser-studio.cjs");
const { compileWorld } = require("../tools/world.cjs"), { World, collisionBounds } = require("../public/assets/js/adventure/model");
const origin = process.env.STUDIO_TEST_ORIGIN || "http://127.0.0.1:47842";
if (new URL(origin).hostname !== "127.0.0.1") throw Error("Isolated local Studio only");
if (new URL(origin).port === "47832") throw Error("Never use the owner's workspace for editing tests");
(async () => {
  const studio = process.env.STUDIO_TEST_ORIGIN ? null : await startStudio({ port: 47842,
    temp: fs.mkdtempSync(path.join(os.tmpdir(), "magikitos-probe-test-")), timeoutMs: 300000 });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [], world = new World(compileWorld().scenes.overworld);
  const wall = world.entities.find(e => {
    if (!e.solid || e.actor || e.portal || !e.sprite?.includes("sign")) return false;
    const r = collisionBounds(e); return world.canStand(r.x + r.w / 2, r.y + r.h + 12);
  });
  assert(wall, "Authored sign with clear approach");
  const bounds = collisionBounds(wall), startPoint = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h + 12 };
  fs.mkdirSync(".local/probe-review", { recursive: true });
  try {
    for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1000 });
      page.on("pageerror", e => errors.push(e.message));
      await page.addInitScript(() => {
        window.boxColours = new Set();
        const stroke = CanvasRenderingContext2D.prototype.strokeRect;
        CanvasRenderingContext2D.prototype.strokeRect = function(...args) {
          boxColours.add(this.strokeStyle); return stroke.apply(this, args);
        };
      });
      await page.goto(origin);
      await page.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
      await page.locator("#scene").selectOption("overworld");
      await page.evaluate(() => MagikitosStudio.select("dock-access-woodland", "docks"));
      await page.locator("#body-edit").click();
      const number = async (id, value) => { await page.locator(id).fill(String(value)); await page.locator(id).press("Tab"); };
      await page.locator('[data-box="entrance"]').click();
      await number("#body-x", 1.5);
      assert(await page.locator("#body-finish").isDisabled());
      await page.waitForFunction(() => boxColours.has("#ff6b6b"));
      await number("#body-x", -1.25); await number("#body-y", -1);
      await number("#body-w", 1.4375); await number("#body-h", 1.5);
      await page.waitForFunction(() => boxColours.has("#ffc4ff"));
      const entrance = await page.evaluate(() => MagikitosStudio.inspect().bodyEntrance);
      await page.locator('[data-box="walkable"]').click();
      await number("#body-h", 1.875);
      await page.waitForFunction(() => boxColours.has("#c5ff75"));
      assert.deepEqual(await page.evaluate(() => MagikitosStudio.inspect().bodyEntrance), entrance);
      assert(await page.locator("#body-finish").isEnabled());
      const before = await page.evaluate(() => JSON.stringify({ changes: MagikitosStudio.inspect().changes, elements: MagikitosStudio.inspect().elements }));
      await page.locator("#probe-toggle").click();
      await page.waitForFunction(() => MagikitosStudio.inspect().probe.valid);
      await page.locator("#map").focus();
      const start = await page.evaluate(() => MagikitosStudio.inspect().probe.actor.x);
      await page.keyboard.down("ArrowRight");
      await page.waitForFunction(() => MagikitosStudio.inspect().probe.trigger === "woodland");
      await page.keyboard.up("ArrowRight");
      assert((await page.evaluate(() => MagikitosStudio.inspect().probe.actor.x)) > start);
      const assertCentered = async () => {
        const s = await page.evaluate(() => MagikitosStudio.inspect());
        assert(Math.abs(s.probe.actor.x - s.camera.x - s.viewSize.width / 2) < 0.01, "Probe centered horizontally");
        assert(Math.abs(s.probe.actor.y - s.camera.y - s.viewSize.height / 2) < 0.01, "Probe centered vertically");
      };
      await assertCentered();
      await page.waitForFunction(() => boxColours.has("#ffd75c"));
      await page.screenshot({ path: `.local/probe-review/trigger-${width}.png` });
      assert.equal(await page.evaluate(() => JSON.stringify({ changes: MagikitosStudio.inspect().changes, elements: MagikitosStudio.inspect().elements })), before,
        "Test walk must not save or move authored objects");
      await page.locator("#probe-toggle").click();
      await page.locator("#body-finish").click();
      await page.keyboard.press("Meta+s");
      await page.waitForFunction(() => !MagikitosStudio.inspect().dirty);
      const saved = await page.evaluate(() => MagikitosStudio.inspect().elements["dock-jetty"].planks);
      assert(saved.walkable && saved.walkable[3] < 1);
      await page.locator("#scene").selectOption("river-willows");
      await page.evaluate(() => MagikitosStudio.select("dock-access-bank", "docks"));
      await page.locator("#body-edit").click();
      assert.deepEqual(await page.evaluate(() => MagikitosStudio.inspect().bodyEntrance), entrance);
      await page.keyboard.press("Escape"); await page.reload();
      await page.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
      assert.deepEqual(await page.evaluate(() => MagikitosStudio.inspect().elements["dock-jetty"].planks), saved);
      await page.locator("#scene").selectOption("overworld");
      await page.evaluate(id => MagikitosStudio.select(id), wall.id);
      await page.locator("#probe-toggle").click();
      await page.locator("#probe-place").click();
      await page.locator("#map").scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const point = await page.evaluate(p => {
        const s = MagikitosStudio.inspect(), r = document.getElementById("map").getBoundingClientRect();
        return { x: r.left + (p.x - s.camera.x) * s.zoom, y: r.top + (p.y - s.camera.y) * s.zoom };
      }, startPoint);
      await page.mouse.click(point.x, point.y);
      await page.locator("#map").focus();
      assert(Math.abs((await page.evaluate(() => MagikitosStudio.inspect().probe.actor.y)) - startPoint.y) < 0.1,
        "Reposition click must reach the canvas, not its toolbar");
      await page.keyboard.down("ArrowUp");
      await page.waitForFunction(id => MagikitosStudio.inspect().probe.contact === id, wall.id);
      await page.waitForFunction(() => boxColours.has("#ff6060"));
      await page.screenshot({ path: `.local/probe-review/collision-${width}.png` });
      await page.keyboard.up("ArrowUp");
      // Real pointer drag goes through the shared thumb geometry and stops on release.
      const beforeDrag = await page.evaluate(() => MagikitosStudio.inspect().probe.actor.y);
      await page.mouse.move(point.x + 65, point.y); await page.mouse.down();
      await page.mouse.move(point.x + 65, point.y + 32, { steps: 4 });
      await page.waitForFunction(y => MagikitosStudio.inspect().probe.actor.y > y + 3, beforeDrag);
      await page.mouse.up();
      const stopped = await page.evaluate(() => MagikitosStudio.inspect().probe.actor.y);
      await page.waitForTimeout(120);
      assert.equal(await page.evaluate(() => MagikitosStudio.inspect().probe.actor.y), stopped, "Releasing drag stops without planting a destination");
      await assertCentered();
      await page.keyboard.press("Escape");
      assert(!(await page.evaluate(() => MagikitosStudio.inspect().probe.enabled)));
      await page.close(); console.log(`PASS Studio probe ${width}×${height}: zone colours, draft walking/boarding, save, shared surface, scene, reload`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); studio?.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
