"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { chromium } = require("playwright");
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
const shots = path.resolve(".local/screenshots/room-polish");
fs.mkdirSync(shots, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [];
  try {
    for (const [scene, width, height, position] of [
      ["cottage", 1440, 900],
      ["house", 1440, 900],
      ["attic", 1440, 900],
      ["cottage", 390, 844],
      ["house", 390, 844],
      ["house", 768, 1024],
      ["overworld", 1200, 850, { x: 27.5 * 16, y: 71.5 * 16 }],
      ["overworld", 390, 844, { x: 27.5 * 16, y: 71.5 * 16 }],
      ["overworld", 1200, 850, { x: 105.5 * 16, y: 85 * 16 }],
    ]) {
      const p = await browser.newPage({ viewport: { width, height } });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.route("**/*", (route) =>
        new URL(route.request().url()).hostname === "127.0.0.1"
          ? route.continue()
          : route.abort(),
      );
      const spawn = world.scenes[scene].spawn;
      await p.addInitScript(
        (state) =>
          localStorage.setItem("magikitos.adventure", JSON.stringify(state)),
        {
          scene,
          position: position || { x: spawn.x * 16, y: spawn.y * 16 },
          flags: {  },
          muted: true,
        },
      );
      await p.goto("http://127.0.0.1:47834/bosque/explorar");
      await require("./browser-entry.cjs").enterWorld(p);
      await p.waitForTimeout(250);
      const state = await p.evaluate(() => window.MagikitosAdventure.inspect());
      console.log(scene, width, state.scale, state.camera);
      await p.screenshot({
        path: path.join(
          shots,
          scene + "-" + width + (position ? "-" + position.y : "") + ".png",
        ),
      });
      await p.close();
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
