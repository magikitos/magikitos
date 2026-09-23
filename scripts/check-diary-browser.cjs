"use strict";
/**
 * El Diario del Bosque (`diary.js`, `DIARIO.md`) en el juego de verdad, con el API de la web
 * simulado: se abre tocando el libro de la plaza, se lee a doble página en ancho y a una en el
 * teléfono, el contador no deja mandar menos de diez palabras, sin cuenta se pide la cuenta y el
 * borrador sobrevive, y con cuenta la página se publica y el día queda gastado.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const { bundleForTest } = require("../tools/bundle.cjs");
const { enterWorld } = require("./browser-entry.cjs");
const { entityScreenPoint } = require("./browser-world.cjs");
const { cleanSave } = require("../public/assets/js/adventure/save");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw Error("Loopback only");

const labels = {
  title: "El diario del bosque", intro: "Cada día…", write: "Escribir mi página de hoy", placeholder: "¿Qué llevas hoy por dentro?",
  send: "Dejarla en el diario", sending: "Secándose la tinta…", words: ":n de :max palabras", min: "Escribe al menos :n palabras.",
  max: "Como mucho :n palabras.", empty: "El diario está en blanco.", more: "Páginas anteriores", already: "Hoy ya has dejado tu página.",
  account: "Hace falta tu cuenta.", saved: "Tu página ya está en el diario.", error: "Error", back: "Volver", anonymous: "Alguien del bosque",
  care: "Gracias.", careLine: "024", rejected: "No ha entrado.", today: "Hoy", discard: "Descartar",
  reasonDatosPersonales: "Lleva datos personales.", reasonTerceros: "t", reasonNoEsUnaPagina: "n", reasonOdio: "o", reasonSexual: "s", reasonInstrucciones: "i",
};
const pages = Array.from({ length: 5 }, (_, i) => ({
  id: 50 - i, text: "Página " + i + " del bosque, con sus palabras de siempre para que se pueda leer.", signature: i === 3 ? null : "Lechuza " + i,
  day: "2026-09-2" + (3 - Math.min(i, 3)), mine: false,
}));
const TEXT = "Esta mañana he visto amanecer desde la ventana del tren y me he acordado de mi padre.";

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
  const bundled = (await bundleForTest()).outputFiles[0].text;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const [width, height, account] of [[1280, 800, true], [390, 844, true], [390, 844, false]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 700 });
      const errors = [], posts = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname.endsWith("/js/aventura.min.js")) return route.fulfill({ contentType: "text/javascript", body: bundled });
        if (url.pathname === "/api/world/bootstrap") return route.fulfill({ json: { ok: true, locale: "es", destinations: {}, capabilities: {} } });
        if (url.pathname === "/api/world/diary")
          return route.fulfill({ json: { ok: true, pages, next: null, me: { account, wroteToday: false },
            limits: { minWords: 10, maxWords: 400, maxChars: 4000 }, labels } });
        if (url.pathname === "/api/world/diary-write") {
          posts.push(route.request().postDataJSON());
          return route.fulfill({ json: { ok: true, status: "published", page: { id: 51, text: TEXT, signature: "Abeja", day: "2026-09-23", mine: true } } });
        }
        if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "{}" });
        return route.continue();
      });
      await page.addInitScript((state) => {
        localStorage.setItem("magikitos.adventure", JSON.stringify(state));
        localStorage.setItem("magikitos.session", "fixture-token");
      }, cleanSave({ scene: "overworld", position: { x: 59 * 16, y: 102 * 16 }, muted: true }, world));
      await page.goto(origin + "/bosque/explorar");
      await enterWorld(page);
      await page.waitForTimeout(1500);
      const book = await entityScreenPoint(page, world.scenes.overworld, "forest-diary");
      if (width < 700) await page.touchscreen.tap(book.x, book.y); else await page.mouse.click(book.x, book.y);
      await page.waitForSelector(".world-diary-book", { timeout: 20000 });
      const shown = () => page.$$eval(".world-diary-page", (n) => n.filter((p) => getComputedStyle(p).display !== "none" && p.textContent.trim()).length);
      assert.equal(await shown(), width < 560 ? 1 : 2, "Two pages side by side, one on a phone");
      assert(await page.$eval(".world-diary-art", (c) => c.width > 0), "The designer's book is drawn");
      await page.click(".world-diary-turn button:last-child");
      await page.waitForFunction((t) => document.querySelector(".world-diary-page--left").textContent.includes(t),
        width < 560 ? "Página 1" : "Página 2");
      await page.click("text=" + labels.write);
      await page.waitForSelector(".world-diary-input");
      await page.fill(".world-diary-input", "Solo cuatro palabras aquí");
      assert(await page.$eval("text=" + labels.send, (b) => b.disabled), "Fewer than ten words cannot be sent");
      await page.fill(".world-diary-input", TEXT);
      assert(!(await page.$eval("text=" + labels.send, (b) => b.disabled)), "Ten words or more can");
      await page.click("text=" + labels.send);
      if (!account) {
        await page.waitForFunction(() => document.getElementById("self-dialog")?.open, null, { timeout: 5000 });
        assert.equal(posts.length, 0, "Without an account nothing leaves the browser");
        assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("magikitos.diary.draft"))).text, TEXT, "The draft survives");
      } else {
        await page.waitForSelector("text=" + labels.already, { timeout: 10000 });
        assert.equal(posts.length, 1);
        assert.match(posts[0].operationId, /^[a-f0-9]{32}$/);
        assert.equal(posts[0].text, TEXT);
        assert.equal(await page.evaluate(() => localStorage.getItem("magikitos.diary.draft")), null, "A published page clears its draft");
        assert(await page.$eval(".world-diary-page--left", (p) => p.textContent.includes("amanecer")), "The new page opens the diary");
      }
      assert.deepEqual(errors, []);
      console.log(`  PASS diary ${width}×${height}${account ? "" : " without account"}`);
      await page.close();
    }
  } finally {
    await browser.close();
    preview?.kill();
  }
  console.log("PASS diary: opens from the book, reads two pages or one, counts words, asks for the account and keeps the draft, publishes once.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
