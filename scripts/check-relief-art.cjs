"use strict";
const assert = require("node:assert/strict");
const { reliefPose, reliefFrame, reliefOffset } = require("../public/assets/js/adventure/relief-art");
const { Self } = require("../public/assets/js/adventure/self");
const { completeRelief } = require("../public/assets/js/adventure/needs");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { compileWorld } = require("../tools/world.cjs");
const { ZoneCasting } = require("../public/assets/js/adventure/casting");
const { ForestPeople } = require("../public/assets/js/adventure/forest-people");
const { protocol } = require("../public/assets/js/adventure/forest-connection");
const world = compileWorld(process.cwd());
const manifest = require("../public/assets/aventura/manifest.json");
const frames = new Set(Object.values(manifest.packs).flatMap(p => p.sprites));
assert.equal(new ZoneCasting(world.avatarProfiles).profiles.length, 100, "NPC casting stays separate");
for (const variant of world.playerArt.enabledVariants) {
  const player = { x: 200, y: 200, variant };
  const female = world.avatarProfiles.find(p => p.id === variant).gender === "F";
  assert.equal(reliefPose("pee", player), female ? "poop" : "pee");
  assert.equal(reliefPose("poop", player), "poop");
  for (let phase = 0; phase < 4; phase++) {
    assert(frames.has(reliefFrame(player, "pee", phase)));
    assert(frames.has(`person-${variant}-pee-${phase}`), "The unused standing row remains in every sheet");
    assert(frames.has(`person-${variant}-poop-${phase}`));
  }
  for (const progress of [.05, .25, .4, .6, .75, .95]) {
    const drawn = [];
    const game = { player, state: { traces: [] }, reducedMotion: false,
      sequence: { current: { type: "relief", elapsed: progress * 4, data: { kind: "pee" } }, progress: () => progress },
      renderer: { drawSprite: (...args) => drawn.push(args) } };
    const frame = Self.prototype.frame.call({ game });
    assert(frame.includes(female ? "-poop-" : "-pee-"));
    assert(frames.has(frame));
    const context = { save() {}, restore() {}, fillRect() {} };
    Self.prototype.drawGround.call({ game }, context);
    Self.prototype.drawStream.call({ game }, context);
    assert(drawn.every(([sprite]) => sprite === "pee-puddle"), "Squatting never produces poop when peeing");
    if (drawn.length) assert.deepEqual(drawn[0].slice(1), reliefOffset("pee", player).map((v, i) => v + [player.x, player.y][i]));
  }
  const now = Date.now(), state = cleanSave(null, world);
  state.needs = { pee: { last: now - 10 * 3600000, due: now - 1000 }, poop: { last: now, due: now + 12 * 3600000 } };
  state.inventory = {};
  const after = completeRelief(state, "pee", world, player, { now });
  assert.deepEqual(after.inventory, {}, "Pee never consumes a leaf");
  assert.deepEqual(after.needs.poop, state.needs.poop, "Pee never resets the poop clock");
  assert.equal(after.traces.at(-1).kind, "pee");
  assert.equal(after.traces.at(-1).x, player.x + (female ? -7 : 20));
  let clock = 0;
  const peers = new ForestPeople(v => v, () => clock);
  peers.snapshot({ scene: "overworld", people: [["a".repeat(24), 200, 200, 3,
    protocol.poses.indexOf("pee"), variant, 0]] }, "overworld", { width: 1000, height: 1000 });
  for (clock = 0; clock <= 800; clock += 100) {
    const [peer] = peers.update(false);
    assert.equal(peer.pose, "pee", "Network semantics remain pee");
    assert(peer.sprite.includes(female ? "-poop-" : "-pee-"), "Other players see the same posture");
    assert(frames.has(peer.sprite));
  }
}
console.log(`PASS relief presentation: ${world.playerArt.enabledVariants.length} identical pose contracts; female crouch, male standing, urine only, unchanged need accounting.`);
