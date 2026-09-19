"use strict";
const { TILE, clamp } = require("./geometry");
const indoor = (world) => Boolean((world?.data || world)?.indoor);
/** Physical room bounds never change. Cutaway presentation can show its painted exterior. */
function cameraLimits(world, view) {
  const axis = (size, visible, start = 0) => {
    if (!indoor(world)) return [start, Math.max(start, Math.floor(start + size - visible))];
    if (visible >= size + 32) {
      const centered = (size - visible) / 2;
      return [centered, centered];
    }
    return [-16, size - visible + 16];
  };
  // ⛔ FUERA, LA CÁMARA RECORRE EL PLANO ENTERO (mundo continuo): el marco es la caja de todas
  // las pantallas exteriores enlazadas, en casillas locales de esta (`world.frame`, lo pone
  // `scenes.link`). Así se puede mirar la pantalla de al lado antes de pisarla, y arrastrar el
  // mapa hasta el otro extremo del bosque. Sin plano, el límite es la pantalla, como siempre.
  const frame = !indoor(world) && world.frame;
  if (frame)
    return {
      x: axis(frame.w * TILE, view.width, frame.x * TILE),
      y: axis(frame.h * TILE, view.height, frame.y * TILE),
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
