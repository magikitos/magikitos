"use strict";
const byId = (id) => document.getElementById(id);
/** Inventory presentation. Item descriptions and consumption policies live in the catalogue. */
class Inventory {
  constructor(game) {
    this.game = game;
    this.selected = null;
    this.held = null;
    byId("bag-toggle").addEventListener("click", () => {
      if (!game.ready || game.transitioning) return;
      game.closeContent();
      game.closeDialogue();
      game.pauseMovement();
      this.paint();
      byId("bag-dialog").showModal();
    });
    byId("bag-use").addEventListener("click", () => {
      this.held = this.selected;
      byId("bag-dialog").close();
      this.paintHeld();
    });
    byId("held-item-cancel").addEventListener("click", () => this.clear());
    byId("bag-dialog").addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) return;
      const r = event.currentTarget.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        event.currentTarget.close();
    });
  }
  clear() {
    this.held = null;
    this.paintHeld();
  }
  paintHeld() {
    byId("held-item").hidden = !this.held;
    if (this.held)
      byId("held-item-label").textContent = this.game
        .text("usePrompt")
        .replace(
          ":item",
          this.game.text(this.game.catalog.items[this.held].name),
        );
  }
  paint() {
    const game = this.game,
      entries = Object.entries(game.state.inventory).filter(([, n]) => n > 0);
    byId("inventory-count").textContent = entries.reduce(
      (sum, [, n]) => sum + n,
      0,
    );
    byId("wallet-balance").textContent = game
      .text("walletBalance")
      .replace(":count", game.state.wallet.balance);
    const grid = byId("bag-items");
    grid.replaceChildren();
    for (const [id, count] of entries) {
      const definition = game.catalog.items[id],
        button = document.createElement("button");
      button.type = "button";
      button.className = "world-pick";
      button.dataset.item = id;
      const icon = game.renderer.sprites.icon(definition.sprite);
      if (icon) button.append(icon);
      const label = document.createElement("span");
      label.textContent =
        game.text(definition.name) + (count > 1 ? " × " + count : "");
      button.append(label);
      button.addEventListener("click", () => {
        this.selected = id;
        this.detail();
      });
      grid.append(button);
    }
    if (!entries.length) {
      const p = document.createElement("p");
      p.textContent = game.text("bagEmpty");
      grid.append(p);
    }
    if (!game.state.inventory[this.selected])
      this.selected = entries[0]?.[0] || null;
    if (this.held && !game.state.inventory[this.held]) this.clear();
    this.detail();
  }
  detail() {
    const game = this.game,
      definition = game.catalog.items[this.selected];
    byId("bag-detail").hidden = !definition;
    if (!definition) return;
    byId("bag-item-title").textContent = game.text(definition.name);
    byId("bag-item-description").textContent = game.text(
      definition.description,
    );
    byId("bag-item-lifetime").textContent = game.text(
      definition.reusable ? "reusable" : "consumable",
    );
    byId("bag-use").hidden = !definition.usable;
    document
      .querySelectorAll("[data-item]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.item === this.selected),
        ),
      );
  }
}
module.exports = { Inventory };
