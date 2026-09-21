"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), crypto = require("node:crypto");
const directory = "data/aventura/art/gait/";
const directions = ["right", "down-right", "up-right", "left", "down-left", "up-left"];
const catalog = JSON.parse(fs.readFileSync(directory + "catalog.json"));
const digest = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function isGaitCorrection(variant, action, name) {
  return Boolean(catalog.characters[variant]) && ["walk", "run"].includes(action)
    && directions.some(d => name === `person-${variant}-${d}-${action}-${action === "walk" ? 3 : 2}`);
}

function checkGaitArt() {
  const variants = require("../data/aventura/art/residents/actions/catalog.json").variants;
  const identities = new Set(require("../data/aventura/art/residents/catalog.json").profiles.map(p => p.id));
  assert(Object.keys(catalog.characters).every(id => identities.has(Number(id))), "Corrections refer to known identities");
  let count = 0;
  for (const [id, spec] of Object.entries(catalog.characters)) {
    assert.equal(digest(`${directory}sources/${id}-opposite.png`), spec.sha256);
    for (const action of ["walk", "run"]) {
      assert.deepEqual([...(spec[action].order || [0,1,2,3])].sort(), [0,1,2,3]);
      assert.equal(spec.sourceHips[action].length, 3);
      assert(spec.sourceHips[action].flat().every(v => Number.isFinite(v) && v > 0 && v < 1));
      const file = `${directory}cutouts/${id}-${action}`;
      const qa = JSON.parse(fs.readFileSync(file + ".json"));
      assert.equal(qa.sourceSha256, spec.sha256);
      assert.equal(qa.cutoutSha256, digest(file + ".png"));
      const frames = JSON.parse(fs.readFileSync(`data/aventura/assets/actor-${id}${action === "run" ? "-run" : ""}.json`)).frames;
      assert.equal(Object.keys(frames).length, 32, "No additional frames or memory per pack");
      assert.equal(Object.keys(qa.poses).length, 6);
      let patched = 0;
      for (const [name, frame] of Object.entries(frames)) {
        if (!isGaitCorrection(id, action, name)) {
          assert(!frame.source.startsWith(directory), "Frontal, rear and passing poses keep original artwork");
          continue;
        }
        patched++;
        assert.equal(frame.source, file + ".png");
        assert.deepEqual(frame.grid, [6,1]);
        assert.deepEqual(frame.size, [48,48]);
        assert.deepEqual(frame.anchor, [24,46]);
        assert.deepEqual(frame.registration, { scale: 1/8, offset: [0,0] });
        assert(qa.poses[name]);
        const [x,y,w,h] = qa.poses[name].bounds;
        assert(x > 0 && y > 0 && x+w < 48 && y+h < 48, `Unclipped silhouette: ${name}`);
        assert(Math.abs(y+h-46) <= .5, `The contact foot stays on the ground: ${name}`);
      }
      assert.equal(patched, 6);
      count += patched;
    }
  }
  const active = variants.filter(id => catalog.characters[id]).length;
  console.log(`PASS gait artwork: ${active} active identities, ${count} opposite contacts; immutable sources, six directions, foot registration, unchanged canvas/frame budgets. Visual review remains required.`);
}
module.exports = { isGaitCorrection, checkGaitArt };
if (require.main === module) checkGaitArt();
