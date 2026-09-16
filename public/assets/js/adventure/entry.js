"use strict";
const { Fullscreen } = require("./fullscreen");
const { SAVE_KEY } = require("./save");
const FULLSCREEN_PREFERENCE = "magikitos.fullscreen";
function hasSavedJourney(storage) {
  try {
    storage ||= localStorage;
    const value = JSON.parse(storage.getItem(SAVE_KEY));
    return Boolean(value?.scene && value?.position);
  } catch (_) {
    return false;
  }
}
class Entry {
  constructor(game) {
    this.game = game;
    this.entered = false;
    this.dialog = document.getElementById("world-entry");
    this.start = document.getElementById("entry-start");
    this.sound = document.getElementById("entry-sound");
    this.fullscreen = new Fullscreen(game);
    this.fullscreenChoice = document.getElementById("entry-fullscreen");
    document.getElementById("entry-fullscreen-option").hidden =
      !this.fullscreen.supported || this.fullscreen.native;
    try {
      this.fullscreenChoice.checked =
        localStorage.getItem(FULLSCREEN_PREFERENCE) === "1";
    } catch (_) {}
    this.start.textContent = game.text(
      hasSavedJourney() ? "continueExploring" : "entryExplore",
    );
    this.sound.checked = !game.state.muted;
    this.dialog.addEventListener("cancel", (event) => event.preventDefault());
    this.dialog.showModal();
    this.start.addEventListener("click", () =>
      this.failed ? location.reload() : this.enter(),
    );
  }
  ready() {
    this.sound.checked = !this.game.state.muted;
    this.start.disabled = false;
    document.getElementById("entry-status").hidden = true;
  }
  fail() {
    this.failed = true;
    const status = document.getElementById("entry-status");
    status.textContent = this.game.s.loadError;
    status.hidden = false;
    this.start.textContent = this.game.text("retry");
    this.start.disabled = false;
  }
  enter() {
    if (!this.game.ready || this.entered) return;
    const game = this.game;
    this.entered = true;
    game.state.muted = !this.sound.checked;
    // Start audio before requesting fullscreen, without an intervening await.
    if (!game.state.muted) game.unlockAudio();
    this.dialog.close();
    this.fullscreen.paint();
    if (this.fullscreenChoice.checked || this.fullscreen.native)
      this.fullscreen.enter();
    try {
      localStorage.setItem(
        FULLSCREEN_PREFERENCE,
        this.fullscreenChoice.checked ? "1" : "0",
      );
    } catch (_) {}
    game.dirty = true;
    game.save();
    document.getElementById("world-canvas").focus({ preventScroll: true });
    game.updateUI();
  }
}
module.exports = { Entry, hasSavedJourney };
