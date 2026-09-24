"use strict";
// Every browser check that uses this helper tidies up after itself when it exits.
process.once("exit", () => require("../tools/clean-local.cjs").cleanLocal({ quiet: true }));
/** Exercise the actual welcome gesture; tests never bypass it in production code. */
async function enterWorld(page) {
  await page.waitForFunction(() => window.MagikitosAdventure?.inspect().ready);
  const button = page.locator("#entry-start");
  if (await button.isVisible()) {
    const touch = await page.evaluate(
      () =>
        navigator.maxTouchPoints > 0 &&
        !matchMedia("(any-pointer: fine)").matches,
    );
    if (touch) await button.tap();
    else await button.click();
  }
  await page.waitForFunction(() => window.MagikitosAdventure.inspect().entered);
  await skipWelcome(page);
  if (process.env.GAME_PLAYER_VARIANT)
    require("node:assert/strict").equal(
      await page.evaluate(() => window.MagikitosAdventure.inspect().player.variant),
      Number(process.env.GAME_PLAYER_VARIANT), "The real game is using the requested review character",
    );
}
/** A blank journey opens the welcome (welcome.js), and a stray tap on the map does not close it.
 * Checks about the world skip it with its own button, the gesture a person has; the welcome
 * itself is exercised by check-welcome-browser.cjs. */
async function skipWelcome(page) {
  const skip = page.locator(".world-welcome .world-experience-links button");
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForFunction(() => document.getElementById("world-content").hidden);
    // Closing the panel eases the camera back from its reading frame; a check that taps exact
    // map coordinates must wait for it to settle, as a person would see it stop.
    await page.waitForFunction(() => {
      const c = window.MagikitosAdventure.inspect().camera, k = c.x.toFixed(1) + "," + c.y.toFixed(1);
      const same = window.__settledCamera === k;
      window.__settledCamera = k;
      return same;
    }, null, { polling: 150, timeout: 10000 });
  }
}
module.exports = { enterWorld, skipWelcome };
