"use strict";
/** Real game rendering/input + real WebSocket authority. Only identity/save HTTP is a
 * synthetic fixture; no debug setter, production account, database or authored map is changed. */
const assert = require("node:assert/strict"), fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright"), { build } = require("esbuild");
const { enterWorld } = require("./browser-entry.cjs");
const { entityScreenPoint } = require("./browser-world.cjs");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { liveContract } = require("../tools/live-contract.cjs");
const { createLiveServer } = require("../../magikitos/bosque-vivo/server.cjs");
const { mac } = require("../../magikitos/bosque-vivo/tickets.cjs");
const { protocol } = require("../public/assets/js/adventure/forest-connection");
const { shapes } = require("../public/assets/js/adventure/construction-layout");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw Error("Loopback only");
const world = JSON.parse(execFileSync("php", ["-r", 'echo json_encode(require "data/aventura/world.php");']));
const scene = world.scenes.overworld = { id: "overworld", width: 64, height: 64, seed: 1,
  spawn: { x: 30, y: 32 }, paths: [], waters: [], regions: [], clearings: [], scenery: [], entities: [
    { id: "shared-crate", sprite: "crates", x: 32, y: 32, solid: [-0.5, -0.5, 1, 1], shared: true, pushable: true, rules: [] },
  ] };
