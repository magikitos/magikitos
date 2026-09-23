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
    this.start.classList.add("is-loading");
    this.start.setAttribute("aria-busy", "true");
    this.dialog.addEventListener("cancel", (event) => event.preventDefault());
    // ⛔ EMBEDDED, THE CARD NEVER SHOWS. The page that holds the world already put
    // a door in front of the person and they walked through it; asking again,
    // inside the frame, would be the same question twice — and the second one
    // would land on a screen they cannot see yet.
    if (!game.embed?.parent) this.dialog.showModal();
    this.start.addEventListener("click", () =>
      this.failed ? location.reload() : this.enter(),
    );
  }
  /** ⛔ MIENTRAS SE PREPARA, EL BOTÓN SE LLENA; NO SE APAGA. Un botón apagado se lee como «esto no
   * funciona»; uno que se va llenando dice que falta poco. La fracción sale de los paquetes de
   * sprites que han llegado frente a los pedidos, y nunca retrocede aunque se pidan más. */
  progress(fraction) {
    const value = Math.max(this.shown || 0, Math.min(1, fraction));
    this.shown = value;
    this.start.style.setProperty("--entry-progress", (value * 100).toFixed(1) + "%");
  }
  ready() {
    this.sound.checked = !this.game.state.muted;
    this.progress(1);
    this.start.classList.remove("is-loading");
    this.start.removeAttribute("aria-busy");
    this.start.disabled = false;
    document.getElementById("entry-status").hidden = true;
  }
  fail() {
    this.failed = true;
    const status = document.getElementById("entry-status");
    status.textContent = this.game.s.loadError;
    status.hidden = false;
    this.start.textContent = this.game.text("retry");
    this.start.classList.remove("is-loading");
    this.start.removeAttribute("aria-busy");
    this.start.disabled = false;
  }
  /** `sound` and `fullscreen` are null when a person answered the card, and set
   * when the page that embeds us answered for them. Only a real answer is
   * remembered: the embedded path must not overwrite a preference nobody gave. */
  enter({ sound = null, fullscreen = null } = {}) {
    if (!this.game.ready || this.entered) return;
    const game = this.game;
    this.entered = true;
    game.state.muted = sound === null ? !this.sound.checked : !sound;
    // Start audio before requesting fullscreen, without an intervening await.
    if (!game.state.muted) game.unlockAudio();
    this.dialog.close();
    this.fullscreen.paint();
    const wantsFullscreen =
      fullscreen === null
        ? this.fullscreenChoice.checked || this.fullscreen.native
        : fullscreen;
    if (wantsFullscreen) this.fullscreen.enter();
    if (fullscreen === null)
      try {
        localStorage.setItem(
          FULLSCREEN_PREFERENCE,
          this.fullscreenChoice.checked ? "1" : "0",
        );
      } catch (_) {}
    game.dirty = true;
    game.save();
    // The clock starts when the world is on screen, not when the page loaded:
    // a first minute measured from boot would be measuring our own loading.
    game.telemetry.begin(hasSavedJourney() ? "retomada" : "nueva");
    document.getElementById("world-canvas").focus({ preventScroll: true });
    game.updateUI();
    if (game.welcome?.due()) game.welcome.show();
  }
}
module.exports = { Entry, hasSavedJourney };
