"use strict";
/** No API mocks: installed game → DDEV HTTPS/WSS proxy → PHP → live observation → MariaDB.
 * Only the uniquely marked fixture has a due need. No real user's save or inventory is edited. */
const assert = require("node:assert/strict"), path = require("node:path"), fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const origin = "https://magikitos.ddev.site", website = path.resolve(__dirname, "../../magikitos");
function fixture(action, value) {
  return JSON.parse(execFileSync("ddev", ["exec", "php", "scripts/lib/forest-live-fixture.php", action],
    { cwd: website, encoding: "utf8", timeout: 30000, input: value ? JSON.stringify(value) : undefined }));
}
(async () => {
  let user, browser;
  const issues = [];
  try {
    user = fixture("create");
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
      ignoreHTTPSErrors: true }); // Only the fixed local DDEV origin above.
    await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addInitScript(({ bearer, origin }) => {
      if (location.origin === origin) localStorage.setItem("magikitos_session", bearer);
    }, { bearer: user.bearer, origin });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    page.on("pageerror", error => issues.push(error.message));
    await page.goto(origin + "/aventura"); await enterWorld(page);
    try {
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.role === "player" &&
        window.MagikitosAdventure.inspect().needStatus === "poop");
    } catch (error) {
      console.error(await page.evaluate(() => {
        const g = window.MagikitosAdventure.inspect(); return { live: g.live, sync: g.sync, need: g.needStatus, player: g.player };
      }));
      throw error;
    }
    await page.locator("#self-toggle").tap();
    await page.locator("#self-poop").tap();
    await page.locator('#dialogue-actions [data-action="write"]').tap();
    const text = '  Una notita 🌱\nمرحبا — :reward <b>esto es texto, no HTML</b>\n  ';
    await page.locator("#forest-note-text").fill(text);
    await page.locator("#forest-note-publish").tap();
    await page.waitForFunction(() => !document.getElementById("forest-note-dialog").open);
    const response = await page.request.get(origin + "/api/world/forest-messages?zone=overworld");
    assert.equal(response.status(), 200);
    const published = (await response.json()).messages.find(row => row.author.handle === user.handle);
    assert(published);
    assert.equal(published.text, text, "Actual MariaDB and PHP preserve every code point and whitespace");
    const bankResponse = await page.request.get(origin + "/api/world/game-account", { headers: { Authorization: "Bearer " + user.bearer } });
    const bank = (await bankResponse.json()).account;
    assert.equal(bank.inventory.leaf, 1);
    assert.equal(bank.inventory.twig, 1);
    const snapshot = await page.evaluate(() => window.MagikitosAdventure.inspect());
    assert.equal(snapshot.needStatus, "comfortable");
    assert.equal(snapshot.traces.filter(t => t.kind === "poop").length, 0, "Shared dropping is not duplicated in the local save");
    const point = await page.evaluate(trace => {
      const g = window.MagikitosAdventure.inspect(), box = document.getElementById("world-canvas").getBoundingClientRect();
      return { x: box.left + (trace.x - g.camera.x) / g.view.width * box.width,
        y: box.top + (trace.y - 14 - g.camera.y) / g.view.height * box.height };
    }, published);
    assert(point.x > 40 && point.y > 90, "The real note is visible clear of the HUD");
    await page.touchscreen.tap(point.x, point.y);
    await page.waitForFunction(text => document.getElementById("dialogue-text").textContent === text, text);
    assert.equal(await page.locator("#dialogue-text b").count(), 0);
    fs.mkdirSync(".local/forest-review", { recursive: true });
    await page.screenshot({ path: ".local/forest-review/ddev-mobile.png" });
    await page.reload(); await enterWorld(page);
    await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.role === "player");
    assert.equal(await page.evaluate(() => window.MagikitosAdventure.inspect().inventory.leaf), 1);
    assert.equal(await page.evaluate(() => window.MagikitosAdventure.inspect().inventory.twig), 1);
    fixture("ban", user);
    await page.waitForFunction(() => {
      const g = window.MagikitosAdventure.inspect();
      return g.live.failure === "forest_banned" && g.live.role === "offline" && !g.live.connected;
    });
    assert.equal(await page.evaluate(() => window.MagikitosAdventure.inspect().ready), true,
      "Live ban revokes the open socket but keeps the solo adventure playable without reload");
    const removed = await page.request.get(origin + "/api/world/forest-messages?zone=overworld");
    assert(!(await removed.json()).messages.some(row => row.id === published.id), "Manual ban removes the public note");
    await page.reload(); await enterWorld(page);
    await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.failure === "forest_banned");
    assert.equal(await page.evaluate(() => window.MagikitosAdventure.inspect().ready), true, "Solo adventure survives a denied live ticket");
    assert.deepEqual(issues, []);
    console.log("PASS real DDEV game/browser: same-origin HTTPS/WSS, authenticated due need, leaf/twig transactions, verbatim MariaDB note, no local duplicate, reload persistence, live ban without reload and solo fallback. Synthetic fixture removed.");
  } finally {
    if (browser) await browser.close();
    if (user) fixture("remove", user);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
