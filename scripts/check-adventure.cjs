"use strict";
const { compileWorld } = require("../tools/world.cjs");
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const {
  World,
  TILE,
  spriteBounds,
  collisionBounds,
} = require("../public/assets/js/adventure/model");
const { docks } = require("../public/assets/js/adventure/docks");
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
const catalog = compileWorld(process.cwd());
const { createNeighbors } = require("../public/assets/js/adventure/neighbors");
const manifest = JSON.parse(
  fs.readFileSync("public/assets/aventura/manifest.json"),
);
const atlas = { frames: {} };
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
  if (/^cat-(ginger|tuxedo|silver|calico|siamese)$/.test(id)) {
    assert(bytes < 160000, id + ": eight-direction creature pack stays scene-lazy and bounded");
  }
  if (/^actor-1\d\d$/.test(id)) {
    assert(bytes < 70000, id + ": 32 integrated-2x poses stay below 70 KB");
  }
}
assert(
  Object.keys(manifest.packs).length >= 15,
  "Independent expandable asset modules",
);
// Transfer budgets measure real scene + viewport requests in check-adventure-residents,
// not the unused catalogue on disk. Decoded bytes are checked by check-adventure-assets.
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
/**
 * ⛔ UN OBJETO DEL SACO PUEDE NO TENER ESTAMPA, PERO NO PUEDE TENER UNA QUE NO EXISTA. `SceneDirector`
 * pide los sprites de TODOS los objetos al entrar a cualquier sitio, así que un nombre inventado no
 * deja sin icono a un objeto: deja el juego entero sin poder abrir una pantalla. Sin sprite, el saco
 * lo enseña por su nombre y no falla nada, que es donde vive la pala hasta que alguien la dibuje.
 */
for (const [id, item] of Object.entries(catalog.items))
  if (item.sprite !== undefined)
    assert(
      atlas.frames[item.sprite],
      "Item sprite: " + id + " → " + item.sprite,
    );
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
      const actor = { direction, gaitPhase: step / 4 };
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
/**
 * ⛔ A UNA PANTALLA SE ENTRA POR MÁS SITIOS QUE SU `spawn` (22-sep-2026, decisión del dueño: «la
 * accesibilidad tiene que tener en cuenta todas las escenas, no solo esta» y «se debe llegar por
 * agua, por eso lo he sellado»).
 *
 * Esto medía «se llega andando desde el spawn» y con eso decidía si una entidad estaba perdida. En
 * un mundo continuo eso es falso: se entra por el spawn, por la COSTURA de una pantalla vecina, por
 * la llegada de una PUERTA y desembarcando en un MUELLE. Sellar un paso a pie no deja nada perdido
 * si a esa orilla se llega remando, que es exactamente lo que el dueño hizo con las rocas. Se
 * juntan todas las entradas reales de la pantalla y basta con llegar desde UNA.
 */
