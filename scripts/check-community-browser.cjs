"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const { chromium, request } = require("playwright");
const {
  catalogGround,
} = require("../public/assets/js/adventure/construction-ground");
const { freeSpot } = require("./community-spot.cjs");
/**
 * ⛔ CONTRA DONDE DE VERDAD SE PRUEBA. Nació atado a DDEV; hoy el desarrollo vive en el clon del
 * VPS, así que el origen y la forma de sembrar la identidad de prueba se declaran por entorno y
 * DDEV sigue siendo el valor por defecto. `GAME_WEB_FIXTURE` es la orden que llama al sembrador
 * (por ejemplo, un `ssh … php scripts/community-browser-fixture.php`), y el guardián de ese
 * fichero sigue negándose a sembrar fuera de una base `*_dev`.
 */
const web = process.env.GAME_WEB_REPO || path.resolve("..", "magikitos"),
  origin = process.env.GAME_WEB_ORIGIN || "https://magikitos.ddev.site";
const fixture = (...args) =>
  process.env.GAME_WEB_FIXTURE
    ? execFileSync(
        "/bin/sh",
        ["-c", process.env.GAME_WEB_FIXTURE + " " + args.join(" ")],
        { encoding: "utf8" },
      )
    : execFileSync(
        "ddev",
        ["exec", "php", "scripts/community-browser-fixture.php", ...args],
        { cwd: web, encoding: "utf8" },
      );
