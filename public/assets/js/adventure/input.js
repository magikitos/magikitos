"use strict";
const { MapGestures } = require("./map-gestures");
const { WorldControls } = require("./world-controls");
const MOVE_KEYS = new Set([
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "w",
  "a",
  "s",
  "d",
  "z",
  "q",
]);
const editable = (target) =>
  target.closest('input,textarea,select,[contenteditable="true"]');

/** Context priority: native form/modal > dialogue > world controls. No device detection. */
class WorldInput {
  constructor(game) {
    const canvas = document.getElementById("world-canvas");
    this.game = game;
    this.canvas = canvas;
    // Dismiss before the target's pointer handler, without swallowing that gesture.
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (
          game.dialogue &&
          !event.target.closest("#dialogue") &&
          !game.hasOverlay()
        )
          game.closeDialogue();
      },
      true,
    );
    this.controls = new WorldControls(game);
    this.map = new MapGestures(game, canvas);
    const press = (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      if (this.tapAt(event.clientX, event.clientY)) event.preventDefault();
    };
    canvas.addEventListener("pointerdown", (event) => {
      if (event.defaultPrevented) return;
      this.map.down(event);
    });
    canvas.addEventListener("pointermove", (event) => this.map.move(event));
    canvas.addEventListener("pointerup", (event) => {
      if (this.map.up(event)) press(event);
    });
    canvas.addEventListener("pointercancel", (event) =>
      this.map.up(event, true),
    );
    canvas.addEventListener("lostpointercapture", (event) =>
      this.map.up(event, true),
    );
    window.addEventListener("blur", () => this.map.clear());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.map.clear();
    });
    canvas.addEventListener("dblclick", (event) => event.preventDefault());
    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          !game.hasOverlay() &&
          !document.getElementById("world-content").hidden
        ) {
          event.preventDefault();
          game.closeContent();
          return;
        }
        if (
          editable(event.target) ||
          game.hasOverlay() ||
          !game.ready ||
          game.transitioning
        )
          return;
        const key = event.key.toLowerCase();
        if (game.dialogue) {
          if (["enter", "escape", " "].includes(key)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!event.repeat)
              key === " " ? game.nextDialogue() : game.closeDialogue();
          }
          return;
        }
        if (key === "escape") {
          event.preventDefault();
          game.closeContent();
          game.inventory.clear();
        } else if (
          key === " " &&
          document.getElementById("world-content").hidden
        ) {
          // Prevent a focused dialogue button from firing after the dialogue has closed.
          if (
            event.target === canvas ||
            event.target === document.body ||
            event.target.closest("#world-boost,#world-joystick") ||
            game.movementIntent()
          ) {
            event.preventDefault();
            if (!event.repeat && !game.keys.has(key)) {
              game.keys.add(key);
            }
          }
        } else if (MOVE_KEYS.has(key)) {
          event.preventDefault();
          game.closeContent();
          game.keys.add(key);
          game.cancelPath();
          game.unlockAudio();
        }
      },
      true,
    );
    document.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      game.keys.delete(key);
    });
  }
  /** The one place a screen point becomes a destination. The stick's zone borrows
   * it so a press there that never steers walks like a press anywhere else —
   * otherwise the corner it occupies would be the only part of the map that
   * answers nothing. */
  tapAt(clientX, clientY) {
    const game = this.game;
    if (
      !game.ready ||
      game.transitioning ||
      game.dialogue ||
      game.hasOverlay()
    )
      return false;
    game.closeContent();
    this.canvas.focus({ preventScroll: true });
    game.unlockAudio();
    const rect = this.canvas.getBoundingClientRect();
    game.tap({
      x:
        ((clientX - rect.left) / rect.width) * game.renderer.width +
        game.camera.x,
      y:
        ((clientY - rect.top) / rect.height) * game.renderer.height +
        game.camera.y,
    });
    return true;
  }
}
module.exports = { WorldInput };
