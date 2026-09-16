"use strict";
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { active, planReaction } = require("../public/assets/js/adventure/rules");
const {
  collect,
  collected,
  cleanResources,
} = require("../public/assets/js/adventure/resources");
const {
  canSee,
  crosses,
  safeDrop,
} = require("../public/assets/js/adventure/cat-encounters");
const {
  validScale,
  transformedRect,
} = require("../public/assets/js/adventure/entity-art");
const {
  VesselMotion,
  ROW_SPEED,
  FAST_ROW_SPEED,
} = require("../public/assets/js/adventure/river-navigation");
const catalog = JSON.parse(
  execFileSync(
    "php",
    ["-r", 'echo json_encode(require "data/aventura/world.php");'],
    { encoding: "utf8" },
  ),
);
let count = 0;
const check = (value, note) => {
  assert(value, note);
  count++;
};
const state = cleanSave(null, catalog),
  nodes = catalog.scenes.overworld.entities.filter(
    (e) => e.resource?.region === "overworld",
  );
check(nodes.length === 12, "Stable registry covers all authored twigs");
const now = 86400000 * 20200 + 1000;
let saved = state;
for (const node of nodes) {
  check(active(node, saved, { now }), node.id + " available");
  saved = planReaction(node, saved, catalog, { now }).state;
  check(!active(node, saved, { now }), node.id + " disappears immediately");
  check(!planReaction(node, saved, catalog, { now }), "Cannot gather twice");
}
check(saved.inventory.twig === 12, "Inventory stacks counts, not instances");
check(
  saved.resources.overworld.bits.length === 3,
  "12 pickups use three hex characters",
);
const restored = {
  ...saved,
  resources: cleanResources(saved.resources, catalog, now),
};
check(
  nodes.every((n) => collected(restored, n.resource, now)),
  "Reload preserves collected bits",
);
check(
  nodes.every((n) => !collected(restored, n.resource, now + 86400000)),
  "Authored daily renewal",
);
check(
  Object.keys(
    cleanResources({ overworld: { cycle: 20200, bits: "x" } }, catalog, now),
  ).length === 0,
  "Reject malformed bits",
);
const full = { ...state, inventory: { twig: 99 } };
check(
  !planReaction(nodes[0], full, catalog, { now }),
  "Full sack consumes no node",
);
check(
  !collected(full, nodes[0].resource, now),
  "Capacity failure keeps ground item",
);
const draft = { ...state };
collect(draft, nodes[0].resource, now);
check(!state.resources.overworld, "Planning never mutates original save");

const brizno = catalog.scenes.overworld.entities.find(
  (e) => e.id === "picnic-neighbor",
);
const fed = planReaction(
  brizno,
  { ...state, inventory: { skewer: 1 } },
  catalog,
  { action: "give", now },
).state;
check(
  fed.inventory.oars === 1 && fed.wallet.balance === 10,
  "First meal gives permanent oars and setines",
);
check(
  !planReaction(brizno, fed, catalog, { action: "give", now }),
  "Reward cannot repeat",
);
const dock = catalog.scenes.overworld.entities.find(
  (e) => e.id === "river-dock",
);
check(
  !planReaction(
    dock,
    { ...state, inventory: { bottle: 1, knife: 1, twig: 99, leaf: 99 } },
    catalog,
    { action: "craft" },
  ),
  "Twigs cannot bypass Brizno",
);
const boat = planReaction(
  dock,
  { ...fed, inventory: { oars: 1, bottle: 1, knife: 1 } },
  catalog,
  { action: "craft" },
).state;
check(
  boat.inventory.boat === 1 &&
    boat.inventory.oars === 1 &&
    !boat.inventory.bottle,
  "Boat consumes bottle, never tools",
);

const cat = { x: 100, y: 100, direction: "right", range: 120 };
check(canSee(cat, { x: 180, y: 100 }, []), "Cat sees in front");
check(!canSee(cat, { x: 40, y: 100 }, []), "Cat cannot see behind");
check(!canSee(cat, { x: 260, y: 100 }, []), "Cat range bounded");
check(
  !canSee(cat, { x: 180, y: 100 }, [{ x: 140, y: 100, solid: [-1, -1, 2, 2] }]),
  "Movable cover occludes sight",
);
check(
  crosses({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 3, y: 3, w: 2, h: 2 }),
  "Ray hits cover",
);
check(
  !crosses({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 3, y: 3, w: 2, h: 2 }),
  "Parallel ray misses cover",
);
check(
  !safeDrop({ canStand: () => false, entities: [] }, cat, () => 0),
  "No unsafe drop fallback",
);
const route = safeDrop(
  { canStand: () => true, entities: [], path: (_c, p) => [p] },
  cat,
  () => 0,
);
check(
  Math.hypot(route[0].x - cat.x, route[0].y - cat.y) >= 176,
  "Meaningful reachable setback",
);
check(
  validScale({ sprite: "picnic-bin" }, 0.5) &&
    validScale({ sprite: "tree" }, 1.17),
  "Continuous Studio scale",
);
check(
  !validScale({ sprite: "tree" }, NaN) && !validScale({ sprite: "tree" }, 4),
  "Scale is finite and bounded",
);
check(!validScale({ portal: true }, 0.5), "Portal geometry protected");
assert.deepEqual(
  transformedRect({ scale: 0.5 }, { x: -2, y: -2, w: 4, h: 4 }),
  { x: -1, y: -1, w: 2, h: 2 },
);
check(
  FAST_ROW_SPEED > ROW_SPEED && FAST_ROW_SPEED < 122,
  "Strong currents remain stronger than boosted rowing",
);
console.log(
  `PASS community foundations: ${count} resource, quest, sight, scale and current assertions.`,
);
