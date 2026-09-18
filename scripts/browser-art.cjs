"use strict";
const assert = require("node:assert/strict");
async function assertRetiredActionsAbsent(page) {
  const packs = await page.evaluate(async () => {
    const { assetManifest } = JSON.parse(document.getElementById("adventure-config").textContent);
    const response = await fetch(assetManifest);
    if (!response.ok) throw new Error("Sprite manifest unavailable");
    return (await response.json()).packs;
  });
  for (const action of ["roll", "bow", "row"])
    assert(!Object.hasOwn(packs, "actor-0-" + action), action + " is absent from the served manifest, not merely unloaded");
}
let reviewBundle;
/** Exercise a complete candidate with the real engine/input before its public selector ships.
 * Only the default appearance/hull differs; no action, save, renderer or network logic is mocked. */
async function useReviewVariant(page) {
  const input = process.env.GAME_PLAYER_VARIANT, vessel = process.env.GAME_VESSEL;
  if (!input && !vessel) return;
  const variant = Number(input || require("../data/aventura/player-art.json").defaultVariant);
  const actions = require("../data/aventura/art/residents/actions/catalog.json");
  assert(Object.keys(actions.actions).every(action => actions.sheets.some(s => s.variant === variant && s.action === action)),
    "Review variant must have all seven accepted actions");
  if (vessel) assert(Object.hasOwn(require("../data/aventura/rowing.json").vessels, vessel), "Review a registered hull");
  reviewBundle ||= require("esbuild").build({
    entryPoints: ["public/assets/js/aventura.js"], bundle: true, write: false, platform: "browser",
    plugins: [{ name: "review-player", setup(build) {
      build.onLoad({filter:/[/\\]data[/\\]aventura[/\\]player-art\.json$/}, () => ({
        loader:"json",contents:JSON.stringify({...require("../data/aventura/player-art.json"),defaultVariant:variant}),
      }));
      if (vessel) build.onLoad({filter:/[/\\]data[/\\]aventura[/\\]rowing\.json$/}, () => ({
        loader:"json",contents:JSON.stringify({...require("../data/aventura/rowing.json"),defaultVessel:vessel}),
      }));
    }}],
  }).then(result => result.outputFiles[0].text)
    // Plugin callbacks otherwise keep esbuild's service alive after the browser
    // has closed, preventing batch reviews from advancing to the next hull.
    .finally(() => require("esbuild").stop());
  const body = await reviewBundle;
  await page.route("**/assets/js/aventura.min.js*", route => route.fulfill({
    contentType:"application/javascript",body,
  }));
}
module.exports = { assertRetiredActionsAbsent, useReviewVariant };
