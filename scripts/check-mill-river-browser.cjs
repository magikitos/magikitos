"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const { compileWorld } = require("../tools/world.cjs");
const { riverVisitors } = require("../public/assets/js/adventure/river-life");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const catalog = compileWorld(), scene = catalog.scenes.overworld, exterior = catalog.scenes["river-willows"];
const mill = exterior.entities.find(e => e.id === "mill-door");
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
      await page.addInitScript(({ scene, x, y }) => localStorage.setItem("magikitos.adventure", JSON.stringify({
        scene, position: { x, y }, muted: true, flags: { welcomed: true }, inventory: {},
      })), { scene: exterior.id, x: mill.arrival[0] * 16, y: mill.arrival[1] * 16 });
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
      await page.evaluate(() => localStorage.setItem("magikitos.adventure", JSON.stringify({
        scene: "mill", position: { x: 240, y: 352 }, muted: true, flags: { welcomed: true }, inventory: {},
      })));
      const workshop = await context.newPage();
      workshop.on("pageerror", e => errors.push(e.message));
      await workshop.route("**/*", route => {
        const r = route.request();
        return new URL(r.url()).pathname.startsWith("/api/") || !["GET", "HEAD"].includes(r.method())
          ? route.fulfill({ status: 503, body: '{"ok":false}' }) : route.continue();
      });
      await workshop.goto(origin + "/bosque/explorar"); await enterWorld(workshop); await workshop.waitForTimeout(1000);
      const machine = catalog.scenes.mill.entities.find(e => e.id === "music-light-machine");
      const gears = { x: machine.x * 16 + 22, y: machine.y * 16 - 78, w: 50, h: 54 };
      const jar = { x: machine.x * 16 - 59, y: machine.y * 16 - 120, w: 36, h: 66 };
      const plinth = { x: machine.x * 16 - 10, y: machine.y * 16 - 10, w: 24, h: 8 };
      const oldGears = await pixels(workshop, gears), oldJar = await pixels(workshop, jar), oldPlinth = await pixels(workshop, plinth);
      await workshop.clock.fastForward(3000); await workshop.waitForTimeout(100);
      const newGears = await pixels(workshop, gears), newJar = await pixels(workshop, jar);
      const differences = (a,b) => a.reduce((n,v,i)=>n+(i%4===0 && Math.abs(v-b[i])>8 ? 1:0),0);
      if (reducedMotion === "reduce") {
        assert.deepEqual(newGears, oldGears, "Reduced motion freezes both interior gears");
        assert.deepEqual(newJar, oldJar, "Reduced motion freezes magic and pipe lights");
      } else {
        assert(differences(oldGears,newGears)>100, "The actual interior cogwheels visibly rotate");
        assert(differences(oldJar,newJar)>40, "Light travels into and out of the jar");
      }
      assert.deepEqual(await pixels(workshop,plinth),oldPlinth,"The machine's wooden base does not rotate or shimmer");
      await workshop.screenshot({ path: folder + "/workshop-" + reducedMotion + ".png" });
      const target = await workshop.evaluate(({x,y}) => {
        const s = window.MagikitosAdventure.inspect(), r = document.getElementById("world-canvas").getBoundingClientRect();
        return { x: r.left + (x*16-s.camera.x)*r.width/s.view.width,
          y: r.top + (y*16-34-s.camera.y)*r.height/s.view.height };
      }, machine);
      await workshop.mouse.click(target.x,target.y);
      await workshop.waitForFunction(() => Boolean(window.MagikitosAdventure.inspect().dialogue), null, { timeout: 20000 });
      assert((await workshop.locator("#dialogue").innerText()).includes("caja de música"), "The player can approach and examine the functioning machine");
      await workshop.close();
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
        let turn = 0, lowest = -Infinity;
        for (let t = 0; t < 300; t += .25) {
          const visitor = riverVisitors(scene, t)[0];
          if (visitor && visitor.y > lowest) { lowest = visitor.y; turn = t; }
        }
        for (const time of [turn - 7, turn, turn + 8]) {
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
