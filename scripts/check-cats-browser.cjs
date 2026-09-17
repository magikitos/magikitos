"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const scene = JSON.parse(fs.readFileSync(".local/build/world.json")).scenes
  .overworld;
const catStart = scene.entities.find((e) => e.id === "picnic-cat");

// Real input and real animation clock. Only the initial saved position is a fixture;
// no debug setters, direct encounter invocation or production identity is used.
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  fs.mkdirSync(".local/cat-review", { recursive: true });
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
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (r) =>
        ["GET", "HEAD"].includes(r.request().method()) &&
        [new URL(origin).hostname, "127.0.0.1", "magikitos.ddev.site"].includes(
          new URL(r.request().url()).hostname,
        )
          ? r.continue()
          : r.abort(),
      );
      await page.addInitScript((cat) => {
        if (!localStorage.getItem("magikitos.adventure"))
          localStorage.setItem(
            "magikitos.adventure",
            JSON.stringify({
              scene: "overworld",
              position: { x: cat.x * 16, y: (cat.y + 1.5) * 16 },
              muted: true,
            }),
          );
      }, catStart);
      await page.goto(origin + "/aventura");
      await require("./browser-entry.cjs").enterWorld(page);
      const inspect = () =>
        page.evaluate(() => window.MagikitosAdventure.inspect());
      assert.equal((await inspect()).cats.length, 1);
      await page.waitForFunction(
        () => Boolean(window.MagikitosAdventure.inspect().carried),
        null,
        { timeout: 35000 },
      );
      const caught = await inspect();
      await page.waitForTimeout(650);
      await page.screenshot({ path: `.local/cat-review/carry-${width}.png` });
      await page.keyboard.down("ArrowLeft");
      await page.keyboard.down(" ");
      await page.waitForTimeout(450);
      await page.keyboard.up("ArrowLeft");
      await page.keyboard.up(" ");
      const carried = await inspect();
      assert(carried.carried, "Cannot escape the carry with movement keys");
      const cat = carried.cats.find((c) => c.id === carried.carried);
      assert(
        Math.hypot(carried.player.x - cat.x, carried.player.y - cat.y) < 1,
      );
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().carried,
        null,
        { timeout: 45000 },
      );
      const released = await inspect();
      const setback = Math.hypot(
        released.player.x - caught.player.x,
        released.player.y - caught.player.y,
      );
      assert(
        Math.hypot(
          released.player.x - caught.player.x,
          released.player.y - caught.player.y,
        ) >= 850,
        "A real setback, not damage",
      );
      assert.deepEqual(released.inventory, caught.inventory);
      await page.waitForTimeout(600);
      assert.equal(
        (await inspect()).carried,
        null,
        "Release grace prevents immediate recapture",
      );
      await page.waitForFunction(
        (id) => {
          const cat = window.MagikitosAdventure.inspect().cats.find(
            (c) => c.id === id,
          );
          return (
            cat &&
            Math.hypot(cat.x - cat.home.x, cat.y - cat.home.y) < 32 &&
            cat.phase !== "homeward"
          );
        },
        caught.carried,
        { timeout: 45000 },
      );
      assert.equal(
        (await inspect()).carried,
        null,
        "Returning cat does not recapture its passenger",
      );
      /**
       * ⛔ UN TOPETAZO ES QUE TE COJA, Y AHÍ MISMO (17-sep-2026, decisión del dueño).
       *
       * Antes el gato tenía que VERTE, fijarse 0,85 s y luego perseguirte; darle un empujón no
       * hacía nada, porque ni siquiera tenía cuerpo. Se mide en TIEMPO: si volviera la espera,
       * esto tardaría más de un segundo en vez de menos de medio.
       */
      await page.reload();
      await require("./browser-entry.cjs").enterWorld(page);
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().carried,
        null,
        { timeout: 20000 },
      );
      // Se espera a que se acabe la gracia y a que el gato esté quieto, para que lo único que
      // provoque la captura sea el topetazo y no que te haya visto desde lejos.
      await page.waitForFunction(
        () => {
          const s = window.MagikitosAdventure.inspect();
          return s.cats[0] && !s.carried;
        },
        null,
        { timeout: 20000 },
      );
      await page.waitForTimeout(8000);
      {
        assert(!(await inspect()).carried, "se empieza libre");
        // Se le persigue con el teclado reapuntando, porque el gato patrulla: lo que se
        // comprueba es el TOPETAZO, y para darlo hay que alcanzarlo.
        const empezo = Date.now();
        let tecla = null;
        while (Date.now() - empezo < 25000) {
          const s = await inspect();
          if (s.carried) break;
          const gato = s.cats[0];
          const dx = gato.x - s.player.x,
            dy = gato.y - s.player.y;
          const quiero =
            Math.abs(dx) > Math.abs(dy)
              ? dx > 0
                ? "ArrowRight"
                : "ArrowLeft"
              : dy > 0
                ? "ArrowDown"
                : "ArrowUp";
          if (quiero !== tecla) {
            if (tecla) await page.keyboard.up(tecla);
            await page.keyboard.down(quiero);
            tecla = quiero;
          }
          await page.waitForTimeout(120);
        }
        if (tecla) await page.keyboard.up(tecla);
        assert((await inspect()).carried, "alcanzar al gato te cuesta el viaje");
        console.log("  PASS topetazo: alcanzarlo te cuesta el viaje");
      }
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().carried,
        null,
        { timeout: 20000 },
      );
      await page.reload();
      await require("./browser-entry.cjs").enterWorld(page);
      assert.equal((await inspect()).carried, null);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.close();
      console.log(
        `PASS cat capture, carry input lock, ${Math.round(setback)}px safe setback, grace and reload ${width}×${height}`,
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
