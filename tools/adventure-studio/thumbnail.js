"use strict";
const { frameName } = require("../../public/assets/js/adventure/elements");
const {
  artworkBounds,
  drawArtwork,
} = require("../../public/assets/js/adventure/entity-art");
const fences = require("../../public/assets/js/adventure/fences");
/** Inspector, object list and palette use the same actual artwork as the map. */
function thumbnail(canvas, sprites, entity, padding = 5) {
  const c = canvas.getContext("2d"),
    { width, height } = canvas;
  c.clearRect(0, 0, width, height);
  c.imageSmoothingEnabled = false;
  const e = { ...entity, x: 0, y: 0 },
    name = frameName(e),
    frame = sprites.frame(name);
  if (!frame && !e.fence) return;
  const b = artworkBounds(e, frame),
    scale = Math.min((width - padding * 2) / b.w, (height - padding * 2) / b.h);
  c.save();
  c.translate(width / 2, height / 2);
  c.scale(scale, scale);
  c.translate(-b.x - b.w / 2, -b.y - b.h / 2);
  if (e.fence) for (const part of fences.parts(e)) fences.drawPart(c, part);
  else drawArtwork(c, sprites, e, name);
  c.restore();
}
module.exports = { thumbnail };
