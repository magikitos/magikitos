"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { startStudio } = require("./browser-studio.cjs");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
const { cameraLimits } = require("../public/assets/js/adventure/scene-frame");
const { World, TILE } = require("../public/assets/js/adventure/model");
const { cameraMetrics } = require("../public/assets/js/adventure/camera");
const errors = [],
  shots = path.resolve(".local/screenshots");
fs.mkdirSync(shots, { recursive: true });
let browser, studio;
const wait = (page, fn, arg) =>
  page.waitForFunction(fn, arg, { timeout: 12000 });
async function pageFor(
  scene = "overworld",
  viewport = { width: 1440, height: 900 },
  options = {},
) {
  const page = await browser.newPage({ viewport, hasTouch: true });
  await page.route("**/*", (route) =>
    ["127.0.0.1", "magikitos.ddev.site"].includes(
      new URL(route.request().url()).hostname,
    )
      ? route.continue()
      : route.abort(),
  );
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (state) => {
      if (!localStorage.getItem("magikitos.adventure"))
        localStorage.setItem("magikitos.adventure", JSON.stringify(state));
      window.__longTasks = [];
      new PerformanceObserver((list) =>
        window.__longTasks.push(...list.getEntries().map((e) => e.duration)),
      ).observe({ type: "longtask", buffered: true });
    },
    {
      scene,
      position: {
        x: world.scenes[scene].spawn.x * TILE,
        y: world.scenes[scene].spawn.y * TILE,
      },
      flags: {},
      muted: true,
      ...options,
    },
  );
  await page.goto(origin + "/bosque/explorar");
  await require("./browser-entry.cjs").enterWorld(page);
  return page;
}
const inspect = (page) =>
  page.evaluate(() => window.MagikitosAdventure.inspect());
async function clickWorld(page, x, y) {
  const s = await inspect(page),
    r = await page.locator("#world-canvas").boundingBox();
  await page.mouse.click(
    r.x + ((x - s.camera.x) * r.width) / s.view.width,
    r.y + ((y - s.camera.y) * r.height) / s.view.height,
  );
}
async function clickEntity(page, id, dy = 10) {
  const e = (await inspect(page)).entities.find((e) => e.id === id);
  assert(e, id);
  await clickWorld(page, e.x, e.y - dy);
}
function coverage(s) {
  const scene = {
    ...world.scenes[s.scene],
    width: s.bounds.width / TILE,
    height: s.bounds.height / TILE,
  };
  if (scene.indoor) {
    const limits = cameraLimits(scene, s.view);
    for (const axis of ["x", "y"])
      assert(
        s.camera[axis] >= limits[axis][0] - 1 &&
          s.camera[axis] <= limits[axis][1] + 1,
      );
    return;
  }
  // Fuera, la cámara recorre el marco del plano (mundo continuo): al alejar del todo se ve la
  // celda entera y, si el duende no está justo en el centro, una franja de la vecina, que desde
  // la rejilla (20-sep-2026) es bosque de verdad y no relleno.
  const frame = s.frame
    ? { x: s.frame.x * TILE, y: s.frame.y * TILE, w: s.frame.w * TILE, h: s.frame.h * TILE }
    : { x: 0, y: 0, w: scene.width * TILE, h: scene.height * TILE };
  assert(s.camera.x >= frame.x - 1 && s.camera.y >= frame.y - 1);
  assert(s.camera.x + s.view.width <= frame.x + frame.w + 1);
  assert(s.camera.y + s.view.height <= frame.y + frame.h + 1);
}
async function pinch(page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 90, y: 350, id: 0 },
      { x: 300, y: 350, id: 1 },
    ],
  });
  for (let n = 1; n <= 6; n++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: 90 + n * 9, y: 350, id: 0 },
        { x: 300 - n * 9, y: 350, id: 1 },
      ],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}
