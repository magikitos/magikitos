"use strict";
/** Real same-origin host handshake and ancestor fullscreen ownership. */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
process.once("exit", () => require("../tools/clean-local.cjs").cleanLocal({ quiet: true }));
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw Error("Local test only");

const PADRE = `<!doctype html><meta charset="utf-8"><title>host</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style>
<body><button id="open">Explorar el bosque</button><div id="host" style="height:100%">
<script>
  window.recibido = [];
  addEventListener("message", (e) => {
    if (e.origin !== location.origin) return;
    const verbo = e.data && e.data.magikitos;
    if (typeof verbo !== "string") return;
    window.recibido.push(verbo);
    if (verbo === "hola" || verbo === "listo") marco().contentWindow.postMessage({ magikitos: "hola" }, location.origin);
  });
  function marco() { return document.getElementById("f"); }
  window.mandar = (verbo) => marco().contentWindow.postMessage({ magikitos: verbo }, location.origin);
  document.write('<iframe id="f" src="/bosque/explorar" allow="autoplay; fullscreen"></iframe>');
</script></div><script>document.getElementById('open').onclick = () => { mandar('abrir'); document.getElementById('host').requestFullscreen(); };</script>`;

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 900, height: 700 },
      hasTouch: true,
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem(
        "magikitos.adventure",
        JSON.stringify({ scene: "overworld", muted: true }),
      );
    });
    await page.route("**/__padre", (route) =>
      route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: PADRE }),
    );
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false}' }),
    );

    // (1) SUELTO: no hay a dónde volver, así que no hay botón.
    await page.goto(origin + "/bosque/explorar");
    await page.waitForFunction(() => Boolean(window.MagikitosAdventure), { timeout: 45000 });
    assert(
      (await page.locator("#world-leave").count()) === 0,
      "The retired website button is absent, including direct entry",
    );
    assert(
      await page.locator("#world-entry").isVisible(),
      "Y la tarjeta de entrada sí pregunta, porque nadie preguntó antes",
    );

    // (2) Embedded entry does not ask again or expose a website-access button.
    await page.goto(origin + "/__padre");
    const world = page.frameLocator("#f");
    await page.waitForFunction(
      () => {
        const f = document.getElementById("f");
        return f && f.contentWindow && f.contentWindow.MagikitosAdventure;
      },
      { timeout: 45000 },
    );
    assert.equal(await world.locator("#world-leave").count(), 0, "No website button inside /bosque either");
    assert(
      await world.locator("#world-entry").isHidden(),
      "La tarjeta no pregunta dos veces: la página ya preguntó",
    );
    const dentro = () =>
      page.evaluate(() =>
        document.getElementById("f").contentWindow.MagikitosAdventure.inspect(),
      );
    assert.equal((await dentro()).entered, false, "Precargado, todavía nadie ha entrado");

    // (3) ABRIR entra con sonido, sin preguntar nada.
    await page.locator("#open").click();
    await page.waitForFunction(
      () => document.getElementById("f").contentWindow.MagikitosAdventure.inspect().entered,
      { timeout: 20000 },
    );
    const abierto = await dentro();
    assert.equal(abierto.entered, true);
    assert(abierto.audio.wanted, "Entrar desde la web es entrar con sonido");

    await page.waitForFunction(() => document.fullscreenElement?.id === "host");
    assert.equal(await page.evaluate(() => document.getElementById("f").contentDocument.fullscreenElement), null,
      "Regression case: the host owns fullscreen, the game document does not");
    await world.locator("#world-fullscreen").waitFor({ state: "hidden" });
    await page.evaluate(() => document.exitFullscreen());
    await world.locator("#world-fullscreen").waitFor({ state: "visible" });
    await world.locator("#world-fullscreen").click();
    await world.locator("#world-fullscreen").waitFor({ state: "hidden" });
    await page.waitForFunction(() => Boolean(document.getElementById("f").contentDocument.fullscreenElement));
    await page.evaluate(() => document.exitFullscreen());
    await world.locator("#world-fullscreen").waitFor({ state: "visible" });

    // (4) CERRAR calla el mundo sin tocar la preferencia de sonido de nadie.
    await page.evaluate(() => window.mandar("cerrar"));
    await page.waitForFunction(
      () => !document.getElementById("f").contentWindow.MagikitosAdventure.inspect().audio.wanted,
      { timeout: 10000 },
    );
    assert.equal(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("magikitos.adventure")).muted,
      ),
      false,
      "Callar no es elegir el mute: la próxima visita no puede salir muda",
    );

    // Re-entering after Back keeps the same world and hides the redundant tool.
    await page.locator("#open").click();
    await page.waitForFunction(() => document.fullscreenElement?.id === "host");
    await world.locator("#world-fullscreen").waitFor({ state: "hidden" });

    assert.deepEqual(errors, []);
    await page.close();
    console.log("PASS: direct/embedded entry, no website button, parent/child fullscreen entry and exit, re-entry and audio preference.");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
