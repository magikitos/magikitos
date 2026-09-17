"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const { chromium, request } = require("playwright");
const {
  validateConstruction,
} = require("../public/assets/js/adventure/construction-layout");
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
// La zona sale del catálogo, no de un nombre escrito a mano: el claro se puede mudar de pantalla
// y esta prueba no tiene por qué enterarse.
const ZONE = Object.keys(
  JSON.parse(fs.readFileSync(".local/build/world.json")).construction.zones,
)[0];
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
    for (const id of ["picnic-knife", "picnic-lighter", "picnic-mushroom"])
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
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ])
      for (const kind of ["twig-fence", "bowl-pool"]) {
        const page = await browser.newPage({
          viewport: { width, height },
          hasTouch: true,
          isMobile: width < 800,
          ignoreHTTPSErrors: true,
        });
        page.on("pageerror", (e) => errors.push(e.message));
        // Nada sale de la máquina: solo el sitio que se está probando, sea DDEV o el clon.
        const allowed = new URL(origin).host;
        await page.route("**/*", (r) =>
          new URL(r.request().url()).host === allowed ? r.continue() : r.abort(),
        );
        await page.addInitScript(
          ({ token, account }) => {
            localStorage.setItem("magikitos_session", token);
            if (!localStorage.getItem("magikitos.adventure"))
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
          { token: identity.token, account },
        );
        await page.goto(origin + "/aventura");
        await require("./browser-entry.cjs").enterWorld(page);
        await page.locator("#home-edit").click();
        await page.waitForFunction(
          () => window.MagikitosAdventure.inspect().community.editing,
        );
        await page
          .locator("#home-palette button")
          .filter({
            hasText:
              kind === "twig-fence" ? "Vallita de ramitas" : "Piscinita deluxe",
          })
          .click();
        const snapshot = await (
          await http.get("/api/world/community?zone=" + ZONE)
        ).json();
        let point;
        const [zx, zy, zw, zh] = world.construction.zones[ZONE].editable;
        const shape = world.construction.definitions[kind].shape;
        for (let y = zy + 2; y <= zy + zh - 2 && !point; y += 0.5)
          for (let x = zx + 2; x < zx + zw - 2 && !point; x += 0.5) {
            const ghost = {
              kind,
              variant: world.construction.definitions[kind].variants[0].id,
              rotation: 0,
              x,
              y,
              ...(shape === "polyline" ? { points: [[0, 0], [2, 0]] } : {}),
            };
            if (
              !validateConstruction(
                [...snapshot.objects, ghost],
                snapshot.zone,
                world.construction,
              )
            )
              point = { x, y };
          }
        assert(point, "At least one legal plot position");
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
        await page.touchscreen.tap(sx, sy);
        await page.waitForFunction(() => {
          const s = window.MagikitosAdventure.inspect();
          return s.community.ghost && !s.community.invalid;
        });
        /**
         * ⛔ CON LA VALLITA ELEGIDA, EL MAPA SE SIGUE PUDIENDO MOVER. Es lo que rompió el primer
         * intento de dibujar arrastrando: cualquier arrastre pasaba a ser un trazo, así que con
         * la vallita en la mano la cámara se quedaba clavada y salía una valla de veintitrés
         * celdas. Un arrastre rápido mueve el mapa; quien deja pulsado medio segundo, dibuja.
         */
        if (kind === "twig-fence") {
          const vertices = () =>
            page.evaluate(
              () => window.MagikitosAdventure.inspect().community.ghost.points.length,
            );
          assert.equal(await vertices(), 2, "A tapped fence is the shortest one");
          const before = (await inspect()).camera;
          await page.mouse.move(width * 0.5, height * 0.3);
          await page.mouse.down();
          await page.mouse.move(width * 0.5 - 60, height * 0.3, { steps: 6 });
          await page.mouse.up();
          const panned = (await inspect()).camera;
          assert(
            Math.abs(panned.x - before.x) > 20,
            "A quick drag still moves the map while a fence is in hand",
          );
          assert.equal(await vertices(), 2, "…and draws nothing");
          // Y dejando pulsado, el mismo arrastre dibuja.
          await page.mouse.move(width * 0.5, height * 0.3);
          await page.mouse.down();
          await page.waitForTimeout(500);
          await page.mouse.move(width * 0.5 + 90, height * 0.3, { steps: 8 });
          await page.mouse.move(width * 0.5 + 90, height * 0.3 + 70, { steps: 8 });
          await page.mouse.up();
          assert(
            (await vertices()) >= 3,
            "Press, hold and drag draws a trace with corners",
          );
          // Se vuelve a elegir la vallita —que es lo que hace una persona que se ha pasado de
          // largo— y con ella el trazo más corto otra vez, y se coloca en el hueco legal.
          await page
            .locator("#home-palette button")
            .filter({ hasText: "Vallita de ramitas" })
            .click();
          assert.equal(await vertices(), 2, "Choosing the fence again starts short");
          s = await inspect();
          sx = box.x + ((point.x * 16 - s.camera.x) * box.width) / s.view.width;
          sy = box.y + ((point.y * 16 - s.camera.y) * box.height) / s.view.height;
          await page.touchscreen.tap(sx, sy);
          await page.waitForFunction(() => {
            const s = window.MagikitosAdventure.inspect();
            return s.community.ghost && !s.community.invalid;
          });
        }
        await page.screenshot({
          path: `.local/community-review/placement-${kind}-${width}.png`,
        });
        await page.locator("#home-save").click();
        // ⛔ COLOCAR NO CIERRA LA CAJA (17-sep-2026): colocar una cosa casi nunca es colocar una
        // sola, así que lo que se va es el fantasma y la caja se queda con la paleta lista.
        await page.waitForFunction(
          () => !window.MagikitosAdventure.inspect().community.ghost,
        );
        assert(
          await page.evaluate(
            () => window.MagikitosAdventure.inspect().community.editing,
          ),
          "Placing one piece leaves the box open for the next",
        );
        const after = await (
          await http.get("/api/world/community?zone=" + ZONE)
        ).json();
        assert.equal(after.objects.length, snapshot.objects.length + 1);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page.close();
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