// La zona sale de la PANTALLA en la que entra esta prueba, no de un nombre escrito a mano ni del
// primero del catálogo: desde que el bosque entero se construye hay una zona por pantalla, así que
// «la primera» dejó de significar «donde estoy».
const SCENE = "river-willows";
const ZONE = Object.entries(
  JSON.parse(fs.readFileSync(".local/build/world.json")).construction.zones,
).find(([, z]) => z.scene === SCENE)[0];
(async () => {
  const users = [],
    browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [];
  fs.mkdirSync(".local/community-review", { recursive: true });
  const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
  try {
    const identity = JSON.parse(fixture("create"));
    users.push(identity.id);
    const http = await request.newContext({
      baseURL: origin,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Authorization: "Bearer " + identity.token,
        Origin: origin,
      },
    });
    async function action(scene, entity, action = "interact") {
      const a = await (await http.get("/api/world/game-account")).json();
      const r = await http.post("/api/world/game-action", {
          data: {
            operationId: crypto.randomUUID().replaceAll("-", ""),
            baseRevision: a.account.revision,
            scene,
            entity,
            action,
          },
        }),
        data = await r.json();
      assert.equal(r.status(), 200, JSON.stringify({ entity, data }));
      return data.account;
    }
    for (const node of world.scenes.overworld.entities.filter(
      (e) => e.resource?.region === "overworld",
    ))
      await action("overworld", node.id);
    for (const id of ["picnic-knife", "picnic-lighter", "forest-mushrooms-fern", "woodland-rake", "woodland-grass-seeds"])
      await action("overworld", id);
    await action("overworld", "picnic-barbecue", "light");
    await action("overworld", "picnic-barbecue", "cook");
    await action("overworld", "picnic-bin");
    await action("overworld", "picnic-neighbor", "give");
    await action("overworld", "river-dock", "craft");
    // Los palitos del prado: una vallita se cobra por celda, así que hace falta más de uno.
    for (const id of ["bank-twig-0", "bank-twig-6"])
      await action("river-willows", id);
    const account = await action("human-hedge", "cat-water-bowl");
    assert.equal(account.inventory.oars, 1);
    // Los setines son reputación y se ganan en la web: el bosque no acuña ni uno, así que un
    // recorrido entero de recogida y cocina deja el monedero exactamente donde estaba.
    assert.equal(account.setines, 0);
    assert(
      account.inventory.twig >= 4,
      "Enough twigs for the shortest fence the house allows: " + account.inventory.twig,
    );
    let paso = 0;
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ])
      // Un trazado que se levanta, un trazado que se pinta y una pieza suelta: las tres formas
      // de dejar algo en el claro pasan por la misma caja.
      for (const kind of ["twig-fence", "forest-path", "bowl-pool"]) {
        /**
         * ⛔ EL SERVIDOR ADMITE DOCE ESCRITURAS POR MINUTO Y PERSONA, y este recorrido hace DOS
         * por vuelta (colocar y quitar). Con dos piezas cabía justo; con tres se pasaba y el
         * 429 llegaba disfrazado de «el botón no hace nada». El límite es correcto y la prueba
         * lo respeta en vez de pelearse con él: once segundos entre vueltas dejan el ritmo en
         * menos de doce por minuto.
         */
        if (paso++) await new Promise((r) => setTimeout(r, 11000));
        const respuestas = [];
        const page = await browser.newPage({
          viewport: { width, height },
          hasTouch: true,
          isMobile: width < 800,
          ignoreHTTPSErrors: true,
        });
        page.setDefaultTimeout(15000);
        page.on("pageerror", (e) => errors.push(e.message));
        // Nada sale de la máquina: solo el sitio que se está probando, sea DDEV o el clon.
        const allowed = new URL(origin).host;
        await page.route("**/*", (r) =>
          new URL(r.request().url()).host === allowed ? r.continue() : r.abort(),
        );
        await page.addInitScript(
          ({ token, account, seed }) => {
            localStorage.setItem("magikitos_session", token);
            // Only the first browser establishes this fixture's new cloud save. Subsequent
            // fresh contexts must load that save, not fabricate a competing unowned local one.
            if (seed && !localStorage.getItem("magikitos.adventure"))
              localStorage.setItem(
                "magikitos.adventure",
                JSON.stringify({
                  scene: "river-willows",
                  position: { x: 92 * 16, y: 95 * 16 },
                  flags: account.progress.flags,
                  inventory: account.inventory,
                  muted: true,
                  resources: account.resources,
                  wallet: {
                    balance: account.setines,
                    claimed: account.progress.rewards,
                  },
                }),
              );
          },
          { token: identity.token, account, seed: paso === 1 },
        );
        // Lo que contesta la autoridad, guardado por si algo no se aplica: el motivo real de un
        // rechazo vive en su respuesta, no en el aviso que la persona acaba viendo.
        page.on("response", async (r) => {
          if (!r.url().includes("/api/world/community-build")) return;
          respuestas.push({ status: r.status(), cuerpo: await r.text().catch(() => "") });
        });
        await page.goto(origin + "/aventura");
        await require("./browser-entry.cjs").enterWorld(page);
        await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.role === "player");
        // ⛔ EL CATÁLOGO SE ABRE DESDE EL ICONO DE ARRIBA, junto al saco, y elegir una cosa lo
        // CIERRA: mientras el panel está delante no hay mapa que tocar, así que la prueba espera
        // a que se cierre antes de buscar ningún hueco.
        const elegir = async (nombre) => {
          await page.locator("#build-toggle").click();
          await page.waitForFunction(() => document.getElementById("build-dialog").open);
          await page
            .locator("#home-palette button")
            .filter({ hasText: nombre })
            .first()
            .click();
          await page.waitForFunction(
            () => window.MagikitosAdventure.inspect().community.editing
              && !document.getElementById("build-dialog").open,
          );
        };
        await elegir({
          "twig-fence": "Vallita de ramitas",
          "forest-path": "Caminito de tierra",
          "bowl-pool": "Piscinita deluxe",
        }[kind]);
        const snapshot = await (
          await http.get("/api/world/community?zone=" + ZONE)
        ).json();
        // El hueco se busca contra el bosque que hay AHORA mismo (lo que acaba de contestar el
        // servidor) y con la misma máscara de suelo que calcula el navegador, que es de donde
        // sale el fantasma. Y el fantasma se llama igual que allí: la pieza candidata es a la
        // única que miran las reglas de permiso.
        const shape = world.construction.definitions[kind].shape;
        const ghost = freeSpot({
          catalog: world.construction,
          zone: ZONE,
          ground: catalogGround(world, SCENE),
          others: snapshot.objects,
          make: (x, y) => ({
            id: "nueva",
            kind,
            variant: world.construction.definitions[kind].variants[0].id,
            rotation: 0,
            x,
            y,
            ...(shape === "polyline" ? { points: [[0, 0], [2, 0]] } : {}),
          }),
        });
        assert(ghost, "At least one legal plot position");
        const point = { x: ghost.x, y: ghost.y };
        const inspect = () =>
          page.evaluate(() => window.MagikitosAdventure.inspect());
        let s = await inspect();
        const c = await page.context().newCDPSession(page),
          cy = height * 0.4;
        const uiBefore = await page.locator("#home-save").boundingBox();
        await c.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { x: 80, y: cy, id: 1 },
            { x: width - 80, y: cy, id: 2 },
          ],
        });
        await c.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            { x: 110, y: cy, id: 1 },
            { x: width - 110, y: cy, id: 2 },
          ],
        });
        await c.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await c.detach();
        assert.equal(
          await page.evaluate(() => visualViewport.scale),
          1,
          "Pinch never scales browser UI",
        );
        const uiAfter = await page.locator("#home-save").boundingBox();
        assert(Math.abs(uiAfter.width - uiBefore.width) < 1);
        // Mobile panning remains available while placing. Bring the legal point into view.
        s = await inspect();
        const box = await page.locator("#world-canvas").boundingBox();
        let sx =
            box.x + ((point.x * 16 - s.camera.x) * box.width) / s.view.width,
          sy =
            box.y + ((point.y * 16 - s.camera.y) * box.height) / s.view.height;
        if (sx < 30 || sx > width - 30 || sy < 90 || sy > height * 0.55) {
          await page.mouse.move(width * 0.5, height * 0.35);
          await page.mouse.down();
          await page.mouse.move(
            width * 0.5 + (width * 0.5 - sx),
            height * 0.35 + (height * 0.35 - sy),
            { steps: 8 },
          );
          await page.mouse.up();
          s = await inspect();
          sx = box.x + ((point.x * 16 - s.camera.x) * box.width) / s.view.width;
          sy =
            box.y + ((point.y * 16 - s.camera.y) * box.height) / s.view.height;
        }
        // Las coordenadas de pantalla de un punto del mundo, con la cámara de AHORA.
        const enPantalla = async (p) => {
          const v = await inspect();
          return {
            x: box.x + ((p.x * 16 - v.camera.x) * box.width) / v.view.width,
            y: box.y + ((p.y * 16 - v.camera.y) * box.height) / v.view.height,
          };
        };
        const fantasma = () =>
          page.evaluate(() => window.MagikitosAdventure.inspect().community.ghost);
        /**
         * ⛔ LA PIEZA NACE SIN APUNTAR (18-sep-2026): elegirla no la clava en ninguna parte y no
         * hay nada que confirmar hasta que tocas el mapa. Se comprueba por `parked` y no por sus
         * coordenadas, y la diferencia es real: con el ratón ya encima del mapa el previo aparece
         * bajo el cursor en cuanto la caja se cierra —eso es apuntar, no colocar—, mientras que
         * con el dedo no hay «encima» y no aparece hasta el primer toque.
         */
        const recien = await page.evaluate(
          () => window.MagikitosAdventure.inspect().community,
        );
        assert(!recien.parked, "Choosing a piece does not park it anywhere");
        assert(await page.locator("#home-save").isDisabled(), "…so there is nothing to confirm yet");
        await page.touchscreen.tap(sx, sy);
        if (world.construction.definitions[kind].shape === "polyline") {
          /**
           * ⛔ UN TRAZADO SE CLAVA A TOQUES, Y ARRASTRAR SIGUE MOVIENDO EL MAPA. Aquí vivió una
           * máquina de dejar-pulsado-y-arrastrar, y el cartel que la explicaba era mentira: con
           * la valla en la mano, la mitad de los arrastres acababan siendo un trazo que nadie
           * había pedido. Ahora los dos gestos no se pueden pisar, porque no comparten nada.
           */
          const postes = async () => (await fantasma()).points.length;
          assert.equal(await postes(), 1, "The first tap plants one post, not a trace");
          assert(
            await page.locator("#home-save").isDisabled(),
            "…and one post is not something you can place yet",
          );
          if (kind === "twig-fence") {
            const antes = (await inspect()).camera;
            await page.mouse.move(width * 0.5, height * 0.3);
            await page.mouse.down();
            await page.mouse.move(width * 0.5 - 60, height * 0.3, { steps: 6 });
            await page.mouse.up();
            const movido = (await inspect()).camera;
            assert(
              Math.abs(movido.x - antes.x) > 20,
              "A drag still moves the map while a trace is in hand",
            );
            assert.equal(await postes(), 1, "…and plants nothing");
          }
          // Segundo poste, donde acaba el trazo que el buscador de huecos dio por legal.
          const uno = await fantasma();
          const dos = await enPantalla({ x: uno.x + 2, y: uno.y });
          await page.touchscreen.tap(dos.x, dos.y);
          assert.equal(await postes(), 2, "The second tap is the trace");
          if (kind === "twig-fence") {
            // Y se quita y se vuelve a poner, que para eso está el botón.
            await page.locator("#build-undo").click();
            assert.equal(await postes(), 1, "Taking the last post out leaves the first");
            await page.touchscreen.tap(dos.x, dos.y);
            assert.equal(await postes(), 2, "…and it can be planted again");
          }
          // Mide lo que el buscador de huecos bendijo, ni media celda más: un trazado se cobra
          // POR CELDA y esta cuenta lleva los palitos justos.
          assert.deepEqual(
            (await fantasma()).points,
            [[0, 0], [2, 0]],
            "The two posts are exactly the trace the free-spot search blessed",
          );
        }
        // Puesta en un sitio legal y sin que nada se queje. Si no llega, la prueba dice QUÉ tenía
        // en la mano: una espera agotada a secas no distingue «no se ha colocado» de «se ha
        // colocado donde no cabe».
        await page
          .waitForFunction(() => {
            const s = window.MagikitosAdventure.inspect();
            return s.community.ghost && s.community.ghost.x !== null && !s.community.invalid;
          })
          .catch(async (error) => {
            const dicho = await page.evaluate(() => window.MagikitosAdventure.inspect().community);
            throw Error(
              "Apuntar " + kind + " a " + width + ": " + JSON.stringify(dicho) +
                " (esperado " + JSON.stringify(point) + ") " + error.message,
            );
          });
        await page.screenshot({
          path: `.local/community-review/placement-${kind}-${width}.png`,
        });
        const puestas = (
          await page.evaluate(() => window.MagikitosAdventure.inspect().community.objects)
        ).length;
        // Y Colocar tiene que estar ENCENDIDO. Si no, la prueba dice por qué en vez de agotar un
        // reloj: apagado puede ser que no quepa, que no llegue el material o que falte herramienta,
        // y desde fuera los tres se ven igual.
        const listo = await page.evaluate(() => ({
          apagado: document.getElementById("home-save").disabled,
          precio: document.getElementById("build-price").textContent.trim(),
          fantasma: window.MagikitosAdventure.inspect().community.ghost,
          saco: window.MagikitosAdventure.inspect().inventory,
        }));
        assert(!listo.apagado, "Colocar apagado: " + JSON.stringify(listo));
        await page.locator("#home-save").click();
        // ⛔ COLOCAR NO SUELTA LA PIEZA (18-sep-2026): poner una flor casi nunca es poner una
        // sola, así que lo que cambia es el BOSQUE y no la mano. Por eso se espera a que el claro
        // tenga una cosa más y no a que el fantasma desaparezca, que ya no desaparece nunca.
        // Y si no llega, la prueba dice POR QUÉ: la barra explica cada negativa con su frase, así
        // que una espera agotada a secas sería tirar la única pista que hay.
        await page
          .waitForFunction(
            (n) => window.MagikitosAdventure.inspect().community.objects.length > n,
            puestas,
          )
          .catch(async (error) => {
            const dicho = await page.evaluate(() => ({
              precio: document.getElementById("build-price")?.textContent?.trim(),
              aviso: document.querySelector("#world-toast")?.textContent?.trim(),
              fantasma: window.MagikitosAdventure.inspect().community.ghost,
            }));
            dicho.servidor = respuestas;
            throw Error(
              "Colocar " + kind + " a " + width + " no se aplicó: " +
                JSON.stringify(dicho) + " (" + error.message + ")",
            );
          });
        assert(
          await page.evaluate(
            () =>
              window.MagikitosAdventure.inspect().community.editing &&
              Boolean(window.MagikitosAdventure.inspect().community.ghost),
          ),
          "La pieza se queda en la mano: poner una no es dejar de construir",
        );
        assert(
          await page.locator("#build-bar").isVisible(),
          "…y la barra de colocar sigue delante, sin volver al catálogo",
        );
        const after = await (
          await http.get("/api/world/community?zone=" + ZONE)
        ).json();
        assert.equal(after.objects.length, snapshot.objects.length + 1);
        /**
         * ⛔ EL IMÁN, contra lo que ACABA de quedarse puesto. Un toque a menos de una celda de un
         * poste se pega a ÉL, sin espacio: empalmar con lo que ya hay es lo fácil, que es justo
         * lo que la regla de vecindad premia. Y la celda no es a ojo — es el hueco más grande por
         * el que un duende todavía no pasa, así que el imán solo cierra lo que no era una puerta.
         */
        if (kind === "twig-fence") {
          const puesta = after.objects.find(
            (o) => !snapshot.objects.some((b) => b.id === o.id),
          );
          const punta = {
            x: puesta.x + puesta.points.at(-1)[0],
            y: puesta.y + puesta.points.at(-1)[1],
          };
          const casi = await enPantalla({ x: punta.x + 0.6, y: punta.y - 0.4 });
          await page.touchscreen.tap(casi.x, casi.y);
          const pegado = await page.evaluate(
            () => window.MagikitosAdventure.inspect().community.ghost,
          );
          assert.deepEqual(
            [pegado.x, pegado.y],
            [punta.x, punta.y],
            "A tap within one tile of an existing post lands ON it, with no gap",
          );
          await page.locator("#build-undo").click();
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        const placed = after.objects.find(
          (o) => !snapshot.objects.some((before) => before.id === o.id),
        );
        assert(placed, "Identify exactly the object this fixture placed");
        const liveAccount = (
          await (await http.get("/api/world/game-account")).json()
        ).account;
        const removed = await http.post("/api/world/community-build", {
          data: {
            operationId: crypto.randomUUID().replaceAll("-", ""),
            baseRevision: liveAccount.revision,
            zone: after.zone,
            zoneRevision: after.revision,
            operation: "remove",
            object: Object.fromEntries(
              ["id", "kind", "variant", "x", "y", "rotation", "points", "revision"]
                .filter((k) => placed[k] !== undefined)
                .map((k) => [k, placed[k]]),
            ),
          },
        });
        assert.equal(removed.status(), 200, await removed.text());
        const refunded = await removed.json();
        assert.equal(
          refunded.account.inventory.twig,
          account.inventory.twig,
          "Removal refunds once, so each viewport tests a funded placement, not an exhausted account",
        );
        assert.equal(
          refunded.account.inventory.bowl,
          account.inventory.bowl,
          "Pool can also be recovered without duplicating its bowl",
        );
        await page.waitForFunction(id => !window.MagikitosAdventure.inspect().community.objects.some(o => o.id === id), placed.id);
        await page.close();
        console.log(
          `PASS shared ${kind} placement/removal/refund, real API, fixed UI pinch ${width}x${height}`,
        );
      }
    assert.deepEqual(errors, []);
    await http.dispose();
  } finally {
    await browser.close();
    for (const id of users) fixture("dispose", String(id));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
