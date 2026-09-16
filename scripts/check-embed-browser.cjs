"use strict";
/** El puente con la página que muestra el mundo, conducido de verdad.
 *
 * ⛔ LO QUE ESTO DEMUESTRA NO ES QUE EL BOTÓN EXISTA, SINO QUE NO PUEDE EXISTIR SIN PADRE.
 * La vuelta a la web es lo único del juego que la app NO debe tener nunca, y la garantía no
 * es una bandera de compilación: es que el logo solo aparece cuando una ventana padre DEL
 * MISMO ORIGEN ha hablado. Aquí se comprueban las dos caras — suelto no aparece, empotrado
 * sí — porque una de ellas es la que se rompe en silencio el día que alguien "simplifique"
 * el puente a un `?embedded=1`.
 *
 * La página padre es sintética y se sirve por `page.route` en el MISMO origen que el juego,
 * que es la única forma de que el postMessage sea el real y no una imitación.
 */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw Error("Local test only");

const PADRE = `<!doctype html><meta charset="utf-8"><title>host</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style>
<body>
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
  document.write('<iframe id="f" src="/aventura" allow="autoplay; fullscreen"></iframe>');
</script>`;

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
    await page.goto(origin + "/aventura");
    await page.waitForFunction(() => Boolean(window.MagikitosAdventure), { timeout: 45000 });
    assert(
      await page.locator("#world-leave").isHidden(),
      "Sin padre no hay vuelta que ofrecer: es la garantía de la app",
    );
    assert(
      await page.locator("#world-entry").isVisible(),
      "Y la tarjeta de entrada sí pregunta, porque nadie preguntó antes",
    );

    // (2) EMPOTRADO: el padre saluda, el mundo ofrece la vuelta y no vuelve a preguntar.
    await page.goto(origin + "/__padre");
    const world = page.frameLocator("#f");
    await page.waitForFunction(
      () => {
        const f = document.getElementById("f");
        return f && f.contentWindow && f.contentWindow.MagikitosAdventure;
      },
      { timeout: 45000 },
    );
    await world.locator("#world-leave").waitFor({ state: "visible", timeout: 15000 });
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
    await page.evaluate(() => window.mandar("abrir"));
    await page.waitForFunction(
      () => document.getElementById("f").contentWindow.MagikitosAdventure.inspect().entered,
      { timeout: 20000 },
    );
    const abierto = await dentro();
    assert.equal(abierto.entered, true);
    assert(abierto.audio.wanted, "Entrar desde la web es entrar con sonido");

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

    // (5) El logo pide la salida; la página es quien decide qué hacer con ella.
    await page.evaluate(() => (window.recibido = []));
    await world.locator("#world-leave").click();
    await page.waitForFunction(() => window.recibido.includes("cerrar"), { timeout: 10000 });

    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      "PASS: sin padre no hay vuelta (la garantía de la app); con padre del mismo origen hay logo, la tarjeta no repite la pregunta, abrir entra con sonido, cerrar calla sin pisar la preferencia y el logo pide la salida.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
