"use strict";
const { DoublePress } = require("./locomotion");
const { WorldZoom } = require("./camera");
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
    this.doublePress = new DoublePress();
    const canvas = document.getElementById("world-canvas");
    this.zoom = new WorldZoom(game, canvas);
    const press = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        !event.isPrimary ||
        !game.ready ||
        game.transitioning ||
        game.dialogue ||
        game.hasOverlay()
      )
        return;
      game.closeContent();
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      game.unlockAudio();
      const rect = canvas.getBoundingClientRect();
      const twice = this.doublePress.press(
        event.clientX,
        event.clientY,
        performance.now(),
        event.pointerType,
      );
      game.tap({
        x:
          ((event.clientX - rect.left) / rect.width) * game.renderer.width +
          game.camera.x,
        y:
          ((event.clientY - rect.top) / rect.height) * game.renderer.height +
          game.camera.y,
      });
      if (twice) game.startRoll();
    };
    canvas.addEventListener("pointerdown", (event) => {
      if (event.defaultPrevented) return;
      if (event.pointerType === "touch") {
        event.preventDefault();
        this.zoom.down(event);
        return;
      }
      press(event);
    });
    canvas.addEventListener("pointermove", (event) => this.zoom.move(event));
    canvas.addEventListener("pointerup", (event) => {
      if (this.zoom.up(event)) press(event);
    });
    canvas.addEventListener("pointercancel", (event) =>
      this.zoom.up(event, true),
    );
    window.addEventListener("blur", () => this.zoom.clear());
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
          if (event.target === canvas || game.movementIntent())
            event.preventDefault();
          if (!event.repeat) game.startRoll();
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
  clearGesture() {
    this.doublePress.clear();
  }
}
module.exports = { WorldInput };
