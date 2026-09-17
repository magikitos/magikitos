"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const {
  World,
  TILE,
  FOOTPRINT,
} = require("../public/assets/js/adventure/model");
const { DIRECTIONS } = require("../public/assets/js/adventure/characters");
/* ⛔ AQUÍ SE PROBABA LA VOLTERETA DEL EXPERIMENTO ARCHIVADO, y el experimento se borró entero el
   17-sep-2026 (decisión del dueño: fuera todos los laboratorios archivados). Lo que sigue
   importando no es cómo rodaba aquel prototipo sino que la voltereta NO ha vuelto al juego, y eso
   se comprueba sin él. */
assert(
  !require("../public/assets/js/adventure/locomotion").RollMotion,
  "Rolling is not a production ability",
);
const { cleanWallet } = require("../public/assets/js/adventure/economy");
const { dialogueText } = require("../public/assets/js/adventure/dialogue");
const catalog = JSON.parse(
  execFileSync(
    "php",
    ["-r", 'echo json_encode(require "data/aventura/world.php");'],
    { encoding: "utf8" },
  ),
);
const manifest = JSON.parse(
  fs.readFileSync("public/assets/aventura/manifest.json"),
);
const sprites = new Set(
  Object.values(manifest.packs).flatMap((p) => p.sprites),
);
const flat = () =>
  new World({
    id: "test",
    width: 80,
    height: 80,
    indoor: true,
    seed: 1,
    paths: [],
    waters: [],
    clearings: [],
    regions: [],
    entities: [],
  });
/* ⛔ AQUÍ VIVÍAN LA VOLTERETA Y LA DOBLE PULSACIÓN, y las dos se han ido con el laboratorio
   archivado que las implementaba (17-sep-2026). Ninguna de las dos es una habilidad del juego:
   `locomotion.js` no exporta la voltereta —lo sigue comprobando la línea de arriba— y no hay un
   solo consumidor de la doble pulsación en el motor. Probar el prototipo de un experimento
   borrado es probar código que ya no existe. */

const { furnishWorkshop } = require("../public/assets/js/adventure/workshop");
const workshop = furnishWorkshop(
  catalog,
  Array.from({ length: 40 }, (_, i) => ({ id: i + 1 })),
).scenes.workshop;
const workshopExit = workshop.entities.find((e) => e.id === "exit");
assert.equal(
  workshopExit.threshold[1] + workshopExit.threshold[3],
  workshop.height - 2 - FOOTPRINT.halfHeight / TILE,
  "Resized workshop uses shared directional door geometry",
);
const wallet = { balance: 0, claimed: { picnic: true } };
assert.deepEqual(
  cleanWallet(wallet, catalog),
  wallet,
  "Validation never invents money",
);
assert.deepEqual(cleanWallet(cleanWallet(wallet, catalog), catalog), wallet);
assert.equal(cleanWallet({ balance: 5, claimed: {} }, catalog).balance, 5);
// El mundo ya no escribe precios dentro de una frase, así que lo que se comprueba es que la
// máquina sigue sabiendo ponerlos —vuelven el día que el dueño quiera— y que un token que nadie
// declara se queda tal cual en vez de desaparecer, que es lo que delataría una frase a medias.
assert.equal(dialogueText(":reward", catalog), ":reward");
assert.equal(
  dialogueText("por :reward setines y :price monedas", {
    economy: { fares: { wish: 3 }, rewards: { picnic: { amount: 10 } } },
    dialogueTokens: { reward: { reward: "picnic" }, price: { fare: "wish" } },
  }),
  "por 10 setines y 3 monedas",
);
for (const scene of Object.values(catalog.scenes))
  for (const boat of scene.entities.filter(
    (e) => e.interactAs && e.sprite === "bottle-boat",
  )) {
    const dock = scene.entities.find((e) => e.id === boat.interactAs);
    assert(
      dock.landing && !dock.actions.some(a => a.id === "board"),
    );
  }
assert.equal(
  catalog.scenes.overworld.entities.find((e) => e.id === "home-two").sprite,
  "home-mushroom-canela",
);
assert.equal(
  catalog.scenes.overworld.entities.find((e) => e.id === "fisher-door").sprite,
  "home-pot-terracotta",
);
console.log(
  "PASS: rolling stays out of the game, reachable doors, wallet validation and boat landings.",
);
