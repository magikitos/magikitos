"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { chromium } = require("playwright");
const { verify } = require("../tools/artifact.cjs"),
  { out } = require("../tools/build.cjs"),
  { ROUTES } = require("../tools/page.cjs");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834",
  offline = process.env.OFFLINE_GAME_ORIGIN || "http://127.0.0.1:47838";
const website = process.env.WEB_ORIGIN || "https://magikitos.ddev.site";
for (const value of [origin, offline, website]) {
  const u = new URL(value);
  if (
    !["localhost", "127.0.0.1"].includes(u.hostname) &&
    !u.hostname.endsWith(".ddev.site")
  )
    throw Error("Local tests only");
}
let browser;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const pointer = JSON.parse(fs.readFileSync(path.join(out, "current.json")));
  verify(path.join(out, "releases", pointer.id), pointer.id);
  const own = JSON.parse(fs.readFileSync("docs/world-api.openapi.json"));
  assert.deepEqual(
    own,
    JSON.parse(fs.readFileSync("../magikitos/docs/world-api.openapi.json")),
    "Both repos consume one matching API contract",
  );
  for (const file of [
    "src/functions-adventure.php",
    "src/view-presentation.php",
    "views/layouts/adventure.php",
    "public/assets/js/adventure",
    "data/aventura",
    "tools/adventure-studio",
  ])
    assert(
      !fs.existsSync("../magikitos/" + file),
      "No private engine copy: " + file,
    );
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  const p = await browser.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.route("**/*", (r) =>
    new URL(r.request().url()).origin === offline ? r.continue() : r.abort(),
  );
  await p.addInitScript(() =>
    localStorage.setItem(
      "magikitos.adventure",
      JSON.stringify({ flags: {  }, muted: true }),
    ),
  );
  await p.goto(offline + "/aventura");
  await require("./browser-entry.cjs").enterWorld(p);
  assert(!(await p.locator("#loading").isVisible()));
  const before = await p.evaluate(
    () => window.MagikitosAdventure.inspect().player,
  );
  await p.keyboard.down("ArrowDown");
  await p.waitForTimeout(300);
  await p.keyboard.up("ArrowDown");
  const after = await p.evaluate(
    () => window.MagikitosAdventure.inspect().player,
  );
  assert(
    Math.hypot(after.x - before.x, after.y - before.y) > 5,
    "World walks with no website/API",
  );
  await p.reload();
  await require("./browser-entry.cjs").enterWorld(p);
  console.log("PASS no-website static boot, movement and saved state");
  await p.close();
  // Mock the provider and protected writes, exercising real game controls.
  for (const mode of ["silent", "interactive", "error", "cancel"]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    page.on("pageerror", (e) => errors.push(e.message));
    let posts = 0;
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/api/world/bootstrap") {
        const response = await route.fetch(),
          data = await response.json();
        data.capabilities.turnstileSiteKey = "fixture-public-key";
        return route.fulfill({ json: data });
      }
      if (url.pathname === "/api/world/identity") {
        const body = route.request().postDataJSON();
        if (body.create) {
          posts++;
          assert.equal(body.turnstile_token, "fixture-proof");
          return route.fulfill({
            json: {
              ok: true,
              created: true,
              user: { name: "Fixture", handle: "fixture", avatar_url: null },
              token: "fixture-session",
            },
          });
        }
        return route.fulfill({
          json: { ok: true, created: false, user: null, token: null },
        });
      }
      // ⛔ LA MEDICIÓN NO ES UNA ESCRITURA DEL JUGADOR, y un guardián que no dice QUÉ vio no
      // sirve para nada: la primera vez que saltó costó una tarde averiguar de qué ruta hablaba.
      if (url.pathname === "/api/world/telemetry")
        return route.fulfill({ status: 204, body: "" });
      if (route.request().method() === "POST")
        throw Error("Unexpected write: " + url.pathname);
      return route.continue();
    });
    await page.addInitScript((mode) => {
      window.__proof = { removed: 0, executed: 0 };
      window.turnstile = {
        render(host, opts) {
          window.__proof.options = opts;
          return "fixture-widget";
        },
        execute() {
          window.__proof.executed++;
          const o = window.__proof.options;
          if (mode === "silent")
            setTimeout(() => o.callback("fixture-proof"), 0);
          else if (mode === "error") setTimeout(() => o["error-callback"](), 0);
          else o["before-interactive-callback"]();
        },
        remove() {
          window.__proof.removed++;
        },
      };
      // En la pradera, que es donde vive el claro compartido: construir es lo que hoy pide una
      // identidad, y por ahí pasa la prueba de humanidad.
      localStorage.setItem(
        "magikitos.adventure",
        JSON.stringify({
          scene: "river-willows",
          position: { x: 92 * 16, y: 95 * 16 },
          flags: {},
          muted: true,
        }),
      );
    }, mode);
    await page.goto(origin + "/aventura");
    await require("./browser-entry.cjs").enterWorld(page);
    /**
     * ⛔ EL BOTÓN QUE PEDÍA IDENTIDAD YA NO EXISTE, y esta prueba se quedó apuntándole: «Yo» dejó
     * de tener un «reclama tu cuenta» cuando el panel pasó a ofrecer Google y el código por
     * correo (16-sep-2026). Lo que de verdad se comprueba aquí es la prueba de humanidad en sus
     * cuatro caras, y quien la dispara hoy es CONSTRUIR: abrir el claro necesita una identidad.
     */
    await page.locator("#home-edit").click();
    if (mode === "interactive" || mode === "cancel") {
      await page.locator(".world-proof[open]").waitFor();
      const host = await page.locator(".world-proof-host").boundingBox();
      assert(host.width > 0, "Challenge has usable space");
      if (mode === "cancel") await page.keyboard.press("Escape");
      else
        await page.evaluate(() =>
          window.__proof.options.callback("fixture-proof"),
        );
    }
    await page.waitForFunction(() => window.__proof.removed === 1);
    await page.waitForTimeout(100);
    assert.equal(await page.locator(".world-proof").count(), 0);
    assert.equal(posts, ["silent", "interactive"].includes(mode) ? 1 : 0);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("magikitos_session")),
      posts ? "fixture-session" : null,
    );
    console.log("PASS independent human proof and identity", mode);
    await page.close();
  }
  // Native guardian; only JSON conversation, no model call or DB write.
  const chat = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let writes = [];
  chat.on("pageerror", (e) => errors.push(e.message));
  await chat.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/api/world/guardian-thread")
      return route.fulfill({
        json: {
          ok: true,
          mensajes: [{ de: "magikito", texto: "Mensaje anterior de prueba" }],
        },
      });
    if (url.pathname === "/api/world/csrf")
      return route.fulfill({ json: { csrf_token: "fixture-csrf" } });
    if (url.pathname === "/api/world/guardian") {
      const body = route.request().postDataJSON();
      writes.push(body);
      assert.equal(body.csrf_token, "fixture-csrf");
      assert.equal(body.texto, "Ea, esto es una prueba");
      return route.fulfill({
        json: {
          ok: true,
          texto: "Respuesta de prueba, sin llamar al modelo",
          token: "guardian-fixture-session",
        },
      });
    }
    if (url.pathname === "/api/world/vote") {
      const body = route.request().postDataJSON();
      writes.push(body);
      assert.equal(body.tipo, "voz");
      assert.equal(body.setas, 4);
      return route.fulfill({ json: { ok: true, media: 4 } });
    }
    // La medición no es una escritura del jugador; misma regla que arriba.
    if (url.pathname === "/api/world/telemetry")
      return route.fulfill({ status: 204, body: "" });
    if (route.request().method() === "POST")
      throw Error("Unexpected write: " + url.pathname);
    return route.continue();
  });
  // ⛔ EL GUARDIÁN TAMBIÉN PIDE PRUEBA DE HUMANIDAD antes de mandar nada, así que sin el widget
  // de pinta el envío se queda esperando para siempre y la prueba muere por tiempo sin decir por
  // qué. Es el mismo doble que el bloque de arriba, en su modo silencioso.
  await chat.addInitScript(() => {
    window.turnstile = {
      render: (host, opts) => ((window.__opts = opts), "fixture-widget"),
      execute: () => setTimeout(() => window.__opts.callback("fixture-proof"), 0),
      remove() {},
    };
  });
  await chat.addInitScript(() =>
    localStorage.setItem(
      "magikitos.adventure",
      JSON.stringify({
        scene: "house",
        position: { x: 296, y: 127 },
        flags: {  },
        muted: true,
      }),
    ),
  );
  await chat.goto(origin + "/aventura");
  await require("./browser-entry.cjs").enterWorld(chat);
  const s = await chat.evaluate(() => window.MagikitosAdventure.inspect()),
    e = s.entities.find((e) => e.id === "expression-book"),
    r = await chat.locator("#world-canvas").boundingBox();
  await chat.mouse.click(
    ((e.x - s.camera.x) / s.view.width) * r.width,
    ((e.y - 8 - s.camera.y) / s.view.height) * r.height,
  );
  // El libro abre la LISTA; el guardián lo cuida cada expresión, así que primero se entra en una.
  await chat.locator("#world-content").waitFor();
  await chat.locator(".world-native-list button").first().click();
  await chat.getByRole("button", { name: "Llamar al guardián" }).click();
  await chat.locator(".world-native-chat-form").waitFor();
  assert(
    (await chat.locator(".world-native-chat").innerText()).includes(
      "Mensaje anterior",
    ),
  );
  await chat
    .locator(".world-native-chat-form textarea")
    .fill("Ea, esto es una prueba");
  await chat.locator(".world-native-chat-form button").click();
  await chat
    .getByText("Respuesta de prueba, sin llamar al modelo", { exact: true })
    .waitFor();
  assert.equal(
    await chat.evaluate(() => localStorage.getItem("magikitos_session")),
    "guardian-fixture-session",
  );
  await chat
    .getByRole("button", { name: "Volver al momento", exact: true })
    .click();
  await chat.locator("[data-world-play]").click();
  await chat.waitForFunction(() =>
    document.getElementById("world-audio").getAttribute("src"),
  );
  // End event substitutes the recording's duration; voting remains owned by the API.
  await chat.evaluate(() =>
    document.getElementById("world-audio").dispatchEvent(new Event("ended")),
  );
  await chat.getByRole("button", { name: "4 setas", exact: true }).click();
  // ⛔ LO QUE SE QUEDA EN PANTALLA ES LA MEDIA, no el «gracias»: el agradecimiento es el respaldo
  // para cuando el servidor todavía no tiene media que dar, y en cuanto la da la escribe encima.
  // La prueba esperaba el destello.
  await chat.getByText("4,0 de media", { exact: true }).waitFor();
  assert.equal(writes.length, 2);
  assert(
    Object.values(
      JSON.parse(
        await chat.evaluate(() => localStorage.getItem("magikitos.setas")),
      ),
    ).includes(4),
  );
  assert.equal(await chat.locator("iframe").count(), 0);
  console.log(
    "PASS native guardian, CSRF/session adoption and voice rating; writes mocked",
  );
  await chat.close();
  // Host mount pages are static byte-for-byte, and regular website remains separate.
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  /**
   * ⛔ ESTA COMPARACIÓN SOLO VALE DONDE EL SITIO Y SU INSTALACIÓN SON EL MISMO ÁRBOL. Las
   * releases se instalan FUERA de git, así que un clon de trabajo no las tiene: aquí el sitio que
   * se está probando puede estar en otra máquina. Se dice y se sigue —los bytes servidos contra
   * los instalados se comprueban donde de verdad importa, en `check-release-live.cjs` contra el
   * anfitrión real—, porque un salto que se calla es peor que no comprobar nada.
   */
  const installed = fs.existsSync("../magikitos/public/game/current.json")
    ? JSON.parse(fs.readFileSync("../magikitos/public/game/current.json"))
    : null;
  const local =
    installed &&
    fs.existsSync("../magikitos/public/game/releases/" + installed.id);
  for (const [lang, route] of Object.entries(ROUTES)) {
    const res = await ctx.request.get(website + route);
    assert.equal(res.status(), 200);
    if (local)
      assert.equal(
        await res.text(),
        fs.readFileSync(
          "../magikitos/public/game/releases/" +
            installed.id +
            "/pages/" +
            lang +
            ".html",
          "utf8",
        ),
      );
    assert(
      !res.headers()["set-cookie"],
      "Static game shell creates no PHP session",
    );
  }
  if (!local)
    console.log(
      "SIN COMPROBAR: los bytes servidos contra los instalados — la release " +
        (installed?.id || "?") +
        " no está instalada en este árbol (se comprueba en check-release-live)",
    );
  for (const route of [
    "/",
    "/cuentos",
    "/chistes",
    "/castellanario",
    "/colorear",
    "/tienda",
    "/cuenta",
  ]) {
    const res = await ctx.request.get(website + route);
    assert.equal(res.status(), 200, route);
    const html = await res.text();
    assert(
      !html.includes('id="world-canvas"'),
      "Website is not the game: " + route,
    );
    assert(!/Fatal error|Deprecated:|Warning:/.test(html), route);
  }
  assert.equal(
    (
      await ctx.request.get(website + "/api/world/content?path=/cuentos")
    ).status(),
    404,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS static DDEV mount in six languages; website intact; old HTML endpoint gone",
  );
  await ctx.close();
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => browser?.close());
