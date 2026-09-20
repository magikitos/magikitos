"use strict";
const { World, TILE } = require("./model");
const { portalArrival } = require("./portals");
const { cleanWallet } = require("./economy");
const { cleanNeeds, cleanTraces } = require("./needs");
const { cleanTimers } = require("./timers");
const { canFloat } = require("./river-navigation");
const { castOffered } = require("./player-art");
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
    resources: require("./resources").cleanResources(value?.resources, catalog),
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
    /* ⛔ AQUÍ VIVÍA EL RESCATE DE LOS PASAJEROS DEL ISLOTE, y se erradicó el 17-sep-2026 con el
       islote: a quien tuviera una partida guardada allí le devolvía la barca para que no se
       quedara tirado en una isla sin salida. Hoy esa escena no existe, así que una partida que la
       nombre cae al arranque por la guarda de arriba (`Object.hasOwn`), que es tierra firme; y la
       barca dejó de ser obligatoria para moverse, así que tampoco hay nada de lo que rescatar.
       Con él se va `catalog.navigation`, que era su único dato. */
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
/**
 * ⛔ QUÉ DUENDE ERES NO ES PARTE DEL VIAJE, ASÍ QUE NO VIAJA CON ÉL.
 *
 * La partida privada se sube a la nube y se puede RESTAURAR desde una copia anterior: metiendo el
 * duende dentro, recuperar el viaje de anteayer te cambiaría la cara sin haberlo pedido, y subirlo
 * obligaría además a que el contrato del servidor lo validara como si fuera progreso. Aquí es lo
 * que es: una preferencia de este navegador que espeja lo que la cuenta ya guarda, del mismo
 * tipo que recordar si entraste a pantalla completa.
 *
 * Se limpia contra el elenco de ESTA release, así que un número de otra versión —o de un duende
 * cuya hoja se retiró— deja a la persona con el duende de la casa y nunca sin cuerpo.
 */
const CAST_KEY = "magikitos.adventure.cast";
function readCast(catalog, storage) {
  try {
    const value = Number((storage || localStorage).getItem(CAST_KEY));
    return castOffered(catalog).includes(value) ? value : null;
  } catch (_) {
    return null;
  }
}
function writeCast(variant, storage) {
  try {
    (storage || localStorage).setItem(CAST_KEY, String(variant));
  } catch (_) {}
}
module.exports = { SAVE_KEY, CAST_KEY, cleanSave, readSave, readCast, writeCast };
