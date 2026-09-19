"use strict";
const { MapGestures } = require("./map-gestures");
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

/**
 * Context priority: native form/modal > dialogue > the map. No device detection, y desde el
 * 19-sep-2026 tampoco hay nada que detectar: tocar es ir, MANTENER es guiar al duende (ver
 * `map-gestures.js`), y eso funciona igual con un dedo, con un ratón o con un lápiz. La cámara se
 * mueve con dos dedos o con el botón derecho/central, así que el menú contextual del lienzo se
 * anula: ahí no hay nada que copiar y sí un gesto que interrumpiría.
 */
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
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
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
          if (MOVE_KEYS.has(key)) {
            if (event.repeat) return;
            // Closing a conversation uses this same press to walk, just like an
            // outside click. Do not stop propagation or require a second press.
            game.closeDialogue();
          } else if (["enter", "escape", " "].includes(key)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!event.repeat)
              key === " " ? game.nextDialogue() : game.closeDialogue();
            return;
          } else {
            return;
          }
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
  /** The one place a screen point becomes a destination. */
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
