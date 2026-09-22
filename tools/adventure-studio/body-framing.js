"use strict";
const { TILE } = require("../../public/assets/js/adventure/geometry");
const { artworkBounds, transformedRect } = require("../../public/assets/js/adventure/entity-art");
/** Include the whole compound body, not just its anchor or selected part. */
function bodyBounds(entity, frame, body) {
  const boxes = [...(body.solids || []), body.entrance, body.walkable].filter(Boolean);
  const rectangles = boxes.map(([x, y, w, h]) => {
    const r = transformedRect(entity, { x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE });
    return { ...r, x: entity.x + r.x, y: entity.y + r.y };
  });
  if (entity.hitRect) rectangles.push(entity.hitRect);
  else if (frame) rectangles.push(artworkBounds(entity, frame));
  if (!body.entrance && entity.threshold) {
    const [x, y, w, h] = entity.threshold.map(v => v * TILE);
    rectangles.push({ x, y, w, h });
  }
  if (!rectangles.length) return { x: entity.x - 24, y: entity.y - 24, w: 48, h: 48 };
  const x = Math.min(...rectangles.map(r => r.x)), y = Math.min(...rectangles.map(r => r.y));
  return { x, y, w: Math.max(...rectangles.map(r => r.x + r.w)) - x,
    h: Math.max(...rectangles.map(r => r.y + r.h)) - y };
}
function bodyView(bounds, viewport, padding = { x: 32, y: 80 }) {
  const zoom = Math.max(0.2, Math.min(3,
    Math.max(48, viewport.width - padding.x * 2) / Math.max(96, bounds.w),
    Math.max(48, viewport.height - padding.y * 2) / Math.max(96, bounds.h)));
  return { zoom, camera: { x: bounds.x + bounds.w / 2 - viewport.width / zoom / 2,
    y: bounds.y + bounds.h / 2 - viewport.height / zoom / 2 } };
}
module.exports = { bodyBounds, bodyView };
