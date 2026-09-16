"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { SpriteLibrary } = require("../public/assets/js/adventure/sprites");
const manifest = JSON.parse(
  fs.readFileSync("public/assets/aventura/manifest.json"),
);
const directory = "public/assets/aventura/";
// The test adapter reads native files only: no browser, fetch, network or production host.
global.location = { href: "http://localhost/aventura" };
class LocalSprites extends SpriteLibrary {
  constructor() {
    super();
    this.imagesRead = new Map();
    this.fail = null;
  }
  async json(url) {
    await Promise.resolve();
    if (url.pathname.endsWith("manifest.json")) return manifest;
    return JSON.parse(
      fs.readFileSync(directory + url.pathname.split("/aventura/")[1]),
    );
  }
  async loadImage(url) {
    const file = url.pathname.split("/aventura/")[1];
    this.imagesRead.set(file, (this.imagesRead.get(file) || 0) + 1);
    await Promise.resolve();
    if (this.fail && file.includes(this.fail))
      throw new Error("Deliberate asset failure");
    const bytes = fs.readFileSync(directory + file);
    return {
      naturalWidth: bytes.readUInt32BE(16),
      naturalHeight: bytes.readUInt32BE(20),
    };
  }
}
(async () => {
  const sprites = new LocalSprites();
  await sprites.initialize("http://localhost/assets/aventura/manifest.json");
  const [first, second] = await Promise.all([
    sprites.prepare(["oak", "person-0-down"]),
    sprites.prepare(["oak", "person-0-down"]),
  ]);
  assert.deepEqual(first, second);
  assert.equal(
    [...sprites.imagesRead.values()].reduce((a, b) => a + b, 0),
    2,
    "Concurrent loads deduplicated",
  );
  sprites.activate(first);
  assert(sprites.frame("oak"));
  assert(!sprites.frame("willow"), "Unvisited island has no decoded art");
  sprites.fail = "shore-garden";
  await assert.rejects(sprites.prepare(["willow"]), /Deliberate asset failure/);
  assert.equal(sprites.pending.size, 0);
  assert(!sprites.packs.has("shore-garden"));
  assert(sprites.frame("oak"), "Failed destination preserves pinned art");
  sprites.fail = null;
  await sprites.prepare(["willow"]);
  assert(sprites.frame("willow"), "Failure can be retried");
  for (const id of Object.keys(manifest.packs)) await sprites.load(id);
  const warm = new Set(Object.keys(manifest.packs).slice(0, 18));
  sprites.retainWarm(warm);
  assert(
    [...warm].every((id) => sprites.packs.has(id)),
    "A large warmed destination is not immediately evicted",
  );
  sprites.activate(first);
  assert.equal(
    sprites.warm.size,
    0,
    "Arriving releases the previous prefetch retention",
  );
  assert(sprites.packs.size <= 12, "Warm cache is bounded");
  assert(
    sprites.frame("oak") && sprites.frame("person-0-down"),
    "Active frames survive pruning",
  );
  await assert.rejects(
    sprites.prepare(["not-registered"]),
    /Unregistered sprite/,
  );
  let draws = 0;
  assert(
    sprites.draw(
      {
        drawImage() {
          draws++;
        },
      },
      "oak",
      0,
      0,
    ),
  );
  assert.equal(draws, 1);
  for (const [id, pack] of Object.entries(manifest.packs)) {
    assert(
      pack.image.includes("-") && /-[a-f0-9]{12}\.png$/.test(pack.image),
      id + ": content-addressed PNG",
    );
    assert(pack.metadata.replace(/\.json$/, ".png") === pack.image);
  }
  console.log(
    "PASS: package load deduplication, lazy scene art, failure/retry, active pins, bounded cache, content hashes.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
