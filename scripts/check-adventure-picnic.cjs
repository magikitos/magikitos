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
for (const lang of ["es", "en", "de", "fr", "it", "pt"]) {
  const strings = require("../data/aventura/locales/" + lang + ".json");
  for (const scene of Object.values(catalog.scenes))
    for (const e of scene.entities) {
      for (const a of e.actions || [])
        assert(strings[a.label], lang + ": action label " + a.label);
      for (const r of e.rules)
        for (const effect of r.effects)
          if (effect.type === "dialogue")
            assert(strings[effect.key], lang + ": dialogue " + effect.key);
    }
  for (const item of Object.values(catalog.items)) {
    assert(strings[item.name], lang + ": item name");
    assert(strings[item.description], lang + ": item description");
  }
}
const hour = 3600000,
  now = Date.now();
let state = cleanSave(null, catalog);
function react(id, context = {}) {
  const before = JSON.stringify(state);
  const plan = planReaction(entity(id), state, catalog, { now, ...context });
  assert.equal(JSON.stringify(state), before, "Planning is pure");
  if (plan) state = plan.state;
  return plan;
}
react("picnic-mushroom");
assert(
  state.inventory.mushroom === 1,
  "The whole mushroom can be picked without a knife; cutting happens at the barbecue",
);
react("picnic-knife");
react("picnic-lighter");
const beforeTools = structuredClone(state);
react("picnic-mushroom");
react("picnic-twig");
react("picnic-barbecue", { action: "light" });
react("picnic-barbecue", { action: "cook" });
assert.equal(state.inventory.skewer, 1);
assert.equal(state.inventory.knife, 1);
assert.equal(state.inventory.lighter, 1);
assert(!state.inventory.mushroom && !state.inventory.twig);
react("picnic-neighbor", { action: "give" });
assert.equal(state.timers.picnic, now + 5 * hour);
assert.equal(state.wallet.balance, 10);
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
react("picnic-mushroom", { now: now + 5 * hour });
react("picnic-twig", { now: now + 5 * hour });
react("picnic-barbecue", { action: "cook", now: now + 5 * hour });
assert(actions(entity("picnic-neighbor"), state).some((a) => a.id === "give"));
react("picnic-neighbor", { action: "give", now: now + 5 * hour });
assert.equal(
  state.timers.picnic,
  now + 10 * hour,
  "Every meal starts a fresh five hours",
);
assert.equal(
  state.wallet.balance,
  10,
  "The initial round-trip reward is not farmed",
);
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
  { flags: { introSeen: true, picnicFed: true }, inventory: { lighter: 1 } },
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
