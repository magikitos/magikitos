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
const { fulfillArena } = require("./lib/input-arena.cjs");
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
        return fulfillArena(route);
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
      // The stick is a ZONE with a ring floating inside it: neutral is wherever
      // the thumb lands and full deflection is a fixed number of pixels from there.
      const cx = stick.x + stick.width / 2,
        cy = stick.y + stick.height / 2;
      const reads = () =>
        page.evaluate(() => {
          const node = document.getElementById("world-joystick"),
            style = getComputedStyle(node);
          return {
            travel: parseFloat(style.getPropertyValue("--world-stick-travel")),
            clearance: getComputedStyle(document.documentElement)
              .getPropertyValue("--world-control-clearance")
              .trim(),
            display: style.display,
            hidden: node.hidden,
            home: {
              x: parseFloat(node.style.getPropertyValue("--stick-home-x")) || 0,
              y: parseFloat(node.style.getPropertyValue("--stick-home-y")) || 0,
            },
          };
        });
      const travel = (await reads()).travel,
        reach = stick.width / 2 - travel;
      assert(travel > 0 && reach > 0, "A zone with room to choose neutral in");
      const cdp = await page.context().newCDPSession(page);
      const touch = (type, points) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: points.map(([x, y, id]) => ({ x, y, id })),
        });
      // One held touch slides through all eight sectors. Equal diagonal speed.
      // It starts at the centre, so neutral is the centre and each sector sits
      // exactly `travel` pixels away — the geometry the sweep assumes.
      await touch("touchStart", [[cx, cy, 1]]);
      assert(
        await page.locator("#world-boost").isHidden(),
        "A thumb landing is not yet a direction",
      );
      await touch("touchMove", [[cx + travel, cy, 1]]);
      const boost = await page.locator("#world-boost").boundingBox();
      assert(
        boost &&
          boost.x + boost.width < width / 2 &&
          boost.y + boost.height <= height,
      );
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        await touch("touchMove", [
          [cx + Math.cos(a) * travel, cy + Math.sin(a) * travel, 1],
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
      const neutral = [cx, cy, 1],
        direction = [cx, cy + travel, 1],
        accelerator = [
          boost.x + boost.width / 2,
          boost.y + boost.height / 2,
          2,
        ];
      async function measure(fast) {
        const before = (await inspect()).player;
        await touch("touchStart", [neutral]);
        await touch("touchMove", [direction]);
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
      await touch("touchStart", [neutral]);
      await touch("touchMove", [direction]);
      await touch("touchStart", [direction, accelerator]);
      await touch("touchCancel", []);
      before = (await inspect()).player;
      await page.waitForTimeout(130);
      after = (await inspect()).player;
      assert(
        Math.hypot(after.x - before.x, after.y - before.y) < 0.1,
        "Cancellation cannot leave movement stuck",
      );

      // ⛔ THE ZONE EXISTS SO NO DIRECTION HAS TO BE REACHED FOR. Press where a
      // thumb naturally falls — up and left inside the zone — and push down-right:
      // the ring moves to the thumb, so full deflection finishes far from both
      // margins. With the old ring pinned to the corner the same input ended about
      // 47px from each edge, right on the system gesture strip.
      const landed = [cx - reach * 0.7, cy - reach * 0.7, 1];
      await touch("touchStart", [landed]);
      const home = (await reads()).home;
      assert(
        Math.abs(home.x + reach * 0.7) < 1 && Math.abs(home.y + reach * 0.7) < 1,
        "Neutral is wherever the thumb landed " + JSON.stringify(home),
      );
      const corner = [
        landed[0] + travel * 0.7071,
        landed[1] + travel * 0.7071,
        1,
      ];
      await touch("touchMove", [corner]);
      before = (await inspect()).player;
      await page.waitForTimeout(170);
      after = (await inspect()).player;
      assert(
        after.x - before.x > 3 && after.y - before.y > 3,
        "Down-right from a chosen neutral " +
          JSON.stringify({ before, after, home }),
      );
      assert(
        width - corner[0] > 70 && height - corner[1] > 70,
        "Full down-right leaves the thumb clear of both margins " +
          JSON.stringify({ corner, width, height }),
      );
      await touch("touchEnd", []);
      assert.deepEqual(
        (await reads()).home,
        { x: 0, y: 0 },
        "The ring eases home on release",
      );

      // ⛔ A BIGGER TERRITORY CANNOT EAT A DESTINATION. A press that never steers
      // is somebody pointing at the map, and it walks there like any other pixel.
      before = (await inspect()).player;
      await touch("touchStart", [[cx, cy, 1]]);
      await touch("touchEnd", []);
      await page.waitForTimeout(90);
      const walk = (await inspect()).travel;
      assert(
        walk.destination &&
          walk.destination.x > before.x &&
          walk.destination.y > before.y,
        "A tap on the stick's territory is a destination " +
          JSON.stringify({ before, walk }),
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
      // ⛔ TALKING RETIRES THE STICK, and it is the conversation doing it and not
      // the modality: the browser is still on touch and the attribute is untouched,
      // so what removes the control is the flag the dialogue puts on the root.
      async function tapWorld(point) {
        const s = await inspect(),
          r = await page.locator("#world-canvas").boundingBox();
        await page.touchscreen.tap(
          r.x + ((point.x - s.camera.x) * r.width) / s.view.width,
          r.y + ((point.y - s.camera.y) * r.height) / s.view.height,
        );
      }
      assert(await page.locator("#world-joystick").isVisible());
      await tapWorld({ x: 1000, y: 906 });
      await page.waitForFunction(() =>
        Boolean(window.MagikitosAdventure.inspect().dialogue),
      );
      const talking = await reads();
      assert.equal(talking.display, "none", "The stick goes while talking");
      assert.equal(talking.hidden, false, "…and the modality never touched it");
      assert.equal(talking.clearance, "0px", "…so nothing reserves its corner");
      const talkBox = await page.locator("#dialogue").boundingBox();
      assert(
        talkBox.y >= 0 && talkBox.y + talkBox.height <= height,
        "…and the conversation gets those pixels back",
      );
      await page.touchscreen.tap(width * 0.5, height * 0.25);
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().dialogue,
      );
      assert(
        await page.locator("#world-joystick").isVisible(),
        "…and it comes back when the conversation ends",
      );

      async function clickWorld(point) {
        const s = await inspect(),
          r = await page.locator("#world-canvas").boundingBox();
        await page.mouse.click(
          r.x + ((point.x - s.camera.x) * r.width) / s.view.width,
          r.y + ((point.y - s.camera.y) * r.height) / s.view.height,
        );
      }
      // ⛔ VOLVER AL DUENDE ES UN VIAJE, NO UN SALTO. Tocar el mapa para caminar
      // enciende el seguimiento y arranca las piernas en el MISMO gesto, así que con
      // la cámara clavada al duende el mundo se teletransportaba lo que hubieras
      // desplazado: cientos de píxeles en un frame. Ahora solo se clava cuando ya
      // está encima (CAMERA_LOCK), y el resto del camino lo hace suavizando.
      // Con el duende todavía andando de un paso anterior, la cámara se reengancha
      // sola mientras arrastras y no hay hueco que cerrar: la prueba aprobaría el
      // salto sin haberlo provocado. Se empieza desde un mundo quieto.
      await page.waitForFunction(
        () => {
          const s = window.MagikitosAdventure.inspect();
          return !s.travel.intent && s.pace === "idle";
        },
        null,
        { timeout: 10000 },
      );
      const camAntes = (await inspect()).camera;
      const lienzo = await page.locator("#world-canvas").boundingBox();
      await page.mouse.move(
        lienzo.x + lienzo.width * 0.5,
        lienzo.y + lienzo.height * 0.5,
      );
      await page.mouse.down();
      for (let i = 1; i <= 8; i++)
        await page.mouse.move(
          lienzo.x + lienzo.width * 0.5 - i * 22,
          lienzo.y + lienzo.height * 0.5 - i * 11,
        );
      await page.mouse.up();
      const camTrasArrastre = (await inspect()).camera;
      const desplazada = Math.hypot(
        camTrasArrastre.x - camAntes.x,
        camTrasArrastre.y - camAntes.y,
      );
      assert(desplazada > 60, "El mapa se ha desplazado de verdad: " + desplazada);
      assert(
        !(await inspect()).cameraFollowing,
        "…y desplazar suelta el seguimiento, que es lo que crea el hueco",
      );
      // Se mide FRAME A FRAME y no con una lectura suelta: con la cámara clavada, el
      // salto dura UN frame, así que una lectura desde fuera llega tarde y aprueba lo
      // que venía a denunciar (comprobado en negativo, restaurando el salto).
      await page.evaluate(() => {
        window.__cam = [];
        const paso = () => {
          const s = window.MagikitosAdventure.inspect();
          window.__cam.push([s.camera.x, s.camera.y]);
          if (window.__cam.length < 240) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      });
      const destino = (await inspect()).player;
      await clickWorld({ x: destino.x + 40, y: destino.y + 24 });
      await page.waitForTimeout(700);
      const vuelta = await page.evaluate(() => {
        let mayor = 0,
          total = 0;
        for (let i = 1; i < window.__cam.length; i++) {
          const d = Math.hypot(
            window.__cam[i][0] - window.__cam[i - 1][0],
            window.__cam[i][1] - window.__cam[i - 1][1],
          );
          mayor = Math.max(mayor, d);
          total += d;
        }
        return { mayor, total, muestras: window.__cam.length };
      });
      assert(
        vuelta.total > 40,
        "La cámara ha vuelto de verdad: " + JSON.stringify(vuelta),
      );
      // La relación es lo que distingue las dos cosas y no depende de la escala ni
      // del recorte del mapa: suavizando, el mayor paso es ~14% del recorrido;
      // clavándose, el primer frame se lo lleva casi entero.
      assert(
        vuelta.mayor < vuelta.total * 0.4,
        "…y vuelve suavizando, no de un salto: " +
          JSON.stringify({ desplazada, ...vuelta }),
      );
      await page.waitForFunction(
        () => {
          const s = window.MagikitosAdventure.inspect();
          return (
            Math.hypot(
              s.camera.x - (s.player.x - s.view.width / 2),
              s.camera.y - (s.player.y - s.view.height / 2),
            ) < 25
          );
        },
        null,
        { timeout: 4000 },
      );

      /**
       * ⛔ Y LA CÁMARA VA AL SITIO QUE HAS TOCADO, NO AL DUENDE (17-sep-2026, decisión del
       * dueño): «habría en realidad que llevar lentamente la cámara poniendo en el centro el
       * destino final seleccionado. Da igual que el duende esté en otro lado, ya llegará».
       *
       * Suavizar el regreso no bastaba: con el mapa desplazado, volver al duende sigue siendo un
       * barrido de cientos de píxeles en la dirección CONTRARIA a la que acabas de señalar, y eso
       * es lo que marea. Aquí se comprueba lo único que lo distingue de verdad: que el centro de
       * la cámara acaba en el destino y que en NINGÚN momento del viaje se acerca a donde estaba
       * el duende cuando tocaste.
       */
      await page.waitForFunction(
        () => {
          const s = window.MagikitosAdventure.inspect();
          return !s.travel.intent && s.pace === "idle";
        },
        null,
        { timeout: 10000 },
      );
      const partida = (await inspect()).player;
      await page.mouse.move(
        lienzo.x + lienzo.width * 0.5,
        lienzo.y + lienzo.height * 0.5,
      );
      await page.mouse.down();
      for (let i = 1; i <= 8; i++)
        await page.mouse.move(
          lienzo.x + lienzo.width * 0.5 - i * 20,
          lienzo.y + lienzo.height * 0.5 - i * 14,
        );
      await page.mouse.up();
      assert(!(await inspect()).cameraFollowing, "el mapa queda desplazado a mano");
      // El sitio no se escribe a mano: se prueban unos cuantos y vale el primero que de verdad
      // arranca un viaje, que es lo que sobrevive a que el dueño redibuje el bosque.
      let meta = null;
      for (const [dx, dy] of [[170, 100], [-170, 100], [170, -100], [-170, -100], [0, 190]]) {
        await clickWorld({ x: partida.x + dx, y: partida.y + dy });
        await page.waitForTimeout(60);
        const s = await inspect();
        if (s.cameraGoal) {
          meta = s.cameraGoal;
          break;
        }
      }
      assert(meta, "ningún destino de prueba arrancó un viaje");
      const viaje = await page.evaluate(
        ([partida, meta]) =>
          new Promise((listo) => {
            const muestras = [];
            const paso = () => {
              const s = window.MagikitosAdventure.inspect();
              const c = {
                x: s.camera.x + s.view.width / 2,
                y: s.camera.y + s.view.height / 2,
              };
              muestras.push({
                x: c.x,
                y: c.y,
                alDuende: Math.hypot(c.x - partida.x, c.y - partida.y),
                aLaMeta: Math.hypot(c.x - meta.x, c.y - meta.y),
                viajando: Boolean(s.cameraGoal),
              });
              if (muestras.length < 300 && (s.cameraGoal || muestras.length < 5))
                requestAnimationFrame(paso);
              else listo(muestras);
            };
            requestAnimationFrame(paso);
          }),
        [partida, meta],
      );
      const primera = viaje[0],
        ultima = viaje.at(-1);
      assert(
        ultima.aLaMeta < primera.aLaMeta * 0.35,
        "la cámara acaba mirando el destino: " + JSON.stringify({ primera, ultima }),
      );
      assert(
        Math.min(...viaje.map((m) => m.alDuende)) >= primera.alDuende - 30,
        "y no se va corriendo a por el duende por el camino: " +
          JSON.stringify({ inicio: primera.alDuende, minimo: Math.min(...viaje.map((m) => m.alDuende)) }),
      );
      let mayor = 0;
      for (let i = 1; i < viaje.length; i++)
        mayor = Math.max(mayor, Math.hypot(viaje[i].x - viaje[i - 1].x, viaje[i].y - viaje[i - 1].y));
      assert(
        mayor < primera.aLaMeta * 0.25,
        "y llega despacio, sin tirones: " + JSON.stringify({ mayor, recorrido: primera.aLaMeta }),
      );
      await page
        .waitForFunction(
          () => window.MagikitosAdventure.inspect().cameraGoal === null,
          null,
          { timeout: 12000 },
        )
        .catch(async (error) => {
          const s = await inspect();
          console.error(
            "  el viaje no termina:",
            JSON.stringify({ meta, player: s.player, travel: s.travel, pace: s.pace }),
          );
          throw error;
        });
      console.log(
        "  PASS cámara al destino: " +
          Math.round(primera.aLaMeta) +
          "px de viaje, mayor paso " +
          Math.round(mayor) +
          "px, sin acercarse al duende (mínimo " +
          Math.round(Math.min(...viaje.map((m) => m.alDuende))) +
          "px de donde estaba)",
      );
      // Y se vuelve al mundo con el que trabaja el resto del barrido: lo que sigue toca puntos
      // del mapa en coordenadas fijas y solo se puede tocar lo que se ve.
      await seed({ scene: "overworld", position: { x: 900, y: 900 } });

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
      await touch("touchStart", [[cx, cy, 1]]);
      await touch("touchMove", [[cx, cy - travel, 1]]);
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
        `PASS ${width}×${height}: floating eight-way stick (zone ${stick.width}px, travel ${travel}px, neutral free within ${reach.toFixed(0)}px), tap-through, talking retires it, camera returns easing (${vuelta.mayor.toFixed(0)}px el mayor paso de ${vuelta.total.toFixed(0)}), two-thumb running/rowing, cancel, center recenter, dialogue click-through, wheel/pinch full map coverage; run ${normal.toFixed(0)}→${fast.toFixed(0)}, row ${rowNormal.toFixed(0)}→${rowFast.toFixed(0)} px.`,
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
