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
}
module.exports = { enterWorld };
