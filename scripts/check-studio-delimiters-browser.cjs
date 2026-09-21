"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"),
  path = require("node:path"), crypto = require("node:crypto");
const { chromium } = require("playwright"), { startStudio } = require("./browser-studio.cjs");
const { families } = require("../tools/adventure-studio/catalog");
const delimiters = Object.fromEntries(Object.entries(families).filter(([, f]) => f.boundary));
const port = 47847, origin = "http://127.0.0.1:" + port;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "magikitos-studio-delimiters-"));
// Only this temporary workspace is writable by the test. The owner's Studio stays open.
const digest = dir => Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f =>
  [f, crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, f))).digest("hex")]));
const gameBefore = digest("data/aventura/scenes"), packsBefore = digest("public/assets/aventura");
const inspect = p => p.evaluate(() => window.MagikitosStudio.inspect());
const ready = p => p.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
const saved = p => p.waitForFunction(() => !window.MagikitosStudio.inspect().dirty);
let studio, browser;
(async () => {
  studio = await startStudio({ port, temp, timeoutMs: 600000 });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  fs.mkdirSync(".local/screenshots", { recursive: true });
  for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    await page.goto(origin); await ready(page);
    await page.locator("#gallery summary").click();
    await page.selectOption("[data-gallery-category]", "Delimitadores");
    assert.equal(await page.locator(".gallery-card").count(), 6);
    assert.equal(await page.locator('.gallery-card option[value="auto"]').count(), 0);
    let canopy, rock;
    // Every orientation/length goes through the real UI, validator, autosave and renderer.
    for (const [family, definition] of Object.entries(delimiters)) {
      for (const variant of definition.variants) {
        const card = page.locator(`[data-family="${family}"]`);
        await card.locator("select").selectOption(variant.id);
        await card.locator("button").click();
        const state = await inspect(page), id = state.selected.id;
        assert.equal(state.changes.overworld.added[id].artVariant, variant.id);
        assert.equal(await page.locator("#variant").inputValue(), variant.id);
        assert.equal(await page.locator('#variant option[value="auto"]').count(), 0);
        if (family.includes("canopy")) canopy = id; else rock = id;
        // Distribute test pieces without applying any of these placements to source scenes.
        const index = Object.keys(state.changes.overworld.added).length - 1;
        await page.locator("#x").fill(String(12 + (index % 4) * 22));
        await page.locator("#x").press("Tab");
        await page.locator("#y").fill(String(14 + (Math.floor(index / 4) % 4) * 18));
        await page.locator("#y").press("Tab");
      }
    }
    await page.locator("#scale-percent").fill("75");
    await page.locator("#scale-percent").press("Tab");
    assert.equal((await inspect(page)).changes.overworld.added[rock].scale, 0.75);
    assert.match(await page.locator("#transform-help").innerText(), /Extremos naturales/);
    await saved(page);
    const placed = await inspect(page);
    await page.reload(); await ready(page);
    assert.deepEqual((await inspect(page)).changes, placed.changes, "All pieces and transforms survive reload");
    await page.locator("#hide-trees").click();
    let hidden = await inspect(page);
    assert(!hidden.visibleElements.some(e => e.id === canopy));
    assert(hidden.visibleElements.some(e => e.id === rock));
    await page.locator("#hide-trees").click();
    await page.locator(`#elements [data-id="${rock}"]`).click();
    await page.locator("#map").focus();
    await page.keyboard.press("Backspace");
    assert(!(await inspect(page)).changes.overworld.added[rock]);
    await page.locator("#undo").click();
    assert((await inspect(page)).changes.overworld.added[rock]);
    await saved(page);
    await page.locator('[data-scene-target="river-willows"]').click();
    await page.locator('[data-scene-target="overworld"]').click();
    assert.deepEqual((await inspect(page)).changes, placed.changes);
    const result = await (await page.request.get(origin + "/api/diff")).json();
    assert.equal(result.conflicts.length, 0);
    assert.equal(result.scenes.find(s => s.scene === "overworld").previewFamilies, undefined);
    await page.locator("#gallery summary").click();
    await page.selectOption("[data-gallery-category]", "Delimitadores");
    await page.locator("#fit").click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `.local/screenshots/studio-delimiters-${width}.png`, fullPage: true });
    console.log(`PASS Studio delimiters ${width}×${height}: 16 variants, scales, rendered palette, autosave/reload, two-scene persistence, tree filter, delete/undo and shared catalogue diff.`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(digest("data/aventura/scenes"), gameBefore);
  assert.deepEqual(digest("public/assets/aventura"), packsBefore);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  studio?.kill("SIGTERM");
  await browser?.close();
});
