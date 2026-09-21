"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const { WALK_SPEED, RUN_SPEED } = require("../public/assets/js/adventure/locomotion");
const origin = process.env.OFFLINE_GAME_ORIGIN || "http://127.0.0.1:47838";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw Error("Local tests only");

// Only the test entry exposes the instance so time can be stepped deterministically.
// Physics, input intent, sheets, renderer and scene code are the real modules.
// Production exposes inspect() only; no test hooks are shipped.
async function reviewBundle() {
  const esbuild = require("esbuild");
  try {
    const result = await esbuild.build({
      stdin: { resolveDir: process.cwd(), contents: fs.readFileSync("public/assets/js/aventura.js", "utf8")
        .replace('require("./adventure/game")', 'require("./public/assets/js/adventure/game")')
        .replace("game.init();", "window.gaitReview = game; game.init();") },
      bundle: true, write: false, platform: "browser",
    });
    return result.outputFiles[0].text;
  } finally { esbuild.stop(); }
}

(async () => {
  const bundle = await reviewBundle();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [], report = [];
  fs.mkdirSync(".local/gait-review", { recursive: true });
  try {
    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1000 });
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
      await page.route("**/assets/js/aventura.min.js*", r => r.fulfill({ contentType: "text/javascript", body: bundle }));
      await page.addInitScript(() => localStorage.setItem("magikitos.adventure", JSON.stringify({ muted: true })));
      await page.goto(origin + "/bosque/explorar");
      await enterWorld(page);
      const variants = await page.evaluate(() => {
        const g = window.gaitReview;
        cancelAnimationFrame(g.frame);
        g.trace = [];
        const render = g.renderer.drawRenderable.bind(g.renderer);
        g.renderer.drawRenderable = (ctx, entity, ...args) => {
          if (entity.player) {
            const painted = g.renderer.actorArt.frame(entity.sprite);
            g.trace.push({ sprite: entity.sprite, painted, available: Boolean(g.renderer.sprites.frame(painted)),
              x: entity.x, y: entity.y, phase: entity.gaitPhase });
          }
          return render(ctx, entity, ...args);
        };
        // Find a real, empty clearing. Never assume authored scene coordinates.
        const special = g.world.entities.filter(e => e.threshold || e.animal);
        const radius = 280;
        outer: for (let y = radius; y < g.world.height * 16 - radius; y += 32) {
          for (let x = radius; x < g.world.width * 16 - radius; x += 32) {
            if (special.some(e => Math.hypot(e.x - x, e.y - y) < 400)) continue;
            if (g.world.actors.some(e => Math.hypot(e.x - x, e.y - y) < radius + 100)) continue;
            let clear = true;
            for (let a = 0; a < 8 && clear; a++) for (let r = 0; r <= radius; r += 6)
              if (!g.world.canStand(x + Math.cos(a * Math.PI / 4) * r, y + Math.sin(a * Math.PI / 4) * r)) { clear = false; break; }
            if (clear) { g.reviewStart = { x, y }; break outer; }
          }
        }
        if (!g.reviewStart) throw Error("No eight-direction clearing for the gait review");
        return g.inspect().cast.offered;
      });
      for (const variant of variants) {
        await page.evaluate(async variant => { await gaitReview.wear(variant, { push: false }); }, variant);
        const result = await page.evaluate(({ variant, width }) => {
          const g = gaitReview, results = [];
          const directions = [
            ["down", ["ArrowDown"]], ["down-right", ["ArrowDown", "ArrowRight"]],
            ["right", ["ArrowRight"]], ["up-right", ["ArrowUp", "ArrowRight"]],
            ["up", ["ArrowUp"]], ["up-left", ["ArrowUp", "ArrowLeft"]],
            ["left", ["ArrowLeft"]], ["down-left", ["ArrowDown", "ArrowLeft"]],
          ];
          const reducedModes = variant === g.inspect().cast.offered[0] ? [false, true] : [false];
          for (const reduced of reducedModes) for (const pace of ["walk", "run"]) for (const [direction, keys] of directions) {
            g.reducedMotion = reduced;
            g.journey.clear(); g.input.map.clear();
            Object.assign(g.player, g.reviewStart, { direction, gaitPhase: 0, walkDistance: 0 });
            g.cameraFollowing = true; g.focusPoint = null; g.centerCamera(true);
            g.keys = new Set([...keys.map(k => k.toLowerCase()), ...(pace === "run" ? [" "] : [])]);
            g.trace = [];
            for (let i = 0; i < 36; i++) { g.tick(g.lastTime + 1000 / 30); cancelAnimationFrame(g.frame); }
            const frames = g.trace, names = [...new Set(frames.map(f => f.sprite))];
            const distance = Math.hypot(g.player.x - g.reviewStart.x, g.player.y - g.reviewStart.y);
            results.push({ variant, width, reduced, pace, direction, draws: frames.length, names, distance,
              exactArt: frames.every(f => f.available && f.painted === f.sprite), phase: g.player.gaitPhase });
            g.keys.clear();
            g.tick(g.lastTime + 100); cancelAnimationFrame(g.frame);
            results.at(-1).idle = g.trace.at(-1).sprite;
          }
          g.reducedMotion = false;
          return results;
        }, { variant, width });
        for (const r of result) {
          assert.equal(r.draws, 36, `Essential movement paints every tick, including reduced motion: ${JSON.stringify(r)}`);
          assert(r.exactArt, "All requested poses are available and painted: no stationary fallback");
          assert.equal(r.names.length, r.pace === "walk" ? 3 : 4, `All expected sprite frames painted: ${JSON.stringify(r)}`);
          assert(r.names.every(n => n.startsWith(`person-${variant}-${r.direction}-${r.pace}-`)), `Correct direction/body: ${JSON.stringify(r)}`);
          assert.equal(r.idle, `person-${variant}-${r.direction}`, "Stopping restores idle, no recovery squat");
          assert(Math.abs(r.distance - (r.pace === "walk" ? WALK_SPEED : RUN_SPEED) * 1.2) < 0.001, `No movement regression: ${JSON.stringify(r)}`);
        }
        report.push(...result);
        console.log(`PASS gait browser ${width}: actor ${variant}, eight directions, walk/run/stop${result.length > 16 ? ', reduced motion' : ''}`);
      }
      // Capture both native texture scale and responsive world framing, not just metadata.
      await page.screenshot({ path: `.local/gait-review/world-${width}.png` });
      await page.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(errors, []);
  fs.writeFileSync(".local/gait-review/runtime.json", JSON.stringify(report, null, 2));
  console.log(`PASS ${report.length} actual-engine gait cases; no page errors.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
