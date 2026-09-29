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
/** The stationary front bearing meets the hub; its braced feet stand in the water. */
function drawMillTrestle(ctx, sprites, part, time) {
  const f = sprites.frame(part.sprite);
  if (!f) return;
  ctx.save();
  ctx.translate(...part.offset);
  // Each pile crosses the surface at its projected depth. The nearer centre
  // post reaches lower on screen than the two rear legs. No floating base rail.
  const surface = [[-40, 24], [-9, 44], [35, 28]];
  ctx.save();
  ctx.beginPath();
  surface.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  for (const [x, y] of [...surface].reverse()) ctx.lineTo(x, y + 5);
  ctx.closePath(); ctx.clip();
  ctx.globalAlpha *= .18;
  sprites.draw(ctx, part.sprite, -f.anchor[0], -f.anchor[1]);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-40, -30); ctx.lineTo(35, -30);
  for (const [x, y] of [...surface].reverse()) ctx.lineTo(x, y);
  ctx.closePath(); ctx.clip();
  sprites.draw(ctx, part.sprite, -f.anchor[0], -f.anchor[1]);
  ctx.restore();
  ctx.strokeStyle = "rgba(220,238,201,.35)";
  ctx.lineWidth = .7;
  for (const [x, y] of [[-24, 34.3], [-9, 44], [15, 35.3]]) {
    const phase = (time * .18 + (x + 30) / 60) % 1;
    ctx.globalAlpha = 1 - phase * .6;
    ctx.beginPath(); ctx.ellipse(x, y, 6 + phase * 5, 1.3 + phase, -.34, 0, Math.PI); ctx.stroke();
  }
  ctx.restore();
}
module.exports = { drawMillWheel, drawMillTrestle };
