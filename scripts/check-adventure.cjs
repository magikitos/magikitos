"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { execFileSync } = require("node:child_process");
const {
  World,
  TILE,
  spriteBounds,
  collisionBounds,
} = require("../public/assets/js/adventure/model");
const {
  planReaction,
  active,
  actions,
} = require("../public/assets/js/adventure/rules");
const { cleanSave, readSave } = require("../public/assets/js/adventure/save");
const { move } = require("../public/assets/js/adventure/movement");
const { ContentRooms } = require("../public/assets/js/adventure/rooms");
const {
  DIRECTIONS,
  facing,
  recordStep,
  characterFrame,
} = require("../public/assets/js/adventure/characters");
const catalog = JSON.parse(
  execFileSync(
    "php",
    ["-r", 'echo json_encode(require "data/aventura/world.php");'],
    { encoding: "utf8" },
  ),
);
const { createNeighbors } = require("../public/assets/js/adventure/neighbors");
const manifest = JSON.parse(
  fs.readFileSync("public/assets/aventura/manifest.json"),
);
const atlas = { frames: {} };
let spriteBytes = 0;
let residentBytes = 0;
let creatureBytes = 0;
for (const [id, pack] of Object.entries(manifest.packs)) {
  const meta = JSON.parse(
    fs.readFileSync("public/assets/aventura/" + pack.metadata),
  );
  assert(
    Object.keys(meta.frames).length === pack.sprites.length,
    id + ": complete metadata",
  );
  for (const name of pack.sprites) {
    assert(!atlas.frames[name], "No duplicate sprites");
    atlas.frames[name] = meta.frames[name];
  }
  const bytes = fs.statSync("public/assets/aventura/" + pack.image).size;
  spriteBytes += bytes;
  if (/^cat-(ginger|tuxedo|silver|calico|siamese)$/.test(id)) {
    assert(bytes < 160000, id + ": eight-direction creature pack stays scene-lazy and bounded");
    creatureBytes += bytes;
  }
  if (/^actor-1\d\d$/.test(id)) {
    assert(bytes < 70000, id + ": 32 integrated-2x poses stay below 70 KB");
    residentBytes += bytes;
  }
}
assert(
  Object.keys(manifest.packs).length >= 15,
  "Independent expandable asset modules",
);
assert(
  spriteBytes - residentBytes - creatureBytes < 4000000 && spriteBytes < 10500000,
  "Shared library with four canopy species stays below 4 MB; residents, cats and new trees are separate scene-lazy packs",
);
function react(entity, state, catalog, context) {
  const plan = planReaction(entity, state, catalog, context);
  if (!plan) return [];
  Object.assign(state, plan.state);
  return plan.effects;
}

const fresh = () => cleanSave(null, catalog);
let paths = 0;
function checkConditions(when = {}) {
  for (const key of Object.keys(when))
    assert(
      ["flags", "items", "maxItems", "timers", "using", "funds", "navigation", "landing"].includes(key),
      "Unknown condition: " + key,
    );
  if (when.funds !== undefined)
    assert(Number.isSafeInteger(when.funds) && when.funds > 0);
  if (when.using !== undefined)
    assert(Array.isArray(when.using) && when.using.length > 0);
  for (const [key, value] of Object.entries(when.flags || {})) {
    assert(catalog.flags.includes(key), "Declared flag: " + key);
    assert.equal(typeof value, "boolean");
  }
  for (const [key, count] of Object.entries(when.items || {})) {
    assert(catalog.items[key], "Declared item: " + key);
    assert(Number.isInteger(count) && count > 0);
  }
  for (const key of when.using || [])
    assert(catalog.items[key], "Declared held item: " + key);
}
for (const scene of Object.values(catalog.scenes))
  for (const entity of scene.entities) {
    for (const when of [
      entity.hiddenWhen,
      entity.visibleWhen,
      entity.solidWhen,
      entity.interactWhen,
    ])
      checkConditions(when);
    for (const visual of entity.visuals || []) {
      checkConditions(visual.when);
      assert(atlas.frames[visual.sprite]);
    }
    for (const action of entity.actions || []) {
      assert(action.id && action.label);
      checkConditions(action.when);
      checkConditions(action.enabledWhen);
    }
    for (const rule of entity.rules) {
      checkConditions(rule.when);
      for (const effect of rule.effects) {
        assert(
          [
            "flag",
            "collect",
            "item",
            "dialogue",
            "sound",
            "travel",
            "content",
            "spend",
            "reward",
            "timer",
            "presentation",
            "keepsake",
            "navigation",
          ].includes(effect.type),
        );
        if (effect.type === "flag") assert(catalog.flags.includes(effect.flag));
        if (effect.type === "item") {
          assert(catalog.items[effect.item]);
          assert(Number.isInteger(effect.amount));
        }
      }
    }
  }

