"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  crypto = require("node:crypto");
const {
  clips,
  pose,
  drawAmbientActor,
} = require("../public/assets/js/adventure/ambient-actors");
const { drawOccupiedBoat } = require("../public/assets/js/adventure/boat-art");
const kit = require("../data/aventura/art/woodland-kit/prompts.json");
const { families } = require("../data/aventura/elements.json");
for (const a of kit.assets) {
  const dir = "data/aventura/art/woodland-kit/",
    metadata = JSON.parse(fs.readFileSync(dir + "cutouts/" + a.id + ".json"));
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(dir + metadata.source))
      .digest("hex"),
    metadata.sourceHash,
    "Original remains unchanged: " + a.id,
  );
  assert(
    families[a.family].variants.some(
      (v) => v.id === a.variant && v.sprite === a.sprite,
    ),
  );
  assert(metadata.bounds.every(Number.isFinite));
}
const actorPack = require("../data/aventura/assets/picnic-humans.json");
const authoredFrames = { ...actorPack.frames, ...require("../data/aventura/assets/picnic-neighbor.json").frames };
for (const id of ["picnic-smoker-poses", "picnic-friend-poses"]) {
  const directory = "data/aventura/art/picnic-polish/";
  const metadata = JSON.parse(
    fs.readFileSync(directory + "cutouts/" + id + ".json"),
  );
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(directory + metadata.source))
      .digest("hex"),
    metadata.sourceHash,
    "Original actor sheet is unchanged",
  );
}
for (const clip of Object.values(clips)) {
  for (const [name] of clip.steps) {
    assert(
      authoredFrames[name]?.preserveCanvas,
      "Every authored pose shares a registered source canvas",
    );
    assert.deepEqual(
      authoredFrames[name].anchor,
      authoredFrames[clip.steps[0][0]].anchor,
    );
    assert.deepEqual(
      authoredFrames[name].size,
      authoredFrames[clip.steps[0][0]].size,
    );
  }
  assert.deepEqual(
    pose(clip, 0),
    { frame: clip.steps[0][0], smoke: 0 },
    "Reduced motion is still",
  );
  const gestures = Array.from({ length: 2000 }, (_, i) => pose(clip, i / 100));
  for (const [frame] of clip.steps)
    assert(
      gestures.some((p) => p.frame === frame),
      "Every authored pose is played",
    );
  assert(gestures.every((p) => p.smoke >= 0 && p.smoke < 1));
  assert.equal(
    gestures.some((p) => p.smoke > 0),
    !!clip.smoke,
  );
  assert.deepEqual(
    pose(clip, 2),
    pose(clip, 2 + clip.duration),
    "Seamless loop",
  );
}
const calls = [],
  context = new Proxy(
    {},
    {
      get:
        (_, key) =>
        (...args) =>
          calls.push([key, ...args]),
    },
  );
const sprites = {
  frame: (n) =>
    n === "boat"
      ? { w: 112, h: 70, anchor: [56, 64] }
      : { w: 24, h: 32, anchor: [12, 29] },
  draw: (_, name, ...args) => calls.push(["sprite", name, ...args]),
};
drawOccupiedBoat(
  context,
  sprites,
  "boat",
  [
    { sprite: "captain", seat: [0.3, 0.74] },
    { sprite: "hero", seat: [0.7, 0.74] },
  ],
  0.76,
  100,
  100,
  2,
);
assert.deepEqual(
  calls.filter((c) => c[0] === "sprite").map((c) => c[1]),
  ["boat", "captain", "hero"],
);
assert.equal(
  calls.filter((c) => c[0] === "save").length,
  calls.filter((c) => c[0] === "restore").length,
);
calls.length = 0;
assert(drawAmbientActor(context, sprites, { x: 1, y: 2 }, "picnic-smoker", 0));
assert.equal(
  calls.filter((c) => c[0] === "save").length,
  calls.filter((c) => c[0] === "restore").length,
);
assert.equal(drawAmbientActor(context, sprites, {}, "oak", 10), false);
console.log(
  "PASS: " +
    kit.assets.length +
    " immutable art masters, manifest/family consistency, authored actor gestures, reduced motion and shared-hull ferry occupants.",
);

const { Terrain } = require("../public/assets/js/adventure/terrain");
const terrain = new Terrain(),
  room = { id: "house", indoor: true, interior: { background: "forest" } };
let backdrop = null;
terrain.context = () => backdrop;
terrain.chunks.set("house:0:0", "provisional");
terrain.chunks.set("other:0:0", "retained");
assert.equal(terrain.background(room), null);
assert.equal(
  terrain.chunks.get("house:0:0"),
  "provisional",
  "Keep immediate painted preview",
);
backdrop = {};
assert.equal(terrain.background(room), backdrop);
assert(
  !terrain.chunks.has("house:0:0"),
  "Late background invalidates its own provisional chunks",
);
assert.equal(terrain.chunks.get("other:0:0"), "retained");
terrain.chunks.set("house:0:0", "finished");
terrain.background(room);
assert.equal(
  terrain.chunks.get("house:0:0"),
  "finished",
  "No per-frame invalidation",
);
console.log(
  "PASS: lazy interior background replaces its own provisional cache exactly once.",
);
