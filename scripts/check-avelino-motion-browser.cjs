"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const folder = ".local/mill-motion/review";
fs.mkdirSync(folder, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  try {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
      const page = await context.newPage();
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", route => {
        const request = route.request();
        return new URL(request.url()).pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method())
          ? route.fulfill({ status: 503, json: { ok: false } }) : route.continue();
      });
      await page.clock.install();
      await page.addInitScript(() => localStorage.setItem("magikitos.adventure", JSON.stringify({
        scene: "mill", position: { x: 240, y: 384 }, muted: true, flags: { welcomed: true }, inventory: {},
      })));
      await page.goto(origin + "/bosque/explorar"); await enterWorld(page);
      const wizard = () => page.evaluate(() => window.MagikitosAdventure.inspect().entities.find(e => e.id === "avelino"));
      const initial = await wizard(), frames = new Set(), positions = new Set(), directions = new Set();
      for (let i = 0; i < 32; i++) {
        await page.clock.runFor(1000);
        const now = await wizard();
        frames.add(now.frame); positions.add(Math.round(now.x) + "," + Math.round(now.y));
        if (now.moving) directions.add(now.direction);
        if (reducedMotion === "reduce") assert.deepEqual(now, initial, "Reduced motion holds both position and pose");
        else if ([0, 4, 10, 16, 24].includes(i))
          await page.screenshot({ path: `${folder}/wizard-${i}.png` });
      }
      if (reducedMotion !== "reduce") {
        assert(positions.size > 6 && directions.size >= 3 && frames.size > 6, "The wizard actually walks with multiple directional poses");
        const target = await page.evaluate(() => {
          const s = window.MagikitosAdventure.inspect(), e = s.entities.find(e => e.id === "avelino");
          const r = document.getElementById("world-canvas").getBoundingClientRect();
          return { x: r.left + (e.x - s.camera.x) * r.width / s.view.width,
            y: r.top + (e.y - 24 - s.camera.y) * r.height / s.view.height };
        });
        await page.mouse.click(target.x, target.y);
        await page.clock.runFor(7000);
        await page.waitForSelector(".world-challenge h1");
        assert((await page.locator(".world-challenge-conversation").innerText()).includes("678"), "A moving host keeps his original first-meeting rules");
        const talking = await wizard();
        await page.clock.runFor(4000);
        assert.deepEqual(await wizard(), talking, "Avelino waits during the challenge");
        await page.keyboard.press("Escape");
        await page.waitForSelector(".world-challenge", { state: "hidden" });
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log("PASS Avelino browser: directional walking, stationary conversation, first challenge, Escape and reduced motion.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
