"use strict";
/** Real keyboard events against the shipped game. The arena only removes random
 * encounters; a deliberate broken bundle proves this regression test can fail. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { build } = require("esbuild");
const { fulfillArena } = require("./lib/input-arena.cjs");
const { enterWorld } = require("./browser-entry.cjs");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["localhost", "127.0.0.1", "magikitos.ddev.site"].includes(new URL(origin).hostname))
  throw Error("Local test only");

async function brokenInputBundle() {
  const result = await build({
    entryPoints: ["public/assets/js/aventura.js"], bundle: true, write: false,
    plugins: [{
      name: "dialogue-regression",
      setup(builder) {
        builder.onLoad({ filter: /\/adventure\/input\.js$/ }, async ({ path }) => {
          const source = fs.readFileSync(path, "utf8");
          const marker = "game.closeDialogue();\n          } else if";
          assert(source.includes(marker), "Mutation still targets the movement branch");
          return { contents: source.replace(marker, "return;\n          } else if"), loader: "js" };
        });
      },
    }],
  });
  return result.outputFiles[0].text;
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  try {
    async function open(viewport, broken) {
      const page = await browser.newPage({ viewport, ignoreHTTPSErrors: true });
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(15000);
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", async route => {
        const request = route.request(), url = new URL(request.url());
        if (!["GET", "HEAD"].includes(request.method()) || url.origin !== origin)
          return route.abort();
        if (url.pathname.startsWith("/api/"))
          return route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false,"error":"offline"}' });
        if (broken && url.pathname.endsWith("/js/aventura.min.js"))
          return route.fulfill({ contentType: "text/javascript", body: broken });
        if (url.pathname === "/bosque/explorar") return fulfillArena(route);
        return route.continue();
      });
      await page.addInitScript(() => localStorage.setItem("magikitos.adventure", JSON.stringify({
        scene: "overworld", position: { x: 1000, y: 958 }, muted: true,
      })));
      return page;
    }
    async function talk(page) {
      await page.goto(origin + "/bosque/explorar");
      await enterWorld(page);
      const point = await page.evaluate(() => {
        const s = window.MagikitosAdventure.inspect();
        const e = s.entities.find(e => e.id === "test-sign");
        const r = document.getElementById("world-canvas").getBoundingClientRect();
        return {
          x: r.x + (e.x - s.camera.x) * r.width / s.view.width,
          y: r.y + (e.y - 13 - s.camera.y) * r.height / s.view.height,
        };
      });
      await page.mouse.click(point.x, point.y);
      await page.waitForFunction(() => !!window.MagikitosAdventure.inspect().dialogue);
    }
    async function walkAndClose(page, key, mutation = false) {
      await talk(page);
      const before = await page.evaluate(() => window.MagikitosAdventure.inspect().player);
      await page.keyboard.down(key);
      try {
        // The dialogue change is synchronous in keydown; no timeout disguises the mutant.
        assert.equal(await page.evaluate(() => window.MagikitosAdventure.inspect().dialogue), null,
          "The same movement press closes the dialogue");
        if (!mutation)
          await page.waitForFunction(p => {
            const s = window.MagikitosAdventure.inspect();
            return Math.hypot(s.player.x - p.x, s.player.y - p.y) > 2;
          }, before, { timeout: 2000 });
      } finally { await page.keyboard.up(key); }
    }
    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [844, 390]]) {
      const page = await open({ width, height });
      for (const key of ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "w", "a", "s", "d", "z", "q"])
        await walkAndClose(page, key);
      await page.close();
      console.log(`PASS dialogue + same-press movement: arrows/WASD/ZQ at ${width}×${height}`);
    }
    const mutant = await open({ width: 1440, height: 900 }, await brokenInputBundle());
    await assert.rejects(() => walkAndClose(mutant, "ArrowDown", true),
      e => e.code === "ERR_ASSERTION" && e.message.includes("same movement press"));
    await mutant.close();
    assert.deepEqual(errors, []);
    console.log("PASS negative control: restoring the old keyboard bug makes the browser test fail.");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
