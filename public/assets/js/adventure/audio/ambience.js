"use strict";
const { TILE } = require("../geometry");
/** Bounded spatial sampling follows the player, never a panned camera. */
function waterPresence(world, player) {
  if (!world || !player || world.data.indoor || !world.data.navigation)
    return 0;
  const x = player.x / TILE,
    y = player.y / TILE;
  if (world.waterAt(x, y)) return 1;
  for (const radius of [1.5, 3, 5, 7])
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      if (
        world.waterAt(
          x + Math.cos(angle) * radius,
          y + Math.sin(angle) * radius,
        )
      )
        return Math.max(0, 1 - radius / 8);
    }
  return 0;
}
class Ambience {
  constructor(context, destination, entries, url) {
    Object.assign(this, {
      context,
      entries,
      url,
      level: 0,
      loading: null,
      source: null,
      retryAfter: 0,
    });
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(destination);
  }
  update(world, player) {
    this.level = waterPresence(world, player);
    this.gain.gain.setTargetAtTime(
      this.level * 0.22,
      this.context.currentTime,
      0.7,
    );
    if (
      this.level > 0 &&
      !this.source &&
      !this.loading &&
      Date.now() >= this.retryAfter
    )
      this.loading = this.load().finally(() => {
        this.loading = null;
      });
  }
  async load() {
    const entry = this.entries.river;
    if (!entry) return;
    try {
      const response = await fetch(this.url(entry.file), {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error("Ambient asset unavailable");
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 4 * 1024 * 1024)
        throw Error("Ambient download exceeds budget");
      const buffer = await this.context.decodeAudioData(bytes);
      if (buffer.length * buffer.numberOfChannels * 4 > 32 * 1024 * 1024)
        throw Error("Ambient PCM exceeds budget");
      this.source = this.context.createBufferSource();
      this.source.buffer = buffer;
      this.source.loop = true;
      this.source.connect(this.gain);
      this.source.start();
    } catch (_) {
      this.retryAfter = Date.now() + 30000;
    }
  }
}
module.exports = { Ambience, waterPresence };