for (const [i, direction] of DIRECTIONS.entries()) {
  assert.equal(
    facing(Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)),
    direction,
  );
  for (const variant of [0, ...catalog.avatarVariants, 12])
    for (let step = 0; step < 4; step++) {
      const actor = { direction, walkDistance: step * 7 };
      assert(
        atlas.frames[characterFrame(variant, actor, true)],
        "Missing directional walking pose",
      );
      assert(
        atlas.frames[characterFrame(variant, actor, false)],
        "Missing standing pose",
      );
    }
}
const walker = { direction: "down", walkDistance: 12 };
assert.equal(recordStep(walker, 0, 0), false);
assert.equal(walker.walkDistance, 12);
recordStep(walker, -3, -3);
assert.equal(walker.direction, "up-left");
for (const data of Object.values(catalog.scenes)) {
  const world = new World(data),
    start = { x: data.spawn.x * TILE, y: data.spawn.y * TILE };
  world.refresh(fresh());
  assert(world.canStand(start.x, start.y), data.id + ": spawn");
  for (const entity of world.entities) {
    if (entity.sprite)
      assert(
        entity.sprite === "doorway" || atlas.frames[entity.sprite],
        "Sprite: " + entity.sprite,
      );
    if (entity.threshold) {
      const [x, y, w, h] = entity.threshold;
      assert(
        world.canStand((x + w / 2) * TILE, (y + h / 2) * TILE),
        entity.id + ": threshold",
      );
    }
    if (!active(entity, world.state)) continue;
    const target = entity.interactAs
      ? world.entities.find((e) => e.id === entity.interactAs)
      : entity;
    const route = world.approach(start, target, 7);
    assert(route?.length, data.id + "/" + entity.id + ": reachable");
    for (let i = 1; i < route.length; i++)
      for (let t = 0; t <= 1; t += 0.1)
        assert(
          world.canStand(
            route[i - 1].x + (route[i].x - route[i - 1].x) * t,
            route[i - 1].y + (route[i].y - route[i - 1].y) * t,
          ),
          entity.id + ": safe route",
        );
    paths++;
    for (const rule of entity.rules)
      for (const effect of rule.effects) {
        if (effect.type === "travel") {
          const next = new World(catalog.scenes[effect.scene]);
          next.refresh(world.state);
          assert(
            next.canStand(effect.x * TILE, effect.y * TILE),
            entity.id + ": arrival",
          );
        }
        if (effect.type === "content")
          assert(catalog.contentRooms[effect.key], "Physical room for content");
      }
  }
  for (const npc of data.neighbors || []) {
    assert(
      world.canStand(npc.x * TILE, npc.y * TILE),
      data.id + "/" + npc.id + ": NPC clear of furniture",
    );
    if (npc.content)
      assert.equal(catalog.contentRooms[npc.content].scene, data.id);
  }
  assert.equal(world.path(start, { x: -100, y: -100 }), null);
}
const repeated = { handle: "same-author", variant: 2, url: "/cuento/example" };
const castWorld = new World(catalog.scenes.overworld);
for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
  const cast = createNeighbors(
    castWorld,
    { world: catalog, cast: { stories: Array(16).fill(repeated) } },
    [],
    () => roll,
  );
  const narrators = cast.filter((n) => n.content === "stories");
  assert(narrators.length >= 6 && narrators.length <= 10);
  assert.equal(
    narrators.filter((n) => n.person?.handle === "same-author").length,
    1,
    "Do not clone a prolific author",
  );
  assert(
    new Set(narrators.map((n) => n.variant)).size >= 3,
    "Fictional visitors bring visual variety",
  );
  for (const n of cast)
    assert(
      castWorld.canStand(n.x, n.y),
      n.id + ": generated NPC is not inside furniture",
    );
}
const world = new World(catalog.scenes.overworld),
  house = new World(catalog.scenes.overworld);
