"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const { cleanSave } = require("../public/assets/js/adventure/save");
const {
  currentAt,
  canFloat,
} = require("../public/assets/js/adventure/river-navigation");
const { World } = require("../public/assets/js/adventure/model");
const { docks } = require("../public/assets/js/adventure/docks");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (
  !["127.0.0.1", "localhost", "magikitos.ddev.site"].includes(
    new URL(origin).hostname,
  )
)
  throw Error("Local test only");
const catalog = JSON.parse(fs.readFileSync(".local/build/world.json"));
const boat = (scene, x, y) =>
  cleanSave(
    {
      scene,
      position: { x: x * 16, y: y * 16 },
      inventory: { boat: 1, knife: 1 },
      navigation: { mode: "boat", direction: "up" },
      muted: true,
    },
    catalog,
  );
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [],
    writes = [];
  fs.mkdirSync(".local/river-review", { recursive: true });
  try {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        ignoreHTTPSErrors: true,
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (r) => {
        if (!["GET", "HEAD"].includes(r.request().method())) {
          // ⛔ La medida NO es una escritura del jugador. `/api/world/telemetry` es el medidor
          // anónimo de la casa y sale solo, sin cuenta y sin tocar nada de la partida; lo que
          // esta prueba vigila es que navegar el río no mande NADA que cambie lo que tienes.
          // Sin la excepción, el medidor tumbaba la prueba desde que se encendió.
          if (!/\/api\/world\/telemetry$/.test(r.request().url()))
            writes.push(r.request().url());
          return r.abort();
        }
        return ["127.0.0.1", "magikitos.ddev.site"].includes(
          new URL(r.request().url()).hostname,
        )
          ? r.continue()
          : r.abort();
      });
      await page.addInitScript(() => {
        const s = sessionStorage.getItem("river-next");
        if (s) {
          localStorage.setItem("magikitos.adventure", s);
          sessionStorage.removeItem("river-next");
        }
      });
      await require("./browser-art.cjs").useReviewVariant(page);
      await page.goto(origin + "/aventura");
      const inspect = () =>
        page.evaluate(() => window.MagikitosAdventure.inspect());
      const ready = () =>
        require("./browser-entry.cjs").enterWorld(page);
      async function seed(s) {
        await page.evaluate(
          (s) => sessionStorage.setItem("river-next", JSON.stringify(s)),
          s,
        );
        await page.reload();
        await ready();
      }
      async function row(key, ms, fast = false) {
        await page.locator("#world-canvas").focus();
        if (fast) await page.keyboard.down(" ");
        await page.keyboard.down(key);
        await page.waitForTimeout(ms);
        await page.keyboard.up(key);
        if (fast) await page.keyboard.up(" ");
      }
      await seed(boat("river-willows", 48, 6));
      assert(await page.locator("#world-joystick").isVisible());
      let start = (await inspect()).player.y;
      await row("ArrowDown", 650);
      const normal = (await inspect()).player.y - start;
      await seed(boat("river-willows", 48, 6));
      start = (await inspect()).player.y;
      await row("ArrowDown", 650, true);
      assert(
        (await inspect()).player.y - start > normal + 7,
        "Space accelerates rowing",
      );
      assert(
        await page.locator("#world-joystick").isHidden(),
        "Keyboard hides touch controls",
      );
      await page.touchscreen.tap(width / 2, 100);
      const pad = await page.locator("#world-joystick").boundingBox();
      const cdp = await page.context().newCDPSession(page);
      start = (await inspect()).player.y;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { id: 1, x: pad.x + pad.width / 2, y: pad.y + pad.height * 0.82 },
        ],
      });
      await page.waitForTimeout(600);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
      assert((await inspect()).player.y > start + 20);
      await page.reload();
      await ready();
      assert.equal((await inspect()).navigation.mode, "boat");
      await seed(boat("river-willows", 48, 3));
      await page.locator("#world-canvas").focus();
      await page.keyboard.down("ArrowUp");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().scene === "river-rapids",
      );
      await page.keyboard.up("ArrowUp");
      assert.equal((await inspect()).navigation.mode, "boat");
      const rapids = new World(catalog.scenes["river-rapids"]);
      let rapid;
      for (let y = 40; y < 65 && !rapid; y++)
        for (let x = 35; x < 65 && !rapid; x++)
          if (
            canFloat(rapids, x * 16, y * 16) &&
            currentAt(rapids.data, x * 16, y * 16).y > 110
          )
            rapid = { x, y };
      assert(rapid);
      await seed(boat("river-rapids", rapid.x, rapid.y));
      start = (await inspect()).player.y;
      await row("ArrowUp", 800);
      assert(
        (await inspect()).player.y > start,
        "Visible current actually pushes upstream attempts back",
      );
      await page.screenshot({
        path: ".local/river-review/rapids-" + width + ".png",
      });
      const clickWorld = async (point) => {
        const s = await inspect(),
          rect = await page.locator("#world-canvas").boundingBox();
        await page.mouse.click(
          rect.x + ((point.x - s.camera.x) * rect.width) / s.view.width,
          rect.y + ((point.y - s.camera.y) * rect.height) / s.view.height,
        );
      };
      for (const data of Object.values(catalog.scenes))
        for (const landing of docks(data)) {
          const scene = data.id;
          await seed(boat(scene, ...landing.water));
          assert.equal(await page.locator("#river-land").count(), 0);
          await page.waitForTimeout(120);
          assert.equal(
            (await inspect()).navigation.mode,
            "boat",
            "Idle alongside a jetty does not land",
          );
          await clickWorld(landing.dry);
          await page.waitForFunction(
            () =>
              window.MagikitosAdventure.inspect().navigation.mode === "foot",
          );
          const s = await inspect();
          assert.equal(s.scene, scene);
          assert(
            Math.hypot(s.player.x - landing.dry.x, s.player.y - landing.dry.y) <
              1,
          );
          await page.waitForTimeout(100);
          assert.equal(
            (await inspect()).navigation.mode,
            "foot",
            "No bounce back into the boat",
          );
          // Click the planks to approach and walk off the tip; no dock dialogue.
          await clickWorld(landing.dry);
          await page.waitForFunction(
            () =>
              window.MagikitosAdventure.inspect().navigation.mode === "boat",
          );
          assert.equal(
            (await inspect()).dialogue,
            null,
            "Boarding has no dialogue",
          );
          // Keyboard/pad direction uses the exact same inward crossing.
          const inward =
            landing.outward.x > 0
              ? "ArrowLeft"
              : landing.outward.x < 0
                ? "ArrowRight"
                : landing.outward.y > 0
                  ? "ArrowUp"
                  : "ArrowDown";
          await page.locator("#world-canvas").focus();
          await page.keyboard.down(inward);
          await page.waitForFunction(
            () =>
              window.MagikitosAdventure.inspect().navigation.mode === "foot",
          );
          await page.keyboard.up(inward);
          const opposite = {
            ArrowLeft: "ArrowRight",
            ArrowRight: "ArrowLeft",
            ArrowUp: "ArrowDown",
            ArrowDown: "ArrowUp",
          }[inward];
          await page.keyboard.down(opposite);
          await page.waitForFunction(
            () =>
              window.MagikitosAdventure.inspect().navigation.mode === "boat",
          );
          await page.keyboard.up(opposite);
          console.log("  PASS directional dock " + scene + "/" + landing.id);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
        }
      await page.close();
      console.log(
        "PASS river rowing/boost/pad, seam, current, reload and all automatic docks " +
          width +
          "x" +
          height,
      );
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, [], "Navegar no escribe nada del jugador");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