const entradas = (data, world) => {
  const puntos = [];
  const añade = (x, y, via) => {
    if (Number.isFinite(x) && Number.isFinite(y) && world.canStand(x * TILE, y * TILE))
      puntos.push({ x: x * TILE, y: y * TILE, via });
  };
  if (data.spawn) añade(data.spawn.x, data.spawn.y, "spawn");
  /**
   * ⛔ LAS COSTURAS QUE ENTRAN SON LAS DE LAS VECINAS, NO LAS SUYAS. `exit.position` es dónde
   * aterrizas en la pantalla de DESTINO (así lo usa `crossings.js` al preparar `exit.scene`), así
   * que las salidas de esta pantalla describen puntos de OTRA. Mirando las suyas, al bosque se le
   * atribuían llegadas en el filo de abajo (y=143,9) que no son suyas y donde no se puede estar,
   * mientras se le ocultaba la que sí tiene: `river-willows/meadow-down-bank` deja en (160, 0,1),
   * arriba del todo en la orilla este. Desde ahí se llega al almacén andando, que es justo lo que
   * el dueño dijo —«entra desde arriba al desembarcar, y llega a pie»— y lo que esta prueba
   * negaba. Se recorre el catálogo entero: reachability es del MUNDO, no de una pantalla.
   */
  for (const otra of Object.values(catalog.scenes))
    for (const exit of otra.navigation?.exits || [])
      if (exit.scene === data.id && Array.isArray(exit.position))
        añade(exit.position[0], exit.position[1], otra.id + "/" + exit.id);
  /**
   * ⛔ LA LLEGADA DE UNA PUERTA NO CUENTA COMO ENTRADA. Es donde apareces al SALIR, y para salir
   * has tenido que entrar: contarla hacía que el almacén se declarase alcanzable desde su propia
   * puerta, que es exactamente no comprobar nada. Se midió: con la llegada dentro, la ÚNICA
   * entrada que llegaba al almacén era la del propio almacén. Las entradas de verdad son las que
   * no dependen de estar ya dentro: el `spawn`, las costuras de las pantallas vecinas y los
   * muelles donde se desembarca.
   */
  for (const muelle of docks(data)) if (Array.isArray(muelle.land)) añade(muelle.land[0], muelle.land[1], "muelle " + muelle.id);
  return puntos;
};
for (const data of Object.values(catalog.scenes)) {
  const world = new World(data),
    start = { x: data.spawn.x * TILE, y: data.spawn.y * TILE };
  world.refresh(fresh());
  assert(world.canStand(start.x, start.y), data.id + ": spawn");
  const puertas = entradas(data, world);
  assert(puertas.length, data.id + ": la pantalla tiene por dónde entrar");
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
    let route = null,
      via = null;
    for (const puerta of puertas) {
      route = world.approach(puerta, target, 7);
      if (route?.length) {
        via = puerta.via;
        break;
      }
    }
    assert(
      route?.length,
      data.id + "/" + entity.id + ": no se llega desde ninguna entrada (" +
        puertas.map((p) => p.via).join(", ") + ")",
    );
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
  mushroom = e("forest-mushrooms-fern"),
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
    react(e("forest-mushrooms-root"), state, catalog);
    if (!state.flags.fireLit) react(fire, state, catalog, { action: "light" });
    assert(actions(fire, state, catalog).some((a) => a.id === "cook"));
    const draft = planReaction(fire, state, catalog, { action: "cook" });
    assert(!state.flags.skewerCooked, "Planning never mutates live state");
    Object.assign(state, draft.state);
    assert(state.flags.skewerCooked && state.flags.fireLit);
    assert.deepEqual(state.inventory, { lighter: 1, knife: 1, skewer: 1 });
    react(hungry, state, catalog, { action: "use", item: "skewer" });
    assert(state.flags.picnicFed);
    assert.deepEqual(state.inventory, { lighter: 1, knife: 1, oars: 1 });
    // ⛔ Lo que se lleva quien comparte la brocheta son LOS REMOS (17-sep-2026, decisión del
    // dueño). Los setines son reputación y se ganan en la web; el bosque no acuña ni uno.
    const purse = structuredClone(state.wallet);
    assert.equal(purse.balance, 0);
    react(hungry, state, catalog, { action: "give" });
    assert.deepEqual(state.wallet, purse, "Sharing a meal never touches the purse");
    assert(!ferry, "Brizno is the one cooking and sharing his oars near the dock");
    // La vida del islote se mudó a la pradera de los sauces (17-sep-2026): las tres casas se
    // borraron y sus vecinos viven ahora en el prado, con las conchas al filo del río.
    const meadow = new World(catalog.scenes["river-willows"]);
    const back = meadow.entities.find((e) => e.id === "meadow-ferryman");
    assert.equal(react(back, state, catalog)[0].key, "riverMemory");
    for (let visit = 0; visit < 3; visit++) {
      react(
        meadow.entities.find((e) => e.id === "meadow-shore-shells"),
        state,
        catalog,
      );
      react(
        meadow.entities.find((e) => e.id === "meadow-shell-collector"),
        state,
        catalog,
        { action: "give" },
      );
      assert.deepEqual(
        state.wallet,
        purse,
        "Shells are a gift to the button maker, not a sale",
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
assert.deepEqual(poisoned.inventory, { lighter: 1 }, "Los remos solo los da Brizno: ninguna migración los regala");
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
/**
 * ⛔ UNA SALA TIENE QUE CONTENER LO QUE LA HACE SALA. El taller de las láminas llevaba su círculo
 * en (37,5 42,5) y su mesa treinta tiles más allá, así que no se abría NUNCA: acercarse a la mesa
 * no hacía nada y quedarse en el círculo enseñaba una sala cuyo mueble no se veía. Pasó al
 * redibujar el mapa en el Estudio —el mueble se mudó y el círculo se quedó—, y no fallaba nada:
 * la sala simplemente no ocurría. Ahora el sitio de la sala sale de dónde está su mueble.
 */
for (const [id, room] of Object.entries(catalog.contentRooms)) {
  const focus = catalog.scenes[room.scene].entities.find(
    (e) => e.id === room.focus,
  );
  assert(focus, id + ": its focus lives in its scene");
  if (room.circle)
    assert(
      Math.hypot(focus.x - room.circle[0], focus.y - room.circle[1]) <=
        room.circle[2],
      id + ": the room contains its own focus",
    );
  if (room.rect) {
    const [x, y, w, h] = room.rect;
    assert(
      focus.x >= x && focus.y >= y && focus.x < x + w && focus.y < y + h,
      id + ": the room contains its own focus",
    );
  }
}
const rooms = new ContentRooms(game);
assert(rooms.contains("expressions"));
assert(!rooms.contains("jokes"));
rooms.enforce();
assert.equal(closed, 1);
assert.equal(stopped, 1);
game.state.scene = "overworld";
const storyFocus = catalog.scenes.overworld.entities.find(e => e.id === catalog.contentRooms.stories.focus);
game.player = { x: storyFocus.x * TILE, y: storyFocus.y * TILE };
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
    " collision-safe routes; modular sprites; " + (catalog.avatarVariants.length+2) + " duendes × 8 directions × 4 poses; all ingredient orders; a purse the world never fills; river clues; content rooms; saves.",
);
