"use strict";
const assert = require("node:assert/strict");
const { compileWorld } = require("../tools/world.cjs");
const { gameContract } = require("../tools/game-contract.cjs");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { planReaction } = require("../public/assets/js/adventure/rules");
const { MemoryBoard } = require("../public/assets/js/adventure/challenge-memory");
const { advance } = require("../public/assets/js/adventure/challenges");
const { World, TILE } = require("../public/assets/js/adventure/model");
const catalog = compileWorld(process.cwd()), challenge = catalog.challenges[0];
const wizard = catalog.scenes.mill.entities.find((e) => e.id === "avelino");
const chest = catalog.scenes.overworld.entities.find((e) => e.id === "mill-chest");
const exterior = new World(catalog.scenes.overworld);
const mill = exterior.entities.find((e) => e.id === "mill-door");
const dock = exterior.entities.find((e) => e.id === "river-dock");
const sourceFrame = require("../data/aventura/assets/mill-exterior.json").frames["mill-exterior"];
const box = require("../public/assets/js/adventure/entity-art").artworkBounds(mill,
  { w: sourceFrame.size[0], h: sourceFrame.size[1], anchor: sourceFrame.anchor });
assert(dock.y - 9 < box.y - 6, "The mill's artwork and click area leave the existing dock visible and usable");
let state = cleanSave(null, catalog);
const react = (entity, action = "interact") => planReaction(entity, state, catalog, { action });
assert(!react(wizard, challenge.action), "The reward cannot be collected before meeting Avelino");
assert(!react(chest).state.flags.avelinoChestOpened, "The chest starts locked");
state = react(wizard).state;
assert(state.flags.avelinoMet);
assert.equal(react(wizard).effects[0].key, "avelinoGreeting", "The introduction only happens once");
assert(!react(wizard, challenge.action), "Meeting the wizard does not solve his cards");
const board = new MemoryBoard(challenge.pairs, [], () => .42);
assert.equal(board.cards.length, 8);
for (const p of challenge.pairs) assert.equal(board.cards.filter((id) => id === p.id).length, 2);
const first = 0, other = board.cards.findIndex((id) => id !== board.cards[first]);
assert.equal(board.turn(first).type, "first");
assert.equal(board.turn(first), null, "One card cannot be paired with itself");
assert.equal(board.turn(other).type, "miss");
assert.equal(board.turn(7), null, "No third card during the reveal");
board.settle(false);
assert.equal(board.found.size, 0);
for (const p of challenge.pairs) {
  assert(!react(wizard, challenge.action), "Every pair is required before the key");
  const positions = board.cards.flatMap((id, i) => id === p.id ? [i] : []);
  board.turn(positions[0]);
  assert.equal(board.turn(positions[1]).type, "pair");
  board.settle();
  state = react(wizard, "pair-" + p.id).state;
  assert(!react(wizard, "pair-" + p.id), "A found pair cannot be recorded twice");
  state = cleanSave(JSON.parse(JSON.stringify(state)), catalog);
  assert(state.flags[p.flag], "Pairs survive a save round trip");
}
assert(board.complete);
state = react(wizard, challenge.action).state;
assert.equal(state.inventory.millKey, 1);
assert(!react(wizard, challenge.action), "Replaying never duplicates the key");
const before = structuredClone(state.inventory);
state = react(chest).state;
assert(state.flags.avelinoChestOpened);
assert.deepEqual(state.inventory, before, "Opening the chest keeps the reusable key");
assert.equal(react(chest).effects[0].key, "millChestAgain");
state = cleanSave(JSON.parse(JSON.stringify(state)), catalog);
assert(state.flags.avelinoMemorySolved && state.flags.avelinoChestOpened && state.inventory.millKey === 1);
const recovery = Object.create(require("../public/assets/js/adventure/material-account").MaterialAccount.prototype);
recovery.game = { catalog, state }; recovery.queue = [];
recovery.recoverLocalTools();
assert.deepEqual(recovery.queue.map((c) => c.action), ["interact", "pair-mushroom", "pair-twig", "pair-shell", "pair-fern", "solveMemory", "interact"],
  "Joining an account after offline play recovers the intro, pairs, key and chest in dependency order");
assert.equal(recovery.queue.at(-1).entity, "mill-chest");
const fresh = cleanSave(null, catalog), world = new World(catalog.scenes.mill);
const game = { catalog, state: { ...fresh, scene: "mill" }, world,
  materials: { canRecord: () => true, record() { throw Error("should not record"); } } };
assert(!advance(game, challenge, challenge.action), "UI cannot bypass reward rules");
game.state.flags.avelinoMet = true;
game.materials.canRecord = () => false;
game.text = (k) => k; game.toast = () => {};
assert(!advance(game, challenge, "pair-mushroom"), "No progress is lost when the durable queue is full");
assert(!game.state.flags.avelinoPairMushroom);
game.state.scene = "overworld";
assert(!advance(game, challenge, "pair-mushroom"), "Challenges belong beside their wizard");
const contract = gameContract(catalog);
assert(contract.progress.scenes.mill);
assert(contract.progress.flags.includes(challenge.completed));
assert.deepEqual(contract.adventure.entities.mill.avelino.rules, wizard.rules);
assert(contract.live.scenes.overworld.transitions.doors["mill-door"]);
assert(contract.live.scenes.mill.transitions.doors.exit);
for (const scene of [catalog.scenes.mill, catalog.scenes.overworld]) {
  const w = new World(scene); w.refresh(state);
  for (const e of scene.entities.filter((e) => e.id === "mill-door" || (scene.id === "mill" && e.id === "exit"))) {
    assert(w.canStand(e.arrival[0] * TILE, e.arrival[1] * TILE), "Both sides of the mill door are dry and walkable");
    const [x, y, width, height] = e.threshold;
    assert(w.canStand((x + width / 2) * TILE, (y + height / 2) * TILE), "The player can reach each threshold");
  }
}
console.log("PASS Avelino: first meeting, eight-card turn rules, persistent pairs, gated single reward, reusable key/chest, offline capacity and server/live contract.");
