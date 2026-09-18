"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const origin = process.env.OFFLINE_GAME_ORIGIN || "http://127.0.0.1:47838";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw Error("Local tests only");
const read = (page) => page.evaluate(() => window.MagikitosAdventure.inspect());

/**
 * El selector de duende, en las tres formas que tiene la pantalla y con el juego de verdad.
 *
 * Lo que se comprueba no es que la rejilla se pinte —eso se ve en la captura— sino las cuatro
 * cosas que fallan en silencio: que ofrezca EXACTAMENTE el elenco que la release dibuja, que cada
 * cara sea una diana que un dedo pueda tocar, que elegir cambie el cuerpo de verdad y sobreviva a
 * una recarga, y que los retratos NO se queden fijados en memoria al cerrar el panel.
 */
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  fs.mkdirSync(".local/cast-review", { recursive: true });
  const errors = [];
  try {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
      page.on("pageerror", (e) => errors.push(`${width}: ${e.message}`));
      await page.route("**/*", (r) =>
        new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
      );
      await page.addInitScript(() =>
        localStorage.setItem("magikitos.adventure", JSON.stringify({ muted: true })),
      );
      await page.goto(origin + "/aventura");
      await enterWorld(page);
      const offered = (await read(page)).cast.offered;
      assert(offered.length >= 1, "The release offers somebody");

      await page.locator("#self-toggle").click();
      await page.waitForSelector("#self-dialog[open]");
      const section = page.locator("#self-cast");
      if (offered.length < 2) {
        assert(await section.isHidden(), "One duende is not a choice");
        await page.close();
        continue;
      }
      await page.waitForSelector("#self-cast:not([hidden]) .world-self-cast-option canvas");
      const options = page.locator(".world-self-cast-option");
      assert.equal(await options.count(), offered.length, "Exactly the offered cast, no categories");
      for (let i = 0; i < offered.length; i++) {
        const box = await options.nth(i).boundingBox();
        assert(box.width >= 44 && box.height >= 44, `Tappable face at ${width}: ${JSON.stringify(box)}`);
        assert.equal(await options.nth(i).locator("canvas").count(), 1, "Every face is painted");
      }
      // La caja del panel no puede salirse de la pantalla por meterle una rejilla dentro.
      const dialog = await page.locator("#self-dialog").boundingBox();
      assert(dialog.x >= 0 && dialog.x + dialog.width <= width + 1, `Panel fits at ${width}`);
      await page.screenshot({ path: `.local/cast-review/${width}.png` });

      const before = (await read(page)).player.variant;
      assert.equal((await read(page)).cast.chosen, null, "Nobody has chosen yet");
      const marked = async () =>
        page.locator(".world-self-cast-option.is-chosen").count();
      assert.equal(await marked(), 1, "The current duende is marked");
      const other = offered.findIndex((v) => v !== before);
      await options.nth(other).click();
      // Se espera a que las HOJAS del cuerpo nuevo estén fijadas, no a que cambie el número: el
      // número cambia en el mismo tick del clic y el arte llega después, así que comprobar el
      // número aprobaría un cambio de duende sin cuerpo con el que dibujarlo.
      await page.waitForFunction(
        (want) => window.MagikitosAdventure.inspect().assets.active.includes("actor-" + want),
        offered[other],
        { timeout: 15000 },
      );
      assert.equal((await read(page)).player.variant, offered[other], "The body changed");
      const after = await read(page);
      assert.equal(after.cast.chosen, offered[other], "The choice is stored, not coincidental");
      assert.equal(await marked(), 1, "Only one face stays marked");
      assert(
        await options.nth(other).evaluate((el) => el.classList.contains("is-chosen")),
        "The mark moved to what was chosen",
      );
      // El cuerpo del jugador se dibuja con el duende nuevo: sus hojas tienen que estar fijadas.
      const pinned = after.assets.active;
      assert(
        pinned.includes("actor-" + offered[other]),
        "The new body's sheets are pinned: " + JSON.stringify(pinned),
      );
      assert(
        !pinned.includes("actor-" + before),
        "The previous body's sheets were released, not stacked",
      );
      assert(
        !pinned.includes("cast-portraits"),
        "Portraits are lent while the panel is open, never pinned",
      );

      // ⛔ `close()` NO dispara su evento en el mismo tick: el estándar encola una tarea, así que
      // hay un instante en que el panel ya está cerrado y nadie ha soltado nada todavía. Se espera
      // a lo que de verdad importa —que la rejilla se haya ido— y no a que `open` cambie.
      await page.locator("#self-dialog [data-dismiss]").click();
      await page.waitForFunction(
        () => !document.getElementById("self-dialog").open &&
          !document.getElementById("self-cast-grid").children.length,
      );
      assert.equal(await options.count(), 0, "The grid is let go with the panel");

      await page.reload();
      await enterWorld(page);
      const resumed = await read(page);
      assert.equal(resumed.player.variant, offered[other], "The duende survives a reload");
      assert.equal(resumed.cast.chosen, offered[other]);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  assert.deepEqual(errors, [], "No page errors");
  console.log(
    "PASS cast selector: offered roster only, tappable faces at 1440/768/390, choosing changes the " +
      "body and survives a reload, sheets swapped not stacked, portraits lent not pinned.",
  );
})();
