"use strict";
const { clampCamera } = require("./camera");
const DRAG_SLOP = 8; // CSS pixels, equally comfortable for mouse, pen and touch.
const point = (event) => ({ x: event.clientX, y: event.clientY });

/** A gesture is either a tap, a drag or a pinch. Only a completed tap orders travel. */
class MapGestures {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.points = new Map();
    this.suppressed = false;
    canvas.addEventListener("wheel", (event) => {
      if (!this.allowed()) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1);
      this.zoom(game.renderer.viewZoom * Math.exp(-Math.max(-180, Math.min(180, delta)) * 0.002), point(event));
    }, { passive: false });
  }
  allowed() {
    const g = this.game;
    return g.ready && !g.transitioning && !g.dialogue && !g.hasOverlay() &&
      document.getElementById("world-content").hidden;
  }
  zoom(ratio, anchor) {
    if (!this.allowed()) return;
    const g = this.game, r = g.renderer, rect = this.canvas.getBoundingClientRect();
    const u = (anchor.x - rect.left) / rect.width, v = (anchor.y - rect.top) / rect.height;
    const focus = { x: g.camera.x + u * r.width, y: g.camera.y + v * r.height };
    r.requestedZoom = ratio;
    r.resize();
    if (!g.cameraFollowing)
      g.camera = clampCamera({ x: focus.x - u * r.width, y: focus.y - v * r.height }, g.world, r);
    g.centerCamera(true);
  }
  down(event) {
    if (!this.allowed() || event.button !== 0 || this.points.size >= 2) return;
    event.preventDefault();
    const p = point(event);
    this.points.set(event.pointerId, { ...p, origin: p });
    this.canvas.setPointerCapture(event.pointerId);
    if (this.points.size === 2) {
      this.suppressed = true;
      this.game.pauseMovement({ keepPointerGesture: true });
      const [a, b] = this.points.values();
      this.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), ratio: this.game.renderer.viewZoom };
    }
  }
  move(event) {
    const previous = this.points.get(event.pointerId);
    if (!previous) return;
    if (!this.allowed()) { this.clear(); return; }
    const p = point(event);
    this.points.set(event.pointerId, { ...p, origin: previous.origin });
    if (this.points.size === 2) {
      event.preventDefault();
      const [a, b] = this.points.values();
      this.zoom(this.pinch.ratio * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, this.pinch.distance),
        { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      return;
    }
    if (!this.dragging && Math.hypot(p.x - previous.origin.x, p.y - previous.origin.y) < DRAG_SLOP) return;
    event.preventDefault();
    if (!this.dragging) {
      this.game.pauseMovement({ keepPointerGesture: true });
      this.game.cameraFollowing = false;
      this.suppressed = this.dragging = true;
      this.canvas.classList.add("is-panning");
    }
    const r = this.game.renderer, rect = this.canvas.getBoundingClientRect();
    this.game.camera = clampCamera({
      x: this.game.camera.x - (p.x - previous.x) * r.width / rect.width,
      y: this.game.camera.y - (p.y - previous.y) * r.height / rect.height,
    }, this.game.world, r);
    this.game.centerCamera();
  }
  up(event, cancel = false) {
    if (!this.points.has(event.pointerId)) return false;
    if (!cancel) this.move(event);
    const tap = !cancel && !this.suppressed && this.allowed();
    this.points.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    // Lifting the first finger of a pinch must never turn the second one into a tap.
    for (const p of this.points.values()) p.origin = { x: p.x, y: p.y };
    if (!this.points.size) this.clear();
    return tap;
  }
  clear() {
    const ids = [...this.points.keys()];
    this.points.clear();
    this.dragging = this.suppressed = false;
    this.pinch = null;
    this.canvas.classList.remove("is-panning");
    for (const id of ids) if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
  }
}
module.exports = { MapGestures, DRAG_SLOP };
