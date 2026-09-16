"use strict";
const { clamp } = require("./model");

/** Presentation only, derived from committed deltas; never grants or saves an item. */
class PickupFeedback {
  constructor(game) {
    this.game = game;
    this.running = new Set();
  }
  gained(before, after, origin) {
    for (const [id, amount] of Object.entries(after.inventory)) {
      const delta = amount - (before.inventory[id] || 0);
      if (delta > 0) {
        const item = this.game.catalog.items[id];
        this.game.telemetry?.milestone("pickup");
        this.fly(
          item.sprite,
          "+" + delta + " " + this.game.text(item.name),
          origin,
        );
      }
    }
    const coins = after.wallet.balance - before.wallet.balance;
    if (coins > 0)
      this.fly(
        "setin",
        "+" + this.game.text("walletBalance").replace(":count", coins),
        origin,
      );
  }
  fly(sprite, label, origin) {
    const game = this.game,
      icon = game.renderer.sprites.icon(sprite);
    if (!icon) return;
    // At most a handful of simultaneous presentation nodes, even with future loot bundles.
    if (this.running.size >= 6) this.running.values().next().value.cancel();
    const node = document.createElement("div");
    node.className = "world-pickup";
    node.setAttribute("aria-hidden", "true");
    const caption = document.createElement("span");
    caption.textContent = label;
    node.append(icon, caption);
    const rect = game.renderer.canvas.getBoundingClientRect();
    const x = clamp(
      rect.left +
        ((origin.x - game.camera.x) / game.renderer.width) * rect.width,
      60,
      innerWidth - 60,
    );
    const y = clamp(
      rect.top +
        ((origin.y - game.camera.y - 25) / game.renderer.height) * rect.height,
      100,
      innerHeight - 140,
    );
    node.style.left = x + "px";
    node.style.top = y + "px";
    document.body.append(node);
    const bag = document.getElementById("bag-toggle");
    const target = bag.getBoundingClientRect();
    const dx = target.left + target.width / 2 - x;
    const dy = target.top + target.height / 2 - y;
    const reduced = game.reducedMotion;
    const animation = node.animate(
      reduced
        ? [
            { opacity: 0 },
            { opacity: 1, offset: 0.15 },
            { opacity: 1, offset: 0.8 },
            { opacity: 0 },
          ]
        : [
            { transform: "translate(0, 8px) scale(.6)", opacity: 0 },
            {
              transform: "translate(0, -12px) scale(1.15)",
              opacity: 1,
              offset: 0.18,
            },
            {
              transform: "translate(0, -12px) scale(1)",
              opacity: 1,
              offset: 0.42,
            },
            {
              transform: `translate(${dx * 0.48}px, ${Math.min(dy * 0.7, -70)}px) scale(.85)`,
              opacity: 1,
              offset: 0.7,
            },
            {
              transform: `translate(${dx}px, ${dy}px) scale(.25)`,
              opacity: 0.5,
            },
          ],
      {
        duration: reduced ? 700 : 1100,
        easing: "linear",
        fill: "forwards",
      },
    );
    this.running.add(animation);
    animation.finished
      .then(() => {
        if (!reduced)
          bag.animate(
            [
              { transform: "scale(1)" },
              { transform: "scale(1.22)" },
              { transform: "scale(1)" },
            ],
            { duration: 260 },
          );
      })
      .catch(() => {})
      .finally(() => {
        node.remove();
        this.running.delete(animation);
      });
    document.getElementById("pickup-status").textContent = label;
  }
}
module.exports = { PickupFeedback };
