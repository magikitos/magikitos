"use strict";
const { World, TILE } = require("./model");
const { portalArrival } = require("./portals");
const { cleanWallet } = require("./economy");
const { cleanNeeds, cleanTraces } = require("./needs");
const { cleanTimers } = require("./timers");
const { canFloat } = require("./river-navigation");
// One storage namespace. Validate untrusted storage, preserving installed-release saves.
const SAVE_KEY = "magikitos.adventure";
function cleanSave(value, catalog) {
  if (!value || typeof value !== "object" || Array.isArray(value)) value = null;
  const spawn = catalog.scenes[catalog.start].spawn;
  const state = {
    scene: catalog.start,
    position: { x: spawn.x * TILE, y: spawn.y * TILE },
    flags: {},
    inventory: {},
    timers: cleanTimers(value?.timers, catalog),
    wallet: cleanWallet(null, catalog),
    muted: false,
    needs: cleanNeeds(value?.needs, catalog),
    traces: cleanTraces(value?.traces, catalog),
    objects: {},
    navigation: { mode: "foot", direction: "down" },
    home: value?.home === true,
    visited: Array.isArray(value?.visited)
      ? [
          ...new Set(
            value.visited.filter(
              (id) => typeof id === "string" && /^[a-f0-9]{32}$/.test(id),
            ),
          ),
        ].slice(-32)
      : [],
    keepsakes: require("./keepsakes").cleanKeepsakes(value?.keepsakes, catalog),
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
  state.objects = require("./movables").cleanPositions(
    value.objects,
    catalog,
    state,
  );
  if (Object.hasOwn(catalog.scenes, value.scene)) {
    state.scene = value.scene;
    const world = new World(catalog.scenes[state.scene]);
    world.refresh(state);
    if (
      [
        "up",
        "down",
        "left",
        "right",
        "up-left",
        "up-right",
        "down-left",
        "down-right",
      ].includes(value.navigation?.direction)
    )
      state.navigation.direction = value.navigation.direction;
    if (
      value.navigation?.mode === "boat" &&
      state.inventory.boat &&
      world.data.navigation &&
      canFloat(world, value.position?.x, value.position?.y)
    )
      state.navigation.mode = "boat";
    if (
      world.data.navigation?.landings.some(
        (l) => l.id === value.navigation?.landing,
      )
    )
      state.navigation.landing = value.navigation.landing;
    // Existing ferry passengers on the island must not be stranded by the new transport rules.
    if (
      !value.navigation &&
      catalog.navigation?.restoreBoatIn.includes(value.scene)
    ) {
      state.inventory.boat = 1;
      state.flags.boatBuilt = true;
    }
    state.position =
      state.navigation.mode === "boat" ||
      world.canStand(value.position?.x, value.position?.y)
        ? { x: value.position.x, y: value.position.y }
        : { x: world.data.spawn.x * TILE, y: world.data.spawn.y * TILE };
  }
  const entrance = value.entrance;
  if (entrance && portalArrival(catalog, entrance.scene, entrance.portal))
    state.entrance = { scene: entrance.scene, portal: entrance.portal };
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
