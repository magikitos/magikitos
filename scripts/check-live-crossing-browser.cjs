"use strict";
/**
 * ⛔ LOS CRUCES SE PRUEBAN CON EL DEMONIO DE VERDAD (20-sep-2026, tres veces «está arreglado» sin
 * estarlo). Las suites de cruces iban sin sesión, así que nunca pasaban por el bosque vivo, que es
 * quien rechazaba el origen recogido en el borde. Aquí hay un jugador CON sesión: el bundle real,
 * el demonio real con el contrato de esta misma build, la API de identidad y guardado simulada, y
 * el duende sube y baja por la costura pradera↔sauces ocho veces seguidas —andando, corriendo y
 * dándose la vuelta al momento—, mientras el demonio tiene que seguirle pantalla a pantalla sin
 * rechazar un solo cruce.
 */
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright"), { build } = require("esbuild");
const { enterWorld } = require("./browser-entry.cjs");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { liveContract } = require("../tools/live-contract.cjs");
const { protocol } = require("../public/assets/js/adventure/forest-connection");
let createLiveServer, mac;
try {
  ({ createLiveServer } = require("../../magikitos/bosque-vivo/server.cjs"));
  ({ mac } = require("../../magikitos/bosque-vivo/tickets.cjs"));
} catch (_) {
  console.log("SKIP live crossing: el demonio del bosque vivo (../magikitos/bosque-vivo) no está al lado.");
  process.exit(0);
}
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw Error("Loopback only");
const world = JSON.parse(execFileSync("php", ["-r", 'echo json_encode(require "data/aventura/world.php");']));
const secret = "synthetic-live-crossing-key-never-production";
const user = 7, TILE = 16;
const rejected = [], issues = [];
const warn = console.warn;
console.warn = (...args) => { if (/cruce rechazado/.test(String(args[0]))) rejected.push(args.join(" ")); warn(...args); };
(async () => {
  const service = createLiveServer({ secret, scenes: liveContract(world).scenes, origins: [origin] });
  const { port } = await service.listen(0);
  const bundled = await build({ entryPoints: ["public/assets/js/aventura.js"], bundle: true, write: false });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.grantPermissions(["local-network-access"], { origin });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => issues.push(e.message));
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error" && !/503|502/.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
    let saved = cleanSave({ scene: "overworld", position: { x: 74 * TILE, y: 6 * TILE }, muted: true }, world), revision = 1;
    const profile = () => ({ id: String(user).padStart(32, "0"), revision, state: saved });
    await page.addInitScript(({ saved, user, origin }) => {
      if (location.origin !== origin) return;
      localStorage.setItem("magikitos_session", "synthetic-live-crossing-" + user);
      localStorage.setItem("magikitos.adventure", JSON.stringify(saved));
    }, { saved, user, origin });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.endsWith("/js/aventura.min.js"))
        return route.fulfill({ contentType: "text/javascript", body: bundled.outputFiles[0].text });
      if (url.pathname === "/bosque/explorar") {
        const response = await route.fetch(), html = await response.text();
        const body = html.replace(/(<script type="application\/json" id="adventure-config">)([\s\S]*?)(<\/script>)/, (_, a, json, b) => {
          const config = JSON.parse(json);
          config.websiteBase = `http://127.0.0.1:${port}/`;
          config.apiBase = origin + "/api/world/";
          return a + JSON.stringify(config).replaceAll("<", "\\u003c") + b;
        });
        return route.fulfill({ response, body });
      }
      if (url.pathname.startsWith("/api/")) {
        const endpoint = url.pathname.split("/").at(-1);
        let body;
        if (endpoint === "identity") body = { user: { id: user, handle: "synthetic-" + user, name: "Test" } };
        else if (endpoint === "game-state") body = { profile: profile(), recoveries: [] };
        else if (endpoint === "game-save") { saved = route.request().postDataJSON().state; revision++; body = { profile: profile(), acknowledgedRevision: revision }; }
        else if (endpoint === "game-account") body = { account: { revision: 1, inventory: {}, setines: 0, progress: { flags: {} }, resources: {} } };
        else if (endpoint === "game-body") body = { now: Date.now(), needs: {} };
        else if (endpoint === "forest-messages") body = { zone: url.searchParams.get("zone"), now: Date.now(), messages: [] };
        else if (endpoint === "forest-ticket") {
          const now = Date.now(), claims = { aud: protocol.ticketAudience, user,
            publicId: mac(secret, "public", String(user)).slice(0, 24), session: mac(secret, "session", String(user)),
            issuedAt: now, expiresAt: now + 300000, variant: 0, scene: saved.scene, ...saved.position, mode: "foot", capabilities: { boat: false } };
          const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
          body = { protocol: 1, socketPath: "/bosque", now, expiresAt: claims.expiresAt, ticket: payload + "." + mac(secret, "forest-ticket", payload) };
        }
        return route.fulfill({ status: body ? 200 : 503, contentType: "application/json", body: JSON.stringify(body || { ok: false, error: "offline" }) });
      }
      return route.continue();
    });
    await page.goto(origin + "/bosque/explorar"); await enterWorld(page);
    await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.connected && window.MagikitosAdventure.inspect().live.role === "player");
    await page.waitForTimeout(4000); // la precarga calienta los sauces
    const snap = () => page.evaluate(() => { const i = window.MagikitosAdventure.inspect(); return { scene: i.scene, x: i.player.x, y: i.player.y, seams: i.seams.map((s) => s.scene), crossingError: i.crossingError, prewarmError: i.prewarmError, live: i.live.connected, transitioning: i.transitioning }; });
    const peerScene = () => service.presence.peers.get(user)?.scene;
    let crossings = 0;
    const cross = async (key, target, { run = false, pause = 500 } = {}) => {
      if (run) await page.keyboard.down(" ");
      await page.keyboard.down(key);
      const t0 = Date.now(); let s;
      while (Date.now() - t0 < 8000) { s = await snap(); if (s.scene === target || s.crossingError) break; await page.waitForTimeout(40); }
      await page.keyboard.up(key);
      if (run) await page.keyboard.up(" ");
      await page.waitForFunction(() => !window.MagikitosAdventure.inspect().transitioning);
      await page.waitForTimeout(pause);
      s = await snap();
      assert.equal(s.crossingError, null, "El cruce no falla: " + JSON.stringify(s.crossingError));
      assert.equal(s.scene, target, `Se llega a ${target} (${key}${run ? ", corriendo" : ""})`);
      assert.equal(peerScene(), target, "El demonio sigue al duende a " + target);
      assert(s.seams.includes(target === "river-willows" ? "overworld" : "river-willows"), "La pantalla que se deja sigue enlazada a la vista");
      assert.equal(s.live, true, "La conexión del bosque vivo sigue en pie");
      crossings++;
    };
    // Ocho veces arriba y abajo: andando, corriendo (rebasa el borde de un paso) y dándose la vuelta al momento.
    for (let i = 0; i < 4; i++) {
      await cross("ArrowUp", "river-willows", { run: i % 2 === 1, pause: i === 2 ? 60 : 500 });
      await cross("ArrowDown", "overworld", { run: i % 2 === 0, pause: i === 1 ? 60 : 500 });
    }
    // Las puertas con el demonio las cubre `check-forest-browser.cjs` (la taberna y su vuelta).
    assert.deepEqual(rejected, [], "El demonio no rechazó ningún cruce");
    assert.equal(peerScene(), "overworld");
    assert.deepEqual(issues, []);
    assert.deepEqual(consoleErrors.filter((e) => /Crossing|Prewarm/.test(e)), [], "Sin errores de cruce ni de precalentado en consola");
    const last = await snap();
    assert.equal(last.prewarmError, null, "Ningún precalentado falló: " + JSON.stringify(last.prewarmError));
    console.log(`PASS live crossing: ${crossings} cruces seguidos por la costura pradera↔sauces con sesión y demonio real (andando, corriendo y con vuelta inmediata), la pantalla que se deja siempre a la vista, cero rechazos del demonio, cero errores.`);
  } finally { console.warn = warn; await browser.close(); await service.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
