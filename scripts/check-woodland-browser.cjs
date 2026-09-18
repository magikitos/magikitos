"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { chromium } = require("playwright");
const { World, collisionBounds } = require("../public/assets/js/adventure/model");
const { entityScreenPoint } = require("./browser-world.cjs");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw Error("Loopback preview only");
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
function approach(scene, id) {
  const model = new World(world.scenes[scene]); model.refresh({ flags: {}, inventory: {} });
  const target = model.entities.find(e => e.id === id), box = collisionBounds(target);
  const position = { x: box.x + box.w / 2, y: box.y + box.h + 6 };
  assert(model.canStand(position.x, position.y), "Clear authored approach: " + id);
  return position;
}
const read = (p) => p.evaluate(() => window.MagikitosAdventure.inspect());
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [];
  try {
    for (const [width, height, touch] of [
      [1440, 900, false],
      [390, 844, true],
      [1024, 768, true],
      [844, 390, false],
    ]) {
      const p = await browser.newPage({
        viewport: { width, height },
        hasTouch: touch,
      });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.route("**/*", (r) =>
        new URL(r.request().url()).origin === origin
          ? r.continue()
          : r.abort(),
      );
      const scene = "human-hedge", id = "cover-pot-1";
      await p.addInitScript(({ scene, position }) => {
        if (!localStorage.getItem("magikitos.adventure"))
          localStorage.setItem(
            "magikitos.adventure",
            JSON.stringify({
              scene,
              position,
              flags: {  },
              muted: true,
            }),
          );
      }, { scene, position: approach(scene, id) });
      await p.goto(origin + "/aventura");
      await require("./browser-entry.cjs").enterWorld(p);
      const initial = await read(p),
        before = initial.entities.find((e) => e.id === id);
      if (touch) {
        const point = await entityScreenPoint(p, world.scenes[scene], id);
        await p.touchscreen.tap(point.x, point.y);
      } else await p.keyboard.down("ArrowUp");
      await p.waitForFunction(
        ({ scene, id }) => !!window.MagikitosAdventure.inspect().objects[scene]?.[id],
        { scene, id },
        { timeout: 6000 },
      );
      await p.keyboard.up("ArrowUp");
      if (touch) await p.waitForFunction(() => !window.MagikitosAdventure.inspect().travel.intent);
      const moved = (await read(p)).entities.find((e) => e.id === id);
      assert(moved.y < before.y, "Push forward, not teleport or pull");
      assert.equal(moved.x, before.x, "Stay on one axis");
      await p.reload();
      await require("./browser-entry.cjs").enterWorld(p);
      assert(
        Math.abs(
          (await read(p)).entities.find((e) => e.id === id).y - moved.y,
        ) < 0.001,
        "Pushed position survives reload at saved precision",
      );
      await p.evaluate((position) => {
        const s = JSON.parse(localStorage.getItem("magikitos.adventure"));
        s.scene = "overworld"; s.position = position;
        localStorage.setItem("magikitos.adventure", JSON.stringify(s));
      }, approach("overworld", "no-pooping"));
      await p.reload();
      await require("./browser-entry.cjs").enterWorld(p);
      await p.keyboard.down("ArrowUp");
      await p.waitForFunction(
        () => !!window.MagikitosAdventure.inspect().dialogue,
      );
      await p.keyboard.up("ArrowUp");
      await p.keyboard.press("Enter");
      await p.keyboard.down("ArrowUp");
      await p.waitForTimeout(600);
      await p.keyboard.up("ArrowUp");
      assert.equal(
        (await read(p)).dialogue,
        null,
        "Continuing against closed sign cannot reopen it",
      );
      await p.close();
      console.log(
        "PASS private puzzle push " +
          (touch ? "touch" : "keyboard") +
          ", save/reload and contact latch " +
          width +
          "×" +
          height,
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
