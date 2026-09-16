"use strict";
/** Canvas-scoped experiment input. No global game shortcuts, saves or device-specific branches. */
class Controls {
  constructor(canvas, actions) {
    this.canvas = canvas;
    this.actions = actions;
    this.keys = new Set();
    this.pointers = new Map();
    this.abort = new AbortController();
    const on = (target, event, fn, options = {}) =>
      target.addEventListener(event, fn, {
        ...options,
        signal: this.abort.signal,
      });
    on(canvas, "contextmenu", (e) => e.preventDefault());
    on(canvas, "keydown", (e) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "w",
          "a",
          "s",
          "d",
        ].includes(e.key)
      ) {
        e.preventDefault();
        e.stopPropagation();
        this.keys.add(e.key);
        actions.cancelPath();
      } else if (e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) actions.roll();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        actions.cancelPath();
      }
    });
    on(canvas, "keyup", (e) => {
      this.keys.delete(e.key);
      e.stopPropagation();
    });
    on(canvas, "blur", () => this.clear());
    on(window, "blur", () => this.clear());
    on(
      canvas,
      "wheel",
      (e) => {
        e.preventDefault();
        this.gesture = null;
        actions.zoom(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
      },
      { passive: false },
    );
    on(canvas, "pointerdown", (e) => {
      if (e.button > 1) return;
      e.preventDefault();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.gesture = null;
        this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
        return;
      }
      this.gesture = {
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
      };
    });
    on(canvas, "pointermove", (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()],
          distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch > 0)
          actions.zoom(distance / this.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinch = distance;
        return;
      }
      const g = this.gesture;
      if (!g) return;
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 6) g.moved = true;
      if (g.moved) actions.pan(e.clientX - g.lastX, e.clientY - g.lastY);
      g.lastX = e.clientX;
      g.lastY = e.clientY;
    });
    const end = (e, cancel = false) => {
      if (!this.pointers.has(e.pointerId)) return;
      if (
        !cancel &&
        this.pointers.size === 1 &&
        this.gesture &&
        !this.gesture.moved
      )
        actions.tap(e.clientX, e.clientY);
      this.pointers.delete(e.pointerId);
      this.gesture = null;
      if (!this.pointers.size) this.pinch = null;
    };
    on(canvas, "pointerup", (e) => end(e));
    on(canvas, "pointercancel", (e) => end(e, true));
  }
  direction() {
    return {
      x:
        Number(this.keys.has("ArrowRight") || this.keys.has("d")) -
        Number(this.keys.has("ArrowLeft") || this.keys.has("a")),
      y:
        Number(this.keys.has("ArrowDown") || this.keys.has("s")) -
        Number(this.keys.has("ArrowUp") || this.keys.has("w")),
    };
  }
  clear() {
    this.keys.clear();
    this.pointers.clear();
    this.gesture = null;
    this.pinch = null;
  }
  destroy() {
    this.clear();
    this.abort.abort();
  }
}
module.exports = { Controls };
