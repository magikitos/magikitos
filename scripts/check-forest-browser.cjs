"use strict";
/** Actual game bundle + actual loopback authority in three isolated browsers. API identity/save
 * fixtures are synthetic; separate PHP integration tests prove the authenticated API boundary. */
const assert = require("node:assert/strict"), fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright"), { build } = require("esbuild");
const { enterWorld } = require("./browser-entry.cjs");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { nearbyPosition } = require("./browser-world.cjs");
const { liveContract } = require("../tools/live-contract.cjs");
const { createLiveServer } = require("../../magikitos/bosque-vivo/server.cjs");
const { mac } = require("../../magikitos/bosque-vivo/tickets.cjs");
const { protocol } = require("../public/assets/js/adventure/forest-connection");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw Error("Loopback only");
const world = JSON.parse(execFileSync("php", ["-r", 'echo json_encode(require "data/aventura/world.php");']));
const secret = "synthetic-browser-live-key-never-production";
const issues = [];
const notes = new Map(), debits = new Map(), operations = new Map();
(async () => {
  const service = createLiveServer({ secret, scenes: liveContract(world).scenes, origins: [origin], limits: { ...protocol.limits, players: 2 } });
  const { port } = await service.listen(0);
  const bundled = await build({ entryPoints: ["public/assets/js/aventura.js"], bundle: true, write: false });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  fs.mkdirSync(".local/forest-review", { recursive: true });
  try {
    async function open(user, viewport, offset) {
      const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1000 });
      await context.grantPermissions(["local-network-access"], { origin });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const endpoints = [], sockets = [];
      const consoleErrors = [];
      page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("websocket", socket => {
        const entry = { url: socket.url(), frames: [] }; sockets.push(entry);
        socket.on("framereceived", ({ payload }) => { const p = JSON.parse(String(payload)); entry.frames.push({ type: p.type, reason: p.reason, role: p.role }); });
        socket.on("socketerror", error => { entry.error = error; });
      });
      page.on("pageerror", e => issues.push(e.message));
      const position = nearbyPosition(world.scenes.overworld, {}, "tavern-door");
      position.x += offset;
      let saved = cleanSave({ scene: "overworld", position, muted: true }, world), revision = 1;
      let bank = { revision: 1, inventory: { pen: 1, parchment: 1, twig: 3, leaf: 2 }, setines: 0,
        progress: { flags: {} }, resources: {} };
      const started = Date.now();
      let needs = { pee: { last: started - 9 * 3600000, due: started - 3600000 },
        poop: { last: started - 12 * 3600000, due: started - 3600000 } };
      let loseReliefReply = user === 1;
      const profile = () => ({ id: String(user).padStart(32, "0"), revision, state: saved });
      await page.addInitScript(({ saved, user, origin }) => {
        if (location.origin !== origin) return;
        localStorage.setItem("magikitos_session", "synthetic-forest-browser-" + user);
        localStorage.setItem("magikitos.adventure", JSON.stringify(saved));
      }, { saved, user, origin });
      await page.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname.endsWith("/js/aventura.min.js"))
          return route.fulfill({ contentType: "text/javascript", body: bundled.outputFiles[0].text });
        if (url.pathname === "/aventura") {
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
          endpoints.push(endpoint);
          let body;
          if (endpoint === "identity") body = { user: { id: user, handle: "synthetic-" + user, name: "Test" } };
          else if (endpoint === "game-state") body = { profile: profile(), recoveries: [] };
          else if (endpoint === "game-save") {
            saved = route.request().postDataJSON().state; revision++;
            body = { profile: profile(), acknowledgedRevision: revision };
          } else if (endpoint === "game-account") body = { account: bank };
          else if (endpoint === "game-body") body = { now: Date.now(), needs };
          else if (endpoint === "forest-messages") body = { zone: url.searchParams.get("zone"), now: Date.now(),
            messages: [...notes.values()].filter(n => n.zone === url.searchParams.get("zone")) };
          else if (endpoint === "forest-relief" || endpoint === "forest-message") {
            const request = route.request().postDataJSON(), key = user + ":" + request.operationId;
            if (operations.has(key)) {
              assert.equal(operations.get(key).request, JSON.stringify(request), "Lost acknowledgements retry identical intent");
              body = { ...operations.get(key).body, account: bank, replayed: true };
            } else {
              assert.equal(service.presence.seats.role(user), "player");
              assert.equal(request.baseRevision, bank.revision);
              const now = Date.now(), actor = service.presence.peers.get(user);
              bank = structuredClone(bank); bank.revision++;
              if (endpoint === "forest-relief") {
                assert.equal(request.kind, "poop"); bank.inventory.leaf--;
                needs = { pee: { last: now, due: now + 8 * 3600000 }, poop: { last: now, due: now + 12 * 3600000 } };
                const trace = { id: String(user).padStart(32, "0"), zone: "overworld", x: Math.round(actor.x), y: Math.round(actor.y),
                  text: null, createdAt: now, expiresAt: now + 86400000, author: { name: "Test " + user, handle: "synthetic-" + user } };
                notes.set(trace.id, trace); debits.set(user, (debits.get(user) || 0) + 1);
                body = { account: bank, now, needs, trace, replayed: false };
              } else {
                bank.inventory.twig--;
                notes.get(request.traceId).text = request.text;
                body = { account: bank, now, replayed: false };
              }
              operations.set(key, { request: JSON.stringify(request), body: structuredClone(body) });
              if (endpoint === "forest-relief" && loseReliefReply) {
                loseReliefReply = false; return route.abort("failed");
              }
            }
          }
          else if (endpoint === "forest-ticket") {
            const now = Date.now(), claims = { aud: protocol.ticketAudience, user,
              publicId: mac(secret, "public", String(user)).slice(0, 24), session: mac(secret, "session", String(user)),
              issuedAt: now, expiresAt: now + 300000, variant: 0, scene: saved.scene,
              ...saved.position, mode: "foot", capabilities: { boat: false }, entrance: saved.entrance };
            const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
            body = { protocol: 1, socketPath: "/bosque", now, expiresAt: claims.expiresAt,
              ticket: payload + "." + mac(secret, "forest-ticket", payload) };
          }
          return route.fulfill({ status: body ? 200 : 503, contentType: "application/json", body: JSON.stringify(body || { ok: false, error: "offline" }) });
        }
        return route.continue();
      });
      await require("./browser-art.cjs").useReviewVariant(page);
      await page.goto(origin + "/aventura"); await enterWorld(page);
      try { await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.connected); }
      catch (error) {
        console.error({ endpoints, sockets, issues, consoleErrors, game: await page.evaluate(() => {
          const g = window.MagikitosAdventure.inspect();
          return { live: g.live, sync: g.sync, scene: g.scene, entered: g.entered };
        }) });
        throw error;
      }
      return page;
    }
    const desktop = await open(1, { width: 1440, height: 900 }, 0);
    async function writeNote(page, user, name) {
      await page.locator("#self-toggle").click();
      await page.locator("#self-poop").click();
      if (user === 1) {
        await page.waitForFunction(() => window.MagikitosAdventure.inspect().notes.pending === "forest-relief" &&
          !window.MagikitosAdventure.inspect().transitioning);
        await page.reload(); await enterWorld(page);
        await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.connected);
        await page.locator("#self-toggle").click();
        await page.locator("#self-forest-retry").click();
      }
      await page.locator('#dialogue-actions [data-action="write"]').click();
      assert.equal(await page.locator("#forest-note-dialog").isVisible(), true);
      const token = Object.keys(world.dialogueTokens || {})[0] || "reward";
      const text = `  <img src=x onerror="window.untrustedNoteExecuted=true"> :${token}\n🌱 مرحبا — hola\n` + "🌱".repeat(70);
      await page.locator("#forest-note-text").fill("🌱".repeat(501));
      // Native maxlength is UTF-16, while the displayed/validated limit is Unicode characters.
      await page.locator("#forest-note-text").evaluate((element) => {
        element.value = "🌱".repeat(501); element.dispatchEvent(new Event("input", { bubbles: true }));
      });
      assert.equal(await page.locator("#forest-note-publish").isDisabled(), true);
      await page.locator("#forest-note-text").fill(text);
      assert.equal(await page.locator("#forest-note-publish").isDisabled(), false);
      assert(await page.locator("#forest-note-dialog").evaluate(dialog => {
        const buttons = [...dialog.querySelectorAll(".world-note-actions button")].map(e => e.getBoundingClientRect());
        return dialog.scrollWidth <= dialog.clientWidth && buttons.every(b => b.height >= 44) &&
          (buttons[0].right <= buttons[1].left || buttons[0].bottom <= buttons[1].top);
      }), "Composer buttons fit without overlapping on every viewport");
      await page.screenshot({ path: `.local/forest-review/${name}-composer.png` });
      if (page.viewportSize().width < 500) {
        const size = page.viewportSize();
        await page.setViewportSize({ width: size.width, height: 430 });
        const dialog = await page.locator("#forest-note-dialog").boundingBox();
        assert(dialog.y >= 0 && dialog.y + dialog.height <= 430, "Composer fits a reduced-height mobile viewport");
        await page.screenshot({ path: `.local/forest-review/${name}-composer-short.png` });
        await page.setViewportSize(size);
      }
      await page.locator("#forest-note-publish").click();
      await page.waitForFunction(() => !document.getElementById("forest-note-dialog").open);
      assert.equal(debits.get(user), 1);
      assert.equal(notes.get(String(user).padStart(32, "0")).text, text);
      assert.equal(await page.evaluate(() => window.MagikitosAdventure.inspect().inventory.leaf), 1);
      assert.equal(await page.evaluate(() => window.MagikitosAdventure.inspect().inventory.twig), 2);
      const trace = notes.get(String(user).padStart(32, "0"));
      const point = await page.evaluate(trace => {
        const g = window.MagikitosAdventure.inspect(), box = document.getElementById("world-canvas").getBoundingClientRect();
        return { x: box.left + (trace.x - g.camera.x) / g.view.width * box.width,
          y: box.top + (trace.y - 14 - g.camera.y) / g.view.height * box.height };
      }, trace);
      if (page.viewportSize().width < 1000) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      await page.waitForFunction(text => document.getElementById("dialogue-text").textContent === text, text);
      assert.equal(await page.locator("#dialogue-text img").count(), 0);
      assert.equal(await page.evaluate(() => window.untrustedNoteExecuted), undefined);
      const bounds = await page.locator("#dialogue").boundingBox();
      assert(bounds.y >= 0 && bounds.y + bounds.height <= page.viewportSize().height, "Long user note fits viewport");
      await page.screenshot({ path: `.local/forest-review/${name}-note.png` });
      await page.keyboard.press("Escape");
      await page.locator("#self-toggle").click();
      assert.equal(await page.locator("#self-poop").isVisible(), false);
      assert.equal(await page.locator("#self-pee").isVisible(), false);
      await page.keyboard.press("Escape");
    }
    await writeNote(desktop, 1, "desktop");
    const tablet = await open(2, { width: 768, height: 1024 }, 45);
    const phone = await open(3, { width: 390, height: 844 }, -45);
    for (const page of [desktop, tablet, phone])
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.visible >= 1);
    assert.equal(await phone.evaluate(() => window.MagikitosAdventure.inspect().live.role), "spectator");
    await phone.locator("#self-toggle").click();
    assert.equal(await phone.locator("#self-poop").isVisible(), false, "Spectators cannot leave a trace");
    await phone.keyboard.press("Escape");
    await writeNote(tablet, 2, "tablet");
    for (const [name, page] of [["desktop", desktop], ["tablet", tablet], ["mobile", phone]])
      await page.screenshot({ path: `.local/forest-review/${name}.png` });
    await desktop.keyboard.down("ArrowUp");
    try { await desktop.waitForFunction(() => window.MagikitosAdventure.inspect().scene === "tavern"); }
    finally { await desktop.keyboard.up("ArrowUp"); }
    assert.equal(service.presence.peers.get(1).scene, "tavern", "Client and authority entered the same actual doorway");
    await desktop.waitForFunction(() => !window.MagikitosAdventure.inspect().transitioning);
    await desktop.keyboard.down("ArrowDown");
    try { await desktop.waitForFunction(() => window.MagikitosAdventure.inspect().scene === "overworld"); }
    finally { await desktop.keyboard.up("ArrowDown"); }
    assert.equal(service.presence.peers.get(1).scene, "overworld", "Interior exit is authoritative too");
    await desktop.goto("about:blank");
    await phone.waitForFunction(() => window.MagikitosAdventure.inspect().live.role === "player");
    await writeNote(phone, 3, "mobile");
    assert.equal(service.presence.seats.players.size, 2);
    assert.deepEqual(issues, []);
    console.log("PASS desktop/tablet/mobile actual game: live neighbors, spectator, doors, queue promotion, notes compose/read/plain Unicode, leaf/twig charged once after lost reply + reload, body actions removed; local screenshots captured. API DTO fixtures; PHP authority tested separately.");
  } finally { await browser.close(); await service.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