const e = (id) => world.entities.find((e) => e.id === id),
  lighter = house.entities.find((e) => e.sprite === "lighter");
assert(lighter, "Picnic lighter exists");
const knife = e("picnic-knife");
const fire = e("picnic-barbecue"),
  mushroom = e("picnic-mushroom"),
  twig = e("picnic-twig"),
  hungry = e("picnic-neighbor"),
  ferry = e("lake-ferryman");
function permutations(xs) {
  return xs.length
    ? xs.flatMap((x, i) =>
        permutations(xs.filter((_, j) => i !== j)).map((p) => [x, ...p]),
      )
    : [[]];
}
for (const objects of permutations([mushroom, twig, lighter, knife])) {
  for (const lightFirst of [false, true]) {
    const state = fresh();
    assert.equal(react(fire, state, catalog)[0].key, "barbecueHint");
    for (const object of objects) {
      react(object, state, catalog);
      if (lightFirst && state.inventory.lighter && !state.flags.fireLit)
        react(fire, state, catalog, { action: "light" });
      const snapshot = structuredClone(state);
      if (object !== twig) {
        react(object, state, catalog);
        assert.deepEqual(state, snapshot, "Single collection for unique objects");
      }
    }
    // Discovering the mushroom early is now a hint; return with the knife to cut it.
    if (!state.inventory.mushroom) react(mushroom, state, catalog);
    if (!state.flags.fireLit) react(fire, state, catalog, { action: "light" });
    assert(actions(fire, state, catalog).some((a) => a.id === "cook"));
    const draft = planReaction(fire, state, catalog, { action: "cook" });
    assert(!state.flags.skewerCooked, "Planning never mutates live state");
    Object.assign(state, draft.state);
    assert(state.flags.skewerCooked && state.flags.fireLit);
    assert.deepEqual(state.inventory, { lighter: 1, knife: 1, skewer: 1 });
    react(hungry, state, catalog, { action: "use", item: "skewer" });
    assert(state.flags.picnicFed);
    assert.equal(state.wallet.balance, catalog.economy.rewards.picnic.amount);
    assert.deepEqual(state.inventory, { lighter: 1, knife: 1, oars: 1 });
    const earned = structuredClone(state.wallet);
    react(hungry, state, catalog, { action: "give" });
    assert.deepEqual(
      state.wallet,
      earned,
      "Meal reward cannot be collected twice",
    );
    assert(!ferry, "Brizno is the one cooking and sharing his oars near the dock");
    const island = new World(catalog.scenes.islet);
    const back = island.entities.find((e) => e.id === "islet-ferryman");
    assert.equal(react(back, state, catalog)[0].key, "riverMemory");
    for (let visit = 0; visit < 3; visit++) {
      react(
        island.entities.find((e) => e.id === "shore-shells"),
        state,
        catalog,
      );
      react(
        island.entities.find((e) => e.id === "shell-collector"),
        state,
        catalog,
        { action: "give" },
      );
      assert.equal(
        state.wallet.balance,
        catalog.economy.rewards.picnic.amount + catalog.economy.rewards.shell.amount,
        "Shells renew after five hours, not by repeating the same API action",
      );
    }
  }
}
const onlyLighter = fresh();
react(lighter, onlyLighter, catalog);
react(fire, onlyLighter, catalog, { action: "use", item: "lighter" });
assert(onlyLighter.flags.fireLit);
assert(!onlyLighter.flags.skewerCooked);
assert.equal(onlyLighter.inventory.lighter, 1);
const onlyMushroom = fresh();
react(mushroom, onlyMushroom, catalog);
assert.deepEqual(
  react(fire, onlyMushroom, catalog, { action: "use", item: "mushroom" }),
  [],
);
for (const badEffects of [
  [
    { type: "flag", flag: "skewerCooked" },
    { type: "item", item: "lighter", amount: -1 },
  ],
  [{ type: "flag", flag: "arbitrary" }],
  [
    { type: "reward", reward: "picnic" },
    { type: "reward", reward: "picnic" },
  ],
  [{ type: "spend", fare: "lake" }],
]) {
  const before = structuredClone(onlyLighter);
  assert.throws(() =>
    planReaction({ rules: [{ effects: badEffects }] }, onlyLighter, catalog),
  );
  assert.deepEqual(
    onlyLighter,
    before,
    "Invalid transaction rolls back every effect",
  );
}
world.refresh(fresh());
const west = { x: 40.5 * TILE, y: 55.5 * TILE },
  east = { x: 49.5 * TILE, y: 55.5 * TILE };
