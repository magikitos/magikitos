"use strict";
/** Native-pixel transforms shared by game and studio. Rotate only flat ground artwork. */
const FLAT = new Set(["toilet-leaf", "poop", "pee-puddle", "shells"]);
function capabilities(entity) {
  const fixed =
    entity.fence ||
    entity.portal ||
    entity.threshold ||
    entity.product ||
    entity.neighbor ||
    entity.sprite === "doorway" ||
    /^(person-|ferry|picnic-humans|barbecue|fire|coals)/.test(
      entity.sprite || "",
    );
  return {
    scale: fixed
      ? { min: entity.scale ?? 1, max: entity.scale ?? 1 }
      : {
          min: Math.min(0.25, entity.scale ?? 1),
          max: Math.max(3, entity.scale ?? 1),
        },
    rotations: !fixed && FLAT.has(entity.sprite) ? [0, 90, 180, 270] : [0],
    mirror: !fixed,
  };
}
function validScale(entity, value) {
  const { min, max } = capabilities(entity).scale;
  return Number.isFinite(value) && value >= min && value <= max;
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
  if (entity.fence || entity.fencePart)
    return require("./fences").bounds(entity);
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
function applyArtworkTransform(ctx, entity) {
  ctx.translate(
    Math.round(entity.x + (entity.offset?.[0] || 0)),
    Math.round(entity.y + (entity.offset?.[1] || 0)),
  );
  ctx.rotate(((entity.rotation || 0) * Math.PI) / 180);
  ctx.scale((entity.scale ?? 1) * (entity.flip ? -1 : 1), entity.scale ?? 1);
}
// Optional clip is in anchor-relative native coordinates, before entity transforms.
function drawArtwork(ctx, sprites, entity, name, clip) {
  const f = sprites.frame(name);
  if (!f) return;
  ctx.save();
  applyArtworkTransform(ctx, entity);
  if (clip) {
    ctx.beginPath();
    ctx.rect(clip.x, clip.y, clip.w, clip.h);
    ctx.clip();
  }
  sprites.draw(ctx, name, -f.anchor[0], -f.anchor[1]);
  ctx.restore();
}
/** Table settings and other small assemblies inherit the complete parent transform. */
function drawAttachments(ctx, sprites, entity) {
  if (!entity.attachments?.length) return;
  ctx.save();
  applyArtworkTransform(ctx, entity);
  for (const part of entity.attachments)
    drawArtwork(
      ctx,
      sprites,
      { x: part.offset[0], y: part.offset[1], scale: part.scale },
      part.sprite,
    );
  ctx.restore();
}
module.exports = {
  capabilities,
  validScale,
  transformedRect,
  artworkBounds,
  drawArtwork,
  drawAttachments,
};
