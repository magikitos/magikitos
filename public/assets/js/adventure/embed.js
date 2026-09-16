"use strict";
/** The bridge to the page that is showing the world.
 *
 * ⛔ THE WAY OUT EXISTS BECAUSE THERE IS A PAGE TO GO BACK TO, and that is a FACT
 * rather than a flag: the logo only appears once a SAME-ORIGIN parent window has
 * spoken to us. A native build has no parent window, so the button cannot appear
 * there however the artifact was compiled, and a stranger who frames the game
 * gets nothing because their messages come from another origin. The requirement
 * — never in the app — holds by the shape of the thing instead of by remembering
 * to thread `embedded: false` through five layers.
 *
 * Everything crosses in one shape, `{ magikitos: <verb> }`, and nothing is read
 * unless it arrives from our own origin and from the window that opened us. */
const CHANNEL = "magikitos";

class Embed {
  constructor(game) {
    this.game = game;
    this.parent = window.parent !== window ? window.parent : null;
    this.host = null;
    this.wanted = false;
    this.button = document.getElementById("world-leave");
    this.button?.addEventListener("click", () => this.leave());
    if (!this.parent) return;
    addEventListener("message", (event) => this.receive(event));
    // The page may still be wiring its own listener, so we knock and it answers.
    this.send("hola");
  }
  /** True only once a same-origin parent has answered: the one condition under
   * which there is somewhere to go back to. */
  get embedded() {
    return Boolean(this.host);
  }
  send(verb, extra = {}) {
    if (!this.parent) return;
    try {
      this.parent.postMessage({ [CHANNEL]: verb, ...extra }, location.origin);
    } catch (_) {
      /* A page that will not listen is a page we simply do not talk to. */
    }
  }
  receive(event) {
    if (event.source !== this.parent || event.origin !== location.origin) return;
    const verb = event.data && event.data[CHANNEL];
    if (typeof verb !== "string") return;
    if (!this.host) {
      this.host = event.source;
      if (this.button) this.button.hidden = false;
    }
    if (verb === "hola") this.send("listo", { ready: this.game.ready });
    else if (verb === "abrir") this.open();
    else if (verb === "cerrar" || verb === "silencia") this.hush();
  }
  /** ⛔ ENTERING FROM THE WEBSITE IS ONE GESTURE WITH ONE MEANING: the forest, out
   * loud. There is no sound question because the question WAS the click, and the
   * entry card never shows — the page already asked. */
  open() {
    const game = this.game;
    if (!game.ready) {
      this.wanted = true;
      return;
    }
    this.wanted = false;
    game.entry.enter({ sound: true, fullscreen: false });
    if (game.state.muted) game.setMuted(false);
    else game.unlockAudio();
    game.recenterCamera(true);
    this.send("abierto");
  }
  /** Out of sight is out of earshot — and it is NOT a preference. Writing
   * `state.muted` here would leave the sound toggle lying on the next visit about
   * a choice the player never made. */
  hush() {
    this.game.pauseMovement();
    this.game.audio.stop();
    this.game.updateUI();
    this.game.save();
  }
  leave() {
    this.hush();
    this.send("cerrar");
  }
  /** The world finished loading: honour an open that arrived before it could. */
  ready() {
    this.send("listo", { ready: true });
    if (this.wanted) this.open();
  }
}
module.exports = { Embed };