assert(world.path(west, east)?.length, "The former river crossing is continuous dry meadow before cooking");
assert(!world.entities.some((e) => e.id === "bridge-hunger"), "No hunger gate");
assert(!world.waterAt(45, 45));
assert(!world.waterAt(13, 43), "No picnic pond");
assert(world.waterAt(115, 45), "The boat lake remains open water");
assert(!world.waterAt(45, 55.5));
// Approach the barbecue from below; the right side can legitimately seat Brizno.
const actor = { x: fire.x, y: fire.y + 40, actor: true };
assert(world.canStand(actor.x, actor.y), "Barbecue contact fixture starts on clear ground");
world.actors = [actor];
let contacts = 0;
move(world, actor, 0, -50, (target) => {
  assert.equal(target.id, fire.id);
  contacts++;
});
assert.equal(
  contacts,
  1,
  "Bump triggers interaction without walking through the barbecue",
);
const poisoned = cleanSave(
  {
    scene: "house",
    position: { x: -1, y: Infinity },
    flags: { picnicFed: true, arbitrary: true },
    inventory: { lighter: 500, unknown: 99 },
  },
  catalog,
);
assert.deepEqual(poisoned.flags, { picnicFed: true });
assert.deepEqual(poisoned.inventory, { lighter: 1, oars: 1 });
assert.equal(poisoned.position.x, catalog.scenes.house.spawn.x * TILE);
for (const value of [null, [], 123, "invalid", { scene: "__proto__" }])
  assert.equal(cleanSave(value, catalog).scene, catalog.start);
assert.equal(
  cleanSave({ scene: "tavern", flags: {} }, catalog).scene,
  "tavern",
);
assert.equal(
  readSave(catalog, {
    getItem() {
      throw Error("Denied");
    },
  }).scene,
  "overworld",
);
let closed = 0,
  stopped = 0;
const game = {
  catalog,
  state: { scene: "house" },
  player: { x: 200, y: 200 },
  site: { current: { group: "stories" } },
  media: {
    item: { kind: "cuento" },
    stop() {
      stopped++;
    },
  },
  closeContent() {
    closed++;
  },
};
const rooms = new ContentRooms(game);
assert(rooms.contains("expressions"));
assert(!rooms.contains("jokes"));
rooms.enforce();
assert.equal(closed, 1);
assert.equal(stopped, 1);
game.state.scene = "overworld";
game.player = { x: 105.5 * TILE, y: 81.5 * TILE };
assert(rooms.contains("stories"));
assert(!rooms.contains("expressions"));
for (const name of ["oak", "human-house"]) {
  const f = atlas.frames[name];
  assert.deepEqual(spriteBounds(f, { x: 100, y: 100 }), {
    x: 100 - f.anchor[0],
    y: 100 - f.anchor[1],
    w: f.w,
    h: f.h,
  });
}
const { Renderer } = require("../public/assets/js/adventure/renderer");
let drawn = 0;
Renderer.prototype.drawSprite.call(
  {
    sprites: {
      frame: (name) => atlas.frames[name],
      draw() {
        drawn++;
      },
    },
    ctx: {
      set globalAlpha(v) {
        throw Error("No obstacle fading");
      },
    },
  },
  "oak",
  0,
  0,
);
assert.equal(drawn, 1);
assert.equal(
  cleanSave({ wallet: { balance: -20, claimed: { fake: true } } }, catalog)
    .wallet.balance,
  0,
);
assert.deepEqual(
  cleanSave(
    {
      wallet: {
        balance: 10,
        claimed: { picnic: true, fake: true },
      },
    },
    catalog,
  ).wallet,
  { balance: 10, claimed: { picnic: true } },
);
console.log(
  "PASS: " +
    paths +
    " collision-safe routes; modular sprites; " + (catalog.avatarVariants.length+2) + " duendes × 8 directions × 4 poses; all ingredient orders; atomic game rewards and wishing coins; river clues; content rooms; saves.",
);
