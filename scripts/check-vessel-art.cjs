"use strict";
/** Art-only gate: independent boat layers, complete directions/phases, stable measured seat.
 * Human review still decides anatomy/occlusion; this does not certify runtime integration. */
const assert = require("node:assert/strict"), fs = require("node:fs"), crypto = require("node:crypto");
const dir = "data/aventura/art/river/";
const catalog = JSON.parse(fs.readFileSync(dir + "vessels.json"));
const manifest = JSON.parse(fs.readFileSync("public/assets/aventura/manifest.json"));
const hash = path => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
assert.deepEqual(catalog.directions, ["down", "down-right", "right", "up-right", "up", "up-left", "left", "down-left"]);
function check(sheet, frames, qa, pack) {
  const count = catalog.directions.length * sheet.phases;
  assert.equal(sheet.grid[0] * sheet.grid[1], count);
  assert.equal(Object.keys(frames).length, count);
  assert.equal(Object.keys(qa.poses).length, count);
  assert.equal(pack.sprites.length, count);
  assert.equal(qa.sourceSha256, sheet.sourceSha256);
  assert(qa.alpha.alpha > 0.5 && qa.alpha.alpha < 0.99, "Mostly transparent, not an empty image");
  const scales = new Set();
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / sheet.grid[0]), col = index % sheet.grid[0];
    const name = `${sheet.spritePrefix}-${catalog.directions[index % 8]}-${Math.floor(index / 8)}`;
    assert(pack.sprites.includes(name), "All phases/directions must be baked");
    assert(!/person|ascua/.test(name), "Vessels are independent of any character");
    const f = frames[name], p = qa.poses[name];
    assert.equal(p.floorAlpha.length, sheet.floorProbes.length);
    assert(p.floorAlpha.length >= 6 && p.floorAlpha.every(a => a >= .95), "Closed solid floor, not a through-hole");
    assert(f && p, "Every exported pose has registration evidence");
    assert.deepEqual(f.size, sheet.canvas);
    assert.deepEqual(f.anchor, sheet.anchor);
    assert.deepEqual(f.rect, [sheet.sourceColumnBounds[col], sheet.sourceRowBounds[row],
      sheet.sourceColumnBounds[col + 1] - sheet.sourceColumnBounds[col],
      sheet.sourceRowBounds[row + 1] - sheet.sourceRowBounds[row]]);
    scales.add(f.registration.scale);
    const seat = sheet.sourceSeatAnchors[row][col];
    for (let axis = 0; axis < 2; axis++) {
      assert(Math.abs(f.registration.offset[axis] + seat[axis] * f.registration.scale - sheet.anchor[axis]) < 1e-8,
        "The same measured seat point must remain under the rower");
      assert(Math.abs(p.seat[axis] - sheet.anchor[axis]) < 1e-8);
      assert(p.ink[axis] >= 0 && p.ink[axis] + p.ink[axis + 2] <= sheet.canvas[axis], "No native clipping");
    }
  }
  assert.equal(scales.size, 1, "Never fit each rowing phase to its changing oar bounds");
}
for (const source of [...catalog.sheets, ...catalog.sourceHistory]) {
  assert.equal(hash(dir + "sources/" + source.source + ".png"), source.sourceSha256);
  assert.equal(hash(dir + source.source + ".prompt.txt"), source.promptSha256);
  if (source.reference) assert.equal(hash(dir + source.reference), source.referenceSha256);
}
for (const sheet of catalog.sheets) {
  assert.equal(hash(dir + "sources/" + sheet.editSource + ".png"), sheet.editSourceSha256);
  const { frames } = JSON.parse(fs.readFileSync(`data/aventura/assets/${sheet.pack}.json`));
  const qa = JSON.parse(fs.readFileSync(dir + "cutouts/" + sheet.source + ".json"));
  const pack = manifest.packs[sheet.pack];
  assert(pack && fs.existsSync("public/assets/aventura/" + pack.image));
  check(sheet, frames, qa, pack);
  const first = Object.keys(frames)[0];
  const missing = structuredClone(frames); delete missing[first];
  assert.throws(() => check(sheet, missing, qa, pack));
  const drifting = structuredClone(frames); drifting[first].registration.offset[1] += 2;
  assert.throws(() => check(sheet, drifting, qa, pack), /measured seat/);
  const resized = structuredClone(frames); resized[first].registration.scale *= 0.9;
  assert.throws(() => check(sheet, resized, qa, pack), /measured seat/);
  const hole = structuredClone(qa); hole.poses[first].floorAlpha[0] = 0;
  assert.throws(() => check(sheet, frames, hole, pack), /Closed solid floor/);
}
console.log(`PASS vessel art: ${catalog.sheets.length} independent hull(s), eight headings, immutable sources, closed floor, invisible attachment, no native clipping; four negative checks.`);
