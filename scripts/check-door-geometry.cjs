"use strict";
/**
 * PARIDAD PHP/JS DE LAS PUERTAS (20-sep-2026). El compilador (`adventureDoorGeometry`) y el gemelo
 * del Studio (`doorGeometry`) tienen que escribir el mismo umbral, dirección y llegada para TODAS
 * las puertas del mundo, con su pie derivado o con una `entrance` dibujada a mano; y el compilador
 * tiene que rechazar una entrada fuera de rango o en una escalera. Se compila una copia aislada
 * del mundo con una entrada añadida: el árbol de trabajo no se toca.
 */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { isolateWorld } = require("./lib/world-fixture.cjs");
const { compileWorld } = require("../tools/world.cjs");
const { doorGeometry, validEntrance, ENTRANCE_LIMITS } = require("../public/assets/js/adventure/portals");
const near = (a, b, label) => assert(Math.abs(a - b) < 1e-9, `${label}: ${a} ≠ ${b}`);
const same = (actual, expected, label) => {
  assert.equal(Object.hasOwn(actual, "entryDirection"), Object.hasOwn(expected, "entryDirection"), label + " entryDirection presence");
  if (expected.entryDirection !== undefined) assert.equal(actual.entryDirection, expected.entryDirection, label + " entryDirection");
  expected.threshold.forEach((v, i) => near(actual.threshold[i], v, label + " threshold[" + i + "]"));
  expected.arrival.forEach((v, i) => near(actual.arrival[i], v, label + " arrival[" + i + "]"));
};
const raw = (root, id) => JSON.parse(fs.readFileSync(path.join(root, "data/aventura/scenes", id + ".json"), "utf8"));
let doors = 0;
const compiled = compileWorld(process.cwd());
for (const scene of Object.values(compiled.scenes)) {
  let source;
  try { source = raw(process.cwd(), scene.id); } catch { continue; } // instancias derivadas
  for (const entity of scene.entities.filter((e) => e.portal)) {
    const authored = source.entities.find((e) => e.id === entity.id);
    if (!authored) continue;
    same(doorGeometry(source, authored), entity, scene.id + "/" + entity.id);
    doors++;
  }
}
assert(doors >= 10, "Se han comparado todas las puertas: " + doors);
// Una entrada dibujada a mano en una casa de fuera y en la salida de un interior.
const root = isolateWorld("magikitos-doors-");
const meadow = raw(root, "overworld"), house = raw(root, "house");
const cottage = meadow.entities.find((e) => e.id === "home-one"), exit = house.entities.find((e) => e.portal);
cottage.entrance = [-1.25, 0.5, 1.5, 0.375];
exit.entrance = [0.5, -0.75, 1, 0.25];
fs.writeFileSync(path.join(root, "data/aventura/scenes/overworld.json"), JSON.stringify(meadow));
fs.writeFileSync(path.join(root, "data/aventura/scenes/house.json"), JSON.stringify(house));
const custom = compileWorld(root);
const door = custom.scenes.overworld.entities.find((e) => e.id === "home-one");
same(door, doorGeometry(meadow, cottage), "overworld/home-one dibujada");
near(door.threshold[0], cottage.x - 1.25, "umbral relativo al pie");
assert.equal(door.entryDirection, -1, "Fuera se entra hacia arriba");
near(door.arrival[1], door.threshold[1] + door.threshold[3] + 2, "La llegada queda dos casillas por delante");
const back = custom.scenes.house.entities.find((e) => e.id === exit.id);
same(back, doorGeometry(house, exit), "house/exit dibujada");
assert.equal(back.entryDirection, 1, "Dentro se sale hacia abajo");
near(back.arrival[1], back.threshold[1] - 2, "La llegada de vuelta queda dos casillas dentro");
// Lo que el compilador rechaza, el gemelo también.
for (const bad of [[0, 0, 3, 0.25], [0, 0, 1, 0.75], [13, 0, 1, 0.25], [0, 0, 0.1, 0.25], ["a", 0, 1, 0.25], [0, 0, 1]]) {
  assert.equal(validEntrance(bad), false, "Entrada inválida: " + JSON.stringify(bad));
  const broken = raw(root, "overworld");
  broken.entities.find((e) => e.id === "home-one").entrance = bad;
  fs.writeFileSync(path.join(root, "data/aventura/scenes/overworld.json"), JSON.stringify(broken));
  assert.throws(() => compileWorld(root), /Entrance/, "El compilador rechaza " + JSON.stringify(bad));
}
fs.writeFileSync(path.join(root, "data/aventura/scenes/overworld.json"), JSON.stringify(meadow));
const stairsScene = Object.values(compiled.scenes).find((s) => s.entities.some((e) => e.portal === "stairs"));
if (stairsScene) {
  const withStairs = raw(root, stairsScene.id);
  withStairs.entities.find((e) => e.portal === "stairs").entrance = [0, 0, 1, 0.25];
  fs.writeFileSync(path.join(root, "data/aventura/scenes", stairsScene.id + ".json"), JSON.stringify(withStairs));
  assert.throws(() => compileWorld(root), /Stairs/, "Una escalera no admite entrada dibujada");
}
fs.rmSync(root, { recursive: true, force: true });
assert.deepEqual(ENTRANCE_LIMITS, { offset: 12, width: [0.25, 2], height: [1 / 16, 0.5] });
console.log(`PASS door geometry: ${doors} puertas iguales en PHP y JS, entrada dibujada dentro y fuera, límites y escaleras rechazados.`);
