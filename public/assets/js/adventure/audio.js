"use strict";
const { Music } = require("./audio/music");
const { Ambience } = require("./audio/ambience");
/** One context, independent buses, explicit intent versus actual playback state. */
class WoodlandAudio {
  constructor(catalog, base, changed = () => {}, notify = () => {}) {
    Object.assign(this, {
      catalog,
      base,
      changed,
      notify,
      context: null,
      wanted: false,
      hidden: false,
      voice: false,
    });
    this.effects = new Set();
  }
  get on() {
    return Boolean(
      this.wanted && !this.hidden && this.context?.state === "running",
    );
  }
  initialize() {
    if (this.context) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.context.destination);
    const bus = () => {
      const gain = this.context.createGain();
      gain.connect(this.master);
      return gain;
    };
    this.musicBus = bus();
    this.ambienceBus = bus();
    this.effectsBus = bus();
    const url = (file) => new URL(file, new URL(this.base, location.href)).href;
    this.music = new Music(
      this.context,
      this.musicBus,
      this.catalog.music,
      url,
      this.notify,
    );
    this.ambience = new Ambience(
      this.context,
      this.ambienceBus,
      this.catalog.ambience,
      url,
    );
    this.context.addEventListener("statechange", () => this.changed());
    this.mix();
  }
  start() {
    this.wanted = true;
    if (this.hidden) return Promise.resolve(false);
    try {
      this.initialize();
      // No await before these activation-sensitive calls: fullscreen will consume the gesture.
      const resume = this.context.resume();
      this.music.start();
      return resume
        .then(() => {
          if (!this.wanted || this.hidden)
            this.context.suspend().catch(() => {});
          this.changed();
          return this.on;
        })
        .catch(() => {
          this.changed();
          return false;
        });
    } catch (_) {
      this.changed();
      return Promise.resolve(false);
    }
  }
  stop() {
    this.wanted = false;
    this.pause();
  }
  pause() {
    this.music?.stop();
    this.context?.suspend().catch(() => {});
    this.changed();
  }
  setHidden(value) {
    // Called on every visibility change now, so it has to be a no-op when the
    // state has not moved: otherwise every tab switch resumed the context and
    // re-entered Music.start() for nothing.
    if (Boolean(value) === Boolean(this.hidden)) return;
    this.hidden = Boolean(value);
    if (this.hidden) this.pause();
    else if (this.wanted) this.start();
  }
  setVoice(value) {
    this.voice = value;
    this.mix();
  }
  mix() {
    if (!this.context) return;
    // Narrated pieces contain their own soundtrack: no competing game audio.
    for (const bus of [this.musicBus, this.ambienceBus, this.effectsBus]) {
      bus.gain.cancelScheduledValues(this.context.currentTime);
      if (this.voice) bus.gain.setValueAtTime(0, this.context.currentTime);
      else bus.gain.setTargetAtTime(1, this.context.currentTime, 0.25);
    }
  }
  update(world, player, ms) {
    if (!this.on || ms < (this.nextSpatial || 0)) return;
    this.nextSpatial = ms + 125;
    this.ambience.update(world, player);
  }
  effect(kind) {
    if (!this.on || this.voice || this.effects.size >= 8) return;
    const notes =
      kind === "found" ? [72, 76, 79, 84] : kind === "knock" ? [48, 48] : [79];
    const now = this.context.currentTime;
    for (const [i, midi] of notes.entries()) {
      if (this.effects.size >= 8) break;
      const oscillator = this.context.createOscillator(),
        gain = this.context.createGain(),
        when = now + i * 0.12;
      oscillator.type = "triangle";
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(
        kind === "found" ? 0.08 : 0.035,
        when + 0.01,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.35);
      oscillator.connect(gain);
      gain.connect(this.effectsBus);
      this.effects.add(oscillator);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.effects.delete(oscillator);
      };
      oscillator.start(when);
      oscillator.stop(when + 0.4);
    }
  }
  inspect() {
    return {
      wanted: this.wanted,
      running: this.on,
      context: this.context?.state || "locked",
      voice: this.voice,
      musicGain: this.musicBus?.gain.value ?? 0,
      river: this.ambience?.level || 0,
      riverLoaded: Boolean(this.ambience?.source),
      music: this.music?.inspect() || null,
    };
  }
}
module.exports = { WoodlandAudio };
