"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const { nearbyPosition } = require("./browser-world.cjs");
const scene = JSON.parse(fs.readFileSync(".local/build/world.json")).scenes
  .overworld;
const elderApproach = nearbyPosition(scene, {}, "picnic-neighbor");
const start = { x: 264, y: 200 };
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  fs.mkdirSync(".local/mobility-review", { recursive: true });
  try {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
      });
      await page.addInitScript(() => {
        const seed = sessionStorage.getItem("mobility-seed");
        if (seed) {
          localStorage.setItem("magikitos.adventure", seed);
          sessionStorage.removeItem("mobility-seed");
        }
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (r) =>
        ["127.0.0.1", "magikitos.ddev.site"].includes(
          new URL(r.request().url()).hostname,
        )
          ? r.continue()
          : r.abort(),
      );
      await page.goto(origin + "/aventura");
      const inspect = () =>
        page.evaluate(() => window.MagikitosAdventure.inspect());
      async function seed(position = start, flags = {}) {
        // Seed after pagehide has saved the old page, never race the real save lifecycle.
        await page.evaluate(
          ({ position, flags }) =>
            sessionStorage.setItem(
              "mobility-seed",
              JSON.stringify({
                scene: "overworld",
                position,
                flags,
                muted: true,
              }),
            ),
          { position, flags },
        );
        await page.reload();
        await require("./browser-entry.cjs").enterWorld(page);
        await page.evaluate(() => {
          window.mobilityTrace = [];
          function sample() {
            const s = window.MagikitosAdventure.inspect();
            window.mobilityTrace.push({
              pace: s.pace,
              x: s.player.x,
              y: s.player.y,
              roll: s.roll?.elapsed,
              travel: s.travel,
            });
            requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        });
      }
      async function drag(dx, dy, touch = false) {
        const x = width * 0.55,
          y = height * 0.5;
        if (touch) {
          const c = await page.context().newCDPSession(page);
          await c.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y, id: 0 }],
          });
          for (let i = 1; i <= 8; i++)
            await c.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [
                { x: x + (dx * i) / 8, y: y + (dy * i) / 8, id: 0 },
              ],
            });
          await c.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          await c.detach();
        } else {
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + dx, y + dy, { steps: 8 });
          await page.mouse.up();
        }
      }
      async function tapWorld(point) {
        let s = await inspect();
        if (point.y > s.camera.y + s.view.height - 20)
          await drag(
            0,
            -Math.min(
              height * 0.4,
              (point.y - s.camera.y - s.view.height * 0.75) * s.scale,
            ),
            width < 800,
          );
        s = await inspect();
        const r = await page.locator("#world-canvas").boundingBox();
        await page.touchscreen.tap(
          r.x + ((point.x - s.camera.x) * r.width) / s.view.width,
          r.y + ((point.y - s.camera.y) * r.height) / s.view.height,
        );
      }
      for (const touch of [false, true]) {
        await seed();
        const before = await inspect();
        await drag(-80, -100, touch);
        await page.waitForTimeout(200);
        let s = await inspect();
        assert.equal(s.player.x, before.player.x);
        assert.equal(s.player.y, before.player.y);
        assert.equal(s.pathLength, 0);
        assert.equal(s.cameraFollowing, false);
        assert(!s.dialogue);
        assert(s.camera.y > before.camera.y + 20);
        await page.locator("#world-recenter").click();
        await page.waitForFunction(
          () => window.MagikitosAdventure.inspect().cameraFollowing,
        );
        assert(await page.locator("#world-recenter").isHidden());
        await page.waitForTimeout(650);
        s = await inspect();
        assert(
          Math.abs(s.camera.x - before.camera.x) < 2 &&
            Math.abs(s.camera.y - before.camera.y) < 2,
        );
      }
      await seed();
      {
        const c = await page.context().newCDPSession(page),
          y = height * 0.4;
        await c.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { x: 80, y, id: 0 },
            { x: width - 80, y, id: 1 },
          ],
        });
        await c.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            { x: 110, y, id: 0 },
            { x: width - 110, y, id: 1 },
          ],
        });
        await c.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [{ x: width - 110, y, id: 1 }],
        });
        await c.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await c.detach();
        await page.waitForTimeout(100);
        const s = await inspect();
        assert.equal(s.pathLength, 0);
        assert(!s.roll);
        assert.equal(s.player.y, start.y);
      }
      for (const [distance, expected] of [
        [32, ["walk"]],
        [128, ["run", "walk"]],
        [320, ["run", "walk"]],
      ]) {
        await seed();
        await tapWorld({ x: start.x, y: start.y + distance });
        await page.waitForFunction(
          (y) => {
            const s = window.MagikitosAdventure.inspect();
            return Math.abs(s.player.y - y) < 1 && s.pathLength === 0;
          },
          start.y + distance,
          { timeout: 10000 },
        );
        await page.waitForTimeout(80);
        const trace = await page.evaluate(() => window.mobilityTrace),
          modes = [
            ...new Set(trace.map((x) => x.pace).filter((x) => x !== "idle")),
          ];
        fs.writeFileSync(
          `.local/mobility-review/travel-${width}-${distance}.json`,
          JSON.stringify(trace, null, 2),
        );
        assert.deepEqual(
          modes,
          expected,
          `Tap ${distance}: ${width}px viewport`,
        );
        const s = await inspect();
        assert.equal(s.pathLength, 0, JSON.stringify({ distance, s }));
        assert(!s.roll);
        assert(Math.abs(s.player.x - start.x) < 1);
      }
      await seed();
      await page.locator("#world-canvas").focus();
      await page.keyboard.down("Space");
      await page.waitForTimeout(80);
      assert.equal(
        (await inspect()).pace,
        "idle",
        "Space alone doesn't launch a roll",
      );
      await page.keyboard.down("ArrowDown");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().pace === "run",
      );
      await page.screenshot({
        path: `.local/mobility-review/run-${width}.png`,
      });
      await page.keyboard.up("Space");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().pace === "walk",
      );
      await page.keyboard.up("ArrowDown");
      await page.keyboard.down("Space");
      await page.keyboard.down("ArrowDown");
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.waitForTimeout(80);
      assert.equal(
        (await inspect()).pace,
        "idle",
        "Losing focus clears held run input",
      );
      await page.keyboard.up("Space");
      await page.keyboard.up("ArrowDown");

      await seed();
      await page.locator("#world-canvas").focus();
      await page.keyboard.down("ArrowDown");
      await page.keyboard.press("Space");
      await page.waitForTimeout(65);
      await page.keyboard.down("Space");
      await page.waitForTimeout(350);
      assert.equal(
        (await inspect()).pace,
        "run",
        "Double Space remains held running, never rolling",
      );
      await page.keyboard.up("Space");
      await page.keyboard.up("ArrowDown");
      const trace = await page.evaluate(() => window.mobilityTrace);
      assert.equal(trace.filter((s) => s.pace === "roll").length, 0);
      await page.waitForTimeout(50);
      assert.equal((await inspect()).pace, "idle");

      await seed(start, {});
      assert.equal(
        (await inspect()).dialogue,
        null,
        "New game starts freely, without an introductory dialogue",
      );
      await drag(-80, -100, width < 800);
      assert.equal((await inspect()).cameraFollowing, false);
      await page.locator("#world-canvas").focus();
      await page.keyboard.down("ArrowDown");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().cameraFollowing,
      );
      await page.keyboard.up("ArrowDown");
      // The current camera deliberately eases back after a manual pan. Following
      // becomes true at movement start; centring finishes over subsequent frames.
      await page.waitForFunction(
        () => {
          const s = window.MagikitosAdventure.inspect();
          const y = Math.max(
            0,
            Math.min(
              s.bounds.height - s.view.height,
              s.player.y - s.view.height / 2,
            ),
          );
          return Math.abs(s.camera.y - y) < 1;
        },
        null,
        { timeout: 5000 },
      );
      const followed = await inspect();
      const expectedY = Math.max(
        0,
        Math.min(
          followed.bounds.height - followed.view.height,
          followed.player.y - followed.view.height / 2,
        ),
      );
      assert(
        Math.abs(followed.camera.y - expectedY) < 1,
        "Walking restores exact follow after manual pan",
      );
      await seed(elderApproach);
      const elder = (await inspect()).entities.find(
        (e) => e.id === "picnic-neighbor",
      );
      await tapWorld({ x: elder.x, y: elder.y - 10 });
      await page.waitForFunction(
        () => !!window.MagikitosAdventure.inspect().dialogue,
      );
      const p = (await inspect()).player;
      await page.keyboard.press("Space");
      await page.waitForTimeout(60);
      assert.equal((await inspect()).dialogue, null);
      assert(!(await inspect()).roll);
      assert.equal(
        (await inspect()).player.y,
        p.y,
        "Dialogue Space never leaks into movement",
      );
      await seed(elderApproach);
      await page.screenshot({
        path: `.local/mobility-review/elder-${width}.png`,
      });
      assert(
        (await inspect()).neighbors.every(
          (n) => ![3, 5, 9].includes(n.variant),
        ),
      );
      assert(
        !(await inspect()).assets.loaded.includes("actor-12"),
        "Future elder walking sheet stays lazy",
      );
      await seed({ x: 24.5 * 16, y: 53 * 16 });
      await page.screenshot({
        path: `.local/mobility-review/picnic-${width}.png`,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.close();
      console.log(
        `PASS mobility ${width}×${height}: mouse/touch pan/recenter, walk/run routes, held/double Space never rolls, dialogue isolation, natural cast, lazy elder.`,
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
