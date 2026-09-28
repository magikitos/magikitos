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
      page.on("pageerror", (e) => errors.push(e.message));
      // Works against the production artifact too: no identity, telemetry or save is ever sent.
      await page.route("**/*", (route) => {
        const r = route.request(), u = new URL(r.url());
        if (u.pathname.startsWith("/api/") || !["GET", "HEAD"].includes(r.method()))
          return route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false,"error":"offline"}' });
        return route.continue();
      });
      await page.addInitScript(({ scene, x, y }) => {
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
        await page.waitForSelector(".world-challenge .world-primary");
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
        assert(panel.y >= 8 && panel.y + panel.height <= height - 8, "Conversation and exit fit in the viewport");
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
      await click(page.locator("#content-exit"));
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
      if (width === 1440) {
        const earned = (await inspect()).flags, pending = (await inspect()).materialSync.pending;
        await click(page.locator(".world-challenge .world-experience-links button"));
        const replay = await cardNames(), mismatch = replay.findIndex((n) => n !== replay[0]);
        await turn(0); await turn(mismatch);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1450);
        assert(await page.locator("#world-content").isHidden(), "A reveal callback cannot reopen a closed puzzle");
        await talk();
        assert.equal((await inspect()).inventory.millKey, 1);
        assert.deepEqual((await inspect()).flags, earned, "Practice never changes quest progress");
        assert.equal((await inspect()).materialSync.pending, pending, "Practice never queues extra rewards");
        assert(await page.locator(".world-challenge-reward").isVisible());
      }
      await click(page.locator(".world-challenge .world-primary"));
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
      console.log(`PASS Avelino ${width}×${height}: real door, first introduction, memory/retry/rapid taps, resume after reload, key, exit, chest and persistence.`);
      await context.close();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
