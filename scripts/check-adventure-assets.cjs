"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { SpriteLibrary } = require("../public/assets/js/adventure/sprites");
const manifest = JSON.parse(
  fs.readFileSync("public/assets/aventura/manifest.json"),
);
const directory = "public/assets/aventura/";
// The test adapter reads native files only: no browser, fetch, network or production host.
global.location = { href: "http://localhost/bosque/explorar" };
class LocalSprites extends SpriteLibrary {
  constructor(options) {
    super(options);
    this.imagesRead = new Map();
    this.fail = null;
    this.peak = 0;
  }
  async json(url) {
    await Promise.resolve();
    if (url.pathname.endsWith("manifest.json")) return manifest;
    return JSON.parse(
      fs.readFileSync(directory + url.pathname.split("/aventura/")[1]),
    );
  }
  async loadImage(url) {
    this.peak = Math.max(this.peak, this.residency.bytes + this.residency.reservedBytes);
    assert(this.peak <= this.residency.limit, "Admission occurs before image decode, including concurrent reservations");
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
  second.release();
  assert(sprites.frame("oak"));
  assert(!sprites.frame("willow"), "Unvisited island has no decoded art");
  sprites.fail = "shore-garden";
  await assert.rejects(sprites.prepare(["willow"]), /Deliberate asset failure/);
  assert.equal(sprites.pending.size, 0);
  assert(!sprites.packs.has("shore-garden"));
  assert(sprites.frame("oak"), "Failed destination preserves pinned art");
  sprites.fail = null;
  (await sprites.prepare(["willow"])).release();
  assert(sprites.frame("willow"), "Failure can be retried");
  for (const id of Object.keys(manifest.packs)) await sprites.load(id);
  const warm = await sprites.prepare([], Object.keys(manifest.packs).slice(0, 18));
  sprites.retainWarm(warm);
  assert(
    [...warm].every((id) => sprites.packs.has(id)),
    "A large warmed destination is not immediately evicted",
  );
  // Lo VISIBLE (una vecina a la vista) aguanta la presión del arte de los actores; lo solo caliente, no.
  const visible = [...warm].slice(0, 3), onlyWarm = [...warm].slice(3).filter((id) => !first.has(id));
  warm.release();
  sprites.retainWarm(warm, visible);
  sprites.residency.evict(sprites.residency.bytes, sprites);
  assert(visible.every((id) => sprites.packs.has(id)), "Visible neighbour packs survive a full eviction pass");
  assert(onlyWarm.some((id) => !sprites.packs.has(id)), "Merely warm packs are what gives way");
  for (const id of Object.keys(manifest.packs)) await sprites.load(id);
  // Fijar sin decir nada más (subir a la barca, cambiar de duende) conserva lo caliente y lo visible…
  sprites.activate(first);
  assert.equal(sprites.visible.size, visible.length, "Plain activation keeps the visible set");
  assert.equal(sprites.warm.size, warm.size, "…and the warm set");
  // …y llegar a otra pantalla los sustituye por lo que el director diga, aunque sea nada.
  sprites.activate(first, [], []);
  assert.equal(sprites.visible.size, 0, "Arriving with an empty visible set clears it");
  assert.equal(
    sprites.warm.size,
    0,
    "Arriving releases the previous prefetch retention",
  );
  assert(sprites.residency.bytes <= sprites.residency.limit, "Decoded cache is byte-bounded");
  assert.equal(sprites.residency.reservedBytes, 0);
  assert.equal(sprites.residency.holds.size, 0, "Every completed or failed preparation releases its lease");
  assert.equal(sprites.residency.bytes, [...sprites.packs.values()].reduce((n, p) => n + p.bytes, 0));
  assert.throws(() => sprites.activate(new Set(["missing-package"])), /not prepared/);
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
    assert.equal(pack.bytes, fs.statSync(directory + pack.image).size);
    const metadata = JSON.parse(fs.readFileSync(directory + pack.metadata));
    assert.equal(pack.width, metadata.width);
    assert.equal(pack.height, metadata.height);
    assert(
      pack.image.includes("-") && /-[a-f0-9]{12}\.png$/.test(pack.image),
      id + ": content-addressed PNG",
    );
    assert(pack.metadata.replace(/\.json$/, ".png") === pack.image);
  }
  for (const id of ["actor-0-roll", "actor-0-bow", "actor-0-row"]) {
    assert(!manifest.packs[id], id + " has no active runtime package");
    assert(!fs.existsSync("data/aventura/assets/" + id + ".json"));
  }
  const cast = require("../data/aventura/art/cast/catalog.json");
  for (const sheet of cast.archivedSheets)
    assert(fs.existsSync("data/aventura/art/cast/sources/" + sheet.id + ".png"), "Retiring art preserves its master");
  const packBytes = manifest.packs["actor-100"].width * manifest.packs["actor-100"].height * 4;
  const focused = new LocalSprites({ budget: packBytes * 3 });
  await focused.initialize("http://localhost/assets/aventura/manifest.json");
  for (const id of [100, 101, 102]) await focused.load("actor-" + id);
  focused.residency.focus = new Map([["actor-100", 4], ["actor-101", 100], ["actor-102", 20]]);
  await focused.load("actor-103");
  assert(!focused.packs.has("actor-101"), "Farthest art is evicted even if it is newer than nearby art");
  assert(focused.packs.has("actor-100") && focused.packs.has("actor-102"));
  const lease = await focused.prepare([], ["actor-100", "actor-102", "actor-103"]);
  await assert.rejects(focused.load("actor-104"), /budget/);
  assert.equal(focused.residency.reservedBytes, 0, "Rejected admission cannot leak reservations");
  lease.release(); lease.release();
  assert.equal(focused.residency.holds.size, 0, "Release is idempotent");
  await focused.load("actor-104");
  const delayed = new LocalSprites({ budget: packBytes * 2 });
  await delayed.initialize("http://localhost/assets/aventura/manifest.json");
  let finishImage;
  const decoded = { naturalWidth: manifest.packs["actor-100"].width,
    naturalHeight: manifest.packs["actor-100"].height, src: "decoded" };
  delayed.json = async () => { throw new Error("Metadata failed first"); };
  delayed.loadImage = () => new Promise((done) => { finishImage = () => done(decoded); });
  const failedLoad = assert.rejects(delayed.load("actor-100"), /Metadata failed/);
  await new Promise(setImmediate);
  assert.equal(delayed.residency.reservedBytes, packBytes, "A metadata failure cannot free a still-decoding image's reservation");
  finishImage();
  await failedLoad;
  assert.equal(delayed.residency.reservedBytes, 0);
  assert.equal(decoded.src, "", "Late image is discarded after the paired request fails");
  console.log(
    "PASS: deduplicated loading, failures/retry, leased preparation, active pins, byte admission including in-flight images, farthest eviction, hashes and retired runtime art.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
