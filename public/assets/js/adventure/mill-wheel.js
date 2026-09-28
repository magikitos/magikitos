"use strict";
/** The raster wheel turns in its own vertical plane; its foot stays submerged. */
function drawMillWheel(ctx, sprites, part, time) {
  const f = sprites.frame(part.sprite);
  if (!f) return;
  ctx.save();
  ctx.translate(...part.offset);
  // Axle depth follows the same down-right projection as the building's timber bearing.
  for (let layer = 0; layer <= 6; layer++) {
    ctx.save();
    ctx.translate(-12 + layer * 2, -4 + layer * 2 / 3);
    ctx.transform(.68, -.24, 0, .86, 0, 0);
    // Clip in the wheel's vertical plane, before rotating its spokes. The waterline
    // follows the riverbank's projection instead of cutting horizontally across it.
    ctx.beginPath();
    ctx.rect(-60, -60, 120, 104);
    ctx.clip();
    ctx.rotate(time * Math.PI / 24);
    sprites.draw(ctx, part.sprite, -f.anchor[0], -f.anchor[1]);
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(...part.offset);
  ctx.translate(0, 44 * .86);
  ctx.transform(.68, -.24, .8, .28, 0, 0);
  ctx.strokeStyle = "rgba(220,238,201,.48)";
  ctx.lineWidth = .8;
  for (let i = 0; i < 3; i++) {
    const phase = (time * .22 + i / 3) % 1;
    ctx.globalAlpha *= 1 - phase * .3;
    ctx.beginPath();
    ctx.ellipse(0, 4 + phase * 9, 26 + phase * 14, 5 + phase * 3, 0, .1, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}
module.exports = { drawMillWheel };
