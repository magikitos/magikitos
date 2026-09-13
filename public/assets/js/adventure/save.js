"use strict";
const { World, TILE } = require("./model");
const { cleanWallet } = require("./economy");
const { cleanNeeds, cleanTraces } = require("./needs");
// One development format. Validate untrusted storage; no prototype migrations.
const SAVE_KEY = "magikitos.adventure";
function cleanSave(value, catalog) {
  if (!value || typeof value !== "object" || Array.isArray(value)) value = null;
  const spawn = catalog.scenes[catalog.start].spawn;
  const state = {
    scene: catalog.start,
    position: { x: spawn.x * TILE, y: spawn.y * TILE },
    flags: {},
    inventory: {},
    wallet: cleanWallet(null, catalog),
    muted: false,
    needs: cleanNeeds(value?.needs, catalog),
    traces: cleanTraces(value?.traces, catalog),
  };
  if (!value) return state;
  for (const key of catalog.flags)
    if (value.flags?.[key] === true) state.flags[key] = true;
  for (const [key, definition] of Object.entries(catalog.items))
    if (Number.isInteger(value.inventory?.[key]) && value.inventory[key] > 0)
      state.inventory[key] = Math.min(
        value.inventory[key],
        definition.max || 99,
      );
  state.wallet = cleanWallet(value.wallet, catalog);
  if (Object.hasOwn(catalog.scenes, value.scene)) {
    state.scene = value.scene;
    const world = new World(catalog.scenes[state.scene]);
    world.refresh(state);
    state.position = world.canStand(value.position?.x, value.position?.y)
      ? { x: value.position.x, y: value.position.y }
      : { x: world.data.spawn.x * TILE, y: world.data.spawn.y * TILE };
  }
  const entrance = value.entrance;
  if (
    entrance &&
    Object.hasOwn(catalog.scenes, entrance.scene) &&
    Number.isFinite(entrance.position?.x) &&
    Number.isFinite(entrance.position?.y)
  ) {
    const world = new World(catalog.scenes[entrance.scene]);
    world.refresh(state);
    if (world.canStand(entrance.position.x, entrance.position.y))
      state.entrance = {
        scene: entrance.scene,
        position: { x: entrance.position.x, y: entrance.position.y },
      };
  }
  state.muted = value.muted === true;
  return state;
}
function readSave(catalog, storage) {
  try {
    storage ||= localStorage;
    const current = storage.getItem(SAVE_KEY);
    if (current) return cleanSave(JSON.parse(current), catalog);
    return cleanSave(null, catalog);
  } catch (_) {
    return cleanSave(null, catalog);
  }
}
module.exports = { SAVE_KEY, cleanSave, readSave };
