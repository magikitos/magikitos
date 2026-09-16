"use strict";

/** Conservative first paint: touch-only, not a laptop merely able to touch. */
function initiallyTouch(coarse, anyFine, maxTouchPoints) {
  return coarse && !anyFine && maxTouchPoints > 0;
}

/** Input evidence overrides capability guesses. Never sniff UA or persist a
 * device choice: mice/keyboards may be attached between visits. Compatibility
 * MouseEvents are deliberately not observed; PointerEvents identify the source. */
class InputModality {
  constructor(onChange, host = window) {
    this.host = host;
    this.onChange = onChange;
    this.touches = new Set();
    this.observed = false;
    this.coarse = host.matchMedia("(pointer: coarse)");
    this.fine = host.matchMedia("(any-pointer: fine)");
    this.touch = this.estimate();
    onChange(this.touch);
    const refresh = () => {
      if (!this.observed) this.set(this.estimate());
    };
    this.coarse.addEventListener("change", refresh);
    this.fine.addEventListener("change", refresh);
    host.addEventListener(
      "pointerdown",
      (event) => {
        if (!this.real(event)) return;
        if (event.pointerType === "touch") {
          this.touches.add(event.pointerId);
          this.choose(true);
        } else if (["mouse", "pen"].includes(event.pointerType))
          this.choose(false);
      },
      { capture: true, passive: true },
    );
    host.addEventListener(
      "pointermove",
      (event) => {
        if (
          this.real(event) &&
          event.pointerType === "mouse" &&
          !this.touches.size &&
          (event.movementX || event.movementY)
        )
          this.choose(false);
      },
      { capture: true, passive: true },
    );
    for (const name of ["pointerup", "pointercancel"])
      host.addEventListener(
        name,
        (event) => {
          if (event.isTrusted) this.touches.delete(event.pointerId);
        },
        { capture: true, passive: true },
      );
    host.addEventListener(
      "keydown",
      (event) => {
        // An on-screen keyboard/composition in a form is not evidence of a mouse
        // workflow. Game keys and real keyboard navigation are authoritative.
        if (
          !event.isTrusted ||
          event.isComposing ||
          [
            "Process",
            "Unidentified",
            "Shift",
            "Control",
            "Alt",
            "Meta",
          ].includes(event.key) ||
          event.target?.closest?.(
            'input,textarea,select,[contenteditable="true"]',
          )
        )
          return;
        this.choose(false);
      },
      { capture: true },
    );
    host.addEventListener("blur", () => this.touches.clear());
    host.document.addEventListener("visibilitychange", () => {
      if (host.document.hidden) this.touches.clear();
    });
  }
  estimate() {
    return initiallyTouch(
      this.coarse.matches,
      this.fine.matches,
      this.host.navigator.maxTouchPoints,
    );
  }
  real(event) {
    return (
      event.isTrusted &&
      !(
        event.pointerType === "mouse" &&
        event.sourceCapabilities?.firesTouchEvents
      )
    );
  }
  choose(touch) {
    this.observed = true;
    this.set(touch);
  }
  set(touch) {
    if (touch === this.touch) return;
    this.touch = touch;
    this.onChange(touch);
  }
}
module.exports = { InputModality, initiallyTouch };
