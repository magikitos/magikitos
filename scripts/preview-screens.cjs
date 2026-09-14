"use strict";
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs"),
  path = require("node:path");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const output = process.env.SCREENSHOT_DIR || path.resolve(".local/screenshots");
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const [scene, width, height] of [
    ["overworld", 1440, 900],
    ["house", 1440, 900],
    ["attic", 1440, 900],
    ["cottage", 390, 844],
    ["overworld", 390, 844],
    ["overworld", 1024, 768],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.route("**/*", (route) =>
      ["127.0.0.1", "magikitos.ddev.site"].includes(
        new URL(route.request().url()).hostname,
      )
        ? route.continue()
        : route.abort(),
    );
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
    await page.addInitScript(
      ({ scene, spawn }) =>
        localStorage.setItem(
          "magikitos.adventure",
          JSON.stringify({
            scene,
            position: { x: spawn.x * 16, y: spawn.y * 16 },
            flags: { introSeen: true },
            muted: true,
          }),
        ),
      { scene, spawn: world.scenes[scene].spawn },
    );
    await page.goto(origin + "/aventura");
    await page.waitForFunction(
      () => window.MagikitosAdventure?.inspect().ready,
    );
    await page.waitForTimeout(400);
    const state = await page.evaluate(() =>
      window.MagikitosAdventure.inspect(),
    );
    console.log(
      JSON.stringify({
        scene,
        width,
        errors,
        view: state.view,
        scale: state.scale,
        assets: state.assets.loaded,
      }),
    );
    await page.screenshot({
      path: path.join(output, scene + "-" + width + ".png"),
    });
    if (scene === "overworld" && width === 1440) {
      await page.mouse.move(720, 450);
      await page.mouse.wheel(0, 1300);
      await page.waitForTimeout(250);
      console.log(
        "zoom",
        await page.evaluate(() => window.MagikitosAdventure.inspect().scale),
      );
      await page.screenshot({ path: path.join(output, "zoom-out.png") });
    }
    await page.close();
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => console.log("Studio error: " + e.message));
  await page.goto("http://127.0.0.1:47832/");
  await page.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
  await page.selectOption("#scene", "house");
  await page.locator('[data-id="human-bed"]').click();
  await page.screenshot({ path: path.join(output, "studio.png") });
  console.log(
    "Studio:",
    await page.evaluate(() => window.MagikitosStudio.inspect()),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
