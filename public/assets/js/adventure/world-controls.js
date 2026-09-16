"use strict";
const { InputModality } = require("./input-modality");

/** A floating thumb stick: one continuous eight-way pointer, independent from the
 * other hand and keyboard.
 *
 * ⛔ THE ZONE IS NOT THE RING. `#world-joystick` is an invisible square in the
 * corner — the territory a thumb may land on — and the ring you see is drawn
 * wherever it lands. A fixed ring pinned to the corner made "down" and
 * "down-right" the two hardest directions in the game: neutral sat 84px from two
 * screen edges and full deflection spent 45 of them, so the thumb finished about
 * forty pixels from the margin, on top of the system gesture strip. Choosing
 * neutral removes the problem instead of fighting it: from wherever you press,
 * every direction costs the same --world-stick-travel pixels.
 *
 * It is still ONE element that takes a gesture, which is what keeps everything
 * else intact — tap to walk, drag to pan and pinch behave exactly as before
 * outside it, and a press inside it that never steers is forwarded as a tap, so
 * the larger territory cannot swallow a destination. */
const DEADZONE = 0.2;
/** A press that neither steers nor lingers was somebody pointing at the map. */
const TAP_MS = 260;
const TAP_SLOP = 12;

function stickVector(dx, dy, radius) {
  const length = Math.hypot(dx, dy);
  if (length < radius * DEADZONE) return null;
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
    this.origin = { x: 0, y: 0 };
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
      this.pressedAt = performance.now();
      this.pressedOn = { x: event.clientX, y: event.clientY };
      this.steered = false;
      this.stick.classList.add("is-active");
      this.anchor(event);
      game.cancelPath();
      game.river.path = [];
      game.unlockAudio();
      this.move(event);
    });
    this.stick.addEventListener("pointermove", (event) => this.move(event));
    const stop = (event) => {
      if (event.pointerId !== this.stickId) return;
      const tapped =
        event.type === "pointerup" &&
        !this.steered &&
        performance.now() - this.pressedAt < TAP_MS &&
        Math.hypot(
          event.clientX - this.pressedOn.x,
          event.clientY - this.pressedOn.y,
        ) < TAP_SLOP;
      this.releaseStick();
      if (tapped) game.input?.tapAt(event.clientX, event.clientY);
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
  /** Zone geometry, read from the stylesheet so one set of numbers governs the
   * look and the feel. Travel is fixed pixels, never a fraction of the zone:
   * growing the territory must not make the stick twitchier. */
  metrics() {
    const rect = this.stick.getBoundingClientRect();
    const travel =
      parseFloat(
        getComputedStyle(this.stick).getPropertyValue("--world-stick-travel"),
      ) || 46;
    return { rect, travel, reach: Math.max(0, rect.width / 2 - travel) };
  }
  /** Where the thumb landed becomes neutral, clamped so the knob's centre still
   * cannot leave the zone however far off-centre the press was. */
  anchor(event) {
    const { rect, reach } = this.metrics();
    let x = event.clientX - (rect.x + rect.width / 2),
      y = event.clientY - (rect.y + rect.height / 2);
    const length = Math.hypot(x, y);
    if (length > reach && length > 0) {
      x = (x / length) * reach;
      y = (y / length) * reach;
    }
    this.origin = { x, y };
    this.stick.style.setProperty("--stick-home-x", x + "px");
    this.stick.style.setProperty("--stick-home-y", y + "px");
  }
  move(event) {
    if (event.pointerId !== this.stickId) return;
    // Track the held thumb through an asynchronous river crossing. Physics is
    // paused by the game; release/cancel still works while art is being prepared.
    event.preventDefault();
    const { rect, travel } = this.metrics();
    const dx = event.clientX - (rect.x + rect.width / 2 + this.origin.x),
      dy = event.clientY - (rect.y + rect.height / 2 + this.origin.y);
    this.vector = stickVector(dx, dy, travel);
    if (this.vector) this.steered = true;
    this.boost.hidden = !this.vector;
    if (!this.vector) this.releaseBoost();
    const factor = Math.min(1, travel / Math.max(1, Math.hypot(dx, dy)));
    this.stick.style.setProperty("--stick-x", dx * factor + "px");
    this.stick.style.setProperty("--stick-y", dy * factor + "px");
  }
  releaseStick() {
    const id = this.stickId;
    this.stickId = undefined;
    this.vector = null;
    this.steered = false;
    this.boost.hidden = true;
    this.releaseBoost();
    if (id !== undefined && this.stick.hasPointerCapture(id))
      this.stick.releasePointerCapture(id);
    this.origin = { x: 0, y: 0 };
    for (const name of [
      "--stick-x",
      "--stick-y",
      "--stick-home-x",
      "--stick-home-y",
    ])
      this.stick.style.setProperty(name, "0px");
    // Dropping the class restores the transition, so the ring eases home instead
    // of teleporting there the instant the thumb lifts.
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
