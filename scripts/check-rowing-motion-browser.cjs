"use strict";
/** Capture complete strokes from the actual game canvas, without freezing/replacing its renderer.
 * Isolated offline browser saves only; never use the owner's browser, account or production. */
const assert = require("node:assert/strict"), fs = require("node:fs");
const { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const { useReviewVariant } = require("./browser-art.cjs");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { World } = require("../public/assets/js/adventure/model");
const { canFloat } = require("../public/assets/js/adventure/river-navigation");
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
const variant = Number(process.env.GAME_PLAYER_VARIANT || require("../data/aventura/player-art.json").defaultVariant);
const vessel = process.env.GAME_VESSEL || "bottle";
const hullDefinition = require("../data/aventura/rowing.json").vessels[vessel];
assert(hullDefinition, "Review a registered vessel");
// Reserve-hull previews do not replace the real inventory: its bottle icon still
// needs the default hull. No other unused reserve may be downloaded.
const vesselDefinitions = require("../data/aventura/rowing.json");
const expectedHulls = [...new Set([hullDefinition.pack,
  vesselDefinitions.vessels[vesselDefinitions.defaultVessel].pack])].sort();
assert(Number.isSafeInteger(variant));
const origin = "http://127.0.0.1:47834", directory = `.local/vessel-art-reviews/${variant}/${vessel === "bottle" ? "game" : vessel + "-game"}`;
const headings = {
  down: ["ArrowDown"], "down-right": ["ArrowDown", "ArrowRight"], right: ["ArrowRight"],
  "up-right": ["ArrowUp", "ArrowRight"], up: ["ArrowUp"],
  "up-left": ["ArrowUp", "ArrowLeft"], left: ["ArrowLeft"], "down-left": ["ArrowDown", "ArrowLeft"],
};
// Derive a wide, valid review position from the map; no test coordinates in the game.
const map = new World(world.scenes.overworld);
let position;
for (let y = 8; y < map.height - 8 && !position; y++) for (let x = 8; x < map.width - 8 && !position; x++) {
  const p = { x: x * 16, y: y * 16 };
  if (canFloat(map, p.x, p.y) && Array.from({ length: 16 }, (_, i) => i * Math.PI / 8)
    .every(a => canFloat(map, p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90))) position = p;
}
assert(position, "A real open-water location is required");
const save = cleanSave({ scene: "overworld", position, muted: true,
  inventory: { boat: 1, oars: 1, knife: 1 }, navigation: { mode: "boat", direction: "down" } }, world);
async function contactSheet(browser, images, filename, reduced) {
  const review = await browser.newPage({ viewport: { width: 1536, height: reduced ? 224 : 896 } });
  try {
    await review.setContent('<body style="margin:0;background:#24484b"><canvas id="contact"></canvas></body>');
    await review.evaluate(async ({ images, reduced }) => {
      const canvas = document.querySelector('#contact'); canvas.width = 1536; canvas.height = reduced ? 224 : 896;
      const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
      for (const item of images) {
        const image = new Image(); image.src = item.image; await image.decode();
        const x = item.column * 192, y = item.phase * 224;
        c.drawImage(image, x, y); c.fillStyle = '#f2e9cb'; c.font = '12px monospace';
        c.fillText(item.direction + ' / ' + item.phase, x + 4, y + 216);
      }
    }, { images, reduced });
    await review.locator('#contact').screenshot({ path: filename });
  } finally { await review.close(); }
}
(async () => {
  fs.mkdirSync(directory, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true }), errors = [];
  try {
    for (const [width, height, dpr, reduced] of [[1440, 900, 1, false], [768, 1024, 2, false],
      [390, 844, 3, false], [390, 844, 3, true]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr,
        hasTouch: width < 1000, reducedMotion: reduced ? "reduce" : "no-preference" });
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin || !["GET", "HEAD"].includes(route.request().method())) return route.abort();
        if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503,
          contentType: "application/json", body: '{"ok":false,"error":"offline"}' });
        return route.continue();
      });
      await page.addInitScript(save => localStorage.setItem("magikitos.adventure", JSON.stringify(save)), save);
      await useReviewVariant(page);
      const images = [];
      for (const [direction, keys] of Object.entries(headings)) {
        await page.goto(origin + "/bosque/explorar"); await enterWorld(page);
        await page.waitForFunction(({ variant, pack }) => {
          const s = window.MagikitosAdventure.inspect();
          return s.player.variant === variant && s.assets.loaded.includes(`actor-${variant}-row`) && s.assets.loaded.includes(pack);
        }, { variant, pack: hullDefinition.pack });
        await page.locator("#world-canvas").focus();
        for (const key of keys) await page.keyboard.down(key);
        const frames = await page.evaluate(({ direction, reduced }) => new Promise((resolve, reject) => {
          const result = {}, start = performance.now();
          function sample() {
            const s = window.MagikitosAdventure.inspect(), phase = s.vessel?.phase;
            if (s.vessel?.direction === direction && !result[phase]) {
              const source = document.querySelector("#world-canvas"), crop = document.createElement("canvas");
              crop.width = 192; crop.height = 200;
              const c = crop.getContext("2d"), scaleX = source.width / s.view.width, scaleY = source.height / s.view.height;
              c.imageSmoothingEnabled = false;
              c.drawImage(source, (s.player.x - s.camera.x - 48) * scaleX,
                (s.player.y - s.camera.y - 52) * scaleY, 96 * scaleX, 100 * scaleY, 0, 0, 192, 200);
              result[phase] = { image: crop.toDataURL(), rower: s.vessel.rower, hull: s.vessel.hull,
                position: { x: s.player.x, y: s.player.y }, elapsed: performance.now() - start,
                bytes: s.assets.bytes + s.assets.reservedBytes, budget: s.assets.budget,
                loadedHulls: s.assets.loaded.filter(id => id.startsWith('vessel-')) };
            }
            if (reduced ? performance.now() - start >= 900 : Object.keys(result).length === 4) return resolve(result);
            if (performance.now() - start > 4000) return reject(Error("Missing rowing phases: " + direction));
            requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        }), { direction, reduced });
        for (const key of keys) await page.keyboard.up(key);
        assert.deepEqual(Object.keys(frames).sort(), reduced ? ["0"] : ["0", "1", "2", "3"]);
        for (const [phase, frame] of Object.entries(frames)) {
          assert.equal(frame.rower, `person-${variant}-${direction}-row-${phase}`);
          assert.equal(frame.hull, `${hullDefinition.prefix}-${direction}-0`, "Hull does not animate with the oars");
          assert.deepEqual(frame.loadedHulls.sort(), expectedHulls, "Unused reserve hulls stay unloaded");
          assert(frame.bytes <= frame.budget, "Decoded sprites stay bounded");
          const name = `${width}${reduced ? "-reduced" : ""}-${direction}-${phase}`;
          images.push({ image: frame.image, direction, phase: Number(phase), column: Object.keys(headings).indexOf(direction) });
          fs.writeFileSync(`${directory}/${name}.png`, Buffer.from(frame.image.split(",")[1], "base64"));
          delete frame.image;
        }
        fs.writeFileSync(`${directory}/${width}${reduced ? "-reduced" : ""}-${direction}.json`, JSON.stringify(frames, null, 2));
        if (direction === "down") await page.screenshot({ path: `${directory}/${width}${reduced ? "-reduced" : ""}-screen.png` });
      }
      console.log(`PASS real rowing cycle: actor ${variant}, vessel ${vessel}, eight directions, ${width}×${height}, DPR ${dpr}, reduced=${reduced}`);
      await contactSheet(browser, images, `${directory}/${width}${reduced ? '-reduced' : ''}-all-${images.length}.png`, reduced);
      await page.close();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().then(() => {
  // This standalone CLI has awaited browser.close() and writes evidence synchronously.
  // macOS Chrome can leave inherited diagnostic pipes open after its process exits;
  // do not let those pipes stall the next fleet job after every assertion passed.
  process.exit(0);
}, error => { console.error(error); process.exit(1); });
