"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const { nearbyPosition } = require("./browser-world.cjs");
const scene = JSON.parse(fs.readFileSync(".local/build/world.json")).scenes
  .overworld;
const elderApproach = nearbyPosition(scene, {}, "picnic-neighbor");
/**
 * ⛔ EL PUNTO DE PARTIDA SE BUSCA EN EL MAPA, NO SE ESCRIBE. El dueño redibuja el bosque en el
 * Studio y dos números cableados dejan de ser suelo firme: el juego cae al sitio de aparición y
 * la prueba se cae comparando una coordenada con otra sin decir por qué (pasó con el retoque del
 * 16-sep-2026). Aquí hace falta algo muy concreto —un claro con un pasillo recto de 320px hacia
 * abajo, que es el paseo más largo que esta prueba pide— así que se busca alrededor del sitio de
 * aparición y se exige encontrarlo: si el bosque dejara de tener un claro así, eso también es
 * algo que hay que saber.
 */
const start = (() => {
  const world = JSON.parse(require("node:fs").readFileSync(".local/build/world.json"));
  const { World } = require("../public/assets/js/adventure/model");
  const scene = new World(world.scenes.overworld);
  scene.actors = [];
  scene.refresh({ inventory: {}, flags: {}, timers: {}, wallet: { balance: 0, claimed: {} } });
  const spawn = world.scenes.overworld.spawn;
  // Suelo firme todo el trayecto Y ninguna puerta cerca: el sitio de aparición cae justo encima
  // del refugio de hojas, así que el paseo de 320px acababa DENTRO de la casa y la prueba medía
  // el ritmo de un viaje que ya no existía.
  const doors = scene.entities.filter((e) => e.threshold);
  // Suelo firme los 320px del paseo más largo, y ninguna puerta en la columna hasta bastante más
  // abajo: el sitio de aparición cae justo encima del refugio de hojas y el paseo acababa DENTRO
  // de la casa, midiendo el ritmo de un viaje que ya no existía. El margen es generoso a
  // propósito, porque el toque se sitúa tras arrastrar la cámara y puede caer un poco más allá.
  const clear = (x, y) => {
    for (let step = 0; step <= 320; step += 8) if (!scene.canStand(x, y + step)) return false;
    return !doors.some((d) => Math.abs(d.x - x) < 160 && d.y > y && d.y < y + 640);
  };
  for (let ring = 0; ring < 60; ring++)
    for (const dx of [0, ring, -ring])
      for (const dy of [0, ring, -ring]) {
        const x = spawn.x * 16 + dx * 16,
          y = spawn.y * 16 + dy * 16;
        if (clear(x, y)) return { x, y };
      }
  throw Error("El bosque ya no tiene un claro con 320px rectos hacia abajo");
})();
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
      await require("./browser-art.cjs").useReviewVariant(page);
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
      /** Un dedo (o el botón izquierdo) que se mueve y se queda `hold` ms puesto antes de soltar. */
      async function drag(dx, dy, touch = false, hold = 0) {
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
          if (hold) await page.waitForTimeout(hold);
          await c.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          await c.detach();
        } else {
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + dx, y + dy, { steps: 8 });
          if (hold) await page.waitForTimeout(hold);
          await page.mouse.up();
        }
      }
      /** Mirar alrededor sin dar órdenes: dos dedos, o el botón derecho del ratón (19-sep-2026). */
      async function pan(dx, dy, touch = false) {
        const x = width * 0.55,
          y = height * 0.5;
        if (touch) {
          const c = await page.context().newCDPSession(page);
          const dedos = (i) => [
            { x: x + (dx * i) / 8, y: y + (dy * i) / 8 - 40, id: 0 },
            { x: x + (dx * i) / 8, y: y + (dy * i) / 8 + 40, id: 1 },
          ];
          await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: dedos(0) });
          for (let i = 1; i <= 8; i++)
            await c.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: dedos(i) });
          await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await c.detach();
        } else {
          await page.mouse.move(x, y);
          await page.mouse.down({ button: "right" });
          await page.mouse.move(x + dx, y + dy, { steps: 8 });
          await page.mouse.up({ button: "right" });
        }
      }
      /**
       * ⛔ AQUÍ SE ARRASTRABA EL MAPA PARA TRAER EL PUNTO A LA PANTALLA, y desde el 19-sep-2026
       * arrastrar ya no es un ajuste de cámara: es una ORDEN DE VIAJE, así que ensuciaba
       * exactamente lo que esta prueba mide (qué marchas usa un toque). Se aleja la vista con la
       * rueda, que solo cambia el zoom y no manda a nadie a ninguna parte.
       */
      async function tapWorld(point) {
        for (let i = 0; i < 16; i++) {
          const v = await inspect();
          if (point.y <= v.camera.y + v.view.height - 24) break;
          await page.mouse.move(width / 2, height / 2);
          await page.mouse.wheel(0, 240);
          await page.waitForTimeout(40);
        }
        const s = await inspect();
        const r = await page.locator("#world-canvas").boundingBox();
        await page.touchscreen.tap(
          r.x + ((point.x - s.camera.x) * r.width) / s.view.width,
          r.y + ((point.y - s.camera.y) * r.height) / s.view.height,
        );
      }
      /**
       * ⛔ MOVER EL DEDO ES UN JOYSTICK INVISIBLE (19-sep-2026, decisión del dueño): el duende va
       * hacia donde tira el dedo desde donde se apoyó, como una flecha, mientras el dedo siga
       * puesto; soltar para; y la cámara sigue siendo SUYA, no del gesto. Aquí se comprobó primero
       * que mirar alrededor no movía a nadie (era trabajo del joystick fijo), luego que arrastrar
       * llevaba al centro de la vista, luego que guiaba hacia el dedo; hoy mirar alrededor son dos
       * dedos o el botón derecho (`pan`), y esto es una tecla.
       */
      for (const touch of [false, true]) {
        await seed();
        const before = await inspect();
        await drag(-80, -100, touch, 350);
        let s = await inspect();
        assert(s.cameraFollowing, "Mandar con el dedo no suelta la cámara: sigue pegada al duende");
        // El dedo tira hacia arriba a la izquierda (−80, −100) desde donde se apoyó.
        assert(
          s.player.y < before.player.y - 4 && s.player.x < before.player.x,
          "…y el duende ha ido hacia donde tiraba el dedo, arriba a la izquierda " +
            JSON.stringify({ antes: before.player, ahora: s.player }),
        );
        assert(!s.travel.intent, "…sin destino: es una tecla, no un viaje");
        assert(!s.dialogue, "…sin hablar con nada por el camino");
        assert(!s.roll);
        // Soltar para, como soltar una tecla; la cámara nunca dejó de seguir, así que el disco de
        // recentrar no tiene nada que recentrar.
        await page.waitForTimeout(150);
        const parado = await inspect();
        assert.equal(parado.pace, "idle", "Soltar para");
        assert(parado.cameraFollowing, "…y la cámara sigue con el duende");
        assert(await page.locator("#world-recenter").isHidden());
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
      await pan(-80, -100, width < 800);
      assert.equal((await inspect()).cameraFollowing, false, "Mirar alrededor suelta la cámara");
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
        `PASS mobility ${width}×${height}: joystick invisible (ratón y dedo) con la cámara pegada, soltar para, dos dedos/botón derecho sueltan la cámara, walk/run routes, held/double Space never rolls, dialogue isolation, natural cast, lazy elder.`,
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
