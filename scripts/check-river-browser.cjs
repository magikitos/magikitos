"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const { cleanSave } = require("../public/assets/js/adventure/save");
const {
  currentAt,
  canFloat,
} = require("../public/assets/js/adventure/river-navigation");
const { World } = require("../public/assets/js/adventure/model");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (
  !["127.0.0.1", "localhost", "magikitos.ddev.site"].includes(
    new URL(origin).hostname,
  )
)
  throw Error("Local test only");
const catalog = JSON.parse(fs.readFileSync(".local/build/world.json"));
const boat = (scene, x, y) =>
  cleanSave(
    {
      scene,
      position: { x: x * 16, y: y * 16 },
      inventory: { boat: 1, knife: 1 },
      navigation: { mode: "boat", direction: "up" },
      muted: true,
    },
    catalog,
  );
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [],
    writes = [];
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
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (r) => {
        if (!["GET", "HEAD"].includes(r.request().method())) {
          writes.push(r.request().url());
          return r.abort();
        }
        return ["127.0.0.1", "magikitos.ddev.site"].includes(
          new URL(r.request().url()).hostname,
        )
          ? r.continue()
          : r.abort();
      });
      await page.addInitScript(() => {
        const s = sessionStorage.getItem("river-next");
        if (s) {
          localStorage.setItem("magikitos.adventure", s);
          sessionStorage.removeItem("river-next");
        }
      });
      await page.goto(origin + "/aventura");
      const inspect = () =>
        page.evaluate(() => window.MagikitosAdventure.inspect());
      const ready = () =>
        page.waitForFunction(() => window.MagikitosAdventure?.inspect().ready);
      async function seed(s) {
        await page.evaluate(
          (s) => sessionStorage.setItem("river-next", JSON.stringify(s)),
          s,
        );
        await page.reload();
        await ready();
      }
      async function row(key, ms, fast = false) {
        await page.locator("#world-canvas").focus();
        if (fast) await page.keyboard.down(" ");
        await page.keyboard.down(key);
        await page.waitForTimeout(ms);
        await page.keyboard.up(key);
        if (fast) await page.keyboard.up(" ");
      }
      await seed(boat("river-willows", 48, 6));
      assert(await page.locator("#river-controls").isVisible());
      let start = (await inspect()).player.y;
      await row("ArrowDown", 650);
      const normal = (await inspect()).player.y - start;
      await seed(boat("river-willows", 48, 6));
      start = (await inspect()).player.y;
      await row("ArrowDown", 650, true);
      assert(
        (await inspect()).player.y - start > normal + 7,
        "Space accelerates rowing",
      );
      const pad = await page
        .locator('[data-river-key="arrowdown"]')
        .boundingBox();
      start = (await inspect()).player.y;
      await page.mouse.move(pad.x + 20, pad.y + 20);
      await page.mouse.down();
      await page.waitForTimeout(600);
      await page.mouse.up();
      assert((await inspect()).player.y > start + 20);
      await page.reload();
      await ready();
      assert.equal((await inspect()).navigation.mode, "boat");
      await seed(boat("river-willows", 48, 3));
      await page.locator("#world-canvas").focus();
      await page.keyboard.down("ArrowUp");
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().scene === "river-reeds",
      );
      await page.keyboard.up("ArrowUp");
      assert.equal((await inspect()).navigation.mode, "boat");
      const rapids = new World(catalog.scenes["river-rapids"]);
      let rapid;
      for (let y = 40; y < 65 && !rapid; y++)
        for (let x = 35; x < 65 && !rapid; x++)
          if (
            canFloat(rapids, x * 16, y * 16) &&
            currentAt(rapids.data, x * 16, y * 16).y > 110
          )
            rapid = { x, y };
      assert(rapid);
      await seed(boat("river-rapids", rapid.x, rapid.y));
      start = (await inspect()).player.y;
      await row("ArrowUp", 800);
      assert(
        (await inspect()).player.y > start,
        "Visible current actually pushes upstream attempts back",
      );
      await page.screenshot({
        path: ".local/river-review/rapids-" + width + ".png",
      });
      for (const scene of [
        "river-willows",
        "river-reeds",
        "river-rapids",
        "river-roots",
        "river-gardens",
        "human-hedge",
        "home-garden",
      ]) {
        const landing = catalog.scenes[scene].navigation.landings[0];
        await seed(boat(scene, ...landing.water));
        await page.locator("#river-land").click();
        await page.waitForFunction(
          () => window.MagikitosAdventure.inspect().navigation.mode === "foot",
        );
        const s = await inspect();
        assert.equal(s.scene, scene);
        assert(
          Math.hypot(
            s.player.x - landing.land[0] * 16,
            s.player.y - landing.land[1] * 16,
          ) < 1,
        );
        if (scene === "home-garden") {
          assert.equal(s.community.zone, "tocon-del-mirlo");
          assert(await page.locator("#home-edit").isVisible());
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
      }
      await page.close();
      console.log(
        "PASS river rowing/boost/pad, seam, current, reload and seven safe landings " +
          width +
          "x" +
          height,
      );
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
