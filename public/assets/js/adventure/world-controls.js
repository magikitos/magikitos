"use strict";
const { InputModality } = require("./input-modality");

/** One continuous eight-way pointer, independent from the other hand and keyboard. */
function stickVector(dx, dy, radius) {
  const length = Math.hypot(dx, dy);
  if (length < radius * 0.2) return null;
  const angle = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
  return {
    x: Math.abs(Math.cos(angle)) < 1e-8 ? 0 : Math.cos(angle),
    y: Math.abs(Math.sin(angle)) < 1e-8 ? 0 : Math.sin(angle),
  };
}

class WorldControls {
  constructor(game) {
    this.game = game;
    this.stick = document.getElementById("world-joystick");
    this.boost = document.getElementById("world-boost");
    this.vector = null;
    this.boosted = false;
    this.modality = new InputModality((touch) => {
      document.documentElement.dataset.worldInput = touch ? "touch" : "desktop";
      this.stick.hidden = !touch;
      if (!touch) this.clear();
    });
    this.stick.addEventListener("pointerdown", (event) => {
      if (this.stick.hidden || this.stickId !== undefined || event.button !== 0)
        return;
      game.closeContent();
      if (!this.available()) return;
      event.preventDefault();
      this.stickId = event.pointerId;
      this.stick.setPointerCapture(event.pointerId);
      game.cancelPath();
      game.river.path = [];
      game.unlockAudio();
      this.move(event);
    });
    this.stick.addEventListener("pointermove", (event) => this.move(event));
    const stop = (event) => {
      if (event.pointerId !== this.stickId) return;
      this.releaseStick();
    };
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      this.stick.addEventListener(name, stop);
    this.boost.addEventListener("pointerdown", (event) => {
      if (
        event.button !== 0 ||
        this.boostId !== undefined ||
        this.boost.hidden ||
        !this.vector
      )
        return;
      game.closeContent();
      if (!this.available()) return;
      event.preventDefault();
      this.boostId = event.pointerId;
      this.boost.setPointerCapture(event.pointerId);
      this.boosted = true;
      this.boost.classList.add("is-active");
      this.boost.setAttribute("aria-pressed", "true");
      game.unlockAudio();
    });
    const stopBoost = (event) => {
      if (event.pointerId === this.boostId) this.releaseBoost();
    };
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      this.boost.addEventListener(name, stopBoost);
    for (const element of [this.stick, this.boost])
      element.addEventListener("contextmenu", (event) =>
        event.preventDefault(),
      );
  }
  available() {
    const g = this.game;
    return g.ready && !g.dialogue && !g.blocked();
  }
  move(event) {
    if (event.pointerId !== this.stickId) return;
    // Track the held thumb through an asynchronous river crossing. Physics is
    // paused by the game; release/cancel still works while art is being prepared.
    event.preventDefault();
    const rect = this.stick.getBoundingClientRect(),
      radius = rect.width * 0.34;
    const dx = event.clientX - (rect.x + rect.width / 2),
      dy = event.clientY - (rect.y + rect.height / 2);
    this.vector = stickVector(dx, dy, radius);
    this.boost.hidden = !this.vector;
    if (!this.vector) this.releaseBoost();
    const factor = Math.min(1, radius / Math.max(1, Math.hypot(dx, dy)));
    this.stick.style.setProperty("--stick-x", dx * factor + "px");
    this.stick.style.setProperty("--stick-y", dy * factor + "px");
    this.stick.classList.toggle("is-active", Boolean(this.vector));
  }
  releaseStick() {
    const id = this.stickId;
    this.stickId = undefined;
    this.vector = null;
    this.boost.hidden = true;
    this.releaseBoost();
    if (id !== undefined && this.stick.hasPointerCapture(id))
      this.stick.releasePointerCapture(id);
    this.stick.style.setProperty("--stick-x", "0px");
    this.stick.style.setProperty("--stick-y", "0px");
    this.stick.classList.remove("is-active");
  }
  releaseBoost() {
    const id = this.boostId;
    this.boostId = undefined;
    this.boosted = false;
    if (id !== undefined && this.boost.hasPointerCapture(id))
      this.boost.releasePointerCapture(id);
    this.boost.classList.remove("is-active");
    this.boost.setAttribute("aria-pressed", "false");
  }
  clear() {
    this.releaseStick();
  }
}
module.exports = { WorldControls, stickVector };
