"use strict";
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const {
  HOUR,
  cleanNeeds,
  needStatus,
  reliefError,
  completeRelief,
  cleanTraces,
} = require("../public/assets/js/adventure/needs");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { Sequence } = require("../public/assets/js/adventure/sequence");
const { Self } = require("../public/assets/js/adventure/self");
const { drawRipples } = require("../public/assets/js/adventure/water");
const { planReaction } = require("../public/assets/js/adventure/rules");
const catalog = JSON.parse(
  execFileSync(
    "php",
    ["-r", 'echo json_encode(require "data/aventura/world.php");'],
    { encoding: "utf8" },
  ),
);
const now = 1800000000000;
const fresh = cleanNeeds(null, catalog, now, () => 0);
assert.deepEqual(fresh, {
  pee: { last: now, due: now + 6 * HOUR },
  poop: { last: now, due: now + 8 * HOUR },
});
const late = cleanNeeds(null, catalog, now, () => 1);
assert(late.pee.due <= now + 10 * HOUR && late.pee.due > now + 9.99 * HOUR);
assert(late.poop.due <= now + 16 * HOUR && late.poop.due > now + 15.99 * HOUR);
assert.deepEqual(
  cleanNeeds(fresh, catalog, now + 20 * HOUR, () => {
    throw Error("Reload must not resample");
  }),
  fresh,
);
assert.equal(needStatus(fresh, now), "comfortable");
assert.equal(needStatus(fresh, now + 6 * HOUR), "pee");
assert.equal(needStatus(fresh, now + 8 * HOUR), "poop");
// The open panel follows real deadlines and removes completed actions, not just their effects.
{
  const originalNow = Date.now,
    originalDocument = global.document;
  const elements = new Map();
  let time = now;
  try {
    Date.now = () => time;
    global.document = {
      getElementById(id) {
        if (!elements.has(id))
          elements.set(id, { dataset: {}, setAttribute() {} });
        return elements.get(id);
      },
    };
    const panel = Object.create(Self.prototype);
    panel.game = {
      ready: true,
      catalog,
      text: (key) => key,
      state: {
        needs: fresh,
        inventory: { leaf: 1 },
        scene: "overworld",
        traces: [],
      },
    };
    const visibility = () => [
      elements.get("self-pee").hidden,
      elements.get("self-poop").hidden,
    ];
    panel.paint();
    assert.deepEqual(visibility(), [true, true], "Comfortable: neither action");
    time += 6 * HOUR;
    panel.update();
    assert.deepEqual(visibility(), [false, true], "Pee due: only pee");
    time += 2 * HOUR;
    panel.update();
    assert.deepEqual(
      visibility(),
      [true, false],
      "Both deadlines passed: only poop",
    );
    panel.game.state = completeRelief(panel.game.state, "poop", catalog, {
      x: 400,
      y: 400,
    });
    panel.update();
    assert.deepEqual(
      visibility(),
      [true, true],
      "After relief: neither action",
    );
  } finally {
    Date.now = originalNow;
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
}
assert.deepEqual(
  cleanNeeds({ pee: { last: NaN, due: Infinity } }, catalog, now, () => 0),
  fresh,
);
const state = {
  scene: "overworld",
  flags: {  },
  inventory: {},
  needs: fresh,
  traces: [],
};
assert.equal(reliefError(state, "poop", catalog, now + 20 * HOUR), "needLeaf");
assert.equal(
  reliefError(state, "pee", catalog, now + 20 * HOUR),
  "poopIncludesPee",
);
assert.equal(reliefError(state, "pee", catalog, now), "noNeed");
assert.throws(
  () =>
    completeRelief(
      state,
      "poop",
      catalog,
      { x: 400, y: 400 },
      { now: now + 20 * HOUR },
    ),
  /needLeaf/,
);
const withLeaves = { ...state, inventory: { leaf: 2, lighter: 1 } };
const relieved = completeRelief(
  withLeaves,
  "poop",
  catalog,
  { x: 400, y: 400 },
  { now: now + 20 * HOUR, random: () => 0.5 },
);
assert.deepEqual(
  withLeaves.inventory,
  { leaf: 2, lighter: 1 },
  "Transaction leaves its input unchanged",
);
assert.deepEqual(relieved.inventory, { leaf: 1, lighter: 1 });
assert.equal(relieved.needs.pee.last, now + 20 * HOUR);
assert.equal(relieved.needs.poop.last, now + 20 * HOUR);
assert.equal(needStatus(relieved.needs, now + 20 * HOUR), "comfortable");
assert.equal(relieved.traces.length, 1);
assert.equal(relieved.traces[0].expires, now + 44 * HOUR);
assert.throws(
  () =>
    completeRelief(
      relieved,
      "poop",
      catalog,
      { x: 400, y: 400 },
      { now: now + 20 * HOUR },
    ),
  /noNeed/,
);
const lastLeaf = completeRelief(
  { ...withLeaves, inventory: { leaf: 1 } },
  "poop",
  catalog,
  { x: 400, y: 400 },
  { now: now + 20 * HOUR },
);
assert(!("leaf" in lastLeaf.inventory));
const peed = completeRelief(
  withLeaves,
  "pee",
  catalog,
  { x: 400, y: 400 },
  { now: now + 7 * HOUR, random: () => 0 },
);
assert.deepEqual(peed.needs.poop, fresh.poop, "Pee never postpones poop");
assert.deepEqual(peed.inventory, withLeaves.inventory, "Pee needs no leaf");
assert.equal(peed.traces[0].expires, now + 7 * HOUR + 300000);
const crossedDeadline = completeRelief(
  withLeaves,
  "pee",
  catalog,
  { x: 400, y: 400 },
  { startedAt: now + 8 * HOUR - 1000, now: now + 8 * HOUR + 2000 },
);
assert.equal(
  needStatus(crossedDeadline.needs, now + 8 * HOUR + 2000),
  "poop",
  "Poop becoming due during pee does not abort its completion or postpone poop",
);
const trace = relieved.traces[0];
const limited = cleanTraces(
  Array(80)
    .fill(trace)
    .concat([
      { ...trace, scene: "missing" },
      { ...trace, x: -1 },
      { ...trace, expires: now },
    ]),
  catalog,
  now + 20 * HOUR,
);
assert.equal(limited.length, 48);
assert.equal(cleanTraces(limited, catalog, now + 44 * HOUR).length, 0);
const roundTrip = cleanSave(
  { ...relieved, position: { x: 23.5 * 16, y: 71.5 * 16 } },
  catalog,
);
assert.deepEqual(roundTrip.needs, relieved.needs);
assert.equal(roundTrip.inventory.leaf, 1);
const plant = catalog.scenes.overworld.entities.find(
  (e) => e.id === "leaves-clearing",
);
let gathered = { ...state };
for (let i = 0; i < 102; i++)
  gathered = planReaction(plant, gathered, catalog, {}).state;
assert.equal(
  gathered.inventory.leaf,
  99,
  "Repeat harvest stacks with a bounded inventory",
);
const cottage = catalog.scenes.cottage;
assert.equal(cottage.entities.filter((e) => e.sprite === "bed").length, 1);
assert(!cottage.entities.some((e) => e.sprite === "lighter"));
assert(
  catalog.scenes.overworld.entities.some((e) => e.id === "picnic-lighter"),
);
assert(!catalog.scenes.house.entities.some((e) => e.id === "house-lighter"));
assert(!cottage.entities.find((e) => e.id === "cottage-table").interactAs);
// Ripples stay world-anchored, never paint dry land, and move at most 3 native pixels.
const renderWater = (time, indoor = false, wet = true) => {
  const marks = [];
  const ctx = {
    fillStyle: "",
    fillRect(x, y, w, h) {
      marks.push({ x, y, w, h, color: this.fillStyle });
    },
  };
  drawRipples(
    ctx,
    { data: { seed: 1, indoor }, waterAt: () => wet },
    { x: 0, y: 0, width: 320, height: 240 },
    time,
  );
  return marks;
};
const a = renderWater(0),
  b = renderWater(4);
assert(a.length > 20);
assert.equal(a.length, b.length);
assert(a.some((v, i) => v.x !== b[i].x));
a.forEach((v, i) => {
  assert(Math.abs(v.x - b[i].x) <= 3);
  assert.equal(v.y, b[i].y);
  assert.equal(v.h, 1);
});
assert.equal(renderWater(0, true).length, 0);
assert.equal(renderWater(0, false, false).length, 0);
(async () => {
  for (const dt of [1 / 120, 1 / 60, 0.05]) {
    const seq = new Sequence();
    let commits = 0;
    const done = seq
      .play("test-gesture", 4.6, { destination: "islet" })
      .then(() => commits++);
    await assert.rejects(seq.play("relief", 1), /already active/);
    seq.advance(0);
    assert.equal(seq.progress(), 0);
    seq.advance(-2);
    assert.equal(seq.progress(), 0);
    let steps = 0;
    while (seq.current) {
      seq.advance(dt);
      steps++;
    }
    await done;
    assert(Math.abs(steps * dt - 4.6) < dt + 1e-6);
    assert.equal(commits, 1);
    seq.advance(10);
    assert.equal(commits, 1);
  }
  await assert.rejects(new Sequence().play("test-gesture", Infinity), /Invalid/);
  console.log(
    "PASS real-time deadlines, poop precedence, no reload rerolls, atomic leaf use, bounded expiring traces, repeatable harvest, cottage contents, subtle water and finite sequences.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
