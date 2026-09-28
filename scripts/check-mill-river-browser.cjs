"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const { compileWorld } = require("../tools/world.cjs");
const { riverVisitors } = require("../public/assets/js/adventure/river-life");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const scene = compileWorld().scenes.overworld, mill = scene.entities.find(e => e.id === "mill-door");
const folder = ".local/avelino-refine/movement"; fs.mkdirSync(folder, { recursive: true });
async function pixels(page, box) {
  return page.evaluate(box => {
    const s = window.MagikitosAdventure.inspect(), canvas = document.getElementById("world-canvas"), scale = canvas.width / s.view.width;
    const x = Math.round((box.x - s.camera.x) * scale), y = Math.round((box.y - s.camera.y) * scale);
    return Array.from(canvas.getContext("2d").getImageData(x, y, Math.round(box.w * scale), Math.round(box.h * scale)).data);
  }, box);
}
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }), errors = [];
  try {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
      const page = await context.newPage();
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", route => {
        const r = route.request();
        if (new URL(r.url()).pathname.startsWith("/api/") || !["GET", "HEAD"].includes(r.method()))
          return route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false}' });
        return route.continue();
      });
      await page.clock.install();
      await page.addInitScript(({ x, y }) => localStorage.setItem("magikitos.adventure", JSON.stringify({
        scene: "overworld", position: { x, y }, muted: true, flags: { welcomed: true }, inventory: {},
      })), { x: mill.x * 16, y: (mill.y + 2) * 16 });
      await page.goto(origin + "/bosque/explorar"); await enterWorld(page); await page.waitForTimeout(1000);
      const wheel = mill.attachments[0], box = { x: mill.x * 16 + wheel.offset[0] - 30,
        y: mill.y * 16 + wheel.offset[1] - 30, w: 60, h: 60 };
      const roof = { x: mill.x * 16 - 10, y: mill.y * 16 - 140, w: 36, h: 20 };
      const before = await pixels(page, box), building = await pixels(page, roof);
      await page.clock.fastForward(2000); await page.waitForTimeout(100);
      const after = await pixels(page, box), buildingAfter = await pixels(page, roof);
      let changedWood = 0;
      for (let i = 0; i < before.length; i += 4)
        if (before[i] > before[i + 2] * 1.35 && before[i] > 60 && Math.abs(before[i] - after[i]) > 8) changedWood++;
      if (reducedMotion === "reduce") assert.equal(changedWood, 0, "Reduced motion holds the wheel still");
      else assert(changedWood > 200, "The wooden wheel visibly rotates, independently of water ripples");
      assert.deepEqual(buildingAfter, building, "The mill building stays completely still");
      await page.screenshot({ path: folder + "/mill-" + reducedMotion + ".png" });
      if (reducedMotion === "no-preference") {
        // Watch the actual lake turn at its real speed; jump the clock only between observations.
        await page.evaluate(() => localStorage.setItem("magikitos.adventure", JSON.stringify({
          scene: "overworld", position: { x: 156 * 16, y: 130 * 16 }, muted: true,
          flags: { welcomed: true }, inventory: { boat: 1, oars: 1 }, navigation: { mode: "boat", direction: "up" },
        })));
        // The startup seed belongs to this page only; make a fresh page using the same storage.
        const riverPage = await page.context().newPage();
        riverPage.on("pageerror", e => errors.push(e.message));
        await riverPage.route("**/*", route => {
          const r = route.request();
          return new URL(r.url()).pathname.startsWith("/api/") || !["GET", "HEAD"].includes(r.method())
            ? route.fulfill({ status: 503, body: '{"ok":false}' }) : route.continue();
        });
        await riverPage.goto(origin + "/bosque/explorar"); await enterWorld(riverPage);
        for (const time of [96, 102, 110]) {
          const current = await riverPage.evaluate(() => performance.now());
          await riverPage.clock.fastForward(Math.max(0, time * 1000 - current));
          await riverPage.waitForTimeout(100);
          const now = await riverPage.evaluate(() => performance.now() / 1000), boat = riverVisitors(scene, now)[0];
          assert(boat && boat.opacity === 1);
          const seen = await pixels(riverPage, { x: boat.x - 24, y: boat.y - 35, w: 48, h: 40 });
          let wood = 0; for (let i = 0; i < seen.length; i += 4) if (seen[i] > seen[i + 2] * 1.4 && seen[i] > 80) wood++;
          assert(wood > 100, "The real boat remains drawn before, during and after its lake turn");
          await riverPage.screenshot({ path: folder + "/river-" + time + ".png" });
        }
        await riverPage.close();
      }
      await context.close();
      console.log("PASS animated mill and river circuit " + reducedMotion);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
