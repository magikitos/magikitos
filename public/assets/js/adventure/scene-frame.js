"use strict";
const { TILE, clamp } = require("./geometry");
const indoor = (world) => Boolean((world?.data || world)?.indoor);
/** Physical room bounds never change. Cutaway presentation can show its painted exterior. */
function cameraLimits(world, view) {
  const axis = (size, visible) => {
    if (!indoor(world)) return [0, Math.max(0, Math.floor(size - visible))];
    if (visible >= size + 32) {
      const centered = (size - visible) / 2;
      return [centered, centered];
    }
    return [-16, size - visible + 16];
  };
  return {
    x: axis(world.width * TILE, view.width),
    y: axis(world.height * TILE, view.height),
  };
}
function frameCamera(camera, world, view) {
  const limits = cameraLimits(world, view);
  return { x: clamp(camera.x, ...limits.x), y: clamp(camera.y, ...limits.y) };
}
/** Shared by raster rendering and cache pinning, including negative cutaway chunks. */
function chunkRange(world, view) {
  const open = indoor(world);
  return {
    left: open
      ? Math.floor(view.x / 256)
      : Math.max(0, Math.floor(view.x / 256)),
    top: open
      ? Math.floor(view.y / 256)
      : Math.max(0, Math.floor(view.y / 256)),
    right: open
      ? Math.floor((view.x + view.width) / 256)
      : Math.min(
          Math.ceil((world.width * TILE) / 256) - 1,
          Math.floor((view.x + view.width) / 256),
        ),
    bottom: open
      ? Math.floor((view.y + view.height) / 256)
      : Math.min(
          Math.ceil((world.height * TILE) / 256) - 1,
          Math.floor((view.y + view.height) / 256),
        ),
  };
}
module.exports = { indoor, cameraLimits, frameCamera, chunkRange };
