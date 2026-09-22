"use strict";
/**
 * ⛔ LOS CORTES AL CAMBIAR DE PANTALLA SE MIDEN, NO SE ADIVINAN (22-sep-2026). El dueño notaba
 * pausas al pasar de una pantalla a otra y nada las medía, así que volvían. Aquí se cruza con la
 * CPU ralentizada cuatro veces —un teléfono corriente—, por la costura pradera↔sauces andando y
 * por la puerta de la taberna, y se mide el hueco más largo entre dos fotogramas pintados en la
 * ventana de cada cruce. El bundle es el del código fuente, no el de la última build.
 *
 * Sin demonio: los cruces locales no dependen del bosque vivo (la confirmación va por detrás).
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const { bundleForTest } = require("../tools/bundle.cjs");
const { enterWorld } = require("./browser-entry.cjs");
const { nearbyPosition, entityScreenPoint } = require("./browser-world.cjs");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { World } = require("../public/assets/js/adventure/model");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw Error("Loopback only");
const THROTTLE = Number(process.env.TRANSITION_THROTTLE || 4);
/** The worst frame gap allowed in a crossing window, at 4× CPU throttling. */
const SEAM_BUDGET_MS = Number(process.env.SEAM_BUDGET_MS || 150),
  DOOR_BUDGET_MS = Number(process.env.DOOR_BUDGET_MS || 200);
const TILE = 16;

async function reachable() {
  try { return (await fetch(origin + "/bosque/explorar")).ok; } catch (_) { return false; }
}
(async () => {
  let preview = null;
  if (!(await reachable())) {
    if (!fs.existsSync(".local/build/world.json")) throw Error("Run npm run build first");
    preview = spawn(process.execPath, ["tools/preview.cjs", "--no-build", "--offline"], { stdio: "ignore" });
    for (let i = 0; i < 50 && !(await reachable()); i++) await new Promise((r) => setTimeout(r, 200));
  }
  const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
  const bundled = await bundleForTest();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];
  try {
    const open = async (saved) => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname.endsWith("/js/aventura.min.js"))
          return route.fulfill({ contentType: "text/javascript", body: bundled.outputFiles[0].text });
        if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "{}" });
        return route.continue();
      });
      await page.addInitScript((state) => {
        localStorage.setItem("magikitos.adventure", JSON.stringify(state));
        window.__frames = [];
        const tick = (t) => { window.__frames.push(t); requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }, saved);
      await page.goto(origin + "/bosque/explorar");
      await enterWorld(page);
      assert.equal(await page.evaluate(() => window.MagikitosAdventure.inspect().terrainWorker), true, "The ground paints off the main thread");
      const cdp = await page.context().newCDPSession(page);
      await page.waitForTimeout(4000); // la precarga calienta las vecinas, como en una partida
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
      return { page, errors, cdp };
    };
    const scene = (page) => page.evaluate(() => window.MagikitosAdventure.inspect().scene);
    const worstGap = (page, from) => page.evaluate((from) => {
      const f = window.__frames.filter((t) => t >= from);
      let worst = 0;
      for (let i = 1; i < f.length; i++) worst = Math.max(worst, f[i] - f[i - 1]);
      return worst;
    }, from);
    const now = (page) => page.evaluate(() => performance.now());
    const settle = (page) => page.waitForFunction(() => !window.MagikitosAdventure.inspect().transitioning, null, { timeout: 30000 });

    // La costura, cuatro veces: andando hasta el borde y al otro lado.
    {
      const saved = cleanSave({ scene: "overworld", position: { x: 74 * TILE, y: 6 * TILE }, muted: true }, world);
      const { page, errors, cdp } = await open(saved);
      for (const [key, target] of [["ArrowUp", "river-willows"], ["ArrowDown", "overworld"], ["ArrowUp", "river-willows"], ["ArrowDown", "overworld"]]) {
        const start = await now(page);
        await page.keyboard.down(key);
        await page.waitForFunction((t) => window.MagikitosAdventure.inspect().scene === t, target, { timeout: 30000 });
        await settle(page);
        await page.waitForTimeout(600);
        await page.keyboard.up(key);
        results.push({ kind: "seam", target, gap: await worstGap(page, start) });
        await page.waitForTimeout(800);
      }
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      assert.deepEqual(errors, []);
      await page.close();
    }
    // La puerta de la taberna, ida y vuelta.
    {
      const position = nearbyPosition(world.scenes.overworld, {}, "tavern-door");
      const saved = cleanSave({ scene: "overworld", position, muted: true }, world);
      const { page, errors, cdp } = await open(saved);
      const start = await now(page);
      const point = await entityScreenPoint(page, world.scenes.overworld, "tavern-door");
      await page.touchscreen.tap(point.x, point.y);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().scene === "tavern", null, { timeout: 30000 });
      await settle(page);
      await page.waitForTimeout(800);
      results.push({ kind: "door", target: "tavern", gap: await worstGap(page, start) });
      assert.equal(await scene(page), "tavern");
      // Y la vuelta: salir a la pradera es el suelo exterior entero de golpe.
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await page.waitForTimeout(3000);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
      const back = await now(page);
      const exit = await page.evaluate(({ x, y }) => {
        const i = window.MagikitosAdventure.inspect(), r = document.querySelector("#world-canvas").getBoundingClientRect();
        return { x: r.x + (x - i.camera.x) * r.width / i.view.width, y: r.y + (y - i.camera.y) * r.height / i.view.height };
      }, (() => { const e = new World(world.scenes.tavern).entities.find((e) => e.id === "exit"); return { x: e.x, y: e.y - 8 }; })());
      await page.touchscreen.tap(exit.x, exit.y);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().scene === "overworld", null, { timeout: 30000 });
      await settle(page);
      await page.waitForTimeout(800);
      results.push({ kind: "door", target: "overworld", gap: await worstGap(page, back) });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
    preview?.kill();
  }
  for (const r of results) console.log(`  ${r.kind} → ${r.target}: worst frame gap ${Math.round(r.gap)} ms`);
  for (const r of results)
    assert(r.gap <= (r.kind === "door" ? DOOR_BUDGET_MS : SEAM_BUDGET_MS),
      `${r.kind} → ${r.target} froze ${Math.round(r.gap)} ms at ${THROTTLE}× CPU`);
  console.log(`PASS transitions at ${THROTTLE}× CPU: ${results.length} crossings within budget (seam ≤ ${SEAM_BUDGET_MS} ms, door ≤ ${DOOR_BUDGET_MS} ms).`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
