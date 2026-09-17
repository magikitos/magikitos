"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { World, TILE } = require("../public/assets/js/adventure/model");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { active, planReaction } = require("../public/assets/js/adventure/rules");
const {
  CatEncounters,
} = require("../public/assets/js/adventure/cat-encounters");
const { riverSection } = require("../public/assets/js/adventure/river-course");
const { HULL_RADIUS } = require("../public/assets/js/adventure/river-navigation");
const { riverVisitors } = require("../public/assets/js/adventure/river-life");
const { createNeighbors } = require("../public/assets/js/adventure/neighbors");
const catalog = JSON.parse(
  execFileSync("php", [
    "-r",
    'echo json_encode(require "data/aventura/world.php");',
  ]),
);
const state = cleanSave(null, catalog),
  world = new World(catalog.scenes.overworld);
world.refresh(state);
const bottle = world.entities.find((e) => e.id === "picnic-bin");
assert(!active(bottle, state));
assert.equal(planReaction(bottle, state, catalog), null);
assert.equal(
  require("../tools/game-contract.cjs").gameContract(catalog).adventure.entities
    .overworld["picnic-bin"].visibleWhen.flags.skewerCooked,
  true,
  "The authoritative API receives the same story gate",
);
const player = { x: 20 * TILE, y: 28.5 * TILE, direction: "down" };
world.actors = [player];
const game = {
  world,
  state,
  player,
  renderer: { sprites: { frame: () => true } },
  river: { active: false },
  hasOverlay: () => false,
  closeContent() {},
  closeDialogue() {},
  pauseMovement() {},
  save() {},
  toast() {},
  text: (k) => k,
};
const cats = new CatEncounters(game);
cats.enter();
assert.equal(
  cats.actors.length,
  2,
  "Second cat is prepared without another scene load",
);
assert.equal(cats.renderables().length, 1);
state.flags.skewerCooked = true;
world.refresh(state);
assert(active(bottle, state));
assert.equal(cats.renderables().length, 2);
assert(!world.entities.some((e) => e.id === "lake-ferryman"));
const authoredOverworld = JSON.parse(
  fs.readFileSync("data/aventura/scenes/overworld.json"),
);
for (const entity of authoredOverworld.entities) {
  for (const rule of entity.rules || []) {
    for (const effect of rule.effects || []) {
      if (effect.type !== "travel") continue;
      assert.equal(
        effect.spawn,
        true,
        "House arrival belongs to its room: " + entity.id,
      );
      assert(
        !("x" in effect) && !("y" in effect),
        "No duplicated entrance coordinates",
      );
      const room = catalog.scenes[effect.scene];
      assert(room?.spawn, "Every house points to an existing room spawn");
      const arrival = catalog.scenes.overworld.entities
        .find((e) => e.id === entity.id)
        .rules.flatMap((r) => r.effects)
        .find((e) => e.type === "travel" && e.scene === effect.scene);
      assert.equal(arrival.x, room.spawn.x);
      assert.equal(arrival.y, room.spawn.y);
      const interior = new World(room);
      interior.refresh(state);
      assert(
        interior.canStand(room.spawn.x * TILE, room.spawn.y * TILE),
        "Unobstructed room arrival: " + effect.scene,
      );
    }
  }
}
assert(
  !active(
    world.entities.find((e) => e.id === "human-smoker"),
    state,
  ),
);
cats.grace = 0;
const original = cats.actors[0];
cats.capture(original);
assert(
  cats.carrier,
  "A reachable long-distance setback exists in the redesigned map",
);
cats.capture(cats.actors[1]);
assert.equal(
  cats.carrier,
  original,
  "The first carrier keeps exclusive ownership",
);
let frames = 0;
while (cats.carrier && frames++ < 60 * 45) cats.update(1 / 60);
assert(!cats.carrier, "Cat releases within its route deadline");
assert.equal(original.phase, "homeward");
assert(
  world.canStand(player.x, player.y, player),
  "Player is released on safe ground",
);
assert(
  Math.hypot(player.x - original.x, player.y - original.y) >= 25,
  "Release separates bodies without teleporting the cat",
);
const drop = { x: original.x, y: original.y };
// A blocked route must retry, never freeze in idle far from its home.
const approach = world.approach;
world.approach = () => null;
original.path = [];
for (let f = 0; f < 90; f++) cats.update(1 / 60);
assert.equal(original.phase, "homeward");
world.approach = approach;
frames = 0;
while (original.phase === "homeward" && frames++ < 60 * 45) cats.update(1 / 60);
assert.notEqual(
  original.phase,
  "homeward",
  "Cat walks all the way home after releasing its passenger",
);
assert(
  Math.hypot(original.x - original.home.x, original.y - original.home.y) <
    TILE * 2,
);
assert(Math.hypot(drop.x - original.x, drop.y - original.y) > 800);
const tavern = new World(catalog.scenes.tavern);
const neighbors = createNeighbors(tavern, { world: catalog }, [], () => 0);
assert(neighbors.length >= 15);
assert(
  new Set(neighbors.map((n) => n.direction)).size >= 6,
  "Conversations face inward, not all at the camera",
);
assert(tavern.entities.filter((e) => e.attachments?.length).length >= 4);
for (const s of Object.values(catalog.scenes).filter((s) =>
  s.id.startsWith("river-"),
)) {
  const river = s.rivers[0];
  /* ⛔ UNA COSTURA SOLO TIENE QUE ENCAJAR DONDE HAY OTRA PANTALLA AL OTRO LADO. Las raíces
     viejas cierran el río en su nacimiento desde el recorte del mapa (17-sep-2026), así que
     exigirle 32/64 arriba sería exigirle una costura contra la nada. Lo que se le pide a un
     borde sin salida es lo contrario: que el cauce se CIERRE, para que se lea como un
     nacimiento y no como un muro invisible a mitad del agua. */
  const cruza = (dir) =>
    (s.navigation?.exits || []).some(
      (e) => e.direction === dir && (e.mode || "boat") !== "foot",
    );
  const arriba = cruza("up"),
    abajo = cruza("down");
  for (const [y, hay] of [
    [0, arriba],
    [4, arriba],
    [10, arriba],
    [134, abajo],
    [140, abajo],
    [144, abajo],
  ]) {
    if (!hay) continue;
    const section = riverSection(river, y);
    assert(
      Math.abs(section.left - 32) < 1e-8 && Math.abs(section.right - 64) < 1e-8,
      "Shared river seams: " + s.id,
    );
  }
  for (const [y, hay] of [
    [0, arriba],
    [144, abajo],
  ]) {
    if (hay) continue;
    const section = riverSection(river, y);
    assert(
      section.right - section.left < (2 * HULL_RADIUS) / TILE,
      s.id + ": un borde sin salida tiene que cerrar el cauce, no cortarlo",
    );
  }
  // Y el tramo navegable es UNO: el cauce puede nacer cerrado, pero en cuanto se abre no puede
  // volver a estrecharse por el camino — eso sería un tapón en mitad del río.
  let abierto = false;
  for (let y = 0; y <= 144; y += 0.25) {
    const bank = riverSection(river, y);
    assert(Number.isFinite(bank.tangent));
    if (bank.right - bank.left >= 31.9) abierto = true;
    else
      assert(
        !abierto,
        s.id + ": el cauce se estrecha a mitad de camino (y=" + y + ")",
      );
  }
  assert(abierto, s.id + ": hay un tramo navegable de verdad");
  const boat = riverVisitors(s, 30)[0];
  const section = riverSection(river, boat.y / TILE);
  assert(boat.x / TILE > section.left + 2 && boat.x / TILE < section.right - 2);
}
// Estas frases son de PANTALLA, así que se comprueban donde viven: en el paquete que viaja con
// la pantalla que las dice, y en los seis idiomas.
{
  const { scenes } = require("../tools/locales.cjs").composeLocales(catalog);
  for (const lang of ["es", "en", "fr", "it", "de", "pt"])
    for (const [scene, key] of [
      ["river-roots", "riverHedgeHint"],
      ["human-hedge", "hedgeHint"],
      ["overworld", "forestSign"],
      ["river-willows", "riverAngler"],
    ])
      assert(scenes[scene][lang][key], lang + ": " + scene + "/" + key);
}
assert.equal(
  catalog.scenes["river-roots"].navigation.exits.find(
    (e) => e.id === "human-garden",
  ).scene,
  "human-hedge",
);
assert(
  catalog.scenes["human-hedge"].entities.filter(
    (e) => e.pushable && e.visionBlocker,
  ).length >= 5,
);
console.log(
  "PASS polished world: story-gated litter/two cats, exclusive carry and reliable homecoming, social tavern, river seams, bowl cover and six-language clues.",
);
