"use strict";
const { TILE, clamp } = require("./geometry");
const { indoor, frameCamera } = require("./scene-frame");
/** One camera scale for ground, actors, props, picking and motion. No browser-page zoom. */
function cameraMetrics(view, world, requested = 1, presentation = 1) {
  const room = indoor(world);
  const normal = room
    ? view.width < 600
      ? 1.5
      : 2
    : Math.max(2, Math.round(view.width / (view.width < 600 ? 350 : 580)));
  const cover =
    world && !room
      ? Math.max(
          view.width / (world.width * TILE),
          view.height / (world.height * TILE),
        )
      : 0;
  const maximum = Math.max(normal, cover);
  const minimum = room ? 0.7 : Math.max(0.45, cover / maximum);
  const ratio = clamp(Number.isFinite(requested) ? requested : 1, minimum, 1);
  const scale = maximum * ratio * (room ? 1 : Math.max(1, presentation));
  return {
    scale,
    ratio,
    minimum,
    width: view.width / scale,
    height: view.height / scale,
  };
}
function clampCamera(camera, world, view) {
  return frameCamera(camera, world, view);
}
class WorldZoom {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.points = new Map();
    this.pinching = false;
    canvas.addEventListener(
      "wheel",
      (event) => {
        if (!this.allowed()) return;
        event.preventDefault();
        const delta =
          event.deltaY *
          (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1);
        this.set(
          game.renderer.viewZoom *
            Math.exp(-Math.max(-180, Math.min(180, delta)) * 0.002),
        );
      },
      { passive: false },
    );
  }
  allowed() {
    const g = this.game;
    return (
      g.ready &&
      !g.transitioning &&
      !g.dialogue &&
      !g.hasOverlay() &&
      document.getElementById("world-content").hidden
    );
  }
  set(ratio) {
    if (!this.allowed()) return;
    const r = this.game.renderer;
    r.viewZoom = ratio;
    r.resize();
    this.game.centerCamera(true);
  }
  down(event) {
    if (event.pointerType !== "touch") return false;
    this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.canvas.setPointerCapture(event.pointerId);
    if (this.points.size >= 2) {
      this.pinching = true;
      this.game.pauseMovement();
      this.game.input?.clearGesture();
      const [a, b] = this.points.values();
      this.distance = Math.hypot(a.x - b.x, a.y - b.y);
      this.start = this.game.renderer.viewZoom;
    }
    return true;
  }
  move(event) {
    if (!this.points.has(event.pointerId)) return;
    this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.points.size !== 2 || !this.pinching) return;
    event.preventDefault();
    const [a, b] = this.points.values();
    this.set(
      (this.start * Math.hypot(a.x - b.x, a.y - b.y)) /
        Math.max(1, this.distance),
    );
  }
  up(event, cancel = false) {
    if (!this.points.has(event.pointerId)) return false;
    const wasPinching = this.pinching;
    this.points.delete(event.pointerId);
    if (!this.points.size) this.pinching = false;
    return !cancel && !wasPinching;
  }
  clear() {
    this.points.clear();
    this.pinching = false;
  }
}
module.exports = { cameraMetrics, clampCamera, WorldZoom };
