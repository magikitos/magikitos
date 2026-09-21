"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { active, planReaction } = require("../public/assets/js/adventure/rules");
const { collected } = require("../public/assets/js/adventure/resources");
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const { makeElement, families } = require("../public/assets/js/adventure/elements");
const { validateChanges, placement, diff } = require("../tools/adventure-studio/scene-edits");
const { gameContract } = require("../tools/game-contract.cjs");
const { collisionBounds, overlaps } = require("../public/assets/js/adventure/geometry");
const { isolateWorld } = require("./lib/world-fixture.cjs");
const { compileWorld: compile } = require("../tools/world.cjs");
const world = compile(process.cwd()), state = cleanSave(null, world);
const entities = world.scenes.overworld.entities, find = (id) => entities.find((e) => e.id === id);
// Pickup command identity stays stable across the visual move out of the bin.
const bottle = find("picnic-bin"), bin = find("picnic-trash-bin");
assert.equal(planReaction(bin, state, world).state.inventory.bottle, undefined, "Bin never grants loot");
const body = e => collisionBounds({ ...e, x: e.x * 16, y: e.y * 16 });
assert(!overlaps(body(bottle), body(bin)), "Bottle sits beside, not inside, the scaled bin");
assert.equal(planReaction(bottle, state, world), null, "Bottle appears only when the humans leave");
assert.equal(planReaction(bottle, { ...state, flags: { skewerCooked: true } }, world).state.inventory.bottle, 1);
for (const inventory of [{ bottle: 1 }, { boat: 1 }]) {
  const saved = cleanSave({ inventory }, world);
  assert(!active(bottle, saved), "Existing bottle/boat saves cannot duplicate the pickup");
  assert.equal(planReaction(bottle, saved, world), null);
}
assert(active(bottle, { ...state, flags: { skewerCooked: true } }), "Litter remains after picnic departs");
/**
 * ⛔ AQUÍ SE CLAVABA `scale === 0.85`, Y ESO NO MEDÍA NINGUNA REGLA: MEDÍA UNA TARDE.
 *
 * El Studio existe justamente para que el dueño mueva y redimensione lo que hay en el mapa, así
 * que una comprobación que fija el tamaño de una seta convierte una decisión de arte en un build
 * roto — pasó el 17-sep-2026 al aplicar una sesión suya (0,85 → 0,67, y el juego no se inmuta:
 * la casa ya publica recogibles a 0,48 y a 0,65). Lo que este fichero tiene que sostener es el
 * CONTRATO de la seta —sin cuchillo no se corta, con cuchillo cae una— y eso son las dos líneas
 * de debajo, que siguen intactas.
 */
assert.equal(planReaction(find("forest-mushrooms-fern"), state, world).state.inventory.mushroom, undefined);
assert.equal(planReaction(find("forest-mushrooms-fern"), { ...state, inventory: { knife: 1 } }, world).state.inventory.mushroom, 3);
const twigCounts = Object.fromEntries(Object.entries(world.scenes).map(([id, s]) =>
  [id, s.entities.filter((e) => e.sprite === "twig").length]).filter(([, n]) => n));
assert.deepEqual(twigCounts, { overworld: 4, "river-rapids": 2, "river-roots": 2, "river-willows": 2 });
assert.deepEqual(entities.filter((e) => e.resource?.region === "overworld").map((e) => e.resource.index),
  [0, 1, 8, 11], "Removed placements never reassign another pickup's saved bit");
const source = require("../data/aventura/element-families.json").families;
const authority = gameContract(world).adventure.entities.overworld;
assert.deepEqual(authority["twig-fern"].rules, [{ effects: [] }],
  "Retired command drains old offline queues without granting anything");
assert.equal(authority["picnic-bin"].rules[0].effects[0].item, "bottle",
  "The already-published bottle command keeps its meaning");
for (const family of Object.keys(require("../data/aventura/elements.json").families))
  assert(source[family], "Regenerating catalogue must preserve " + family);

// A real Studio proposal -> isolated source -> registry -> client AND server contract.
// No mutation of the user's workspace, source scenes or actual game save.
const base = snapshot(process.cwd()), added = {};
for (const family of ["ground-twig", "toilet-leaves", "ground-bottle"]) {
  const id = "studio-test-" + family;
  added[id] = { family, ...placement(makeElement(family, id, 40, 52)) };
  assert.equal(families[family].category, "Recogibles");
}
const changes = validateChanges(base, { overworld: { added } });
const proposed = diff(base, changes)[0].proposedScene;
for (const e of proposed.entities.filter((e) => added[e.id])) {
  assert(e.behavior, "Studio exports reusable behavior, not a decorative copy");
  assert(!e.rules, "No empty rule override suppresses the pickup");
}
const temp = isolateWorld("magikitos-pickups-");
try {
  fs.writeFileSync(path.join(temp, "data/aventura/scenes/overworld.json"), JSON.stringify(proposed));
  assert.throws(() => compile(temp), /Register pickup/, "Unregistered Studio pickups cannot silently ship");
  const registryFile = path.join(temp, "data/aventura/resource-nodes.json"), registry = JSON.parse(fs.readFileSync(registryFile));
  registry.overworld.nodes.push("studio-test-ground-twig");
  fs.writeFileSync(registryFile, JSON.stringify(registry));
  assert.throws(() => compile(temp), /Register harvest/);
  registry["harvest-overworld-120000"].nodes.push("studio-test-toilet-leaves");
  fs.writeFileSync(registryFile, JSON.stringify(registry));
  const compiled = compile(temp), contract = gameContract(compiled);
  for (const id of Object.keys(added)) {
    const node = compiled.scenes.overworld.entities.find((e) => e.id === id);
    const outcome = planReaction(node, state, compiled);
    assert(outcome && Object.keys(outcome.state.inventory).length === 1);
    assert(contract.adventure.entities.overworld[id], "Authoritative API receives reviewed pickup rules");
    if (node.resource) {
      assert(collected(outcome.state, node.resource));
      assert.equal(active(node, outcome.state), !!node.resource.keepVisible);
    }
  }
  // Reordering or removing plants must never reuse a bit while its cycle is active.
  proposed.entities = proposed.entities.filter((e) => e.id !== "leaves-clearing").reverse();
  fs.writeFileSync(path.join(temp, "data/aventura/scenes/overworld.json"), JSON.stringify(proposed));
  for (const e of compile(temp).scenes.overworld.entities.filter((e) => e.resource))
    assert.deepEqual(e.resource, compiled.scenes.overworld.entities.find((n) => n.id === e.id).resource);
} finally {
  fs.rmSync(temp, { recursive: true });
}
console.log("PASS independent ground bottle, sparse stable pickups, smaller mushroom, reproducible families and Studio-to-client/API authoring.");
