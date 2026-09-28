"use strict";
/** The raster wheel turns in its own vertical plane; its foot stays submerged. */
function drawMillWheel(ctx, sprites, part, time) {
  const f = sprites.frame(part.sprite);
  if (!f) return;
  ctx.save();
  ctx.translate(...part.offset);
  ctx.beginPath();
  ctx.rect(-70, -80, 140, 117);
  ctx.clip();
  // Axle depth follows the same down-right projection as the building's timber bearing.
  for (let layer = 0; layer <= 6; layer++) {
    ctx.save();
    ctx.translate(-12 + layer * 2, -4 + layer * 2 / 3);
    ctx.transform(.68, -.24, 0, .86, 0, 0);
    ctx.rotate(time * Math.PI / 24);
    sprites.draw(ctx, part.sprite, -f.anchor[0], -f.anchor[1]);
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(...part.offset);
  ctx.strokeStyle = "rgba(220,238,201,.48)";
  ctx.lineWidth = .8;
  for (let i = 0; i < 3; i++) {
    const phase = (time * .22 + i / 3) % 1;
    ctx.globalAlpha *= 1 - phase * .3;
    ctx.beginPath();
    ctx.ellipse(3, 39 + phase * 7, 20 + phase * 12, 2 + phase * 2, 0, .1, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}
module.exports = { drawMillWheel };
