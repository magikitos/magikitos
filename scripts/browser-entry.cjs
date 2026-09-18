"use strict";
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
  if (process.env.GAME_PLAYER_VARIANT)
    require("node:assert/strict").equal(
      await page.evaluate(() => window.MagikitosAdventure.inspect().player.variant),
      Number(process.env.GAME_PLAYER_VARIANT), "The real game is using the requested review character",
    );
}
module.exports = { enterWorld };