(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [2560, 1440],
  ]) {
    const page = await pageFor("overworld", { width, height }),
      initial = await inspect(page);
    coverage(initial);
    await page.mouse.move(width / 2, height / 2);
    for (let n = 0; n < 12; n++) await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(150);
    const out = await inspect(page);
    coverage(out);
    assert(out.scale < initial.scale, "Wheel zooms the complete world");
    assert(
      Math.abs(
        out.scale -
          Math.max(width / out.bounds.width, height / out.bounds.height),
      ) < 1e-7,
      "Outdoor zoom reaches real map coverage limit",
    );
    await page.waitForTimeout(400);
    const cached = (await inspect(page)).terrainBuilds;
    await page.waitForTimeout(400);
    assert.equal(
      (await inspect(page)).terrainBuilds,
      cached,
      "Full zoom-out reuses visible terrain chunks without cache thrashing",
    );
    // Larger authored maps have a lower fit scale: traverse the full zoom range.
    for (let n = 0; n < 16; n++) await page.mouse.wheel(0, -1000);
    await page.waitForTimeout(150);
    assert(
      Math.abs(
        (await inspect(page)).scale -
          cameraMetrics({ width, height }, world.scenes.overworld, 1).scale,
      ) < 0.01,
      "Cannot zoom beyond original scale",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "No horizontal page overflow",
    );
    assert.equal(await page.locator("#loading").isVisible(), false);
    if (width === 390) {
      const before = await inspect(page);
      await pinch(page);
      await page.waitForTimeout(150);
      const after = await inspect(page);
      assert(after.scale < before.scale, "Native two-finger pinch zooms out");
      assert.equal(
        after.pathLength,
        0,
        "Pinch does not issue an accidental walking command",
      );
      assert(
        Math.hypot(
          after.player.x - before.player.x,
          after.player.y - before.player.y,
        ) < 1,
      );
      const target = { x: after.player.x, y: after.player.y + 40 },
        box = await page.locator("#world-canvas").boundingBox();
      await page.touchscreen.tap(
        ((target.x - after.camera.x) / after.view.width) * box.width,
        ((target.y - after.camera.y) / after.view.height) * box.height,
      );
      await page.waitForTimeout(350);
      assert(
        (await inspect(page)).player.y > after.player.y + 3,
        "Single touch still walks",
      );
      await page.screenshot({ path: path.join(shots, "mobile-pinch.png") });
    }
    console.log("PASS viewport", width, height);
    await page.close();
  }
  {
    /**
     * ⛔ LA PANTALLA VECINA ESTÁ VIVA, NO ES UN FONDO (20-sep-2026, revisión). Sus baldosas se
     * pegan en píxeles de pantalla y salen bien solas, pero lo que se dibuja en coordenadas del
     * mundo —puentes, ondas y recortes de interiores— necesita el desplazamiento de la costura.
     * Sin él caía una pantalla entera fuera de la vista: el río de los sauces se veía QUIETO
     * desde la pradera y su puente no estaba. Aquí se mira el agua de la vecina en dos instantes.
     */
    const page = await pageFor("overworld", { width: 1440, height: 900 }, {
      position: { x: 74 * TILE, y: 9 * TILE },
    });
    await wait(page, () => window.MagikitosAdventure.inspect().seams.some((s) => s.scene === "river-willows"));
    await page.waitForTimeout(1200);
    // Una franja del cauce compartido (96..128 casillas) por encima y por debajo de la costura.
    const strip = (top) => page.evaluate((top) => {
      const i = window.MagikitosAdventure.inspect(), canvas = document.querySelector("canvas");
      const scale = canvas.width / i.view.width, c = document.createElement("canvas");
      c.width = 200; c.height = 60;
      c.getContext("2d").drawImage(canvas, Math.round((96 * 16 - i.camera.x) * scale),
        Math.round((top - i.camera.y) * scale), 200, 60, 0, 0, 200, 60);
      return [...c.getContext("2d").getImageData(0, 0, 200, 60).data];
    }, top);
    const moved = (a, b) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);
    const neighbourBefore = await strip(-120), mineBefore = await strip(40);
    await page.waitForTimeout(700);
    const neighbourAfter = await strip(-120), mineAfter = await strip(40);
    assert(moved(mineBefore, mineAfter) > 100, "El agua de tu pantalla se mueve (control)");
    assert(
      moved(neighbourBefore, neighbourAfter) > 100,
      "El agua de la pantalla vecina también se mueve: " + moved(neighbourBefore, neighbourAfter),
    );
    console.log("PASS neighbour scene ripples animate across the seam");
    await page.close();
  }
  // Small rooms use painted cutaway framing, not viewport-filling giant sprites.
  for (const scene of ["cottage", "house", "attic", "tavern", "workshop"])
    for (const [width, height] of [
      [390, 844],
      [844, 390],
      [768, 1024],
      [1440, 900],
    ]) {
      const page = await pageFor(scene, { width, height });
      const initial = await inspect(page);
      coverage(initial);
      assert(
        initial.scale <= (width < 600 ? 1.5 : 2),
        "Interior scale is restrained",
      );
      for (const zoomOut of [false, true]) {
        if (zoomOut) {
          await page.mouse.move(width / 2, height / 2);
          for (let n = 0; n < 4; n++) await page.mouse.wheel(0, 1000);
          await page.waitForTimeout(150);
          const out = await inspect(page);
          coverage(out);
          assert(out.scale < initial.scale, "Room zoom-out remains available");
          assert.deepEqual(
            out.player,
            initial.player,
            "Zooming is not movement",
          );
        }
        const pixels = await page.evaluate(() => {
          const canvas = document.getElementById("world-canvas"),
            c = canvas.getContext("2d");
          const { data } = c.getImageData(0, 0, canvas.width, canvas.height);
          let longest = 0;
          const edge = (points) => {
            let run = 0;
            for (const [x, y] of points) {
              const i = (y * canvas.width + x) * 4;
              const dark =
                data[i] + data[i + 1] + data[i + 2] < 20 || data[i + 3] !== 255;
              run = dark ? run + 1 : 0;
              longest = Math.max(longest, run);
            }
          };
          // A cupboard can cross an edge with a single native black outline pixel.
          // Check continuous empty spans, not legitimate isolated ink in the sprite.
          for (const y of [0, canvas.height - 1])
            edge(Array.from({ length: canvas.width }, (_, x) => [x, y]));
          for (const x of [0, canvas.width - 1])
            edge(Array.from({ length: canvas.height }, (_, y) => [x, y]));
          return longest;
        });
        assert(
          pixels < 8,
          "No continuous blank/black interior edge at either zoom limit",
        );
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      console.log(
        "PASS interior framing + painted edges",
        scene,
        width,
        height,
      );
      await page.close();
    }
  for (const [locale, route] of Object.entries(require("../tools/page.cjs").ROUTES)) {
    const page = await pageFor();
    const response = await page.goto(origin + route);
    assert.equal(response.status(), 200);
    await require("./browser-entry.cjs").enterWorld(page);
    const config = JSON.parse(
      await page.locator("#adventure-config").textContent(),
    );
    assert.equal(config.locale, locale);
    console.log("PASS locale", locale, route);
    await page.close();
  }
  {
    const page = await pageFor(
      "house",
      { width: 1440, height: 900 },
      { position: { x: 6 * TILE, y: 19.8 * TILE } },
    );
    await page.keyboard.down("ArrowUp");
    await wait(
      page,
      () => window.MagikitosAdventure.inspect().scene === "attic",
    );
    await page.keyboard.up("ArrowUp");
    await page.waitForTimeout(800);
    assert.equal(await page.locator("#loading").isVisible(), false);
    coverage(await inspect(page));
    await page.keyboard.down("ArrowUp");
    await wait(
      page,
      () => window.MagikitosAdventure.inspect().scene === "house",
    );
    await page.keyboard.up("ArrowUp");
    await page.screenshot({ path: path.join(shots, "stairs-return.png") });
    console.log("PASS stairs both ways, no click needed");
    await page.close();
  }
  // Studio can relocate an entire building. Door entry, a resumed save and exit all follow its ID.
  for (const [id, room] of [
    ["human-door", "house"],
    ["tavern-door", "tavern"],
    ["home-one", "cottage"],
  ]) {
    const door = world.scenes.overworld.entities.find((e) => e.id === id);
    const page = await pageFor(
      "overworld",
      { width: 390, height: 844 },
      {
        position: { x: door.arrival[0] * TILE, y: door.arrival[1] * TILE },
      },
    );
    await page.keyboard.down("ArrowUp");
    await wait(
      page,
      () => window.MagikitosAdventure.inspect().scene !== "overworld",
    );
    await page.keyboard.up("ArrowUp");
    assert.equal((await inspect(page)).scene, room);
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("magikitos.adventure")),
    );
    assert.deepEqual(saved.entrance, { scene: "overworld", portal: id });
    await page.reload();
    await require("./browser-entry.cjs").enterWorld(page);
    await page.keyboard.down("ArrowDown");
    await wait(
      page,
      () => window.MagikitosAdventure.inspect().scene === "overworld",
    );
    await page.keyboard.up("ArrowDown");
    const out = await inspect(page);
    assert(
      Math.hypot(
        out.player.x - door.arrival[0] * TILE,
        out.player.y - door.arrival[1] * TILE,
      ) < 8,
      "Return lands at the moved building, not its former location",
    );
    console.log("PASS moved building entry/save/reload/exit", id);
    await page.close();
  }
  for (const [side, viewport] of [
    [-1, { width: 390, height: 844 }],
    [1, { width: 1440, height: 900 }],
  ]) {
    const door = world.scenes.overworld.entities.find(
      (e) => e.id === "human-door",
    );
    const y = (door.threshold[1] + door.threshold[3] / 2) * TILE;
    const page = await pageFor("overworld", viewport, {
      position: { x: (door.x + side) * TILE, y },
    });
    const key = side < 0 ? "ArrowRight" : "ArrowLeft";
    await page.keyboard.down(key);
    await wait(page, () => {
      const s = window.MagikitosAdventure.inspect(),
        door = s.entities.find((e) => e.id === "human-door");
      return Math.abs(s.player.x - door.x) < 5;
    });
    await page.keyboard.up(key);
    await page.waitForTimeout(120);
    assert.equal(
      (await inspect(page)).scene,
      "overworld",
      "Passing sideways in front of house never absorbs",
    );
    // Tapping the facade must route to the front and walk upward, even from this close lateral approach.
    await clickEntity(page, "human-door", 30);
    await wait(
      page,
      () => window.MagikitosAdventure.inspect().scene === "house",
    );
    await clickEntity(page, "exit", 0);
    await wait(
      page,
      () => window.MagikitosAdventure.inspect().scene === "overworld",
    );
    console.log(
      "PASS exterior lateral/idle immunity + front-routed tap round trip",
      side,
    );
    await page.close();
  }
  for (const side of [-1, 1]) {
    const scene = world.scenes.cottage,
      door = scene.entities.find((e) => e.id === "exit");
    const page = await pageFor(
      "cottage",
      { width: 390, height: 844 },
      {
        position: {
          x: (door.x + side) * TILE,
          y: (scene.height - 2) * TILE - 5.1,
        },
      },
    );
    const key = side < 0 ? "ArrowRight" : "ArrowLeft";
    await page.keyboard.down(key);
    await wait(page, () => {
      const s = window.MagikitosAdventure.inspect();
      const door = s.entities.find((e) => e.id === "exit");
      return Math.abs(s.player.x - door.x) < 5;
    });
    await page.keyboard.up(key);
    await page.waitForTimeout(150);
    assert.equal(
      (await inspect(page)).scene,
      "cottage",
      "Sideways movement and standing do not exit",
    );
    await page.keyboard.down("ArrowDown");
    await wait(
      page,
      () => window.MagikitosAdventure.inspect().scene === "overworld",
    );
    await page.keyboard.up("ArrowDown");
    console.log("PASS lateral approach stays indoors, then down exits", side);
    await page.close();
  }
  {
    const page = await pageFor(
      "overworld",
      { width: 1440, height: 900 },
      {
        position: { x: 90.5 * TILE, y: 45.5 * TILE },
        flags: { picnicFed: true },
        inventory: { knife: 1, bottle: 1, oars: 1, twig: 2, leaf: 2 },
        wallet: { balance: 10, claimed: { picnic: true } },
      },
    );
    await clickEntity(page, "river-dock");
    await page.locator("#dialogue-actions button").first().waitFor();
    await page.locator("#dialogue-actions button").first().click();
    await wait(
      page,
      () => window.MagikitosAdventure.inspect().sequence?.type === "gesture",
    );
    const before = await inspect(page);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(300);
    await page.keyboard.up("ArrowRight");
    const during = await inspect(page);
    assert.deepEqual(during.player, before.player, "Crafting stays in place");
    await wait(
      page,
      () => window.MagikitosAdventure.inspect().inventory.boat === 1,
    );
    await page.keyboard.press("Enter");
    await clickWorld(page, 93.375 * TILE, 45.2 * TILE);
    await wait(
      page,
      () => window.MagikitosAdventure.inspect().navigation.mode === "boat",
    );
    await page.screenshot({ path: path.join(shots, "bottle-craft.png") });
    assert.equal((await inspect(page)).wallet.balance, 10);
    assert.equal((await inspect(page)).inventory.knife, 1);
    console.log(
      "PASS atomic bottle crafting and playable boarding without fare",
    );
    await page.close();
  }
  // Full browser autosave/crop test uses an isolated Studio, never the user's working version.
  const temp = fs.mkdtempSync(
    path.join(os.tmpdir(), "magikitos-browser-studio-"),
  );
  // Cold Studio startup prepares its uncropped authoring atlas and archived labs.
  // This is offline art preparation, not a game loading-time allowance.
  studio = await startStudio({ port: "47836", temp });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:47836/");
  await wait(page, () => window.MagikitosStudio?.inspect().ready);
  assert.equal(
    await page.locator("#new,#load,#name").count(),
    0,
    "No draft selector",
  );
  await page.selectOption("#scene", "house");
  await page.locator('[data-id="human-bed"]').click();
  await page.locator("#crop-w").fill("53");
  await page.locator("#crop-w").press("Tab");
  await wait(
    page,
    () => window.MagikitosStudio.inspect().sprites.bed?.crop[2] === 53,
  );
  // El cuerpo se edita en el mapa y pertenece al ELEMENTO, no a esta cama: ver
  // `check-studio-entrance-browser.cjs`, que cubre el editor entero. Aquí solo interesa que el
  // recorte del sprite sobreviva a una recarga junto con las colocaciones.
  await wait(page, () => !window.MagikitosStudio.inspect().dirty);
  const saved = await page.evaluate(() => window.MagikitosStudio.inspect());
  await page.reload();
  await wait(page, () => window.MagikitosStudio?.inspect().ready);
  const resumed = await page.evaluate(() => window.MagikitosStudio.inspect());
  assert.deepEqual(resumed.sprites, saved.sprites);
  assert.deepEqual(resumed.changes, saved.changes);
  const exported = await (
    await page.request.get("http://127.0.0.1:47836/api/diff")
  ).json();
  assert.equal(exported.sprites[0].sprite, "bed");
  assert.equal(
    (
      await page.request.post("http://127.0.0.1:47836/api/workspace", {
        data: {},
      })
    ).status(),
    403,
  );
  await page.selectOption("#scene", "house");
  await page.locator('[data-id="human-bed"]').click();
  await page.locator("#crop-preview").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shots, "studio-crop.png") });
  console.log(
    "PASS Studio crop, collision edit, autosave/reload, diff and same-origin write guard",
  );
  assert.deepEqual(errors, [], "No browser exceptions");
  console.log("PASS all browser regressions.");
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    studio?.kill("SIGTERM");
    await browser?.close();
  });
