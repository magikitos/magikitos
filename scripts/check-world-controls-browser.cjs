"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (
  !["127.0.0.1", "localhost", "magikitos.ddev.site"].includes(
    new URL(origin).hostname,
  )
)
  throw Error("Local test only");
// Ephemeral clear arena isolates input from scenery. No test scene or writable
// debug interface ships; production code, gestures, sprites and physics run intact.
const arena = {
  id: "overworld",
  width: 128,
  height: 128,
  seed: 1,
  spawn: { x: 56.25, y: 56.25 },
  paths: [],
  waters: [],
  regions: [],
  clearings: [],
  scenery: [],
  neighbors: [],
  entities: [
    {
      id: "test-sign",
      sprite: "sign",
      x: 62.5,
      y: 57.5,
      solid: [-0.5, -0.5, 1, 1],
      label: "sign",
      rules: [{ effects: [{ type: "dialogue", key: "forestDirections" }] }],
    },
  ],
};
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [];
  fs.mkdirSync(".local/controls-review", { recursive: true });
  try {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
      [844, 390],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        ignoreHTTPSErrors: true,
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (
          !["GET", "HEAD"].includes(request.method()) ||
          url.hostname !== new URL(origin).hostname
        )
          return route.abort();
        if (url.pathname.startsWith("/api/"))
          return route.fulfill({
            status: 503,
            contentType: "application/json",
            body: '{"ok":false,"error":"offline"}',
          });
        if (url.pathname !== "/aventura") return route.continue();
        const response = await route.fetch(),
          body = (await response.text()).replace(
            /(<script type="application\/json" id="adventure-config">)([\s\S]*?)(<\/script>)/,
            (_, open, json, close) => {
              const config = JSON.parse(json);
              config.world.scenes.overworld = arena;
              config.neighbors = [];
              config.cast = {};
              return (
                open + JSON.stringify(config).replaceAll("<", "\\u003c") + close
              );
            },
          );
        return route.fulfill({ response, body });
      });
      await page.addInitScript(() => {
        localStorage.setItem(
          "magikitos.adventure",
          sessionStorage.getItem("controls-next") ||
            JSON.stringify({
              scene: "overworld",
              position: { x: 900, y: 900 },
              muted: true,
            }),
        );
      });
      const ready = () => require("./browser-entry.cjs").enterWorld(page);
      const inspect = () =>
        page.evaluate(() => window.MagikitosAdventure.inspect());
      const seed = async (state) => {
        await page.evaluate(
          (s) =>
            sessionStorage.setItem(
              "controls-next",
              JSON.stringify({ muted: true, ...s }),
            ),
          state,
        );
        await page.reload();
        await ready();
      };
      await page.goto(origin + "/aventura");
      await ready();
      const stick = await page.locator("#world-joystick").boundingBox();
      assert(stick.x > width / 2 && stick.y + stick.height <= height);
      assert(
        await page.locator("#world-boost").isHidden(),
        "Turbo starts hidden",
      );
      const cx = stick.x + stick.width / 2,
        cy = stick.y + stick.height / 2,
        radius = stick.width * 0.34;
      const cdp = await page.context().newCDPSession(page);
      const touch = (type, points) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: points.map(([x, y, id]) => ({ x, y, id })),
        });
      // One held touch slides through all eight sectors. Equal diagonal speed.
      await touch("touchStart", [[cx + radius, cy, 1]]);
      const boost = await page.locator("#world-boost").boundingBox();
      assert(
        boost &&
          boost.x + boost.width < width / 2 &&
          boost.y + boost.height <= height,
      );
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        await touch("touchMove", [
          [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 1],
        ]);
        const before = (await inspect()).player;
        await page.waitForTimeout(170);
        const after = (await inspect()).player,
          dx = after.x - before.x,
          dy = after.y - before.y;
        assert(
          dx * Math.cos(a) + dy * Math.sin(a) > 5,
          "Held sector moves in correct direction " +
            i +
            " " +
            JSON.stringify({
              before,
              after,
              errors,
              state: (await inspect()).dialogue,
              ui: await page.locator("#world-joystick").getAttribute("style"),
              classes: await page
                .locator("#world-joystick")
                .getAttribute("class"),
              hidden: await page.evaluate(() => document.hidden),
            }),
        );
        assert(
          Math.abs(dx * Math.sin(a) - dy * Math.cos(a)) < 3,
          "No stray perpendicular motion " + i,
        );
      }
      await touch("touchMove", [[cx, cy, 1]]);
      await page.waitForTimeout(60);
      let before = (await inspect()).player;
      await page.waitForTimeout(120);
      let after = (await inspect()).player;
      assert(
        Math.hypot(after.x - before.x, after.y - before.y) < 0.1,
        "Center dead zone stops without lifting",
      );
      assert(
        await page.locator("#world-boost").isHidden(),
        "Center dead zone hides turbo even while touching",
      );
      await touch("touchEnd", []);
      // Real independent touch pointers: right thumb direction + left thumb boost.
      const direction = [cx, cy + radius, 1],
        accelerator = [
          boost.x + boost.width / 2,
          boost.y + boost.height / 2,
          2,
        ];
      async function measure(fast) {
        const before = (await inspect()).player;
        await touch("touchStart", [direction]);
        assert(await page.locator("#world-boost").isVisible());
        if (fast) await touch("touchStart", [direction, accelerator]);
        await page.waitForTimeout(450);
        await touch("touchEnd", []);
        assert(await page.locator("#world-boost").isHidden());
        const after = (await inspect()).player;
        return Math.hypot(after.x - before.x, after.y - before.y);
      }
      const normal = await measure(false),
        fast = await measure(true);
      assert(fast > normal * 2, "Two-handed running boost is clearly faster");
      assert.equal(
        await page.locator("#world-boost").getAttribute("aria-pressed"),
        "false",
      );
      await touch("touchStart", [direction]);
      await touch("touchStart", [direction, accelerator]);
      await touch("touchCancel", []);
      before = (await inspect()).player;
      await page.waitForTimeout(130);
      after = (await inspect()).player;
      assert(
        Math.hypot(after.x - before.x, after.y - before.y) < 0.1,
        "Cancellation cannot leave movement stuck",
      );

      // Touch recenter stays centered inside the joystick.
      await touch("touchStart", [[width * 0.5, height * 0.35, 1]]);
      for (let i = 1; i <= 5; i++)
        await touch("touchMove", [
          [width * 0.5 + i * 14, height * 0.35 + i * 4, 1],
        ]);
      await touch("touchEnd", []);
      const recenter = page.locator("#world-recenter");
      assert(await recenter.isVisible());
      const rect = await recenter.boundingBox();
      assert(
        Math.abs(rect.x + rect.width / 2 - cx) < 1 &&
          Math.abs(rect.y + rect.height / 2 - cy) < 1,
      );
      await page.touchscreen.tap(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
      );
      assert((await inspect()).cameraFollowing);
      assert(await recenter.isHidden());

      await seed({ scene: "overworld", position: { x: 900, y: 900 } });
      async function clickWorld(point) {
        const s = await inspect(),
          r = await page.locator("#world-canvas").boundingBox();
        await page.mouse.click(
          r.x + ((point.x - s.camera.x) * r.width) / s.view.width,
          r.y + ((point.y - s.camera.y) * r.height) / s.view.height,
        );
      }
      await clickWorld({ x: 1000, y: 906 });
      await page.waitForFunction(() =>
        Boolean(window.MagikitosAdventure.inspect().dialogue),
      );
      const dialogue = await page.locator("#dialogue").boundingBox();
      assert(dialogue.y >= 0 && dialogue.y + dialogue.height <= height);
      assert(
        await page.locator("#world-joystick").isHidden(),
        "Mouse hides touch controls",
      );
      assert(await page.locator("#world-boost").isHidden());
      await page.screenshot({
        path: `.local/controls-review/dialogue-${width}.png`,
      });
      await page.mouse.move(
        dialogue.x + dialogue.width / 2,
        dialogue.y + dialogue.height / 2,
      );
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, 120);
      await page.keyboard.up("Control");
      await page.waitForTimeout(50);
      assert.deepEqual(
        await page.locator("#dialogue").boundingBox(),
        dialogue,
        "Trackpad zoom never scales or reflows dialogue",
      );
      const frame = await inspect();
      const target = {
        x: Math.floor((frame.camera.x + frame.view.width * 0.28) / 16) * 16 + 8,
        y:
          Math.floor((frame.camera.y + frame.view.height * 0.04) / 16) * 16 + 8,
      };
      before = frame.player;
      await clickWorld(target);
      assert.equal((await inspect()).dialogue, null);
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().travel.intent,
      );
      after = (await inspect()).player;
      assert(
        Math.hypot(after.x - target.x, after.y - target.y) < 1,
        "Same outside click closes dialogue AND reaches destination " +
          JSON.stringify({ before, after, target, state: await inspect() }),
      );

      // Wheel and two-finger pinch reach exactly the geometric cover limit.
      await page.mouse.move(width / 2, height * 0.4);
      for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 900);
      await page.waitForTimeout(180);
      const cover = Math.max(width / 2048, height / 2048);
      assert(
        Math.abs((await inspect()).scale - cover) < 1e-6,
        "Wheel reaches map boundary",
      );
      for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -900);
      await page.waitForTimeout(80);
      await touch("touchStart", [
        [width / 2 - 130, height * 0.4, 1],
        [width / 2 + 130, height * 0.4, 2],
      ]);
      for (let d = 120; d >= 5; d -= 5)
        await touch("touchMove", [
          [width / 2 - d, height * 0.4, 1],
          [width / 2 + d, height * 0.4, 2],
        ]);
      await touch("touchEnd", []);
      await page.waitForTimeout(100);
      const zoomed = await inspect();
      assert(
        Math.abs(zoomed.scale - cover) < 1e-6,
        "Pinch reaches same map boundary",
      );
      assert(
        zoomed.camera.x >= 0 &&
          zoomed.camera.y >= 0 &&
          zoomed.camera.x + zoomed.view.width <= 2048 + 0.001 &&
          zoomed.camera.y + zoomed.view.height <= 2048 + 0.001,
      );
      assert.equal(
        await page.evaluate(() => visualViewport.scale),
        1,
        "DOM never pinch zooms",
      );
      assert.equal(
        (await page.locator("#world-joystick").boundingBox()).width,
        stick.width,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `.local/controls-review/zoom-${width}.png`,
      });

      await seed({
        scene: "river-willows",
        position: { x: 768, y: 96 },
        inventory: { boat: 1 },
        navigation: { mode: "boat", direction: "down" },
      });
      assert(await page.locator("#world-joystick").isVisible());
      assert(await page.locator("#world-boost").isHidden());
      const rowNormal = await measure(false),
        rowFast = await measure(true);
      assert(
        rowFast > rowNormal * 1.9,
        "Two-handed rowing turbo is clearly faster " +
          rowNormal +
          " / " +
          rowFast,
      );
      await seed({
        scene: "river-willows",
        position: { x: 768, y: 48 },
        inventory: { boat: 1 },
        navigation: { mode: "boat", direction: "up" },
      });
      await touch("touchStart", [[cx, cy - radius, 1]]);
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().scene === "river-reeds",
      );
      before = (await inspect()).player;
      await page.waitForTimeout(350);
      after = (await inspect()).player;
      assert(
        after.y < before.y - 12,
        "Held thumb continues across river scene seam without lifting",
      );
      await touch("touchEnd", []);
      await cdp.detach();
      await page.close();
      console.log(
        `PASS ${width}×${height}: continuous eight-way joystick, two-thumb running/rowing, cancel, center recenter, dialogue click-through, wheel/pinch full map coverage; run ${normal.toFixed(0)}→${fast.toFixed(0)}, row ${rowNormal.toFixed(0)}→${rowFast.toFixed(0)} px.`,
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
