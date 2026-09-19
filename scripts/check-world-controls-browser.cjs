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
      /**
       * ⛔ EL MANDO ES EL MAPA (19-sep-2026, decisión del dueño: «el joystick táctil es una
       * mierda, no me gusta nada, ni el botón de turbo… mientras movemos la cámara con el drag,
       * el protagonista siempre debe caminar hacia el centro»).
       *
       * Aquí vivían trescientas líneas de geometría de aro flotante, sectores, zona muerta,
       * turbo a dos pulgares y la detección de qué tienes en la mano. Lo que hay ahora es un
       * gesto que ya existía —arrastrar para mirar— haciendo además de mando, así que se prueba
       * lo que se ve: el destino es el centro, se anda hacia él, lejos se corre y soltar no para.
       */
      assert.equal(await page.locator("#world-joystick").count(), 0, "El joystick ya no existe");
      assert.equal(await page.locator("#world-boost").count(), 0, "Ni su botón de turbo");
      const cdp = await page.context().newCDPSession(page);
      const touch = (type, points) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: points.map(([x, y, id]) => ({ x, y, id })),
        });
      // El arrastre empieza donde quepa entero: se mide en píxeles de PANTALLA y el hueco que abre
      // en el mundo depende del zoom, así que los sitios se eligen para que el gesto no se salga.
      const arrastra = async (dx, dy, pasos = 10) => {
        const x0 = dx < 0 ? width * 0.82 : width * 0.18,
          y0 = dy < 0 ? height * 0.78 : height * 0.18;
        await touch("touchStart", [[x0, y0, 1]]);
        for (let i = 1; i <= pasos; i++)
          await touch("touchMove", [[x0 + (dx * i) / pasos, y0 + (dy * i) / pasos, 1]]);
        return [x0 + dx, y0 + dy, 1];
      };
      const largo = Math.min(240, Math.round(width * 0.6));
      const lejos = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

      // 1. Arrastrar pone destino, y el destino es el CENTRO de lo que estás mirando.
      let antes = (await inspect()).player;
      await arrastra(-largo, 0, 12);
      let ahora = await inspect();
      const centro = {
        x: ahora.camera.x + ahora.view.width / 2,
        y: ahora.camera.y + ahora.view.height / 2,
      };
      assert(ahora.travel.destination, "Arrastrar el mapa pone un destino");
      assert(
        lejos(ahora.travel.destination, centro) < 48,
        "…y el destino es el centro de la vista " +
          JSON.stringify({ destino: ahora.travel.destination, centro }),
      );
      assert.equal(ahora.travel.intent, "ground", "…que es un sitio, no una interacción");

      // 2. Y el duende ANDA hacia allí mientras el dedo sigue puesto.
      await page.waitForTimeout(260);
      let andando = (await inspect()).player;
      assert(
        lejos(andando, antes) > 6,
        "El duende camina mientras arrastras " + JSON.stringify({ antes, andando }),
      );

      // 3. Lejos se CORRE. La marcha la decide la distancia del camino, no un botón.
      const marcha = await inspect();
      assert.equal(
        marcha.pace,
        "run",
        "Un arrastre largo es correr " +
          JSON.stringify({ arrastre: largo, resto: marcha.travel.remaining }),
      );

      // 4. Soltar no para: el destino era el último centro y se llega solo.
      await touch("touchEnd", []);
      antes = (await inspect()).player;
      await page.waitForTimeout(260);
      andando = (await inspect()).player;
      assert(
        lejos(andando, antes) > 6,
        "Levantar el dedo no frena: el viaje sigue hasta el sitio",
      );

      // 5. Un arrastre cortito es andar, no correr: la marcha sigue al hueco que abres.
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().pace === "idle");
      await arrastra(-40, 0, 4);
      await page.waitForTimeout(160);
      const suave = await inspect();
      assert.equal(
        suave.pace,
        "walk",
        "Un empujoncito es andar " + JSON.stringify({ resto: suave.travel.remaining }),
      );
      await touch("touchEnd", []);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().pace === "idle");

      // 6. Y la cámara es del dedo mientras arrastra: andar no puede tirar de ella.
      const quieto = await arrastra(largo, 0, 8);
      /**
       * Los toques de CDP y `evaluate` llegan al renderizador por caminos distintos, así que leer
       * la cámara justo después del último `touchMove` puede pillarla con un tramo del arrastre sin
       * aplicar y contarlo luego como deriva. Se espera a que el paneo se asiente, y ahí empieza la
       * medida: con el dedo quieto, la cámara no puede moverse ni un píxel.
       */
      const camaraA = await (async () => {
        let previa = null;
        for (let i = 0; i < 20; i++) {
          const c = (await inspect()).camera;
          if (previa && lejos(previa, c) < 0.5) return c;
          previa = c;
          await page.waitForTimeout(60);
        }
        return previa;
      })();
      await page.waitForTimeout(200);
      // El dedo NO se mueve: cualquier desplazamiento de aquí sería la cámara yéndose sola.
      await touch("touchMove", [quieto]);
      const camaraB = (await inspect()).camera;
      assert(
        lejos(camaraA, camaraB) < 1,
        "Con el dedo puesto, la cámara no se va sola " + JSON.stringify({ camaraA, camaraB }),
      );

      /**
       * ⛔ RECENTRAR SOLO VIVE MIENTRAS LA CÁMARA ES TUYA, y eso lo cambió el mapa-mando: soltar
       * el dedo ya devuelve la cámara sola, porque el viaje la vuelve a enganchar. Así que el
       * disco dejó de ser «deshacer el paneo» y es la salida mientras lo estás haciendo —o cuando
       * el sitio que señalaste no tenía camino y el duende se quedó donde pudo—. Se comprueba con
       * el dedo puesto, que es el único estado en el que de verdad hace falta.
       */
      const recenter = page.locator("#world-recenter");
      assert(await recenter.isVisible(), "Con el dedo en el mapa, el disco de volver está ahí");
      const rect = await recenter.boundingBox();
      assert(
        rect.x + rect.width <= width && rect.y + rect.height <= height,
        "El disco de recentrar cabe entero en la esquina de abajo a la derecha",
      );
      await recenter.click();
      assert((await inspect()).cameraFollowing);
      assert(await recenter.isHidden());
      await touch("touchEnd", []);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().pace === "idle");
      // Y al soltar, la cámara vuelve SOLA: el viaje la reengancha sin tocar nada.
      assert((await inspect()).cameraFollowing, "Soltar deja la cámara siguiendo al duende");

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
        position: { x: 768, y: 96 },
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
        position: { x: 768, y: 96 },
        inventory: { boat: 1 },
        navigation: { mode: "boat", direction: "down" },
      });
      const rowFast = await remaEn(true);
      assert(
        rowFast > rowNormal * 1.5,
        "Con espacio se rema claramente más fuerte " + rowNormal + " / " + rowFast,
      );

      /**
       * ⛔ Y UN ARRASTRE SOSTENIDO CRUZA LA COSTURA DEL RÍO. El destino es el centro de lo que
       * miras, así que al cambiar de pantalla el gesto sigue vivo y la barca sigue subiendo: sin
       * esto, cruzar te dejaba parado en mitad del agua con el dedo todavía puesto.
       */
      await seed({
        scene: "river-willows",
        position: { x: 768, y: 48 },
        inventory: { boat: 1 },
        navigation: { mode: "boat", direction: "up" },
      });
      // La brazada se mide en pantalla y tiene que cubrir lo que hay del centro de la vista al
      // borde del mapa: la cámara se para ahí, así que lo último que empuja hacia la costura es el
      // destino, no la vista. Media pantalla sobra en las cuatro formas.
      await arrastra(0, Math.round(height * 0.55), 16);
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
        "El arrastre sostenido sigue llevando la barca después de la costura",
      );
      await touch("touchEnd", []);
      await cdp.detach();
      await page.close();
      console.log(
        `PASS ${width}×${height}: el mapa es el mando (destino al centro, anda/corre por distancia, soltar no para, la cámara es del dedo), sin joystick ni turbo en el DOM, hablar retira la esquina, la cámara vuelve suavizando (${vuelta.mayor.toFixed(0)}px el mayor paso de ${vuelta.total.toFixed(0)}), recentrar, clic a través del diálogo, rueda/pellizco cubriendo el mapa entero y remo ${rowNormal.toFixed(0)}→${rowFast.toFixed(0)} px con espacio.`,
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
