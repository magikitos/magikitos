"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { chromium } = require("playwright"), { startStudio } = require("./browser-studio.cjs");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "magikitos-dock-studio-"));
(async () => {
  const studio = await startStudio({ port: 47841, temp, timeoutMs: 300000 });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  try {
    for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on("pageerror", e => errors.push(e.message));
      await page.goto("http://127.0.0.1:47841");
      await page.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
      await page.locator("#scene").selectOption("overworld");
      await page.waitForFunction(() => window.MagikitosStudio.inspect().scene === "overworld");
      await page.evaluate(() => window.MagikitosStudio.select("dock-access-woodland", "docks"));
      await page.locator("#body-edit").click();
      await page.waitForFunction(() => window.MagikitosStudio.inspect().bodyEditing);
      assert.equal(await page.evaluate(() => window.MagikitosStudio.inspect().bodyScope), "dock-jetty/planks");
      await page.locator('[data-box="entrance"]').click();
      await page.locator("#body-x").fill("1.5"); await page.locator("#body-x").press("Tab");
      assert(await page.locator("#body-finish").isDisabled(), "Access in water must not be saved");
      await page.locator("#body-x").fill("-0.5"); await page.locator("#body-x").press("Tab");
      assert(await page.locator("#body-finish").isEnabled());
      await page.locator("#body-finish").click();
      await page.waitForFunction(() => window.MagikitosStudio.inspect().elements["dock-jetty"]?.planks?.entrance?.[0] === -0.5);
      await page.keyboard.press("Meta+s");
      await page.waitForFunction(() => !window.MagikitosStudio.inspect().dirty);
      await page.locator("#scene").selectOption("river-willows");
      await page.waitForFunction(() => window.MagikitosStudio.inspect().scene === "river-willows");
      await page.evaluate(() => window.MagikitosStudio.select("dock-access-bank", "docks"));
      await page.locator("#body-edit").click();
      assert.equal(await page.evaluate(() => window.MagikitosStudio.inspect().bodyEntrance[0]), -0.5);
      await page.keyboard.press("Escape"); await page.reload();
      await page.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
      assert.equal(await page.evaluate(() => window.MagikitosStudio.inspect().elements["dock-jetty"].planks.entrance[0]), -0.5);
      await page.close(); console.log(`PASS dock editor/save/scene/reload ${width}×${height}`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); studio.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
