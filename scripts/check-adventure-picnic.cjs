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
assert.deepEqual(state.inventory, {}, "Brizno gives a clue, not river access");
assert.equal(state.wallet.balance, 0);
assert(!catalog.contentRooms.restaurant && !catalog.timers.picnic);
for (const sc of Object.values(catalog.scenes)) for (const e of sc.entities)
  assert(!e.rules.some(r => r.effects.some(f => f.type === "content" && f.key === "restaurant")));
assert(active(entity("picnic-bin"), state), "Boat bottle remains independent from the side quest");
assert(!react("picnic-barbecue", {action:"grill"}), "No cooking without ingredients and fire");
assert(!react("picnic-neighbor", {action:"share"}), "No sharing without the skewer");
for (const flags of [{}, {oarsReceived:true}, {avelinoChestOpened:true}]) {
  state = cleanSave({flags, inventory:{mushroom:5,twig:2,lighter:1,knife:1}}, catalog);
  react("picnic-barbecue",{action:"light"});
  assert(actions(entity("picnic-barbecue"),state).some(a=>a.id==="grill"));
  react("picnic-barbecue",{action:"use",item:"mushroom"});
  assert.deepEqual(state.inventory,{mushroom:3,twig:1,lighter:1,knife:1,skewer:1});
  assert(!react("picnic-barbecue",{action:"grill"}),"No second skewer in the bag");
  const offered = react("picnic-neighbor",{action:"use",item:"skewer"});
  assert(offered.effects.some(e=>e.sequence==="offer"),"Visible handoff before the joke");
  assert(state.flags.picnicSkewerMade && state.flags.picnicSkewerShared);
  assert(!state.inventory.skewer && !state.inventory.oars);
  assert.deepEqual(state.timers,{});assert.equal(state.wallet.balance,0);
  assert(!react("picnic-neighbor",{action:"share"}),"Cannot submit the joke twice");
  assert(!react("picnic-barbecue",{action:"grill"}),"Completed favour never consumes more ingredients");
  const done = structuredClone(state);
  state = cleanSave(JSON.parse(JSON.stringify(state)),catalog);
  react("picnic-neighbor");
  assert.deepEqual(state,done,"The completed joke survives reload and remains optional");
}
const old = cleanSave({inventory:{knife:1,boat:1,oars:1}, flags:{picnicFed:true,skewerCooked:true,boatBuilt:true},timers:{picnic:Date.now()+10000}},catalog);
assert.deepEqual(old.inventory,{knife:1,boat:1,oars:1});
assert.deepEqual(old.flags,{boatBuilt:true});assert.deepEqual(old.timers,{});
for (const e of world.entities.filter(e=>e.id.startsWith("human-picnic") || e.id==="human-smoker"))
  assert(active(e,state),e.id+" remains scenery after the favour");
// Account recovery of the new favour follows prerequisites and cannot mint money.
const recovery = Object.create(require("../public/assets/js/adventure/material-account").MaterialAccount.prototype);
recovery.game={catalog,state};recovery.queue=[];recovery.recoverLocalTools();
let restored=cleanSave(null,catalog);
for(const command of recovery.queue) {
  const e=catalog.scenes[command.scene].entities.find(e=>e.id===command.entity);
  const next=planReaction(e,restored,catalog,{action:command.action});
  assert(next,command.entity+":"+command.action);restored=next.state;
}
assert(restored.flags.picnicSkewerShared && !restored.inventory.skewer);
assert.equal(restored.wallet.balance,0);
state=cleanSave(null,catalog);
react("picnic-knife");
const now = Math.floor(Date.now() / 28800000) * 28800000 + 1000;
react("forest-mushrooms-fern", { now });
assert.equal(state.inventory.mushroom, 3);
assert.equal(react("forest-mushrooms-fern", { now: now + 1000 }), null, "Harvest cannot duplicate");
react("forest-mushrooms-fern", { now: now + 28800000 });
assert.equal(state.inventory.mushroom, 6, "Storehouse materials still regrow");
for (const e of world.entities.filter(e => /^picnic-(knife|lighter|twig|barbecue|neighbor)$/.test(e.id)))
  assert(world.approach({ x: scene.spawn.x * TILE, y: scene.spawn.y * TILE }, e, 7)?.length, e.id + ": walkable");
console.log("PASS picnic: optional skewer, ingredients, unique handoff/joke, old saves, offline recovery, no money/timer/public recipes, six languages and walkable side activities.");
