"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { World } = require("../public/assets/js/adventure/model");
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const out = path.resolve(".local/woodland-review");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [],
    reports = [];
  try {
    for (const [name, scene, x, y, w, h] of [
      ["village", "overworld", 64, 32, 1440, 900],
      ["picnic", "overworld", 25, 52.5, 1440, 900],
      ["clearing", "overworld", 27.5, 71.5, 1440, 900],
      ["bridge", "overworld", 45, 55.5, 1440, 900],
      ["camp", "overworld", 105, 83, 1440, 900],
      ["jetty", "overworld", 91, 45, 1440, 900],
      ["leaf-home", "house", null, null, 1440, 900],
      ["boot-home", "tavern", null, null, 1440, 900],
      ["stump-home", "cottage", null, null, 1440, 900],
      ["workshop", "workshop", null, null, 1440, 900],
      ["attic", "attic", null, null, 1440, 900],
      ["village-mobile", "overworld", 60, 32, 390, 844],
      ["picnic-mobile", "overworld", 25, 52.5, 390, 844],
      ["house-mobile", "house", null, null, 390, 844],
      ["house-tablet", "house", null, null, 1024, 768],
      ["clearing-tablet", "overworld", 27.5, 71.5, 1024, 768],
    ]) {
      const state = {
        scene,
        position: {
          x: (x ?? world.scenes[scene].spawn.x) * 16,
          y: (y ?? world.scenes[scene].spawn.y) * 16,
        },
        flags: {  },
        inventory: {},
        timers: {},
        muted: true,
      };
      const model = new World(world.scenes[scene]);
      model.refresh(state);
      const positions = [];
      for (let dy = -64; dy <= 64; dy += 4)
        for (let dx = -64; dx <= 64; dx += 4)
          positions.push({
            x: state.position.x + dx,
            y: state.position.y + dy,
            distance: dx * dx + dy * dy,
          });
      const safe = positions
        .sort((a, b) => a.distance - b.distance)
        .find((p) => model.canStand(p.x, p.y));
      assert(safe, "A safe review point exists near " + name);
      state.position = { x: safe.x, y: safe.y };
      const p = await browser.newPage({
        viewport: { width: w, height: h },
        hasTouch: true,
      });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.route("**/*", (r) =>
        ["127.0.0.1", "magikitos.ddev.site"].includes(
          new URL(r.request().url()).hostname,
        )
          ? r.continue()
          : r.abort(),
      );
      await p.addInitScript(
        (s) => localStorage.setItem("magikitos.adventure", JSON.stringify(s)),
        state,
      );
      await p.goto(origin + "/aventura");
      await require("./browser-entry.cjs").enterWorld(p);
      await p.waitForTimeout(350);
      await p.screenshot({ path: path.join(out, name + ".png") });
      const report = await p.evaluate(() => ({
        state: window.MagikitosAdventure.inspect(),
        images: performance
          .getEntriesByType("resource")
          .filter((r) => r.name.endsWith(".png"))
          .map((r) => ({ url: r.name, bytes: r.encodedBodySize })),
      }));
      if (scene !== "workshop")
        assert(
          Math.hypot(
            report.state.player.x - state.position.x,
            report.state.player.y - state.position.y,
          ) < 1,
          "Review reached its intended viewpoint instead of silently falling back to spawn: " +
            name,
        );
      assert(
        !report.images.some((r) => r.url.includes("/art/")),
        "No source masters in browser",
      );
      reports.push({ name, ...report });
      await p.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(reports, null, 2),
    );
    console.log(
      "PASS: 16 visual scene/device captures; no JS errors, no source artwork downloads. " +
        out,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
