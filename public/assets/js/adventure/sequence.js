"use strict";
/** A finite foreground timeline, driven by the game's RAF. Hidden tabs pause, no extra timers. */
class Sequence {
  constructor() {
    this.current = null;
  }
  play(type, duration, data = {}) {
    if (this.current)
      return Promise.reject(new Error("Sequence already active"));
    if (!Number.isFinite(duration) || duration <= 0)
      return Promise.reject(new Error("Invalid sequence duration"));
    return new Promise((resolve) => {
      this.current = { type, duration, elapsed: 0, data, resolve };
    });
  }
  advance(dt) {
    const current = this.current;
    if (!current) return;
    current.elapsed = Math.min(
      current.duration,
      current.elapsed + Math.max(0, dt),
    );
    if (current.elapsed >= current.duration) {
      this.current = null;
      current.resolve();
    }
  }
  progress() {
    return this.current ? this.current.elapsed / this.current.duration : 0;
  }
  inspect() {
    const c = this.current;
    return c
      ? {
          type: c.type,
          elapsed: c.elapsed,
          duration: c.duration,
          data: { ...c.data },
        }
      : null;
  }
}
module.exports = { Sequence };
