"use strict";
const { compileWorld } = require("../tools/world.cjs");
const assert = require("node:assert/strict");
const {
  matches,
  active,
  actions,
  planReaction,
} = require("../public/assets/js/adventure/rules");
const {
  cleanTimers,
  expireTimers,
} = require("../public/assets/js/adventure/timers");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { World, TILE } = require("../public/assets/js/adventure/model");
const catalog = compileWorld(process.cwd());
const scene = catalog.scenes.overworld,
  world = new World(scene);
const entity = (id) => world.entities.find((e) => e.id === id);
/**
 * Cada pantalla tiene que poder decir todo lo suyo con lo que trae ella más el motor, y en los
 * seis idiomas. Componer ya aborta ante una clave que falte; esto comprueba lo que de verdad ve
 * el jugador: que ninguna frase de una pantalla se resuelva a su propia clave.
 */
{
  const { composeLocales } = require("../tools/locales.cjs");
  const { core, scenes } = composeLocales(catalog);
  for (const lang of ["es", "en", "de", "fr", "it", "pt"]) {
    for (const [id, scene] of Object.entries(catalog.scenes)) {
      const say = (key) => scenes[id][lang][key] ?? core[lang][key];
      for (const e of scene.entities) {
        for (const a of e.actions || [])
          assert(say(a.label), lang + "/" + id + ": action label " + a.label);
        for (const r of e.rules)
          for (const effect of r.effects)
            if (effect.type === "dialogue")
              assert(say(effect.key), lang + "/" + id + ": dialogue " + effect.key);
      }
    }
    // El saco se abre en cualquier pantalla, así que los objetos los nombra el motor.
    for (const item of Object.values(catalog.items)) {
      assert(core[lang][item.name], lang + ": item name " + item.name);
      assert(core[lang][item.description], lang + ": item description");
    }
  }
}
let state = cleanSave(null, catalog);
const react = (id, context = {}) => {
  const before = structuredClone(state), plan = planReaction(entity(id), state, catalog, context);
  assert.deepEqual(state, before, "Planning remains pure");
  if (plan) state = plan.state;
  return plan;
};
react("picnic-neighbor");
assert.equal(state.inventory.oars, 1, "A greeting is enough to receive Brizno's oars");
assert(state.flags.oarsReceived);
assert.equal(state.wallet.balance, 0);
const once = structuredClone(state);
react("picnic-neighbor");
assert.deepEqual(state, once, "No second reward");
for (const inventory of [{ oars: 1 }, { boat: 1 }]) {
  const old = cleanSave({ inventory, flags: { picnicFed: true, skewerCooked: true } }, catalog);
  assert.deepEqual(planReaction(entity("picnic-neighbor"), old, catalog).state, old, "Old completed saves get no duplicate");
}
const old = cleanSave({ inventory: { skewer: 1, knife: 1, boat: 1 },
  flags: { picnicFed: true, skewerCooked: true, boatBuilt: true }, timers: { picnic: Date.now() + 10000 } }, catalog);
assert.deepEqual(old.inventory, { knife: 1, boat: 1 });
assert.deepEqual(old.flags, { boatBuilt: true });
assert.deepEqual(old.timers, {});
for (const e of world.entities.filter(e => e.id.startsWith("human-picnic") || e.id === "human-smoker"))
  assert(active(e, state), e.id + " remains scenery after receiving the oars");
assert(active(entity("picnic-bin"), cleanSave(null, catalog)), "Boat bottle is reachable without cooking");
assert(!actions(entity("picnic-neighbor"), state).length);
assert(!catalog.items.skewer && !catalog.contentRooms.restaurant && !catalog.timers.picnic);
for (const sc of Object.values(catalog.scenes)) for (const e of sc.entities) {
  assert(!(e.actions || []).some(a => a.id === "cook"));
  assert(!e.rules.some(r => r.effects.some(f => f.item === "skewer" || f.type === "content" && f.key === "restaurant")));
}
react("picnic-knife");
const now = Math.floor(Date.now() / 28800000) * 28800000 + 1000;
react("forest-mushrooms-fern", { now });
assert.equal(state.inventory.mushroom, 3);
assert.equal(react("forest-mushrooms-fern", { now: now + 1000 }), null, "Harvest cannot duplicate");
react("forest-mushrooms-fern", { now: now + 28800000 });
assert.equal(state.inventory.mushroom, 6, "Storehouse materials still regrow");
for (const e of world.entities.filter(e => /^picnic-(knife|lighter|twig|barbecue|neighbor)$/.test(e.id)))
  assert(world.approach({ x: scene.spawn.x * TILE, y: scene.spawn.y * TILE }, e, 7)?.length, e.id + ": walkable");
console.log("PASS picnic: gift once, old saves, no cooking or recipe publication, renewable materials, six languages and walkable side activities.");
