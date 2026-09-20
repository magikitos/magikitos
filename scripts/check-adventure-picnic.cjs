"use strict";
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
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
const catalog = JSON.parse(
  execFileSync(
    "php",
    ["-r", 'echo json_encode(require "data/aventura/world.php");'],
    { encoding: "utf8" },
  ),
);
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
const hour = 3600000;
/**
 * ⛔ LAS SETAS REBROTAN POR VENTANAS DE OCHO HORAS DEL RELOJ, no ocho horas después del corte
 * (`resources.js`: un ciclo por región, `floor(now / renewMs)`; el servidor lo valida igual en
 * `adventure-authority.php`). Esta prueba comprueba que a las cinco horas la mata sigue
 * descansando, y eso solo es cierto si las cinco horas no cruzan el cambio de ventana: con
 * `Date.now()` a secas fallaba tres horas de cada ocho (20-sep-2026). Si el reloj real cae en
 * esas tres horas, la prueba arranca en el inicio de la siguiente ventana, que es tiempo
 * inyectado y no cambia lo que se comprueba.
 */
const renew = catalog.scenes.overworld.entities.find((e) => e.id === "forest-mushrooms-fern").resource.renewMs;
let now = Date.now();
if (Math.floor((now + 5 * hour) / renew) !== Math.floor(now / renew))
  now = (Math.floor(now / renew) + 1) * renew + 1000;
let state = cleanSave(null, catalog);
function react(id, context = {}) {
  const before = JSON.stringify(state);
  const plan = planReaction(entity(id), state, catalog, { now, ...context });
  assert.equal(JSON.stringify(state), before, "Planning is pure");
  if (plan) state = plan.state;
  return plan;
}
react("forest-mushrooms-fern");
assert(
  !state.inventory.mushroom,
  "Cutting a mushroom portion requires the knife",
);
react("picnic-knife");
react("picnic-lighter");
const beforeTools = structuredClone(state);
react("forest-mushrooms-fern");
react("picnic-twig");
react("picnic-barbecue", { action: "light" });
react("picnic-barbecue", { action: "cook" });
assert.equal(state.inventory.skewer, 1);
assert.equal(state.inventory.knife, 1);
assert.equal(state.inventory.lighter, 1);
assert(!state.inventory.mushroom && !state.inventory.twig);
react("picnic-neighbor", { action: "give" });
assert.equal(state.timers.picnic, now + 5 * hour);
assert.equal(state.inventory.oars, 1, "The old man hands over his oars");
assert.equal(state.wallet.balance, 0, "and not a single setín: those are earned on the website");
assert(state.flags.picnicFed);
for (const e of world.entities.filter(
  (e) => e.id.startsWith("human-picnic") || e.id === "human-smoker",
))
  assert(!active(e, state), e.id + " leaves after the first meal");
assert(!actions(entity("picnic-neighbor"), state).length);
const deadline = state.timers.picnic;
const timedEntity = {
  visibleWhen: { timers: { picnic: false } },
  rules: [{ effects: [] }],
};
assert.equal(
  planReaction(timedEntity, state, catalog, { now: deadline - 1 }),
  null,
);
assert(
  planReaction(timedEntity, state, catalog, { now: deadline }),
  "Injected time applies to visibility too",
);
assert.equal(cleanTimers(state.timers, catalog, now + hour).picnic, deadline);
assert.equal(
  cleanSave(state, catalog).timers.picnic,
  deadline,
  "Reload does not restart the hunger clock",
);
assert(!expireTimers(state, now + 5 * hour - 1));
assert(
  matches(state, { timers: { picnic: true } }, { now: now + 5 * hour - 1 }),
);
assert(matches(state, { timers: { picnic: false } }, { now: now + 5 * hour }));
assert(expireTimers(state, now + 5 * hour));
assert(
  !expireTimers(state, now + 5 * hour + 1),
  "Expiration is applied only once",
);
// Brizno vuelve a tener hambre a las cinco horas, pero las setas rebrotan a las OCHO (decisión
// del dueño, 19-sep-2026): la mata de antes sigue descansando y la segunda brocheta sale de otra.
react("forest-mushrooms-fern", { now: now + 5 * hour });
assert(!state.inventory.mushroom, "The first patch still rests at five hours");
react("forest-mushrooms-root", { now: now + 5 * hour });
assert.equal(state.inventory.mushroom, 1, "Another patch feeds the second skewer");
react("picnic-twigs", { now: now + 5 * hour });
react("picnic-barbecue", { action: "cook", now: now + 5 * hour });
assert(actions(entity("picnic-neighbor"), state).some((a) => a.id === "give"));
react("picnic-neighbor", { action: "give", now: now + 5 * hour });
assert.equal(
  state.timers.picnic,
  now + 10 * hour,
  "Every meal starts a fresh five hours",
);
assert.equal(state.wallet.balance, 0, "and a second meal still mints nothing");
assert.equal(state.inventory.knife, 1);
assert.equal(state.inventory.lighter, 1);
assert(
  !active(entity("human-smoker"), state),
  "Humans never return with hunger",
);
assert.deepEqual(
  cleanTimers({ picnic: NaN, unknown: now + hour }, catalog, now),
  {},
);
assert.deepEqual(cleanTimers({ picnic: now + 100 * hour }, catalog, now), {});
const invalid = {
  rules: [
    {
      effects: [
        { type: "item", item: "twig", amount: 1 },
        { type: "timer", timer: "unknown" },
      ],
    },
  ],
};
assert.throws(() => planReaction(invalid, beforeTools, catalog), /timer/);
assert(
  !beforeTools.inventory.twig && !beforeTools.timers.picnic,
  "Invalid effects roll back atomically",
);
// Existing completed local saves can still collect the newly introduced tool.
const established = cleanSave(
  { flags: { picnicFed: true, skewerCooked: true }, inventory: { lighter: 1 } },
  catalog,
);
assert(active(entity("picnic-knife"), established));
assert(!active(entity("human-smoker"), established));
for (const e of world.entities.filter((e) =>
  /^picnic-(knife|lighter|mushroom|twig|barbecue|neighbor)$/.test(e.id),
))
  assert(
    world.approach({ x: scene.spawn.x * TILE, y: scene.spawn.y * TILE }, e, 7)
      ?.length,
    e.id + ": walkable interaction",
  );
assert(!catalog.scenes.cottage.entities.some((e) => e.sprite === "lighter"));
console.log(
  "PASS picnic recipe, reusable tools, first/repeat meals, exact 5h boundary, reload, departure, existing progress and atomic deadlines.",
);
