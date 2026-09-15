"use strict";
const { TILE, clamp } = require("./geometry");
const { indoor, frameCamera } = require("./scene-frame");
/** One camera scale for ground, actors, props, picking and motion. No browser-page zoom. */
function cameraMetrics(view, world, requested = null, presentation = 1) {
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
  // Start with breathing room, not at the closest allowed zoom. The short side
  // keeps portrait/landscape equally readable; quarter steps avoid arbitrary
  // pixel magnifications. Large monitors reveal more world, not enormous actors.
  const initialScale = clamp(Math.round(Math.min(view.width, view.height) / 150) / 4, 1.25, 2);
  const initialRatio = room ? 1 : Math.min(1, initialScale / maximum);
  const minimum = room ? 0.7 : Math.max(Math.min(0.45, initialRatio * 0.75), cover / maximum);
  const ratio = clamp(Number.isFinite(requested) ? requested : initialRatio, minimum, 1);
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
module.exports = { cameraMetrics, clampCamera };
