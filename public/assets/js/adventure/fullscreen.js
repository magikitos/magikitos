"use strict";
/** Fullscreen owns the complete document, never just the canvas. Enter-only UI. */
class Fullscreen {
  constructor(game) {
    this.game = game;
    this.button = document.getElementById("world-fullscreen");
    this.native = window.MagikitosPlatform?.native === true;
    this.supported =
      this.native ||
      Boolean(
        document.fullscreenEnabled &&
          document.documentElement.requestFullscreen,
      );
    this.button.addEventListener("click", () => {
      game.unlockAudio();
      this.enter();
    });
    document.addEventListener("fullscreenchange", () => this.paint());
    this.paint();
  }
  paint() {
    this.button.hidden =
      !this.supported ||
      this.native ||
      Boolean(document.fullscreenElement) ||
      !this.game.entry?.entered;
  }
  enter() {
    if (this.native)
      return Promise.resolve(window.MagikitosPlatform.immerse()).catch(
        () => false,
      );
    if (!this.supported || document.fullscreenElement)
      return Promise.resolve(false);
    return document.documentElement
      .requestFullscreen({ navigationUI: "hide" })
      .then(() => {
        this.paint();
        return true;
      })
      .catch(() => {
        this.game.toast(this.game.text("fullscreenUnavailable"));
        this.paint();
        return false;
      });
  }
}
module.exports = { Fullscreen };
