"use strict";
/** Two reusable streaming decks. Never decode a whole playlist into PCM memory. */
class Music {
  constructor(context, destination, tracks, url, notify) {
    Object.assign(this, {
      context,
      tracks,
      url,
      notify,
      bag: [],
      last: null,
      active: 0,
      paused: true,
      generation: 0,
      fade: null,
    });
    this.decks = [0, 1].map(() => {
      const media = new Audio();
      media.preload = "none";
      const gain = context.createGain();
      gain.gain.value = 0;
      context.createMediaElementSource(media).connect(gain);
      gain.connect(destination);
      media.addEventListener("ended", () => this.advance());
      media.addEventListener("error", () => {
        if (this.paused) return;
        // A failed connection must not produce a new play attempt every 200ms.
        // Keep the game usable and offer a fresh, user-activated retry via sound.
        this.blocked = true;
        this.stop();
        notify("musicUnavailable");
      });
      return { media, gain, track: null };
    });
    this.load(this.decks[0]);
    this.load(this.decks[1]);
  }
  nextTrack() {
    if (!this.bag.length) {
      this.bag = [...this.tracks];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
      if (this.bag.length > 1 && this.bag.at(-1).id === this.last)
        [this.bag[0], this.bag[this.bag.length - 1]] = [
          this.bag.at(-1),
          this.bag[0],
        ];
    }
    const track = this.bag.pop();
    this.last = track?.id;
    return track;
  }
  load(deck) {
    deck.track = this.nextTrack();
    if (deck.track) deck.media.src = this.url(deck.track.file);
  }
  play(deck) {
    const generation = this.generation;
    return deck.media
      .play()
      .then(() => {
        if (this.paused || generation !== this.generation) deck.media.pause();
        return !this.paused && generation === this.generation;
      })
      .catch((error) => {
        if (error.name !== "AbortError" && !this.paused) {
          this.blocked = error.name === "NotAllowedError";
          this.notify(this.blocked ? "soundRetry" : "musicUnavailable");
        }
        return false;
      });
  }
  start() {
    if (this.blocked) {
      this.stop();
      for (const deck of this.decks) if (deck.media.error) deck.media.load();
    }
    if (!this.tracks.length || !this.paused) return;
    this.blocked = false;
    this.paused = false;
    const generation = ++this.generation;
    const current = this.decks[this.active],
      next = this.decks[1 - this.active];
    current.gain.gain.setValueAtTime(1, this.context.currentTime);
    next.gain.gain.setValueAtTime(0, this.context.currentTime);
    // Activate both reusable elements in the entry gesture, before any fullscreen request.
    this.play(current);
    this.play(next).then((ok) => {
      if (ok && generation === this.generation && !this.fade) {
        next.media.pause();
        next.media.currentTime = 0;
      }
    });
    clearInterval(this.timer);
    this.timer = setInterval(() => this.update(), 200);
  }
  update() {
    if (this.paused) return;
    const current = this.decks[this.active].media;
    if (this.fade) {
      if (this.context.currentTime >= this.fade.until) this.finishFade();
    } else if (
      Number.isFinite(current.duration) &&
      current.duration - current.currentTime <= 3 &&
      current.currentTime > 0
    )
      this.advance();
  }
  async advance() {
    if (this.paused || this.blocked || this.fade || !this.tracks.length) return;
    const old = this.decks[this.active],
      next = this.decks[1 - this.active];
    if (!old.media.ended && next.media.readyState < 3) return;
    const generation = this.generation;
    this.fade = { pending: true, until: Infinity };
    const ok = await this.play(next);
    if (generation !== this.generation || this.paused) return;
    if (!ok) {
      this.fade = null;
      return;
    }
    const now = this.context.currentTime;
    const duration = old.media.ended
      ? 0.15
      : Math.max(0.15, Math.min(3, old.media.duration - old.media.currentTime));
    this.fade = { until: now + duration };
    old.gain.gain.setValueAtTime(1, now);
    old.gain.gain.linearRampToValueAtTime(0, now + duration);
    next.gain.gain.setValueAtTime(0, now);
    next.gain.gain.linearRampToValueAtTime(1, now + duration);
  }
  finishFade() {
    const old = this.decks[this.active];
    old.media.pause();
    this.active = 1 - this.active;
    this.fade = null;
    this.load(old);
    old.media.preload = "auto";
    old.media.load();
  }
  stop() {
    this.paused = true;
    this.generation++;
    clearInterval(this.timer);
    if (this.fade) {
      this.active = 1 - this.active;
      this.fade = null;
      this.load(this.decks[1 - this.active]);
    }
    for (const deck of this.decks) {
      deck.media.pause();
      deck.gain.gain.cancelScheduledValues(this.context.currentTime);
    }
  }
  inspect() {
    return {
      track: this.decks[this.active]?.track?.id,
      time: this.decks[this.active]?.media.currentTime,
      paused: this.paused,
      fading: Boolean(this.fade),
      decks: this.decks.length,
    };
  }
}
module.exports = { Music };
