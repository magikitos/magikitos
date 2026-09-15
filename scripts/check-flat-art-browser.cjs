"use strict";
/** Isolated browser contract exercise: real game UI, paginated DTO fixtures, zero API writes. */
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const { World, TILE } = require("../public/assets/js/adventure/model");
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
      [320, 568],
      [844, 390],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
      });
      const errors = [],
        catalogs = [],
        images = [];
      const sheetFile =
        "../magikitos/public/assets/images/colorear/colorear-colorear-0d01f44f.avif";
      const fixture = fs.existsSync(sheetFile)
        ? fs.readFileSync(sheetFile)
        : Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
            "base64",
          );
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (r) => {
        const url = new URL(r.request().url());
        if (url.origin !== origin) return r.abort();
        if (url.pathname.startsWith("/test-art/")) {
          images.push(url.pathname);
          return r.fulfill({
            contentType: fs.existsSync(sheetFile) ? "image/avif" : "image/png",
            body: fixture,
          });
        }
        if (url.pathname === "/api/world/bootstrap")
          return r.fulfill({
            json: {
              ok: true,
              locale: "es",
              destinations: { art: "/colorear" },
              capabilities: {},
            },
          });
        if (url.pathname === "/api/world/catalog") {
          catalogs.push(url);
          const cursor = Number(url.searchParams.get("cursor") || 0);
          return r.fulfill({
            json: {
              items: Array.from({ length: cursor ? 1 : 24 }, (_, i) => ({
                id: cursor + i + 1,
                title: "Lámina " + (cursor + i + 1),
                image: "/test-art/master-" + (cursor + i + 1) + ".avif",
                thumb: "/test-art/thumb-" + (cursor + i + 1) + ".avif",
              })),
              nextCursor: cursor ? null : 24,
            },
          });
        }
        if (url.pathname.startsWith("/api/world/"))
          return r.fulfill({ json: { ok: true, items: [], nextCursor: null } });
        return r.continue();
      });
      const room = world.contentRooms.art,
        model = new World(world.scenes[room.scene]);
      const focus = model.entities.find((e) => e.id === room.focus);
      const spawn = { x: focus.x, y: focus.y + TILE * 3 };
      assert(model.canStand(spawn.x, spawn.y));
      await page.addInitScript(
        (state) =>
          localStorage.setItem("magikitos.adventure", JSON.stringify(state)),
        { scene: room.scene, position: spawn, muted: true, flags: {} },
      );
      await page.goto(origin + "/aventura");
      await page.waitForFunction(
        () => window.MagikitosAdventure?.inspect().ready,
      );
      const s = await page.evaluate(() => window.MagikitosAdventure.inspect()),
        r = await page.locator("#world-canvas").boundingBox();
      await page.mouse.click(
        r.x + ((focus.x - s.camera.x) / s.view.width) * r.width,
        r.y + ((focus.y - 9 - s.camera.y) / s.view.height) * r.height,
      );
      const grid = page.locator(".world-native-catalogue");
      await grid.waitFor();
      assert.equal(await grid.locator("button").count(), 24);
      assert.equal(catalogs.length, 1);
      assert(!images.some((p) => p.includes("master")));
      assert(
        !(await page.locator("#world-content").innerText()).includes(
          "Colecciones",
        ),
      );
      await grid.locator("button").first().click();
      await page.waitForFunction(
        () => document.querySelector(".world-experience-object img")?.complete,
      );
      assert(await page.locator(".world-experience-object img").isVisible());
      assert(images.includes("/test-art/master-1.avif"));
      assert.equal(
        new URL(
          await page
            .getByRole("link", { name: /Imprimir en la web/ })
            .getAttribute("href"),
        ).pathname,
        "/colorear",
      );
      await page
        .getByRole("button", { name: "Láminas de los Magikitos", exact: true })
        .click();
      await page.getByRole("button", { name: "Ver más", exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelectorAll(".world-native-catalogue button").length ===
          25,
      );
      assert.equal(catalogs.length, 2);
      assert.equal(catalogs[1].searchParams.get("cursor"), "24");
      assert(catalogs.every((u) => !u.searchParams.has("collection")));
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: ".local/screenshots/flat-art-" + width + ".png",
      });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#world-content").isVisible(), false);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(
        "PASS flat art " +
          width +
          "×" +
          height +
          ": direct sheet grid, thumbnails only, selected master, 24+1 paging, return, print hub and Escape.",
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
