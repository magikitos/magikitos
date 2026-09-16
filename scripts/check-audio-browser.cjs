"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47842";
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--autoplay-policy=user-gesture-required"],
  });
  const errors = [];
  fs.mkdirSync(".local/audio-review", { recursive: true });
  try {
    for (const size of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      const page = await browser.newPage({ viewport: size, hasTouch: true });
      const requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (r.url().endsWith(".mp3")) requests.push(r.url());
      });
      await page.route("**/*", (r) =>
        new URL(r.request().url()).origin === origin &&
        ["GET", "HEAD"].includes(r.request().method())
          ? r.continue()
          : r.abort(),
      );
      await page.addInitScript(() => {
        window.__media = [];
        const AudioElement = window.Audio;
        window.Audio = function (...args) {
          const media = new AudioElement(...args);
          window.__media.push(media);
          return media;
        };
        const Context = window.AudioContext;
        window.AudioContext = class extends Context {
          constructor(...args) {
            super(...args);
            window.__audioContext = this;
            const create = this.createGain.bind(this);
            this.createGain = () => {
              const gain = create();
              if (!window.__master) window.__master = gain;
              return gain;
            };
          }
        };
      });
      await page.goto(origin + "/aventura");
      await page.waitForFunction(
        () => window.MagikitosAdventure?.inspect().ready,
      );
      assert.equal(
        await page.locator("#entry-start").textContent(),
        "Explorar",
      );
      assert.equal(requests.length, 0, "No audio downloads before entry");
      assert(await page.locator("#world-fullscreen").isHidden());
      await page.screenshot({
        path: `.local/audio-review/entry-${size.width}.png`,
      });
      const before = await page.evaluate(
        () => window.MagikitosAdventure.inspect().player,
      );
      await page.keyboard.press("ArrowDown");
      assert.deepEqual(
        await page.evaluate(() => window.MagikitosAdventure.inspect().player),
        before,
      );
      await page.locator("#entry-start").click();
      await page.waitForFunction(
        () =>
          window.MagikitosAdventure.inspect().audio.running &&
          window.__media.some((m) => m.currentTime > 0.2 && !m.paused),
      );
      assert(await page.locator("#world-fullscreen").isVisible());
      assert.equal(await page.evaluate(() => window.__media.length), 2);
      // Test actual signal through the mixer, not just an icon or resolved play() promise.
      await page.evaluate(() => {
        const c = window.__audioContext,
          a = c.createAnalyser();
        a.fftSize = 2048;
        window.__master.disconnect();
        window.__master.connect(a);
        a.connect(c.destination);
        window.__analyser = a;
        window.__energy = () => {
          const data = new Float32Array(a.fftSize);
          a.getFloatTimeDomainData(data);
          return Math.max(...data.map(Math.abs));
        };
      });
      await page.waitForFunction(() => window.__energy() > 0.0001);
      const first = await page.evaluate(
        () => window.MagikitosAdventure.inspect().audio.music.track,
      );
      await page.evaluate(() => {
        const playing = window.__media.find((m) => !m.paused);
        playing.currentTime = playing.duration - 2;
      });
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().audio.music.fading,
      );
      await page.waitForFunction(
        (old) => window.MagikitosAdventure.inspect().audio.music.track !== old,
        first,
      );
      assert.equal(
        await page.evaluate(() => window.__media.length),
        2,
        "Playlist reuses unlocked decks",
      );
      // Real HTML media playback through the narration element; the local MP3 is
      // a fixture, not a replacement or modification of the website's voices.
      await page.evaluate(async () => {
        const voice = document.getElementById("world-audio");
        voice.src = window.__media[0].src;
        await voice.play();
      });
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().audio.musicGain === 0,
      );
      await page.waitForTimeout(100);
      assert.equal(
        await page.evaluate(() => window.__energy()),
        0,
        "Narration has no game soundtrack or ambient mix",
      );
      await page.evaluate(() => document.getElementById("world-audio").pause());
      await page.waitForFunction(() => window.__energy() > 0.0001);
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("magikitos:app-state", { detail: { active: false } }),
        ),
      );
      await page.waitForFunction(
        () =>
          !window.MagikitosAdventure.inspect().audio.running &&
          window.__media.every((m) => m.paused),
      );
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("magikitos:app-state", { detail: { active: true } }),
        ),
      );
      await page.waitForFunction(
        () =>
          window.MagikitosAdventure.inspect().audio.running &&
          window.__energy() > 0.0001,
      );
      await page.locator("#world-fullscreen").click();
      await page.waitForFunction(
        () => document.fullscreenElement === document.documentElement,
      );
      assert(
        await page.locator("#world-fullscreen").isHidden(),
        "No exit-fullscreen button",
      );
      await page.evaluate(() => document.exitFullscreen());
      await page.waitForFunction(
        () => !document.getElementById("world-fullscreen").hidden,
      );
      assert(await page.locator("#world-fullscreen").isVisible());
      await page.locator("#sound-toggle").click();
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().audio.running,
      );
      assert(await page.evaluate(() => window.__media.every((m) => m.paused)));
      await page.reload();
      await page.waitForFunction(
        () => window.MagikitosAdventure?.inspect().ready,
      );
      assert.equal(
        await page.locator("#entry-start").textContent(),
        "Continuar explorando",
      );
      assert(!(await page.locator("#entry-sound").isChecked()));
      await page.locator("#entry-start").click();
      assert.equal(
        await page.evaluate(
          () => window.MagikitosAdventure.inspect().audio.context,
        ),
        "locked",
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth === innerWidth,
        ),
      );
      await page.close();
      console.log(
        "PASS real audio, welcome, playlist crossfade, voice silence, fullscreen and mute " +
          size.width +
          "×" +
          size.height,
      );
    }
    const riverScene = Object.values(world.scenes).find(
      (s) => s.navigation?.landings?.length && s.rivers?.length,
    );
    assert(riverScene, "Navigable river fixture");
    const page = await browser.newPage();
    await page.route("**/api/**", (r) => r.abort());
    await page.addInitScript(
      (scene) =>
        localStorage.setItem(
          "magikitos.adventure",
          JSON.stringify({
            scene: scene.id,
            position: {
              x: scene.navigation.landings[0].water[0] * 16,
              y: scene.navigation.landings[0].water[1] * 16,
            },
            inventory: { boat: 1 },
            navigation: { mode: "boat", direction: "right" },
            flags: { boatBuilt: true },
          }),
        ),
      riverScene,
    );
    await page.goto(origin + "/aventura");
    await require("./browser-entry.cjs").enterWorld(page);
    await page.waitForFunction(
      () => window.MagikitosAdventure.inspect().audio.riverLoaded,
      null,
      { timeout: 20000 },
    );
    const river = await page.evaluate(
      () => window.MagikitosAdventure.inspect().audio,
    );
    assert(river.river > 0 && river.music && river.running);
    await page.screenshot({ path: ".local/audio-review/river.png" });
    await page.close();
    assert.deepEqual(errors, []);
    console.log("PASS river lazily mixed with music; no page errors");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
