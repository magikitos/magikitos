"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  crypto = require("node:crypto");
const {
  waterPresence,
} = require("../public/assets/js/adventure/audio/ambience");
const { Music } = require("../public/assets/js/adventure/audio/music");
const { WoodlandAudio } = require("../public/assets/js/adventure/audio");
const { hasSavedJourney } = require("../public/assets/js/adventure/entry");
const { verify } = require("../tools/artifact.cjs");
const catalog = require("../public/assets/audio/catalog.json");
assert(catalog.music.length >= 4);
for (const entry of [...catalog.music, ...Object.values(catalog.ambience)]) {
  assert.match(entry.file, /^[a-f0-9]{32}\.mp3$/);
  const bytes = fs.readFileSync("public/assets/audio/" + entry.file);
  assert.equal(bytes.length, entry.bytes);
  assert.equal(
    crypto
      .createHash("md5")
      .update(fs.readFileSync("data/audio/originals/" + entry.file))
      .digest("hex"),
    entry.id,
    "Untouched original checksum",
  );
  assert(entry.duration > 1 && entry.duration < 600);
}
assert.equal(hasSavedJourney({ getItem: () => null }), false);
assert.equal(
  hasSavedJourney({
    getItem: () => '{"scene":"overworld","position":{"x":1,"y":2}}',
  }),
  true,
);
assert.equal(hasSavedJourney({ getItem: () => "{broken" }), false);
assert.equal(
  hasSavedJourney({
    getItem: () => {
      throw Error();
    },
  }),
  false,
);
const world = { data: { navigation: {} }, waterAt: (x) => x > 10 };
assert.equal(waterPresence(world, { x: 0, y: 0 }), 0);
assert.equal(waterPresence(world, { x: 176, y: 0 }), 1);
assert(waterPresence(world, { x: 144, y: 0 }) > 0);
assert.equal(
  waterPresence(
    { ...world, data: { navigation: {}, indoor: true } },
    { x: 176, y: 0 },
  ),
  0,
);
const makeParam = () => ({
  value: 0,
  setValueAtTime(v) {
    this.value = v;
  },
  setTargetAtTime(v) {
    this.value = v;
  },
  linearRampToValueAtTime(v) {
    this.value = v;
  },
  cancelScheduledValues() {},
});
const context = {
  currentTime: 0,
  createGain: () => ({ gain: makeParam(), connect() {} }),
  createMediaElementSource: () => ({ connect() {} }),
};
global.Audio = class {
  constructor() {
    this.paused = true;
    this.currentTime = 0;
    this.duration = 100;
    this.readyState = 4;
  }
  addEventListener() {}
  pause() {
    this.paused = true;
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  load() {}
};
(async () => {
  const music = new Music(
    context,
    {},
    catalog.music,
    (f) => f,
    () => {},
  );
  const seen = [music.decks[0].track.id, music.decks[1].track.id];
  for (let i = 2; i < catalog.music.length; i++)
    seen.push(music.nextTrack().id);
  assert.equal(
    new Set(seen).size,
    catalog.music.length,
    "No repeats within playlist round",
  );
  assert.notEqual(
    music.nextTrack().id,
    seen.at(-1),
    "No adjacent repeats across rounds",
  );
  music.start();
  await new Promise((r) => setImmediate(r));
  assert.equal(
    music.decks.filter((d) => !d.media.paused).length,
    1,
    "Second unlocked deck is held ready, inaudible",
  );
  music.decks[0].media.currentTime = 98;
  await music.advance();
  assert(music.fade);
  context.currentTime = 3;
  music.update();
  assert.equal(music.active, 1);
  assert.equal(music.fade, null);
  music.stop();
  assert(music.decks.every((d) => d.media.paused));
  const audio = new WoodlandAudio(catalog, "/assets/audio/");
  audio.context = { currentTime: 0 };
  audio.musicBus = { gain: makeParam() };
  audio.ambienceBus = { gain: makeParam() };
  audio.effectsBus = { gain: makeParam() };
  audio.setVoice(true);
  assert.equal(audio.musicBus.gain.value, 0);
  assert.equal(audio.ambienceBus.gain.value, 0);
  audio.setVoice(false);
  assert.equal(audio.musicBus.gain.value, 1);
  const pointer = require("../.local/build/current.json");
  const release = verify(".local/build/releases/" + pointer.id, pointer.id);
  assert(Object.keys(release.files).includes("assets/audio/catalog.json"));
  assert(
    !Object.keys(release.files).some((f) =>
      /original|sources\.json|apps\/mobile/.test(f),
    ),
    "Delivery excludes masters and native build sources",
  );
  for (const lang of ["es", "en", "de", "fr", "it", "pt"]) {
    const strings = require("../data/aventura/locales/" + lang + ".json");
    for (const key of [
      "entryExplore",
      "continueExploring",
      "fullscreen",
      "soundRetry",
    ])
      assert.equal(typeof strings[key], "string");
  }
  console.log(
    "PASS audio sources, finite asset budgets, spatial river, playlist/deck reuse, voice priority, safe saved-entry selection and delivery allowlist",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
