"use strict";
const { compileWorld } = require("../tools/world.cjs");
const assert = require("node:assert/strict");
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
  CatEncounters,
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
const catalog = compileWorld(process.cwd());
let count = 0;
const check = (value, note) => {
  assert(value, note);
  count++;
};
const state = cleanSave(null, catalog),
  nodes = catalog.scenes.overworld.entities.filter(
    (e) => e.resource?.region === "overworld",
  );
check(nodes.length === 4, "Four intentionally placed twigs, not a carpet of pickups");
const now = 86400000 * 20200 + 1000;
let saved = state;
for (const node of nodes) {
  check(active(node, saved, { now }), node.id + " available");
  saved = planReaction(node, saved, catalog, { now }).state;
  check(!active(node, saved, { now }), node.id + " disappears immediately");
  check(!planReaction(node, saved, catalog, { now }), "Cannot gather twice");
}
check(saved.inventory.twig === nodes.length, "Inventory stacks counts, not instances");
check(
  saved.resources.overworld.bits.length === 3,
  "Sparse pickups retain their stable bits in three hex characters",
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
  fed.inventory.oars === 1 && fed.wallet.balance === 0,
  "First meal gives the permanent oars and nothing else",
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
  Math.hypot(route[0].x - cat.x, route[0].y - cat.y) >= 880,
  "Meaningful reachable setback",
);
for(const variant of ["ginger","tuxedo","silver","calico","siamese"]) {
  const frames=require("../data/aventura/assets/cat-"+variant+".json").frames;
  for(const direction of ["down","down-right","right","up-right","up","up-left","left","down-left"]) {
    const poses=new Set();
    for(let phase=0;phase<4;phase++) {
      const name=CatEncounters.prototype.frame({variant,direction,moving:true,walkDistance:phase*9});
      check(Boolean(frames[name]),"Every cat has all directional walking frames");
      poses.add(name);
    }
    check(poses.size===4,"Four separate phases, no repeated middle pose");
  }
}
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
  FAST_ROW_SPEED > ROW_SPEED * 2 && FAST_ROW_SPEED < 240,
  "Strong currents remain stronger than boosted rowing",
);
/**
 * ⛔ DOS BALDOSAS NO SE PUEDEN LLAMAR IGUAL. Desde que el catálogo enseña las variantes una al
 * lado de otra, una cosa con dos variantes y sin nombre para cada una sale dos veces con el
 * mismo rótulo y el mismo precio: parece un fallo. El `label` de `elements.json` no sirve —es
 * del Estudio y está solo en castellano—, así que el mapa `variantLabels` de construction.json
 * lo traduce a una clave de textos y esto comprueba que no se queda ninguna fuera, ni apunta a
 * una frase que nadie dice en los seis idiomas.
 */
const textos = JSON.parse(
  require("node:fs").readFileSync("data/aventura/locales/core.json", "utf8"),
);
for (const [kind, d] of Object.entries(catalog.construction.definitions)) {
  if (d.variants.length < 2) continue;
  for (const variant of d.variants) {
    check(
      Boolean(variant.label),
      kind + "/" + variant.id + ": una variante entre varias necesita su nombre",
    );
    check(
      Boolean(textos[variant.label]),
      kind + "/" + variant.id + ": «" + variant.label + "» no lo dice nadie en core.json",
    );
  }
  check(
    new Set(d.variants.map((v) => v.label)).size === d.variants.length,
    kind + ": dos variantes con el mismo nombre no se distinguen",
  );
}
console.log(
  `PASS community foundations: ${count} resource, quest, sight, scale, variant-name and current assertions.`,
);
