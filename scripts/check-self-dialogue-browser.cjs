"use strict";
// Real UI and gestures, synthetic identity/email replies. No mail or account writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const { fulfillArena } = require("./lib/input-arena.cjs");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
async function until(fn) {
  const deadline = Date.now() + 12000;
  while (!fn()) {
    if (Date.now() > deadline) throw Error("Expected mocked request did not arrive");
    await new Promise(r => setTimeout(r, 10));
  }
}
if (new URL(origin).hostname !== "127.0.0.1") throw Error("Local only");
(async () => {
  fs.mkdirSync(".local/self-dialogue-review", { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  try {
    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 900 });
      page.on("pageerror", e => errors.push(e.message));
      let completeSend, completeVerify, sends = 0, verifies = 0, accepted = false;
      const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      await page.route("**/*", async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === "/bosque/explorar") return fulfillArena(route);
        if (url.pathname.endsWith("/bootstrap")) return json(route, { locale: "es", destinations: {}, capabilities: {} });
        if (url.pathname.endsWith("/request-code")) {
          sends++; await new Promise(resolve => completeSend = resolve);
          return json(route, { ok: true });
        }
        if (url.pathname.endsWith("/verify-code")) {
          verifies++; await new Promise(resolve => completeVerify = resolve);
          return accepted ? json(route, { ok: true, token: "test-session", user: { name: "Test", handle: "test", anonymous: false } }) :
            json(route, { ok: false, error: "code_invalid" }, 400);
        }
        if (url.pathname.endsWith("/identity")) return json(route, { ok: true, user: null });
        if (url.pathname.startsWith("/api/")) return json(route, { ok: false, error: "offline" }, 503);
        if (!["GET", "HEAD"].includes(req.method())) return route.abort();
        return route.continue();
      });
      await page.addInitScript(() => localStorage.setItem("magikitos.adventure", JSON.stringify({
        scene: "overworld", position: { x: 1000, y: 958 }, muted: true,
      })));
      await page.goto(origin + "/bosque/explorar"); await enterWorld(page);
      await page.locator("#self-toggle").click();
      await page.locator("#self-email").waitFor({ state: "visible" });
      await page.locator("#self-cast-grid button").first().waitFor();
      assert(await page.evaluate(() => {
        const a = document.getElementById("self-account"), b = document.getElementById("self-cast");
        return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) && a.getBoundingClientRect().bottom <= b.getBoundingClientRect().top;
      }), "Account precedes avatar selection in reading and visual order");
      await page.locator("#self-email").fill("synthetic@example.invalid");
      await page.locator('#self-email-form [type="submit"]').click();
      await page.waitForFunction(() => document.querySelector('#self-email-form [type="submit"]').disabled);
      assert.match(await page.locator('#self-email-form [type="submit"]').textContent(), /Enviando/);
      assert.equal(await page.locator("#self-identity-note").textContent(), "");
      await page.waitForFunction(() => document.querySelector('#self-email-form [aria-hidden="true"]'));
      await until(() => completeSend);
      completeSend();
      await page.waitForFunction(() => !document.getElementById("self-code-form").hidden && !document.querySelector('#self-code-form [type="submit"]').disabled);
      assert.equal(sends, 1);
      await page.locator("#self-code").fill("123456");
      await page.locator('#self-code-form [type="submit"]').click();
      await page.waitForFunction(() => document.querySelector('#self-code-form .fa-spinner') && document.querySelector('#self-code-form [type="submit"]').disabled);
      await until(() => completeVerify);
      completeVerify();
      await page.waitForFunction(() => document.getElementById("self-code").getAttribute("aria-invalid") === "true");
      assert(await page.evaluate(() => {
        const f = document.getElementById("self-code"), e = document.getElementById("self-code-error");
        return !!e.textContent && e.getBoundingClientRect().top >= f.getBoundingClientRect().bottom;
      }), "Code error is under the red field");
      await page.locator("#self-dialog").screenshot({ path: `.local/self-dialogue-review/self-${width}.png` });
      accepted = true; completeVerify = null;
      await page.locator("#self-code").fill("654321");
      assert.equal(await page.locator("#self-code").getAttribute("aria-invalid"), "false");
      await page.locator('#self-code-form [type="submit"]').click();
      await until(() => completeVerify);
      completeVerify();
      await page.waitForFunction(() => document.getElementById("self-account").hidden);
      assert.equal(await page.locator("#self-account-link").count(), 0);
      assert.equal(verifies, 2);
      const current = await page.evaluate(() => window.MagikitosAdventure.inspect().player.variant);
      await page.locator('#self-cast-grid button:not(.is-chosen)').first().click();
      await page.waitForFunction(() => !document.getElementById("self-dialog").open);
      assert.notEqual(await page.evaluate(() => window.MagikitosAdventure.inspect().player.variant), current);
      // Real sign click opens the dialogue, without a phantom portrait column.
      const talk = async () => {
        const pt = await page.evaluate(() => {
          const s = window.MagikitosAdventure.inspect(), e = s.entities.find(e => e.id === "test-sign"), r = document.getElementById("world-canvas").getBoundingClientRect();
          return { x: r.x + (e.x - s.camera.x) * r.width / s.view.width, y: r.y + (e.y - 13 - s.camera.y) * r.height / s.view.height };
        });
        await page.mouse.click(pt.x, pt.y);
        await page.waitForFunction(() => !!window.MagikitosAdventure.inspect().dialogue);
      };
      await talk();
      assert.equal(await page.locator("#dialogue-next").count(), 0);
      assert(await page.locator("#portrait").isHidden());
      assert(await page.locator("#dialogue").evaluate(e => e.classList.contains("without-portrait")));
      await page.locator("#dialogue").screenshot({ path: `.local/self-dialogue-review/sign-${width}.png` });
      const before = await page.evaluate(() => window.MagikitosAdventure.inspect().player);
      if (width < 900) await page.touchscreen.tap(30, Math.floor(height / 2));
      else await page.mouse.click(30, Math.floor(height / 2));
      await page.waitForFunction(() => !window.MagikitosAdventure.inspect().dialogue);
      await page.waitForTimeout(350);
      const after = await page.evaluate(() => window.MagikitosAdventure.inspect().player);
      assert.equal(after.x, before.x); assert.equal(after.y, before.y);
      await talk();
      for (let i = 0; i < 8 && await page.locator("#dialogue").isVisible(); i++) await page.locator("#dialogue-text").click();
      assert(await page.locator("#dialogue").isHidden());
      await page.close();
      console.log(`PASS self/email/avatars/dialogue dismiss ${width}×${height}`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
