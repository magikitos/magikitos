"use strict";
const assert = require("node:assert/strict");
const { definition, compositionBounds, vesselLayers } = require("../public/assets/js/adventure/vessel-art");
// El elenco ofrecido lo DERIVA el mundo de lo que hay horneado (ver world.php), así que se lee
// de ahí y no del fichero de autoría: preguntándoselo al JSON se comprobaría una lista que ya no
// existe, y una comprobación sobre un dato muerto es una comprobación apagada.
const player = JSON.parse(require("node:fs").readFileSync(".local/build/world.json")).playerArt;
const actions = require("../data/aventura/art/residents/actions/catalog.json");
const manifest = require("../public/assets/aventura/manifest.json");
const directions = ["down", "down-right", "right", "up-right", "up", "up-left", "left", "down-left"];
function check(data, roster) {
  assert(roster.enabledVariants.includes(roster.defaultVariant), "Default character must be enabled");
  assert.equal(new Set(roster.enabledVariants).size, roster.enabledVariants.length);
  const finite = values => values.every(v => Number.isFinite(v) && Math.abs(v) <= 128);
  for (const [id, vessel] of Object.entries(data.vessels)) {
    assert(manifest.packs[vessel.pack], "Hull must be baked");
    assert.deepEqual(Object.keys(vessel.views).sort(), [...directions].sort());
    assert.equal(vessel.immersion.depth.length, 4);
    assert(vessel.immersion.depth.every(v => v >= 0 && v <= 1));
    assert(!Object.hasOwn(vessel.immersion, "opacity"), "Immersion is a crisp cut, not faded paddle patches");
    assert(Number.isFinite(vessel.rowerScale ?? 1) && (vessel.rowerScale ?? 1) >= .5 && (vessel.rowerScale ?? 1) <= 1.5);
    for (const [direction, view] of Object.entries(vessel.views)) {
      assert([null, 0, 1].includes(view.far));
      assert(!view.rowerOffset || view.rowerOffset.length === 2 && finite(view.rowerOffset), "Bounded pelvis placement");
      assert(view.far === null || view.farMask, "Far paddle needs its vessel occlusion mask");
      for (const polygon of [view.rim, view.farMask].filter(Boolean)) {
        assert(polygon.length >= 3);
        assert(polygon.every(p => p.length === 2 && finite(p)), "Mask vertices must be finite bounded pairs");
      }
      assert(manifest.packs[vessel.pack].sprites.includes(`${vessel.prefix}-${direction}-0`), id);
    }
  }
  assert(data.vessels[data.defaultVessel]);
  for (const id of roster.enabledVariants) {
    for (const action of Object.keys(actions.actions)) {
      assert(actions.sheets.some(s => s.variant === id && s.action === action), "Enabled character needs all seven accepted sheets");
      assert(manifest.packs[`actor-${id}-${action}`], "Enabled character action must be baked");
    }
    const rig = data.rigs[roster.rowingRigs[id]];
    assert(rig, "Every enabled rower needs their own measured paddle rig");
    assert.deepEqual(Object.keys(rig).sort(), [...directions].sort());
    for (const [direction, phases] of Object.entries(rig)) {
      const body = data.bodies?.[roster.rowingRigs[id]]?.[direction];
      if (phases.some(pair => pair.some(p => p[3] < p[1])))
        assert(body, 'A rear-projected paddle needs an authored body protection mask');
      if (body) assert(body.length >= 3 && body.length <= 24 && body.every(p => p.length === 2 && finite(p)),
        'Body protection is a bounded actor-space polygon');
      assert.equal(phases.length, 4);
      for (const pair of phases) {
        assert.equal(pair.length, 2, "Both oars are preserved");
        assert(pair.every(p => p.length === 6 && finite(p) && p[4] > 0 && p[4] <= 6 &&
          p[5] > 0 && p[5] <= 20), "Measured paddle landmarks and blade length");
      }
    }
  }
}
check(definition, player);
for (const mutate of [d => { d.rigs.brezo.down[0].pop(); },
  d => { d.vessels.bottle.views.right.farMask[0][0] = NaN; },
  d => { delete d.vessels.bottle.views.left; },
  d => { d.vessels.bottle.rowerScale = Infinity; },
  d => { d.rigs.brezo.down[0][0][5] = -1; },
  d => { d.vessels.bottle.views.down.rowerOffset = [0, NaN]; },
  d => { d.vessels.bottle.immersion.opacity = .4; }]) {
  const changed = structuredClone(definition); mutate(changed);
  assert.throws(() => check(changed, player));
}
for (const mutate of [d => { delete d.bodies.brezo.right; }, d => { d.bodies.brezo.left[0][0] = NaN; }]) {
  const changed = structuredClone(definition); mutate(changed);
  assert.throws(() => check(changed, player));
}
const incomplete = actions.variants.find(id => !Object.keys(actions.actions).every(action =>
  actions.sheets.some(s => s.variant === id && s.action === action)));
if (incomplete !== undefined)
  assert.throws(() => check(definition, { ...player, enabledVariants: [...player.enabledVariants, incomplete] }), /seven accepted/);
assert.deepEqual(compositionBounds({ w: 64, h: 56, anchor: [32, 40] }, { w: 80, h: 72, anchor: [40, 32] }),
  { x: -40, y: -40, w: 80, h: 80 }, "Visibility includes the hull beyond the character's feet");
assert.deepEqual(compositionBounds({ w: 64, h: 56, anchor: [32, 40] }, { w: 80, h: 72, anchor: [40, 32] },
  { scale: 1.1, offset: [0, 2] }), { x: -40, y: -42, w: 80, h: 82 }, "Visibility includes scaled actor and placement");
assert.equal(vesselLayers({ direction: "left" }, 3).rower, "person-100-left-row-3");
assert(!manifest.packs["actor-0-row"], "The old compound boat must not ship");
console.log("PASS independent rowing contract: complete enabled characters, eight hull views, two measured oars × four phases, bounded masks/placement, viewport union and rejection tests.");
