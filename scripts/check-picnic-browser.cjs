"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const catalog = JSON.parse(fs.readFileSync(".local/build/world.json"));
const { nearbyPosition, entityScreenPoint } = require("./browser-world.cjs");
const errors = [];
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const [width, height] of [
      [1440, 900],
      [1024, 768],
      [768, 1024],
      [390, 844],
      [844, 390],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
      });
      await page.route("**/*", (r) =>
        ["127.0.0.1", "magikitos.ddev.site"].includes(
          new URL(r.request().url()).hostname,
        )
          ? r.continue()
          : r.abort(),
      );
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        const pending = sessionStorage.getItem("picnic-seed");
        if (pending) {
          localStorage.setItem("magikitos.adventure", pending);
          sessionStorage.removeItem("picnic-seed");
        }
      });
      let state = {
        scene: "overworld",
        position: { x: 27 * 16, y: 53 * 16 },
        flags: {},
        muted: true,
      };
      await page.goto(origin + "/aventura");
      async function position(x, y) {
        state.position = { x: x * 16, y: y * 16 };
        await page.evaluate(
          (s) => sessionStorage.setItem("picnic-seed", JSON.stringify(s)),
          state,
        );
        await page.reload();
        await require("./browser-entry.cjs").enterWorld(page);
      }
      /**
       * ⛔ SE PINCHA LO QUE SE DIBUJA, NO UN HUECO SOBRE EL ANCLA. Esto restaba píxeles a mano al
       * pie de la entidad, y un número a mano caduca con el arte: la seta de helecho vive a escala
       * 0,72, su dibujo mide doce píxeles de alto y el `-20` apuntaba diez por ENCIMA del sombrero,
       * o sea a la hierba. El check llevaba rojo desde que se escalaron las dos cosas en el mismo
       * commit. `entityScreenPoint` es el helper de la casa para esto: recorte nativo, escala y
       * desplazamiento de autor, y la cámara de AHORA.
       */
      async function click(id) {
        const punto = await entityScreenPoint(page, catalog.scenes.overworld, id);
        const r = await page.locator("#world-canvas").boundingBox();
        assert(
          punto.x >= r.x &&
            punto.x <= r.x + r.width &&
            punto.y >= r.y &&
            punto.y <= r.y + r.height,
          id + " visible at " + width,
        );
        await page.mouse.click(punto.x, punto.y);
        await page.waitForFunction(
          () => !!window.MagikitosAdventure.inspect().dialogue,
          null,
          { timeout: 15000 },
        );
      }
      async function near(id) {
        const point = nearbyPosition(catalog.scenes.overworld, state, id);
        await position(point.x / 16, point.y / 16);
      }
      async function save() {
        await page.keyboard.press("Enter");
        state = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("magikitos.adventure")),
        );
      }
      await near("picnic-knife");
      await click("picnic-knife");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.knife === 1,
      );
      await save();
      await near("picnic-lighter");
      await click("picnic-lighter");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.lighter === 1,
      );
      await save();
      await near("forest-mushrooms-fern");
      await click("forest-mushrooms-fern");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.mushroom === 1,
      );
      await save();
      await near("picnic-twig");
      await click("picnic-twig");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.twig === 1,
      );
      await save();
      await near("picnic-barbecue");
      await click("picnic-barbecue");
      await page.locator("[data-action='light']").click();
      await page.waitForFunction(
        () =>
          window.MagikitosAdventure.inspect().flags.fireLit &&
          !!window.MagikitosAdventure.inspect().dialogue,
      );
      await page.locator("[data-action='cook']").click();
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().inventory.skewer === 1,
      );
      await save();
      await near("picnic-neighbor");
      await click("picnic-neighbor");
      await page.locator("[data-action='give']").click();
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().flags.picnicFed,
      );
      await save();
      // Brizno suelta sus remos y nada más: el bosque no acuña setines (17-sep-2026).
      assert.equal(state.inventory.oars, 1);
      assert.equal(state.wallet.balance, 0);
      assert(state.timers.picnic > Date.now() + 4.99 * 3600000);
      assert.equal(state.inventory.knife, 1);
      assert.equal(state.inventory.lighter, 1);
      await position(25, 53);
      assert(
        !(
          await page.evaluate(
            () => window.MagikitosAdventure.inspect().entities,
          )
        ).some((e) => e.id === "human-smoker"),
      );
      const deadline = state.timers.picnic;
      assert.equal(
        (await page.evaluate(() => window.MagikitosAdventure.inspect().timers))
          .picnic,
        deadline,
      );
      // A prepared second meal waits in the test profile; the full repeat recipe is covered by pure tests.
      state.inventory.skewer = 1;
      await near("picnic-neighbor");
      await click("picnic-neighbor");
      assert.equal(await page.locator("[data-action='give']").count(), 0);
      // Advance the test browser's clock, not game state or the user's session.
      await page.evaluate((t) => {
        const original = Date.now;
        Date.now = () => Math.max(original(), t);
      }, deadline + 1);
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().timers.picnic,
      );
      assert(
        !(
          await page.evaluate(
            () => window.MagikitosAdventure.inspect().entities,
          )
        ).some((e) => e.id === "human-smoker"),
      );
      await page.waitForSelector("[data-action='give']");
      await page.locator("[data-action='give']").click();
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().timers.picnic > Date.now(),
      );
      const repeat = await page.evaluate(() =>
        window.MagikitosAdventure.inspect(),
      );
      assert.equal(repeat.wallet.balance, 0, "Ni la segunda brocheta acuña nada");
      assert.equal(repeat.inventory.knife, 1);
      assert.equal(repeat.inventory.lighter, 1);
      assert(!repeat.inventory.skewer);
      await page.close();
      console.log(
        "PASS picnic pointer recipe, oars, departure, reload and live hunger expiry " +
          width +
          "×" +
          height,
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
