"use strict";
const {
  drawArtwork,
} = require("../../../../public/assets/js/adventure/entity-art");
const {
  drawAmbientActor,
} = require("../../../../public/assets/js/adventure/ambient-actors");
const { hash } = require("../../../../public/assets/js/adventure/geometry");
const { SELECTIVE } = require("./scene");
function enabled(entity, mode, detail = false) {
  return (
    entity.motion !== "reference" &&
    mode !== "still" &&
    (mode === "all" ||
      (detail &&
        ["actor", "fern", "foliage", "planter"].includes(entity.motion)) ||
      SELECTIVE.has(entity.id))
  );
}
/** Quiet rests and deterministic, independent phases. No random redraws or physics changes. */
function bend(entity, time) {
  const phase = (hash(entity.id) % 10000) / 1000;
  const period = 16 + phase * 0.7,
    local = (time + phase * 2) % period;
  const envelope = local < 5 ? Math.sin((local / 5) * Math.PI) ** 2 : 0;
  return (
    Math.sin(local * 0.95) * envelope * (entity.motion === "fern" ? 2.1 : 0.8)
  );
}
function drawMotion(ctx, art, profile, e, time, mode, detail = false) {
  const lib = art.library(profile),
    active = enabled(e, mode, detail);
  if (e.motion === "actor") {
    drawAmbientActor(ctx, lib, e, e.sprite, active ? time : 0);
    return active;
  }
  if (!active) {
    drawArtwork(ctx, lib, e, e.sprite);
    return false;
  }
  const a = art.manifest.assets[e.sprite],
    f = a.logical,
    v = a.variants[profile],
    image = art.images.get(v.image);
  if (!image) return false;
  const amount = bend(e, time);
  if (!amount) {
    drawArtwork(ctx, lib, e, e.sprite);
    return true;
  }
  if (e.motion === "rigid") {
    // Deliberate stress comparison: rigid objects should usually NOT breathe.
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(amount * 0.006);
    lib.draw(ctx, e.sprite, -f.anchor[0], -f.anchor[1]);
    ctx.restore();
    return true;
  }
  ctx.save();
  ctx.translate(e.x - f.anchor[0], e.y - f.anchor[1]);
  const strips = 20,
    stillFrom = e.motion === "planter" ? Math.floor(f.h * 0.57) : f.h;
  for (let i = 0; i < strips; i++) {
    const y = Math.round((i * f.h) / strips),
      next = Math.round(((i + 1) * f.h) / strips);
    if (next === y) continue;
    const influence =
      i === strips - 1 ? 0 : Math.max(0, 1 - y / stillFrom) ** 2;
    const shift = amount * influence;
    ctx.imageSmoothingEnabled = false;
    art.drawCalls++;
    ctx.drawImage(
      image,
      0,
      y * v.density,
      v.width,
      (next - y) * v.density,
      shift,
      y,
      f.w,
      next - y,
    );
  }
  ctx.restore();
  return true;
}
module.exports = { enabled, bend, drawMotion };
