"use strict";
/** Native-pixel transforms shared by game and studio. Rotate only flat ground artwork. */
const FLAT = new Set(["toilet-leaf", "poop", "pee-puddle", "shells"]);
function capabilities(entity) {
  const fixed =
    entity.portal ||
    entity.threshold ||
    entity.product ||
    entity.neighbor ||
    entity.sprite === "doorway" ||
    /^(person-|ferry|picnic-|barbecue|fire|coals)/.test(entity.sprite || "");
  return {
    scales: fixed ? [1] : [0.75, 1, 1.25, 1.5],
    rotations: !fixed && FLAT.has(entity.sprite) ? [0, 90, 180, 270] : [0],
    mirror: !fixed,
  };
}
function transformPoint(entity, x, y) {
  const scale = entity.scale ?? 1,
    angle = ((entity.rotation || 0) * Math.PI) / 180;
  x *= scale * (entity.flip ? -1 : 1);
  y *= scale;
  const clean = (v) =>
    Math.abs(v) < 1e-10
      ? 0
      : Math.abs(1 - Math.abs(v)) < 1e-10
        ? Math.sign(v)
        : v;
  const cos = clean(Math.cos(angle)),
    sin = clean(Math.sin(angle));
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}
function transformedRect(entity, rect) {
  const points = [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h],
  ].map(([x, y]) => transformPoint(entity, x, y));
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  return {
    x,
    y,
    w: Math.max(...points.map((p) => p.x)) - x,
    h: Math.max(...points.map((p) => p.y)) - y,
  };
}
function artworkBounds(entity, frame) {
  const rect = transformedRect(entity, {
    x: -frame.anchor[0],
    y: -frame.anchor[1],
    w: frame.w,
    h: frame.h,
  });
  return {
    ...rect,
    x: rect.x + entity.x + (entity.offset?.[0] || 0),
    y: rect.y + entity.y + (entity.offset?.[1] || 0),
  };
}
function drawArtwork(ctx, sprites, entity, name) {
  const f = sprites.frame(name);
  if (!f) return;
  ctx.save();
  ctx.translate(
    Math.round(entity.x + (entity.offset?.[0] || 0)),
    Math.round(entity.y + (entity.offset?.[1] || 0)),
  );
  ctx.rotate(((entity.rotation || 0) * Math.PI) / 180);
  ctx.scale((entity.scale ?? 1) * (entity.flip ? -1 : 1), entity.scale ?? 1);
  sprites.draw(ctx, name, -f.anchor[0], -f.anchor[1]);
  ctx.restore();
}
module.exports = {
  capabilities,
  transformPoint,
  transformedRect,
  artworkBounds,
  drawArtwork,
};
