"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { chromium } = require("playwright");
const { cleanSave } = require("../public/assets/js/adventure/save");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (
  !["127.0.0.1", "localhost", "magikitos.ddev.site"].includes(
    new URL(origin).hostname,
  )
)
  throw Error("Local browser test only");
const catalog = JSON.parse(fs.readFileSync(".local/build/world.json"));
const clone = (v) => JSON.parse(JSON.stringify(v));
const boat = (scene, x, y) =>
  cleanSave(
    {
      scene,
      position: { x: x * 16, y: y * 16 },
      inventory: { boat: 1, knife: 1 },
      navigation: { mode: "boat", direction: "up" },
      wallet: { balance: 10, claimed: { picnic: true } },
      muted: true,
    },
    catalog,
  );
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [];
  fs.mkdirSync(".local/river-review", { recursive: true });
  try {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        ignoreHTTPSErrors: true,
      });
      let remote = null,
        saves = 0;
      page.on("pageerror", (e) => errors.push(e.message));
      // UI isolation: exercise the real client protocol, but no account mint/write in this browser suite.
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url()),
          endpoint = url.pathname.split("/").pop();
        if (!["127.0.0.1", "magikitos.ddev.site"].includes(url.hostname))
          return route.abort();
        let data;
        if (endpoint === "identity")
          data = {
            ok: true,
            user: { id: 71001, name: "Local UI test", handle: "local-ui-test" },
            token: null,
          };
        if (endpoint === "game-state")
          data = { ok: true, profile: remote, recoveries: [] };
        if (endpoint === "game-save") {
          const body = route.request().postDataJSON();
          assert.equal(body.baseRevision, remote?.revision || 0);
          remote = {
            id: "a".repeat(32),
            revision: (remote?.revision || 0) + 1,
            state: body.state,
            parcel: body.parcel,
          };
          saves++;
          data = {
            ok: true,
            profile: remote,
            acknowledgedRevision: remote.revision,
            replayed: false,
          };
        }
        if (endpoint === "parcels")
          data = {
            ok: true,
            items: [
              {
                id: "b".repeat(32),
                revision: 1,
                owner: { name: "Vecina de prueba", handle: "vecina" },
              },
            ],
            nextCursor: null,
          };
        if (endpoint === "parcel")
          data = {
            ok: true,
            plot: {
              id: "b".repeat(32),
              revision: 1,
              owner: { name: "Vecina de prueba", handle: "vecina" },
              parcel: catalog.homesteads.initial,
            },
          };
        if (data)
          return route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(data),
          });
        return route.continue();
      });
      await page.addInitScript(
        (seed) => {
          const next = sessionStorage.getItem("river-next");
          if (next) {
            localStorage.setItem("magikitos.adventure", next);
            sessionStorage.removeItem("river-next");
          }
          if (!sessionStorage.getItem("river-seeded")) {
            localStorage.setItem("magikitos.adventure", JSON.stringify(seed));
            sessionStorage.setItem("river-seeded", "1");
          }
        },
        boat("river-willows", 48, 60),
      );
      const inspect = () =>
        page.evaluate(() => window.MagikitosAdventure.inspect());
      const ready = () =>
        page.waitForFunction(() => window.MagikitosAdventure?.inspect().ready);
      const seed = async (state) => {
        await page.evaluate(
          (s) => sessionStorage.setItem("river-next", JSON.stringify(s)),
          state,
        );
        await page.reload();
        await ready();
      };
      const point = async (x, y) => {
        const s = await inspect(),
          r = await page.locator("#world-canvas").boundingBox();
        await page.mouse.click(
          r.x + ((x * 16 - s.camera.x) / s.view.width) * r.width,
          r.y + ((y * 16 - s.camera.y) / s.view.height) * r.height,
        );
      };
      await page.goto(origin + "/aventura");
      await ready();
      assert.equal((await inspect()).navigation.mode, "boat");
      assert(await page.locator("#river-controls").isVisible());
      const initial = await inspect();
      await page.locator("#world-canvas").focus();
      await page.keyboard.down("ArrowUp");
      await page.waitForTimeout(750);
      await page.keyboard.up("ArrowUp");
      assert((await inspect()).player.y < initial.player.y - 30);
      await page.screenshot({
        path: `.local/river-review/willows-${width}.png`,
      });
      await page.waitForTimeout(2100);
      await page.reload();
      await ready();
      assert.equal((await inspect()).navigation.mode, "boat");
      assert.equal((await inspect()).wallet.balance, 10);
      // Pointer pad works at every viewport; no device-dependent branch.
      const down = await page
        .locator('[data-river-key="arrowdown"]')
        .boundingBox();
      const beforePad = (await inspect()).player.y;
      await page.mouse.move(down.x + 20, down.y + 20);
      await page.mouse.down();
      await page.waitForTimeout(800);
      await page.mouse.up();
      assert((await inspect()).player.y > beforePad + 20);
      await seed(boat("river-willows", 48, 3));
      await page.locator("#world-canvas").focus();
      await page.keyboard.down("ArrowUp");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().scene === "river-reeds",
      );
      await page.keyboard.up("ArrowUp");
      assert.equal((await inspect()).navigation.mode, "boat");
      await seed(boat("river-rapids", 48, 28));
      const rapidY = (await inspect()).player.y;
      await page.locator("#world-canvas").focus();
      await page.keyboard.down("ArrowUp");
      await page.waitForTimeout(1000);
      await page.keyboard.up("ArrowUp");
      assert((await inspect()).player.y > rapidY, "Current is a real setback");
      await page.screenshot({
        path: `.local/river-review/rapids-${width}.png`,
      });
      const jetty = catalog.scenes["river-gardens"].navigation.landings[0];
      const address = catalog.scenes["river-gardens"].entities.find(
        (e) => e.parcelSlot === 0,
      );
      await seed(boat("river-gardens", ...jetty.water));
      await page.locator("#river-land").click();
      await point(address.x, address.y);
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().scene === "guest-garden",
      );
      await page.locator("#home-return").click();
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().scene === "river-gardens",
      );
      assert(
        Math.hypot(
          (await inspect()).player.x - jetty.water[0] * 16,
          (await inspect()).player.y - jetty.water[1] * 16,
        ) < 20,
      );
      await seed(boat("home-garden", 24, 42.5));
      await page.locator("#river-land").click();
      await page.waitForFunction(() =>
        Boolean(window.MagikitosAdventure.inspect().dialogue),
      );
      await page.keyboard.press("Enter");
      await page.locator("#home-edit").click();
      const count = (await inspect()).homestead.objects.length;
      await page.locator("#home-palette button").first().click();
      await point(22, 27);
      assert.equal((await inspect()).homestead.objects.length, count + 1);
      await page.screenshot({ path: `.local/river-review/edit-${width}.png` });
      await page.evaluate(() =>
        localStorage.setItem(
          "magikitos_session",
          "local-ui-only-not-a-server-token",
        ),
      );
      await page.locator("#home-save").click();
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().sync.status === "cloudSaved",
      );
      assert(saves > 0);
      assert.equal(remote.parcel.objects.length, count + 1);
      await page.locator("#home-neighbors").click();
      await page.locator("#home-neighbors-list button").first().click();
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().scene === "guest-garden",
      );
      assert(await page.locator("#home-edit").isHidden());
      assert.equal((await inspect()).homestead.visiting, "b".repeat(32));
      const beforeVisitSaves = saves;
      await page.locator("#world-canvas").focus();
      await page.keyboard.down("ArrowLeft");
      await page.waitForTimeout(500);
      await page.keyboard.up("ArrowLeft");
      await page.waitForTimeout(2100);
      assert.equal(
        saves,
        beforeVisitSaves,
        "Visits never autosave over the owner's position",
      );
      await page.locator("#home-return").click();
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().scene === "river-gardens",
      );
      assert.equal((await inspect()).navigation.mode, "boat");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.close();
      console.log(
        `PASS river controls, current, travel, reload, land, decorate, save, public visit at ${width}x${height}`,
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
