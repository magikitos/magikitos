"use strict";
const assert = require("node:assert/strict"),
  cp = require("node:child_process");
const { World, TILE } = require("../public/assets/js/adventure/model");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { planReaction, active } = require("../public/assets/js/adventure/rules");
const {
  canFloat,
  currentAt,
  VesselMotion,
  HULL_RADIUS,
} = require("../public/assets/js/adventure/river-navigation");
const { riverOffset } = require("../public/assets/js/adventure/geometry");
const catalog = JSON.parse(
  cp.execFileSync("php", [
    "-r",
    'echo json_encode(require "data/aventura/world.php");',
  ]),
);
let checks = 0;
const check = (ok, message) => {
  assert(ok, message);
  checks++;
};
for (const data of Object.values(catalog.scenes)) {
  if (!data.navigation) continue;
  const world = new World(data);
  for (const landing of data.navigation.landings) {
    check(
      world.canStand(...landing.land.map((n) => n * TILE)),
      `${data.id}/${landing.id} dry landing`,
    );
    check(
      canFloat(world, ...landing.water.map((n) => n * TILE)),
      `${data.id}/${landing.id} whole-hull clearance`,
    );
    check(
      !canFloat(world, ...landing.land.map((n) => n * TILE)),
      "Boat cannot go onto the jetty",
    );
  }
  for (const exit of data.navigation.exits)
    check(
      canFloat(
        new World(catalog.scenes[exit.scene]),
        ...exit.position.map((n) => n * TILE),
      ),
      `${data.id}/${exit.id} safe destination`,
    );
}
const world = new World(catalog.scenes.overworld),
  state = cleanSave(null, catalog);
const jetties = new World(catalog.scenes["river-gardens"]);
const parked = { ...state, inventory: { boat: 1 }, navigation: { mode: "foot", landing: "neighbor-1" } };
check(jetties.entities.filter(e => e.generated === "landing-vessel" && active(e, parked)).length === 1,
  "One owned boat appears at its actual landing, never duplicated across jetties");
for (const data of Object.values(catalog.scenes).filter((s) =>
  s.id.startsWith("river-"),
)) {
  const river = data.rivers[0],
    model = new World(data),
    vessel = new VesselMotion();
  const player = { x: 48 * TILE, y: 74 * TILE, direction: "up" };
  const route = [];
  for (let y = 72; y >= 3; y -= 2)
    route.push({
      x: (river.rect[0] + riverOffset(river, y) + 3) * TILE,
      y: y * TILE,
    });
  let index = 0;
  for (let frame = 0; frame < 60 * 60 && index < route.length; frame++) {
    const point = route[index];
    if (Math.hypot(point.x - player.x, point.y - player.y) < 8) {
      index++;
      continue;
    }
    vessel.step(
      model,
      player,
      { x: point.x - player.x, y: point.y - player.y },
      1 / 60,
    );
  }
  check(
    index === route.length,
    `${data.id}: a navigable upstream eddy route bypasses the strong current`,
  );
}
const apply = (name, action = "interact") => {
  const entity = world.entities.find((e) => e.id === name);
  const plan = planReaction(entity, state, catalog, { action });
  if (plan) Object.assign(state, plan.state);
  return plan;
};
apply("picnic-bin");
apply("picnic-knife");
apply("picnic-twig");
apply("picnic-twig");
apply("leaves-clearing");
apply("leaves-clearing");
check(
  state.inventory.twig === 2 && state.inventory.leaf === 2,
  "Materials stack",
);
const recipe = apply("river-dock", "craft");
check(
  recipe && state.inventory.boat === 1 && state.inventory.knife === 1,
  "Craft retains the knife",
);
check(
  !state.inventory.bottle && !state.inventory.twig && !state.inventory.leaf,
  "Only recipe ingredients consumed",
);
check(
  !state.flags.picnicFed && state.wallet.balance === 0,
  "Sailing does not require Brizno or money",
);
check(
  apply("river-dock", "board").effects.some((e) => e.type === "navigation"),
  "Boarding requests playable navigation",
);
check(
  apply("lake-ferryman").effects[0].key === "riverMemory",
  "Old ferryman remains as clue giver",
);
check(!apply("river-dock", "craft"), "Cannot craft a duplicate boat");
state.flags.skewerCooked = true;
check(
  !active(
    world.entities.find((e) => e.id === "human-smoker"),
    state,
  ),
  "Humans leave once skewer is made",
);
const leftover = cleanSave(
  { ...state, inventory: {}, flags: { skewerCooked: true } },
  catalog,
);
check(
  planReaction(
    world.entities.find((e) => e.id === "picnic-bin"),
    leftover,
    catalog,
  ).state.inventory.bottle === 1,
  "Bottle remains obtainable after humans leave",
);
const recovery = cleanSave(
  {
    scene: "islet",
    position: { x: 170, y: 410 },
    inventory: { knife: 1 },
    wallet: { balance: 17, claimed: { picnic: true } },
  },
  catalog,
);
check(
  recovery.inventory.boat === 1 &&
    recovery.inventory.knife === 1 &&
    recovery.wallet.balance === 17,
  "Existing island saves remain playable, funds untouched",
);
const ocean = new World({
  id: "water-test",
  width: 80,
  height: 80,
  seed: 1,
  baseWater: true,
  islands: [],
  waters: [],
  rivers: [],
  bridges: [],
  paths: [],
  clearings: [],
  entities: [],
  scenery: [],
  regions: [],
  navigation: { currents: [] },
});
check(
  !canFloat(ocean, HULL_RADIUS - 1, 100),
  "Whole hull stays inside the world",
);
const endpoints = [];
for (const fps of [30, 60, 120]) {
  const motion = new VesselMotion(),
    player = { x: 400, y: 400, direction: "down" };
  for (let i = 0; i < fps * 3; i++)
    motion.step(ocean, player, { x: 1, y: -1 }, 1 / fps);
  endpoints.push(player);
  check(player.direction === "up-right", "Eight-direction rowing");
  check(canFloat(ocean, player.x, player.y), "Movement remains legal");
}
check(
  Math.hypot(endpoints[0].x - endpoints[2].x, endpoints[0].y - endpoints[2].y) <
    2,
  "Frame-rate-independent travel",
);
ocean.data.navigation.currents = [{ area: [40, 40, 30, 30], vector: [0, 120] }];
const swept = { x: 640, y: 500, direction: "up" },
  motion = new VesselMotion();
for (let i = 0; i < 120; i++)
  motion.step(ocean, swept, { x: 0, y: -1 }, 1 / 60);
check(
  swept.y > 500,
  "Strong current pushes back against rowing; no health loss",
);
check(
  !("health" in state) && !catalog.economy.fares.lake,
  "No damage or ticket economy",
);
const persisted = cleanSave(
  {
    ...state,
    scene: "river-willows",
    position: { x: 48 * 16, y: 60 * 16 },
    navigation: { mode: "boat", direction: "up" },
  },
  catalog,
);
check(
  persisted.navigation.mode === "boat",
  "Reload preserves legal boating position",
);
console.log(`${checks} river, recipe, geometry, current and save checks PASS`);
