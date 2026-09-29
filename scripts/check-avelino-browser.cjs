"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const exterior = require("../tools/world.cjs").compileWorld().scenes["river-willows"];
const mill = exterior.entities.find(e => e.id === "mill-door");
const shots = path.resolve(".local/avelino-work/review");
fs.mkdirSync(shots, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }), errors = [];
  try {
    for (const [width, height] of (process.env.GAME_REVIEW_QUICK ? [[1440, 900]] : [[1440, 900], [390, 844], [320, 568], [844, 390]])) {
      const touch = width < 900, context = await browser.newContext({ viewport: { width, height }, hasTouch: touch,
        isMobile: touch, deviceScaleFactor: 1, reducedMotion: width === 320 ? "reduce" : "no-preference" });
      const page = await context.newPage();
      const feedback = [];
      page.on("pageerror", (e) => errors.push(e.message));
      // Works against the production artifact too: no identity, telemetry or save is ever sent.
      await page.route("**/*", (route) => {
        const r = route.request(), u = new URL(r.url());
        if (u.pathname === "/api/world/bootstrap") return route.fulfill({ json: {
          ok: true, locale: "es", destinations: {}, capabilities: { turnstileSiteKey: "test-site-key" },
        } });
        if (u.pathname === "/api/world/feedback") {
          feedback.push(r.postDataJSON());
          return route.fulfill({ status: feedback.length === 1 ? 503 : 200, json: feedback.length === 1 ?
            { ok: false, error: "delivery_unavailable" } : { ok: true, sent: true } });
        }
        if (u.pathname.startsWith("/api/") || !["GET", "HEAD"].includes(r.method()))
          return route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false,"error":"offline"}' });
        return route.continue();
      });
      await page.addInitScript(({ scene, x, y }) => {
        let callback, issued = 0;
        window.__proofActions = [];
        window.turnstile = {
          render(host, options) { window.__proofActions.push(options.action); callback = options.callback; return "test-widget"; },
          execute() { setTimeout(() => callback("test-proof-" + ++issued), 80); }, remove() {},
        };
        if (!localStorage.getItem("magikitos.adventure")) localStorage.setItem("magikitos.adventure", JSON.stringify({
          scene, position: { x, y }, muted: true, flags: { welcomed: true }, inventory: {},
        }));
      }, { scene: exterior.id, x: mill.arrival[0] * 16, y: mill.arrival[1] * 16 });
      const inspect = () => page.evaluate(() => window.MagikitosAdventure.inspect());
      const tap = async (id, dy = -12) => {
        await page.waitForTimeout(350);
        const point = await page.evaluate(([id, dy]) => {
          const s = window.MagikitosAdventure.inspect(), e = s.entities.find((e) => e.id === id),
            r = document.getElementById("world-canvas").getBoundingClientRect();
          if (!e) throw Error("Missing entity: " + id);
          return { x: r.left + (e.x - s.camera.x) * r.width / s.view.width,
            y: r.top + (e.y + dy - s.camera.y) * r.height / s.view.height };
        }, [id, dy]);
        assert(point.x > 0 && point.x < width && point.y > 0 && point.y < height, `Visible ${id}: ${JSON.stringify(point)}`);
        if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
      };
      const click = async (locator) => { if (touch) await locator.tap(); else await locator.click(); };
      const talk = async (first = false) => {
        await tap("avelino", -24);
        await page.waitForSelector(".world-challenge h1");
        assert.equal((await inspect()).dialogue, null, "One conversation opens the challenge directly");
        if (first) {
          const text = await page.locator(".world-challenge-conversation").innerText();
          assert(text.includes("Avelino, el mago del molino") && text.includes("678") && text.includes("más sabio"));
          assert(text.includes("¿Jugamos?"), "The whole first invitation is present without greeting again");
          if (height > 500) {
            const start = await page.locator(".world-challenge .world-primary").boundingBox();
            const body = await page.locator("#world-content-body").boundingBox();
            assert(start.y + start.height <= body.y + body.height + 1, "The first start button is visible without scrolling");
          }
          assert(await page.locator("#world-toast").isHidden(), "Arrival toast never covers the challenge");
          await page.screenshot({ path: path.join(shots, `meeting-${width}.png`) });
        }
        const panel = await page.locator("#world-content").boundingBox();
        assert(Math.abs(panel.y + panel.height / 2 - height / 2) < 2, "The challenge is centered in the viewport");
        if (touch) {
          assert(Math.abs(panel.x) < 1 && Math.abs(panel.y) < 1 && Math.abs(panel.width - width) < 1 && Math.abs(panel.height - height) < 1,
            "Mobile challenge fills the viewport: " + JSON.stringify(panel));
          assert.equal(await page.locator("#world-content").evaluate(e => getComputedStyle(e).zIndex), "2147483000");
        } else assert(panel.y >= 8 && panel.y + panel.height <= height - 8, "Desktop sheet fits");
        assert(await page.locator("#content-exit").isHidden(), "No redundant return-to-world button");
        const close = await page.locator(".world-challenge-close").boundingBox();
        assert(close.width >= 44 && close.height >= 44 && close.y >= 0 && close.y < panel.y + 65, "Visible top close target");
      };
      const cardNames = () => page.locator(".world-memory-face").evaluateAll((cards) => cards.map((c) => c.textContent));
      const turn = (i) => click(page.locator('[data-card="' + i + '"]'));
      await page.goto(origin + "/bosque/explorar"); await enterWorld(page);
      await page.screenshot({ path: path.join(shots, `mill-${width}.png`) });
      await tap("mill-door", -16);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().scene === "mill", null, { timeout: 20000 });
      await page.screenshot({ path: path.join(shots, `interior-${width}.png`) });
      await talk(true);
      await click(page.locator(".world-challenge .world-primary"));
      await page.waitForSelector(".world-memory-card");
      assert.equal(await page.locator(".world-memory-card").count(), 8);
      const rects = await page.locator(".world-memory-card").evaluateAll((cards) => cards.map((c) => {
        const r = c.getBoundingClientRect(); return { width: r.width, height: r.height, x: r.x, right: r.right };
      }));
      assert(rects.every((r) => r.width >= 44 && r.height >= 44 && r.x >= 0 && r.right <= width), "Cards fit and have touch targets");
      await page.screenshot({ path: path.join(shots, `puzzle-${width}.png`) });
      let names = await cardNames();
      const other = names.findIndex((name) => name !== names[0]), pair = names.findIndex((name, i) => i > 0 && name === names[0]);
      await turn(0); await turn(other);
      const third = names.findIndex((_, i) => i !== 0 && i !== other);
      const thirdBox = await page.locator('[data-card="' + third + '"]').boundingBox();
      if (touch) await page.touchscreen.tap(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2);
      else await page.mouse.click(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2);
      assert.equal(await page.locator(".world-memory-card.is-open").count(), 2, "Rapid third tap cannot expose a third card");
      await page.waitForFunction(() => !document.querySelector(".world-memory-card.is-open"));
      await turn(0); await turn(pair);
      assert.equal(await page.locator(".world-memory-card.is-found").count(), 2);
      await click(page.locator(".world-challenge-close"));
      await page.reload(); await enterWorld(page);
      assert.equal(Object.keys((await inspect()).flags).filter((f) => f.startsWith("avelinoPair")).length, 1);
      await talk(); await click(page.locator(".world-challenge .world-primary"));
      await page.waitForSelector(".world-memory-card.is-found");
      assert.equal(await page.locator(".world-memory-card.is-found").count(), 2, "Matched pair remains after reload");
      names = await cardNames();
      for (const name of new Set(names)) {
        const indices = names.flatMap((n, i) => n === name ? [i] : []);
        if ((await page.locator('[data-card="' + indices[0] + '"]').getAttribute("class")).includes("is-found")) continue;
        if (!touch) {
          for (const index of indices) { await page.locator('[data-card="' + index + '"]').focus(); await page.keyboard.press("Enter"); }
        } else for (const index of indices) await turn(index);
      }
      await page.waitForSelector(".world-challenge-reward");
      assert(!(await inspect()).inventory.millKey, "The reward is offered before collection");
      await click(page.locator(".world-challenge .world-primary"));
      assert.equal((await inspect()).inventory.millKey, 1);
      await page.screenshot({ path: path.join(shots, `reward-${width}.png`) });
      assert.equal(await page.locator(".world-experience-links").count(), 0, "Completed challenges offer no replay");
      assert((await page.locator(".world-challenge h1").innerText()).includes("No hay más misterios"));
      assert.equal(feedback.length, 0, "Opening the form never sends feedback");
      const draft = "Me gusta el molino. Me gustaría otro misterio.";
      await page.locator("#world-feedback-text").fill(draft);
      const earned = (await inspect()).flags, pending = (await inspect()).materialSync.pending;
      if (!touch) {
        await page.keyboard.press("Escape");
        assert(await page.locator("#world-content").isHidden(), "Escape closes while the textarea has focus");
        await talk();
        assert.equal(await page.locator("#world-feedback-text").inputValue(), draft, "Draft survives closing");
        await page.mouse.click(5, height / 2);
        assert(await page.locator("#world-content").isHidden(), "Outside click closes the sheet");
        await talk();
      }
      await click(page.locator(".world-feedback button"));
      await page.waitForFunction(() => document.querySelector(".world-feedback-status")?.textContent.includes("No hemos podido"));
      assert.equal(await page.locator("#world-feedback-text").inputValue(), draft, "Failure keeps the draft");
      await click(page.locator(".world-feedback button"));
      await page.waitForFunction(() => document.querySelector(".world-feedback")?.textContent.includes("¡Gracias!"));
      assert.equal(feedback.length, 2);
      assert.equal(feedback[0].operationId, feedback[1].operationId, "Uncertain response reuses submission id");
      assert.notEqual(feedback[0].turnstile_token, feedback[1].turnstile_token, "Each attempt has fresh proof");
      assert.equal(feedback[1].text, draft);
      assert.deepEqual(await page.evaluate(() => window.__proofActions), ["game_feedback", "game_feedback"]);
      assert.deepEqual((await inspect()).flags, earned, "Feedback never alters quest progress");
      assert.equal((await inspect()).materialSync.pending, pending);
      assert.equal((await inspect()).inventory.millKey, 1);
      await page.screenshot({ path: path.join(shots, `feedback-${width}.png`) });
      await click(page.locator(".world-challenge-close"));
      await tap("exit", 0);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().scene === "river-willows", null, { timeout: 20000 });
      await tap("mill-chest", -12);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().flags.avelinoChestOpened, null, { timeout: 20000 });
      assert.equal((await inspect()).inventory.millKey, 1, "Opening the chest keeps the key");
      await page.screenshot({ path: path.join(shots, `chest-${width}.png`) });
      await page.keyboard.press("Escape");
      await page.reload(); await enterWorld(page);
      assert((await inspect()).flags.avelinoChestOpened);
      assert.equal((await inspect()).inventory.millKey, 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      console.log(`PASS Avelino ${width}×${height}: real door, first introduction, memory/retry/rapid taps, resume after reload, key once, fullscreen/close/Escape/outside, proof + feedback retry, chest and persistence.`);
      await context.close();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
