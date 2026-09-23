"use strict";
/**
 * La bienvenida (`welcome.js`) y el botón de entrada que se llena mientras el bosque se prepara,
 * en el juego de verdad: con red lenta el botón no se apaga y su barra avanza sin retroceder;
 * una partida en blanco abre las cinco láminas en orden, cada una con su dibujo; un toque en el
 * mapa no la cierra; al terminar se queda la marca `welcomed` en la partida, y la segunda visita
 * ya no la enseña.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw Error("Loopback only");
const TITLES = ["Explora", "Escape room", "Interactúa", "Descubre", "Relájate"];

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
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const [width, height] of [[390, 844], [1280, 800]]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 700 });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false, latency: 150, downloadThroughput: 600 * 1024, uploadThroughput: 200 * 1024,
      });
      await page.goto(origin + "/bosque/explorar");
      const seen = [];
      for (let i = 0; i < 120; i++) {
        const state = await page.evaluate(() => {
          const b = document.getElementById("entry-start");
          return b && { p: parseFloat(b.style.getPropertyValue("--entry-progress")) || 0,
            loading: b.classList.contains("is-loading"), disabled: b.disabled, opacity: getComputedStyle(b).opacity };
        });
        if (!state) { await page.waitForTimeout(250); continue; }
        if (state.disabled) {
          assert(state.loading, "While preparing, the button shows it is loading");
          assert.equal(state.opacity, "1", "Loading is a fill, not a dimmed button");
        }
        seen.push(state.p);
        if (!state.disabled) break;
        await page.waitForTimeout(250);
      }
      assert(seen.length > 3, "The entry card was observed while preparing");
      for (let i = 1; i < seen.length; i++) assert(seen[i] >= seen[i - 1], "The bar never goes back");
      assert.equal(seen.at(-1), 100, "Ready is a full bar");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await page.click("#entry-start");
      await page.waitForSelector(".world-welcome", { state: "visible", timeout: 10000 });
      for (let s = 0; s < TITLES.length; s++) {
        await page.waitForFunction(() => document.querySelector(".world-welcome-art"), null, { timeout: 20000 });
        const slide = await page.evaluate(() => ({
          title: document.querySelector(".world-welcome h1").textContent,
          next: document.querySelector(".world-welcome .world-primary").textContent,
          on: [...document.querySelectorAll(".world-welcome-dots span")].findIndex((d) => d.classList.contains("is-on")),
          fits: document.querySelector(".world-welcome .world-primary").getBoundingClientRect().bottom <= innerHeight,
        }));
        assert.equal(slide.title, TITLES[s]);
        assert.equal(slide.on, s, "The dots say where you are");
        assert.equal(slide.next, s === TITLES.length - 1 ? "¡A explorar!" : "Siguiente");
        assert(slide.fits, "The button to go on is on screen");
        if (s === 1) {
          await page.mouse.click(8, height / 2);
          assert(!(await page.evaluate(() => document.getElementById("world-content").hidden)), "A stray tap on the map does not close it");
        }
        await page.click(".world-welcome .world-primary");
      }
      await page.waitForFunction(() => document.getElementById("world-content").hidden);
      const flags = await page.evaluate(() => JSON.parse(localStorage.getItem("magikitos.adventure")).flags);
      assert.equal(flags.welcomed, true, "The journey remembers the welcome");
      await page.reload();
      await page.waitForFunction(() => !document.getElementById("entry-start").disabled, null, { timeout: 60000 });
      await page.click("#entry-start");
      await page.waitForTimeout(1200);
      assert(await page.evaluate(() => document.getElementById("world-content").hidden), "The second visit goes straight to the forest");
      assert.deepEqual(errors, []);
      console.log(`  PASS welcome ${width}×${height}`);
      await context.close();
    }
  } finally {
    await browser.close();
    preview?.kill();
  }
  console.log("PASS welcome: the entry fills while preparing, five slides once, a stray tap keeps them, never twice.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
