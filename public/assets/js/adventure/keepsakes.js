"use strict";
/** Bounded, decorative memories attached to authored containers. Never an economic ledger. */
function cleanKeepsakes(value, catalog) {
  const clean = {};
  for (const [scene, data] of Object.entries(catalog.scenes)) {
    for (const entity of data.entities || []) {
      const limit = entity.keepsakes?.limit;
      const count = value?.[scene]?.[entity.id];
      if (Number.isSafeInteger(limit) && limit > 0 && limit <= 32 &&
          Number.isSafeInteger(count) && count > 0)
        (clean[scene] ||= {})[entity.id] = Math.min(limit, count);
    }
  }
  return clean;
}
function remember(state, entity) {
  const limit = entity.keepsakes?.limit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 32)
    throw new Error("Invalid keepsake container");
  const scene = state.scene;
  state.keepsakes = { ...state.keepsakes, [scene]: { ...state.keepsakes?.[scene] } };
  state.keepsakes[scene][entity.id] = Math.min(limit, (state.keepsakes[scene][entity.id] || 0) + 1);
}
function keepsakePoint(entity, index) {
  const [cx, cy, rx, ry] = entity.keepsakes.area;
  const angle = index * 2.399963229728653;
  const radius = 0.38 + (index % 4) * 0.15;
  return { x: entity.x + cx + Math.cos(angle)*rx*radius,
    y: entity.y + cy + Math.sin(angle)*ry*radius };
}
function drawKeepsakes(ctx, sprites, entity, state) {
  if (!entity.keepsakes) return;
  const count = state.keepsakes?.[state.scene]?.[entity.id] || 0;
  for (let i=0; i<count; i++) {
    const p = keepsakePoint(entity, i);
    sprites.draw(ctx, entity.keepsakes.sprite, p.x-2.5, p.y-1.5, 5, 3);
  }
}
module.exports = { cleanKeepsakes, remember, keepsakePoint, drawKeepsakes };
