"use strict";
/**
 * Paints outdoor ground tiles off the main thread (OffscreenCanvas) and hands back ImageBitmaps,
 * transferred, not copied. It is the same painter as the main thread (`terrain-paint.js`), fed
 * with ground data only: no DOM, no sprites, no game state. The main thread falls back to
 * painting itself whenever this worker is missing or fails.
 */
const { paintOutdoorChunk, paintVoidChunk, groundModel } = require("./terrain-paint");
let plane = null;
self.onmessage = ({ data: message }) => {
  if (message.type === "plane") {
    plane = message.plane;
    return;
  }
  const { job, key, cx, cy } = message;
  try {
    const canvas = new OffscreenCanvas(256, 256),
      c = canvas.getContext("2d", { alpha: false });
    if (message.type === "void") {
      if (!plane) throw Error("no_plane");
      paintVoidChunk(c, plane, key, cx * 256, cy * 256);
    } else paintOutdoorChunk(c, groundModel(message.data, message.origin), key, cx * 256, cy * 256);
    const bitmap = canvas.transferToImageBitmap();
    self.postMessage({ job, bitmap }, [bitmap]);
  } catch (error) {
    self.postMessage({ job, error: String(error?.message || error) });
  }
};
