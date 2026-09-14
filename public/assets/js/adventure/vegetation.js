"use strict";
const { hash } = require("./geometry");
/** Visual wind only: deterministic selection, short breaths, long rests and firmly planted roots. */
function windAmount(entity, time) {
  const wind = entity.wind;
  if (!wind || !(time > 0)) return 0;
  const seed = hash(entity.id);
  if ((seed % 1000)/1000 >= wind.share) return 0;
  const phase = (seed % 10000)/1000;
  const local = (time+phase*2) % (15+phase*.8);
  if (local >= 4.5) return 0;
  return Math.sin(local*.95)*Math.sin(local/4.5*Math.PI)**2*wind.amplitude;
}
function drawVegetation(ctx, sprites, e, name, time) {
  const amount = windAmount(e,time), f = sprites.frame(name);
  if (!amount || !f) return false;
  ctx.save();
  ctx.translate(Math.round(e.x+(e.offset?.[0]||0)),Math.round(e.y+(e.offset?.[1]||0)));
  ctx.rotate(((e.rotation||0)*Math.PI)/180);
  ctx.scale((e.scale??1)*(e.flip?-1:1),e.scale??1);
  const strips=12, fixedFrom=f.h*e.wind.fixedFrom;
  for (let i=0;i<strips;i++) {
    const y=Math.round(i*f.h/strips), next=Math.round((i+1)*f.h/strips);
    if (next===y) continue;
    const influence=Math.max(0,1-y/fixedFrom)**2;
    const shift=Math.round(amount*influence*f.pixelRatio)/f.pixelRatio;
    sprites.drawRegion(ctx,name,0,y,f.w,next-y,-f.anchor[0]+shift,y-f.anchor[1],f.w,next-y);
  }
  ctx.restore();
  return true;
}
module.exports={windAmount,drawVegetation};
