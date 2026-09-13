"use strict";
const { drawRipples } = require("./water");
const { clamp } = require("./model");
/** Short shore-to-shore tableau. The occupied sprite binds both passengers to the hull. */
class Voyage {
  constructor(game) {
    this.game = game;
  }
  get active() {
    return this.game.sequence.current?.type === "voyage";
  }
  async play(travel, entity) {
    const definition = this.game.catalog.transports[travel.presentation];
    if (!definition) throw new Error("Unknown travel presentation");
    document.getElementById("world-toast").hidden = true;
    const boat = this.game.world.entities.find(
      (e) => e.interactAs === entity.id,
    );
    await this.game.sequence.play(
      "voyage",
      this.game.reducedMotion ? 2.4 : definition.duration,
      {
        presentation: travel.presentation,
        reverse: Boolean(boat?.flip),
        destination: travel.scene,
      },
    );
  }
  render(c, width, height, time) {
    const game = this.game,
      seq = game.sequence.current,
      p = game.sequence.progress();
    const definition = game.catalog.transports[seq.data.presentation];
    c.fillStyle = "#5b9f9a";
    c.fillRect(0, 0, width, height);
    const openWater = { data: { seed: 9137 }, waterAt: () => true };
    drawRipples(
      c,
      openWater,
      { x: 0, y: 0, width, height },
      game.reducedMotion ? 0 : time,
    );
    const shore = clamp(width * 0.08, 20, 62);
    const y = height * 0.57;
    c.save();
    if (seq.data.reverse) {
      c.translate(width, 0);
      c.scale(-1, 1);
    }
    for (const side of [0, 1]) {
      c.save();
      if (side) {
        c.translate(width, 0);
        c.scale(-1, 1);
      }
      for (const [extra, color] of [
        [10, "#aecbad"],
        [5, "#c6bd8e"],
        [0, "#628151"],
      ]) {
        c.fillStyle = color;
        c.beginPath();
        c.ellipse(-22, y, shore + 22 + extra, height * 0.8, 0, 0, Math.PI * 2);
        c.fill();
      }
      // A few familiar bank details, kept away from the landing and the boat's path.
      for (let i = 0; i < 7; i++) {
        const name =
          definition.shoreSprites[i % definition.shoreSprites.length];
        const f = game.renderer.sprites.frame(name);
        const py = height * (0.12 + i * 0.12);
        if (Math.abs(py - y) < 45) continue;
        game.renderer.sprites.draw(
          c,
          name,
          shore - f.w - 3 + (i % 2) * 7,
          py - f.anchor[1],
        );
      }
      game.renderer.sprites.draw(c, "jetty", shore - 13, y - 7, 52, 26);
      c.restore();
    }
    const pose = game.reducedMotion
      ? 0
      : Math.floor(seq.elapsed / 0.22) % definition.frames;
    const sprite = definition.spritePrefix + pose,
      frame = game.renderer.sprites.frame(sprite);
    // Keep both passengers and the entire hull visible even in narrow portrait viewports.
    const zoom = Math.min(1, (width * 0.4) / frame.w);
    const t = p * p * (3 - 2 * p);
    const start = shore + (frame.w * zoom) / 2 - 8;
    const x = start + t * (width - 2 * start);
    const bob = game.reducedMotion ? 0 : Math.round(Math.sin(time * 3) * 0.8);
    if (!game.reducedMotion) {
      c.strokeStyle = "#afd6c7";
      c.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const drift = (seq.elapsed * 12 + i * 12) % 35;
        c.globalAlpha = (1 - drift / 35) * 0.35;
        c.beginPath();
        c.ellipse(
          x - frame.w * zoom * 0.42 - drift,
          y + 4,
          8 + drift * 0.18,
          2 + drift * 0.09,
          0,
          -1.2,
          1.2,
        );
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    game.renderer.sprites.draw(
      c,
      sprite,
      Math.round(x - frame.anchor[0] * zoom),
      Math.round(y - frame.anchor[1] * zoom + bob),
      Math.round(frame.w * zoom),
      Math.round(frame.h * zoom),
    );
    c.restore();
    const fade = clamp(Math.min(p * 14, (1 - p) * 14), 0, 1);
    if (fade < 1) {
      c.fillStyle = "rgba(32,54,42," + (1 - fade) + ")";
      c.fillRect(0, 0, width, height);
    }
  }
}
module.exports = { Voyage };
