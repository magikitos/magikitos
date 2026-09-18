"use strict";
const assert = require("node:assert/strict");
const { World, TILE } = require("../public/assets/js/adventure/model");
const fs = require("node:fs");
const { artworkBounds } = require("../public/assets/js/adventure/entity-art");
const { frameName } = require("../public/assets/js/adventure/elements");
const { matches } = require("../public/assets/js/adventure/rules");

/** Test fixtures follow authored anchors instead of retaining stale map coordinates. */
function nearbyPosition(data, state, id) {
  const world = new World(data);
  world.refresh({ flags: {}, inventory: {}, ...state });
  const entity = world.entities.find((e) => e.id === id);
  assert(entity, "Existing test anchor: " + id);
  for (const [dx, dy] of [
    [0, 3],
    [2, 3],
    [-2, 3],
    [0, 4],
    [3, 0],
    [-3, 0],
  ]) {
    const point = { x: entity.x + dx * TILE, y: entity.y + dy * TILE };
    if (world.canStand(point.x, point.y)) return point;
  }
  throw new Error("No safe test approach to " + id);
}
/** Tap what is actually drawn: native crop, authored scale and offset, then the live camera. */
async function entityScreenPoint(page, data, id) {
  const state = await page.evaluate(() => window.MagikitosAdventure.inspect());
  const world = new World(data), entity = world.entities.find((e) => e.id === id);
  assert(entity, "Existing visual target: " + id);
  const sprite = entity.visuals?.find((v) => matches(state, v.when))?.sprite || frameName(entity);
  const manifest = JSON.parse(fs.readFileSync("public/assets/aventura/manifest.json"));
  const pack = Object.values(manifest.packs).find((p) => p.sprites.includes(sprite));
  assert(pack, "Target art exists: " + sprite);
  const frame = JSON.parse(fs.readFileSync("public/assets/aventura/" + pack.metadata)).frames[sprite];
  const bounds = artworkBounds(entity, frame);
  const canvas = await page.locator("#world-canvas").boundingBox();
  return {
    x: canvas.x + (bounds.x + bounds.w / 2 - state.camera.x) * canvas.width / state.view.width,
    y: canvas.y + (bounds.y + bounds.h / 2 - state.camera.y) * canvas.height / state.view.height,
  };
}
module.exports = { nearbyPosition, entityScreenPoint };
