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
      // La foto en una caja del mismo tamaño para todas, el nombre debajo y, si hay más de una,
      // la cuenta en una chapa en la esquina: «Palito × 5» partido en dos líneas no se leía.
      const box = document.createElement("span");
      box.className = "world-pick-icon";
      const icon = game.renderer.sprites.iconIn(definition.sprite, 56);
      if (icon) box.append(icon);
      button.append(box);
      const label = document.createElement("span");
      label.className = "world-pick-name";
      label.textContent = game.text(definition.name);
      button.append(label);
      if (count > 1) {
        const badge = document.createElement("span");
        badge.className = "world-pick-count";
        badge.textContent = "×" + count;
        button.append(badge);
      }
      button.setAttribute(
        "aria-label",
        game.text(definition.name) + (count > 1 ? " × " + count : ""),
      );
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
    const icon = game.renderer.sprites.iconIn(definition.sprite, 60, 4);
    byId("bag-item-icon").replaceChildren(...(icon ? [icon] : []));
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
