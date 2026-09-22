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
        if (url.pathname !== "/bosque/explorar") return route.continue();
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
      await page.goto(origin + "/bosque/explorar");
      await ready();
      /**
       * ⛔ EL MANDO ES UN JOYSTICK INVISIBLE QUE NACE DONDE APOYAS EL DEDO (19-sep-2026, decisión
       * del dueño, la tercera del día). Por la mañana se fue el joystick fijo («es una mierda, no me
       * gusta nada, ni el botón de turbo»); a mediodía, arrastrar el mapa al centro («no permite
       * navegación continua»); por la tarde, probado en producción, guiar hacia el dedo («con nada
       * que me alejo ya se pone a correr», «para ir arriba el dedo tiene que estar muy arriba»).
       *
       * Se prueba lo que se ve: un dedo quieto no manda; moverlo manda al duende en esa dirección
       * como una tecla, sin destino; un poco anda y en el borde corre; el origen sigue al dedo, así
       * que volver hacia atrás es virar sin levantar; soltar para; la cámara es del duende; el aro
       * se pinta mientras el dedo manda; y dos dedos mueven la cámara sin dar órdenes.
       */
      assert.equal(await page.locator("#world-joystick").count(), 0, "El joystick fijo ya no existe");
      assert.equal(await page.locator("#world-boost").count(), 0, "Ni su botón de turbo");
      const cdp = await page.context().newCDPSession(page);
      const touch = (type, points) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: points.map(([x, y, id]) => ({ x, y, id })),
        });
      const lejos = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      // El dedo se apoya donde le viene bien al pulgar —abajo, a un lado— y desde ahí se mueve.
      let dedo = [Math.round(width * 0.3), Math.round(height * 0.72)];
      const apoyar = () => touch("touchStart", [[dedo[0], dedo[1], 1]]);
      const mover = async (dx, dy, pasos = 6) => {
        for (let i = 1; i <= pasos; i++)
          await touch("touchMove", [
            [Math.round(dedo[0] + (dx * i) / pasos), Math.round(dedo[1] + (dy * i) / pasos), 1],
          ]);
        dedo = [dedo[0] + dx, dedo[1] + dy];
      };
      const soltar = () => touch("touchEnd", []);
      const quieto = () =>
        page.waitForFunction(
          () => {
            const s = window.MagikitosAdventure.inspect();
            return s.pace === "idle" && !s.travel.intent;
          },
          null,
          { timeout: 15000 },
        );

      // 1. Apoyar sin mover no manda nada, dure lo que dure.
      let antes = await inspect();
      await apoyar();
      await page.waitForTimeout(400);
      let ahora = await inspect();
      assert(!ahora.gesture.steering && ahora.pace === "idle", "Un dedo quieto no manda");
      assert(lejos(ahora.player, antes.player) < 1, "…ni mueve al duende");

      // 2. Moverlo un poco a la izquierda: se anda a la izquierda, sin destino, con la cámara pegada.
      await mover(-50, 0);
      await page.waitForTimeout(260);
      ahora = await inspect();
      assert(ahora.gesture.steering, "Mover el dedo es mandar");
      assert(ahora.gesture.intent && ahora.gesture.intent.x < -0.9, "…hacia la izquierda " + JSON.stringify(ahora.gesture.intent));
      assert(
        ahora.player.x < antes.player.x - 6,
        "…y el duende anda hacia allí " + JSON.stringify({ antes: antes.player, ahora: ahora.player }),
      );
      assert(!ahora.travel.intent, "…sin destino: es una tecla, no un viaje");
      assert.equal(ahora.pace, "walk", "Un poco es andar");
      assert(ahora.cameraFollowing, "La cámara es del duende");
      assert(ahora.gesture.hint, "…y el aro del mando se pinta mientras el dedo manda");

      // 3. En el borde del aro TAMBIÉN se anda: el dedo no corre nunca (correr es Espacio o el toque lejano).
      await mover(-70, 0);
      await page.waitForTimeout(200);
      const corriendo = await inspect();
      assert(corriendo.gesture.steering && corriendo.gesture.intent.x < -0.9, "En el borde del aro se sigue mandando");
      assert.equal(corriendo.pace, "walk", "…y se anda, no se corre");
      assert(!("running" in corriendo.gesture), "El mando no tiene marcha que inspeccionar");

      // 4. El origen ha seguido al dedo: volver 150 px a la derecha, sin levantar, ya es ir a la derecha.
      await mover(150, 0);
      await page.waitForTimeout(260);
      const virada = await inspect();
      assert(virada.gesture.intent && virada.gesture.intent.x > 0.9, "Volver hacia atrás vira sin levantar " + JSON.stringify(virada.gesture.intent));
      assert(virada.player.x > corriendo.player.x + 6, "…y el duende va ahora a la derecha");
      assert.equal(virada.pace, "walk", "…andando, como siempre con el dedo");

      // 5. Soltar para, como soltar una tecla.
      await soltar();
      await page.waitForTimeout(150);
      const parado = await inspect();
      assert(!parado.gesture.steering && parado.pace === "idle" && !parado.travel.intent, "Soltar para");
      assert(parado.cameraFollowing, "…y la cámara sigue siendo del duende");
      await page.waitForTimeout(200);
      assert(lejos((await inspect()).player, parado.player) < 1, "…parado de verdad");

      // 6. El aro se pinta SIEMPRE que el dedo manda y se apaga al soltar (decisión del dueño:
      //    «que siempre salga, solo ligeramente más transparentito»). Aquí vivió un contador que lo
      //    retiraba tras seis segundos andados, y se fue el mismo día.
      await apoyar();
      await mover(50, 0);
      await page.waitForTimeout(200);
      assert((await inspect()).gesture.hint, "Mandando, el aro está");
      await soltar();
      await page.waitForTimeout(100);
      assert(!(await inspect()).gesture.hint, "Soltando, el aro se va");
      await quieto();

      // 7. Dos dedos hacen ZOOM y nada más (decisión del dueño: «dejaría solo el zoom»): la cámara
      //    sigue siendo del duende, no se desplaza aunque los dedos viajen, y no hay disco de recentrar.
      const antesDelPellizco = await inspect();
      const par = (k, shift = 0) => {
        const cx = Math.round(width * 0.5) - shift,
          cy = Math.round(height * 0.45),
          d = 120 - k * 10;
        return [
          [cx - d, cy, 1],
          [cx + d, cy, 2],
        ];
      };
      await touch("touchStart", par(0));
      for (let k = 1; k <= 8; k++) await touch("touchMove", par(k));
      // El último paso del pellizco se aplica en el fotograma siguiente: se deja asentar antes de
      // leer la cámara, o el «desplazamiento» que se mide después es solo el zoom terminando.
      await page.waitForTimeout(150);
      const pellizco = await inspect();
      assert(
        pellizco.scale < antesDelPellizco.scale,
        "Juntar los dedos aleja el zoom " + JSON.stringify({ antes: antesDelPellizco.scale, ahora: pellizco.scale }),
      );
      assert(pellizco.cameraFollowing && !pellizco.gesture.panning && !pellizco.gesture.steering, "…y la cámara sigue siendo del duende");
      assert(await page.locator("#world-recenter").isHidden(), "…sin disco de recentrar");
      const camaraA = pellizco.camera;
      // Los dedos viajan a la MISMA distancia, sin salirse de la pantalla: un dedo fuera del borde
      // lo recorta el navegador y eso sí cambia la distancia (o sea, el zoom), que no es lo que se mide.
      const paso = Math.min(30, (Math.round(width * 0.5) - 40 - 12) / 6);
      for (let k = 1; k <= 6; k++) await touch("touchMove", par(8, k * paso));
      await page.waitForTimeout(150);
      const camaraB = (await inspect()).camera;
      assert(lejos(camaraA, camaraB) < 1, "Arrastrar con dos dedos no mueve la cámara " + JSON.stringify({ camaraA, camaraB }));
      assert.equal((await inspect()).pace, "idle", "…ni al duende");
      await touch("touchEnd", []);
      await quieto();
      // Y el zoom máximo nunca enseña más allá del plano: la vista cabe en la caja del bosque.
      const alejado = await inspect();
      assert(
        alejado.frame &&
          alejado.view.width <= alejado.frame.w * 16 + 1e-6 &&
          alejado.view.height <= alejado.frame.h * 16 + 1e-6,
        "Alejar del todo sigue cabiendo dentro del plano",
      );

      await seed({ scene: "overworld", position: { x: 900, y: 900 } });
      /**
       * ⛔ HABLAR RETIRA EL MANDO, y lo retira la CONVERSACIÓN. Lo que se aparta hoy es el disco
       * de recentrar y el hueco que tiene reservado: hablando no hay nada que recentrar, así que
       * reservarle sitio le cuesta al panel su propia altura sin que haya nada debajo.
       */
      async function tapWorld(point) {
        const s = await inspect(),
          r = await page.locator("#world-canvas").boundingBox();
        await page.touchscreen.tap(
          r.x + ((point.x - s.camera.x) * r.width) / s.view.width,
          r.y + ((point.y - s.camera.y) * r.height) / s.view.height,
        );
      }
      const holgura = () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--world-control-clearance")
            .trim(),
        );
      assert.equal(await holgura(), "46px", "La esquina reserva lo que mide recentrar");
      await tapWorld({ x: 1000, y: 906 });
      await page.waitForFunction(() =>
        Boolean(window.MagikitosAdventure.inspect().dialogue),
      );
      assert.equal(await holgura(), "0px", "Hablando no se reserva esa esquina");
      assert(await page.locator("#world-recenter").isHidden(), "…y no hay nada que recentrar");
      const talkBox = await page.locator("#dialogue").boundingBox();
      assert(
        talkBox.y >= 0 && talkBox.y + talkBox.height <= height,
        "…and the conversation gets those pixels back",
      );
      await page.touchscreen.tap(width * 0.5, height * 0.25);
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().dialogue,
      );
      assert.equal(await holgura(), "46px", "…y la esquina vuelve al acabar");

      async function clickWorld(point) {
        const s = await inspect(),
          r = await page.locator("#world-canvas").boundingBox();
        await page.mouse.click(
          r.x + ((point.x - s.camera.x) * r.width) / s.view.width,
          r.y + ((point.y - s.camera.y) * r.height) / s.view.height,
        );
      }
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
      const before = frame.player;
      await clickWorld(target);
      assert.equal((await inspect()).dialogue, null);
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().travel.intent,
      );
      const after = (await inspect()).player;
      assert(
        Math.hypot(after.x - before.x, after.y - before.y) < 0.01,
        "Outside click closes dialogue without walking " +
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
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `.local/controls-review/zoom-${width}.png`,
      });

      /**
       * REMAR: el turbo es la BARRA ESPACIADORA y nada más. El botón de dos pulgares se fue con el
       * joystick, así que lo que queda es lo que siempre funcionó en un teclado y ahora es lo
       * único: flechas para remar, espacio para remar fuerte.
       */
      await seed({
        scene: "river-willows",
        position: { x: 1792, y: 96 },
        inventory: { boat: 1 },
        navigation: { mode: "boat", direction: "down" },
      });
      const remaEn = async (turbo) => {
        await page.locator("#world-canvas").focus();
        if (turbo) await page.keyboard.down(" ");
        await page.keyboard.down("ArrowDown");
        const desde = (await inspect()).player;
        await page.waitForTimeout(420);
        const hasta = (await inspect()).player;
        await page.keyboard.up("ArrowDown");
        if (turbo) await page.keyboard.up(" ");
        await page.waitForTimeout(120);
        return Math.hypot(hasta.x - desde.x, hasta.y - desde.y);
      };
      const rowNormal = await remaEn(false);
      await seed({
        scene: "river-willows",
        position: { x: 1792, y: 96 },
        inventory: { boat: 1 },
        navigation: { mode: "boat", direction: "down" },
      });
      const rowFast = await remaEn(true);
      assert(
        rowFast > rowNormal * 1.5,
        "Con espacio se rema claramente más fuerte " + rowNormal + " / " + rowFast,
      );

      /**
       * ⛔ Y UN DEDO PUESTO CRUZA LA COSTURA DEL RÍO. El mando es un vector, como una tecla pulsada,
       * y al cambiar de pantalla sigue leyéndose, así que la barca sigue subiendo: sin esto, cruzar
       * te dejaba parado en mitad del agua con el dedo todavía puesto.
       */
      await seed({
        scene: "river-willows",
        position: { x: 1792, y: 48 },
        inventory: { boat: 1 },
        navigation: { mode: "boat", direction: "up" },
      });
      // El dedo se apoya donde sea y sube sesenta píxeles: remar río arriba, andando. Y ahí se
      // queda: cruzar no lo suelta.
      await touch("touchStart", [[Math.round(width / 2), Math.round(height * 0.6), 1]]);
      for (let i = 1; i <= 6; i++)
        await touch("touchMove", [[Math.round(width / 2), Math.round(height * 0.6) - i * 10, 1]]);
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().scene === "river-rapids",
        null,
        { timeout: 15000 },
      );
      const antesDeLaCostura = (await inspect()).player;
      await page.waitForTimeout(350);
      const trasLaCostura = (await inspect()).player;
      assert(
        Math.hypot(trasLaCostura.x - antesDeLaCostura.x, trasLaCostura.y - antesDeLaCostura.y) > 4,
        "El dedo puesto sigue llevando la barca después de la costura",
      );
      await touch("touchEnd", []);
      await cdp.detach();
      await page.close();
      console.log(
        `PASS ${width}×${height}: joystick invisible (nace bajo el dedo, anda, el origen sigue al dedo, soltar para, aro mientras manda), dos dedos solo hacen zoom, sin joystick fijo ni turbo en el DOM, hablar retira la esquina, la cámara viaja al sitio tocado sin acercarse al duende, clic fuera solo cierra el diálogo, rueda/pellizco cubriendo el mapa entero y remo ${rowNormal.toFixed(0)}→${rowFast.toFixed(0)} px con espacio.`,
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
