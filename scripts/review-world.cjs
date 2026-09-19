"use strict";
/** Read-only local scene review. Seeds isolated browser profiles, never the owner's save. */
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { World } = require("../public/assets/js/adventure/model");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
assert(
  ["localhost", "127.0.0.1", "magikitos.ddev.site"].includes(
    new URL(origin).hostname,
  ),
);
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
const tag = process.argv[2] || "current";
assert(/^[a-z-]+$/.test(tag));
const output = path.resolve(".local/world-review", tag);
const points = [
  [
    "overview",
    "overworld",
    null,
    1536,
    Math.round(
      (1536 * world.scenes.overworld.height) / world.scenes.overworld.width,
    ),
    true,
  ],
  ["picnic", "overworld", "picnic-trash-bin", 1440, 900],
  ["village", "overworld", "fountain", 1440, 900],
  ["brizno", "overworld", "picnic-neighbor", 1440, 900],
  ["tavern", "tavern", null, 1440, 1000],
  ["hedge", "human-hedge", null, 1536, 1152, true],
  ...Object.keys(world.scenes)
    .filter((id) => id.startsWith("river-"))
    .map((id) => [id, id, null, 1152, 1296, true]),
  ["picnic-mobile", "overworld", "picnic-trash-bin", 390, 844],
  ["tavern-mobile", "tavern", null, 390, 844],
  ["tavern-tablet", "tavern", null, 768, 1024],
  ["community", "river-willows", "meadow-clearing-sign", 768, 1024],
];
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  try {
    for (const [name, scene, anchor, width, height, overview] of points) {
      const data = world.scenes[scene],
        model = new World(data);
      const target = anchor
        ? data.entities.find((e) => e.id === anchor)
        : data.spawn;
      assert(target, name);
      const state = {
        scene,
        muted: true,
        flags: {},
        inventory: scene === "overworld" ? {} : { boat: 1 },
      };
      model.refresh(state);
      const spots = [];
      for (let dy = 0; dy <= 6; dy += 0.5)
        for (let dx = -6; dx <= 6; dx += 0.5)
          spots.push({
            x: (target.x + dx) * 16,
            y: (target.y + dy) * 16,
            d: dx * dx + dy * dy,
          });
      const safe = spots
        .sort((a, b) => a.d - b.d)
        .find((p) => model.canStand(p.x, p.y));
      assert(safe, "Review point is reachable: " + name);
      state.position = { x: safe.x, y: safe.y };
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
      });
      page.on("pageerror", (e) => errors.push(name + ": " + e.message));
      await page.route("**/*", (r) =>
        ["GET", "HEAD"].includes(r.request().method()) &&
        new URL(r.request().url()).origin === origin
          ? r.continue()
          : r.abort(),
      );
      await page.addInitScript(
        (s) => localStorage.setItem("magikitos.adventure", JSON.stringify(s)),
        state,
      );
      await page.goto(origin + "/bosque/explorar");
      await require("./browser-entry.cjs").enterWorld(page);
      if (overview) {
        await page.mouse.move(width / 2, height / 2);
        for (let i = 0; i < 6; i++) {
          await page.mouse.wheel(0, 1400);
          await page.waitForTimeout(50);
        }
      }
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(output, name + ".png") });
      fs.writeFileSync(
        path.join(output, name + ".json"),
        JSON.stringify(
          await page.evaluate(() => window.MagikitosAdventure.inspect()),
          null,
          2,
        ),
      );
      await page.close();
      console.log("REVIEW " + name);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
