"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [];
  fs.mkdirSync(".local/modality-review", { recursive: true });
  try {
    const route = (r) =>
      ["GET", "HEAD"].includes(r.request().method()) &&
      new URL(r.request().url()).origin === origin
        ? r.continue()
        : r.abort();
    const noScript = await browser.newPage({ javaScriptEnabled: false });
    await noScript.route("**/*", route);
    await noScript.goto(origin + "/aventura");
    assert(await noScript.locator("#world-joystick").isHidden());
    assert(
      await noScript.locator("#world-boost").isHidden(),
      "No desktop flash before JS starts",
    );
    await noScript.close();
    for (const spec of [
      { name: "desktop", width: 1440, height: 900, touch: false, fine: true },
      { name: "mobile", width: 390, height: 844, touch: true, fine: false },
      { name: "tablet", width: 768, height: 1024, touch: true, fine: false },
      { name: "hybrid", width: 1366, height: 900, touch: true, fine: true },
    ]) {
      const page = await browser.newPage({
        viewport: { width: spec.width, height: spec.height },
        hasTouch: spec.touch,
        ignoreHTTPSErrors: true,
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", route);
      await page.addInitScript((spec) => {
        localStorage.setItem(
          "magikitos.adventure",
          JSON.stringify({ muted: true }),
        );
        if (spec.touch && spec.fine) {
          const original = window.matchMedia.bind(window);
          window.matchMedia = (q) => {
            const m = original(q);
            if (q === "(any-pointer: fine)")
              Object.defineProperty(m, "matches", { value: true });
            return m;
          };
        }
      }, spec);
      await page.goto(origin + "/aventura");
      await page.waitForFunction(
        () => window.MagikitosAdventure?.inspect().ready,
      );
      await require("./browser-entry.cjs").enterWorld(page);
      if (spec.touch && !spec.fine) await page.touchscreen.tap(130, 140);
      const stick = page.locator("#world-joystick"),
        boost = page.locator("#world-boost"),
        recenter = page.locator("#world-recenter");
      assert.equal(
        await stick.isVisible(),
        spec.touch && !spec.fine,
        spec.name + " conservative initial mode",
      );
      assert(await boost.isHidden());
      await page.screenshot({
        path: ".local/modality-review/" + spec.name + "-initial.png",
      });
      // Actual mouse input hides touch controls; desktop recenter remains reachable.
      await page.mouse.move(120, 120);
      await page.mouse.down();
      await page.mouse.move(210, 170, { steps: 8 });
      await page.mouse.up();
      assert(await stick.isHidden());
      assert(await boost.isHidden());
      assert(await recenter.isVisible());
      const recenterRect = await recenter.boundingBox();
      assert(recenterRect.width === 46 && recenterRect.x > spec.width / 2);
      await recenter.click();
      assert(await recenter.isHidden());
      if (spec.touch) {
        const cdp = await page.context().newCDPSession(page);
        const send = (type, points) =>
          cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
        for (let i = 0; i < 3; i++) {
          await page.touchscreen.tap(130, 140);
          assert(await stick.isVisible(), "Touch restores controls repeatedly");
          await page.waitForTimeout(80);
          assert(
            await stick.isVisible(),
            "Compatibility mouse events cannot hide them",
          );
          await page.keyboard.press("ArrowDown");
          assert(await stick.isHidden(), "Keyboard switches immediately");
        }
        await page.touchscreen.tap(130, 140);
        const rect = await stick.boundingBox(),
          direction = {
            id: 1,
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height * 0.82,
          };
        await send("touchStart", [direction]);
        assert(await boost.isVisible());
        const b = await boost.boundingBox(),
          accelerator = { id: 2, x: b.x + b.width / 2, y: b.y + b.height / 2 };
        await send("touchStart", [direction, accelerator]);
        assert.equal(await boost.getAttribute("aria-pressed"), "true");
        // Mouse noise while thumbs are active must not tear down pointer capture.
        await page.mouse.move(250, 220);
        assert(await stick.isVisible());
        assert(await boost.isVisible());
        await page.screenshot({
          path: ".local/modality-review/" + spec.name + "-active.png",
        });
        await send("touchEnd", [direction]);
        assert(await boost.isHidden());
        assert.equal(
          await boost.getAttribute("aria-pressed"),
          "false",
          "Releasing direction disarms the held turbo",
        );
        await send("touchEnd", []);
        await send("touchStart", [direction]);
        assert(await boost.isVisible());
        await send("touchMove", [
          {
            ...direction,
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
          },
        ]);
        assert(await boost.isHidden());
        await send("touchCancel", []);
        assert(await boost.isHidden());
        // Focus loss clears transient input without forgetting the touch modality.
        await send("touchStart", [direction]);
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        assert(await boost.isHidden());
        await send("touchEnd", []);
        await page.evaluate(() => {
          const input = document.createElement("input");
          input.id = "test-composition";
          input.style = "position:fixed;top:100px;left:20px;z-index:200";
          document.body.append(input);
          input.focus();
        });
        await page.keyboard.type("hola");
        assert(
          await stick.isVisible(),
          "Typing into a touch form does not hide the joystick",
        );
        await page.evaluate(() =>
          document.getElementById("test-composition").remove(),
        );
        await page.mouse.move(180, 200);
        assert(await stick.isHidden());
        await cdp.detach();
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.close();
      console.log(
        "PASS input mode " +
          spec.name +
          ": initial visibility, mouse/keyboard recenter, repeated touch fallback, directional-only turbo and safe release.",
      );
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
