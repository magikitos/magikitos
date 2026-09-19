"use strict";
// Authoring-only gallery, including file:// use; never starts the game or calls its API.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const assert = require("node:assert/strict");
const { chromium, webkit } = require("playwright");
const dir = path.resolve(__dirname, "../data/aventura/art/playable-cast/review-101-110");
const expected = { idle: 8, walk: 24, run: 32, row: 32, push: 16, work: 16, carried: 16, pee: 4, poop: 4, discover: 4 };
async function check(name, engine) {
  const browser = await engine.launch({ headless: true, ...(name === "chrome" ? { channel: "chrome" } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(dir, "index.html")).href);
    await page.waitForFunction(() => state.image !== null);
    const keys = await page.locator("#cast button").evaluateAll(items => items.map(b => b.dataset.key));
    assert.equal(keys.length, 10);
    let total = 0;
    for (const key of keys) {
      await page.locator('#cast button[data-key="' + key + '"]').click();
      await page.waitForFunction(key => state.person.key === key && state.image !== null, key);
      for (const [action, count] of Object.entries(expected)) {
        await page.selectOption("#action", action);
        await page.waitForFunction(action => state.action === action && state.image !== null, action);
        const actual = await page.evaluate(() => state.groups.reduce((n, g) => n + g.frames.length, 0));
        assert.equal(actual, count, key + "/" + action);
        total += actual;
      }
    }
    assert.equal(total, 1560);
    await page.selectOption("#action", "row");
    await page.waitForFunction(() => state.image !== null);
    await page.locator("#phase").fill("2");
    assert.equal(await page.locator("#pause").innerText(), "Reproducir");
    for (const [label, width, height] of [["desktop", 1440, 900], ["tablet", 768, 1024], ["mobile", 390, 844]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(dir, name + "-" + label + ".png"), fullPage: true });
    }
    assert.deepEqual(errors, []);
    const result = { browser: name, characters: keys.length, frames: total, views: 3, errors };
    fs.writeFileSync(path.join(dir, name + "-checks.json"), JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
}
Promise.all([check("chrome", chromium), check("webkit", webkit)]).catch(error => { console.error(error); process.exitCode = 1; });