world.construction.zones.overworld.protected = [];
const secret = "synthetic-browser-shared-objects-only-secret";
let communityRevision = 0, communityObjects = [];
const read = page => page.evaluate(() => window.MagikitosAdventure.inspect());
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) {
  const deadline = Date.now() + 8000;
  while (!(await predicate())) { if (Date.now() > deadline) throw Error("Shared browser condition timed out"); await pause(30); }
}
async function main() {
  const service = createLiveServer({ secret, scenes: liveContract(world).scenes, origins: [origin],
    limits: { ...protocol.limits, players: 2 } });
  const { port } = await service.listen(0);
  const zones = Object.entries(world.construction.zones).map(([zone, definition]) =>
    ({ scene: definition.scene, zone, revision: 0, bodies: [] }));
  service.presence.objects.install({ zones });
  const changeFurniture = objects => {
    communityObjects = objects; communityRevision++;
    const bodies = objects.flatMap(o => shapes(o, world.construction.definitions[o.kind]))
      .map(r => [r.x * 16, r.y * 16, r.w * 16, r.h * 16]);
    service.presence.objects.install({ zones: [{ scene: "overworld", zone: "overworld", revision: communityRevision, bodies }] });
  };
  const bundled = await build({ entryPoints: ["public/assets/js/aventura.js"], bundle: true, write: false });
  const browser = await chromium.launch({ channel: "chrome", headless: true }), errors = [];
  const crate = () => service.presence.objects.prop("overworld", "shared-crate");
  try {
    async function open(user, viewport, x) {
      const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1000 });
      await context.grantPermissions(["local-network-access"], { origin });
      const page = await context.newPage(), frames = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("websocket", socket => socket.on("framereceived", ({ payload }) => frames.push(JSON.parse(String(payload)))));
      let saved = cleanSave({ scene: "overworld", position: { x, y: 512 }, muted: true }, world), revision = 1;
      const profile = () => ({ id: String(user).padStart(32, "0"), revision, state: saved });
      await page.addInitScript(({ saved, user, origin }) => {
        if (location.origin !== origin) return;
        localStorage.setItem("magikitos_session", "synthetic-shared-browser-" + user);
        if (!localStorage.getItem("magikitos.adventure")) localStorage.setItem("magikitos.adventure", JSON.stringify(saved));
      }, { saved, user, origin });
      await page.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname.endsWith("/js/aventura.min.js"))
          return route.fulfill({ contentType: "text/javascript", body: bundled.outputFiles[0].text });
        if (url.pathname === "/bosque/explorar") {
          const response = await route.fetch(), html = await response.text();
          const body = html.replace(/(<script type="application\/json" id="adventure-config">)([\s\S]*?)(<\/script>)/, (_, a, json, b) => {
            const config = JSON.parse(json);
            Object.assign(config, { world, websiteBase: `http://127.0.0.1:${port}/`, apiBase: origin + "/api/world/" });
            return a + JSON.stringify(config).replaceAll("<", "\\u003c") + b;
          });
          return route.fulfill({ response, body });
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const endpoint = url.pathname.split("/").at(-1), now = Date.now();
        let body;
        if (endpoint === "identity") body = { user: { id: user, handle: "synthetic-shared-" + user, name: "Test" } };
        if (endpoint === "game-state") body = { profile: profile(), recoveries: [] };
        if (endpoint === "game-save") {
          saved = route.request().postDataJSON().state; revision++;
          assert(!Object.hasOwn(saved.objects?.overworld || {}, "shared-crate"), "Shared prop must never enter a cloud save");
          body = { profile: profile(), acknowledgedRevision: revision };
        }
        if (endpoint === "game-account") body = { account: { revision: 1, inventory: {}, setines: 0, progress: { flags: {} }, resources: {} } };
        if (endpoint === "game-body") body = { now, needs: { pee: { last: now, due: now + 8 * 3600000 }, poop: { last: now, due: now + 12 * 3600000 } } };
        if (endpoint === "forest-messages") body = { zone: "overworld", now, messages: [] };
        if (endpoint === "community") body = { zone: "overworld", now, revision: communityRevision, objects: communityObjects };
        if (endpoint === "forest-ticket") {
          const claims = { aud: protocol.ticketAudience, user, publicId: mac(secret, "public", String(user)).slice(0, 24),
            session: mac(secret, "session", String(user)), issuedAt: now, expiresAt: now + 300000, variant: 0,
            scene: "overworld", ...saved.position, mode: "foot", capabilities: { boat: false } };
          const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
          body = { protocol: 1, socketPath: "/bosque", now, expiresAt: claims.expiresAt,
            ticket: payload + "." + mac(secret, "forest-ticket", payload) };
        }
        return route.fulfill({ status: body ? 200 : 503, contentType: "application/json", body: JSON.stringify(body || { ok: false, error: "offline" }) });
      });
      await page.goto(origin + "/bosque/explorar"); await enterWorld(page);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.connected &&
        window.MagikitosAdventure.inspect().entities.some(e => e.id === "shared-crate"));
      return { page, frames };
    }
    const desktop = await open(1, { width: 1440, height: 900 }, 498);
    const tablet = await open(2, { width: 820, height: 1180 }, 526);
    const mobile = await open(3, { width: 390, height: 844 }, 498);
    assert.equal((await read(mobile.page)).live.role, "spectator");
    const kind = "woodland-bench", definition = world.construction.definitions[kind];
    assert(definition, "Fixture uses a real supported construction");
    const bench = { id: "b".repeat(32), kind, variant: definition.variants[0].id,
      x: 29, y: 36, rotation: 0, revision: 1, mine: false, heritage: false };
    const viewers = [desktop, tablet, mobile];
    changeFurniture([bench]);
    await until(async () => (await Promise.all(viewers.map(v => read(v.page)))).every(s =>
      s.entities.some(e => e.id === "community-" + bench.id)));
    changeFurniture([{ ...bench, x: 31, revision: 2 }]);
    await until(async () => (await Promise.all(viewers.map(v => read(v.page)))).every(s =>
      s.entities.find(e => e.id === "community-" + bench.id)?.x === 31 * 16));
    changeFurniture([]);
    await until(async () => (await Promise.all(viewers.map(v => read(v.page)))).every(s =>
      !s.entities.some(e => e.id === "community-" + bench.id)));
    assert.equal(crate().x, 512, "Furniture snapshots never reset or move a shared prop");
    console.log("PASS real desktop/tablet/mobile receive construction place/move/remove without re-entering the scene.");
    await Promise.all([desktop.page.keyboard.down("ArrowRight"), tablet.page.keyboard.down("ArrowLeft")]);
    await pause(700);
    const opposed = crate().x;
    await pause(1000);
    assert(Math.abs(crate().x - opposed) < 2, "Opposing browser inputs must stop the crate");
    assert((await read(desktop.page)).player.pushing && (await read(tablet.page)).player.pushing);
    console.log("PASS desktop/tablet actual held input cancels opposing pushes without penetration.");
    await Promise.all([desktop.page.keyboard.up("ArrowRight"), tablet.page.keyboard.up("ArrowLeft")]);
    await tablet.page.keyboard.down("ArrowRight"); await pause(1000); await tablet.page.keyboard.up("ArrowRight");
    await desktop.page.keyboard.down("ArrowRight");
    await until(() => crate().x > opposed + 15);
    await desktop.page.keyboard.up("ArrowRight");
    await until(async () => {
      const a = await read(desktop.page), b = await read(tablet.page);
      return a.entities.find(e => e.id === "shared-crate").x === b.entities.find(e => e.id === "shared-crate").x;
    });
    console.log("PASS released opposition permits a server-owned push and both rendered worlds converge.");

    await desktop.page.keyboard.down("ArrowLeft"); await pause(650); await desktop.page.keyboard.up("ArrowLeft");
    const beforeClick = crate().x, current = { ...scene, entities: [{ ...scene.entities[0], x: beforeClick / 16 }] };
    const point = await entityScreenPoint(desktop.page, current, "shared-crate");
    await desktop.page.mouse.click(point.x, point.y);
    await until(() => crate().x > beforeClick + 8);
    await until(async () => !(await read(desktop.page)).travel.intent);
    assert(!(await read(desktop.page)).dialogue);
    console.log("PASS actual sprite click approaches, waits on network authority and finishes the original push journey.");

    // Releasing the second player's seat promotes the existing mobile spectator, not a
    // fabricated replacement. Its real control —arrastrar el mapa, que desde el 19-sep-2026 es el
    // único mando táctil— toma el mismo camino de autoridad que el teclado del escritorio.
    await tablet.page.close();
    await until(async () => (await read(mobile.page)).live.role === "player");
    const cdp = await mobile.page.context().newCDPSession(mobile.page);
    const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type,
      touchPoints: points.map(([x, y], i) => ({ x, y, id: i + 1 })) });
    /**
     * ⛔ CON EL DEDO SE EMPUJA TOCANDO LA COSA, NO CAMINANDO CONTRA ELLA. Aquí se empujaba con el
     * joystick, que se erradicó el 19-sep-2026: hoy el mando táctil es arrastrar el mapa, y eso
     * planta un DESTINO cuyo camino RODEA lo que estorba —que es exactamente lo que se pidió, «que
     * encuentre el camino hasta ese sitio»—. Así que la forma táctil de empujar es la misma que la
     * del ratón, tocar la caja, y el camino de autoridad que se prueba aquí no cambia.
     */
    // El escritorio acaba de empujar, así que está plantado justo en el sitio DESDE el que se
    // empuja, y los duendes chocan entre ellos: se aparta, y suelta la caja. Un TOQUE pide la
    // autoridad UNA vez y una negativa es definitiva, mientras que el mando sostenido de antes la
    // volvía a pedir en cada fotograma hasta que el otro la soltaba.
    await desktop.page.keyboard.down("ArrowUp");
    await pause(700);
    await desktop.page.keyboard.up("ArrowUp");
    await until(() => service.presence.objects.intents.size === 0);
    const beforeTouch = crate().x;
    const mobileScene = { ...scene, entities: [{ ...scene.entities[0], x: beforeTouch / 16 }] };
    const mobilePoint = await entityScreenPoint(mobile.page, mobileScene, "shared-crate");
    await mobile.page.touchscreen.tap(mobilePoint.x, mobilePoint.y);
    await until(() => crate().x > beforeTouch + 8);
    // Y el empujón se suelta al TERMINAR el viaje, no al levantar el dedo: el toque ya dio la orden
    // entera, así que nada se queda reservado cuando la caja deja de hacer falta.
    await until(async () => !(await read(mobile.page)).travel.intent);
    await until(() => service.presence.objects.intents.size === 0);
    console.log("PASS mobile FIFO promotion and a real touch push; finishing the journey releases its intent.");
    // ⛔ La cámara ya no se arrastra (19-sep-2026): dos dedos solo hacen zoom y siguen al duende.
    // Aquí se paneaba para dejar la caja fuera de la vista y comprobar que conservaba su colisión;
    // hoy se comprueba lo que queda de esa idea: dos dedos no sueltan la cámara y la caja sigue ahí.
    await touch("touchStart", [[65, 230], [65, 290]]);
    for (let x = 105; x <= 345; x += 40) { await touch("touchMove", [[x, 230], [x, 290]]); await pause(30); }
    await touch("touchEnd", []);
    await pause(300);
    assert((await read(mobile.page)).cameraFollowing, "Two fingers never take the camera away from the player");
    assert((await read(mobile.page)).entities.some(e => e.id === "shared-crate"), "The nearby crate keeps its collision");
    console.log("PASS real two-finger gesture keeps the camera on the player and the crate's collision.");
    await pause(500);
    const returning = await open(4, { width: 1024, height: 768 }, crate().x);
    const arrived = (await read(returning.page)).player;
    assert(Math.abs(arrived.x - crate().x) >= 14 || Math.abs(arrived.y - crate().y) >= 13,
      "A saved position inside moved furniture is corrected before the player can be trapped");
    await returning.page.close();
    console.log("PASS actual saved-position admission applies the server's clear-foot greeting in the browser.");
    fs.mkdirSync(".local/forest-review", { recursive: true });
    await desktop.page.screenshot({ path: ".local/forest-review/shared-desktop.png" });
    await mobile.page.screenshot({ path: ".local/forest-review/shared-mobile.png" });
    for (const viewer of [desktop, mobile]) assert(!viewer.frames.some(f => f.type === "corregir"), "No movement correction loop while pushing");
    assert.deepEqual(errors, []);
    console.log("PASS shared-object browser integration; no production writes or personal object saves.");
  } finally { await browser.close(); await service.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
