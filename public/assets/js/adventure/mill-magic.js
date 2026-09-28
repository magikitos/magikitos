"use strict";
// One clock drives the waterwheel, meshing gears and the musical light sequence.
// The renderer supplies time=0 for reduced motion: no private timers or random flashes.
function drawMillMagic(ctx, sprites, part, time) {
  const f = sprites.frame(part.sprite);
  if (!f) return;
  ctx.save();
  ctx.translate(...part.offset);
  const angle = time * Math.PI / 24;
  for (const [x, y, scale, rotation] of [[53, -44, .84, angle], [39, -65, .51, -angle * .84 / .51 + .23]]) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale * .94); ctx.rotate(rotation);
    sprites.draw(ctx, part.sprite, -f.anchor[0], -f.anchor[1]); ctx.restore();
  }
  // A turning row of cylinder pins and gently plucked comb teeth carry the rhythm.
  ctx.fillStyle = "#fff0a9";
  for (let i = 0; i < 9; i++) {
    const phase = time * .8 - i * .63;
    ctx.globalAlpha = .18 + Math.max(0, Math.sin(phase)) * .55;
    ctx.fillRect(-7 + i * 3.2, -71 + Math.sin(phase) * 5, 1, 1.5);
    ctx.fillRect(-5 + i * 2.8, -54, .8, 3 + Math.max(0, Math.sin(phase)) * 2);
  }
  // Light travels along the actual copper pipe, from the music cylinder into the coil.
  const pipe = [[-15,-83],[-15,-92],[-19,-96],[-29,-96],[-33,-101],[-33,-111],[-37,-113],[-45,-113]];
  const lengths = pipe.slice(1).map((p,i)=>Math.hypot(p[0]-pipe[i][0],p[1]-pipe[i][1]));
  const total = lengths.reduce((a,b)=>a+b,0);
  for (let i = 0; i < 3; i++) {
    let distance = ((time * .13 + i / 3) % 1) * total;
    for (let j = 0; j < lengths.length; j++) {
      if (distance > lengths[j]) { distance -= lengths[j]; continue; }
      const t = distance / lengths[j];
      glow(ctx, pipe[j][0] + (pipe[j+1][0]-pipe[j][0])*t, pipe[j][1] + (pipe[j+1][1]-pipe[j][1])*t, 3, .65);
      break;
    }
  }
  glow(ctx, -42, -59, 28, .19 + .035 * Math.sin(time * .8));
  // A few slow fireflies rise out of the jar and fade; never a rapid strobe.
  for (let i = 0; i < 5; i++) {
    const phase = (time * .075 + i / 5) % 1;
    const x = -42 + Math.sin(phase * 5 + i * 1.7) * (5 + phase * 9), y = -75 - phase * 44;
    const alpha = Math.sin(phase * Math.PI) * .75;
    glow(ctx, x, y, 3, alpha);
    ctx.globalAlpha = alpha; ctx.fillStyle = "#eaffcf";
    ctx.fillRect(x - 1.5, y - .5, 3, 1); ctx.fillRect(x - .5, y - 1.5, 1, 3);
  }
  ctx.restore();
}
function glow(ctx, x, y, radius, alpha) {
  ctx.globalAlpha = alpha;
  const gradient = ctx.createRadialGradient(x,y,0,x,y,radius);
  gradient.addColorStop(0,"#eaffce"); gradient.addColorStop(.25,"#91e5b8"); gradient.addColorStop(1,"rgba(91,217,173,0)");
  ctx.fillStyle = gradient; ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
}
module.exports = { drawMillMagic };
