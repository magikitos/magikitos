"use strict";
const { drawArtwork } = require("./entity-art");
const cache = new Map();

/** Seat furniture is independent art, not baked into a particular duende's body. */
function drawSeat(ctx, sprites, entity) {
  if (!entity.seat) return;
  const seat = entity.seat;
  drawArtwork(ctx, sprites, {
    ...entity,
    scale: (entity.scale ?? 1) * (seat.scale ?? 1),
    offset: [
      (entity.offset?.[0] || 0) + (seat.offset?.[0] || 0) * (entity.scale ?? 1),
      (entity.offset?.[1] || 0) + (seat.offset?.[1] || 0) * (entity.scale ?? 1),
    ],
  }, seat.sprite);
}

/** Any authored person-N-DIRECTION-sit sheet uses the same restrained mood cycle. */
function seatedClip(name) {
  if (!name.includes("-sit-")) return null;
  if (cache.has(name)) return cache.get(name);
  const match = /^(person-\d+-(?:down|up|right|left)(?:-right|-left)?-sit-)(0|2)$/.exec(name);
  if (!match) return null;
  const happy = match[2] === "2";
  const steps = [[name, happy ? 8 : 7], [match[1] + (happy ? 3 : 1), happy ? 0.14 : 1.2], [name, happy ? 6 : 5]];
  const clip = { phase: happy ? 4.3 : 2.1, fixedBelow: -13, steps, duration: steps.reduce((sum, [, t]) => sum + t, 0) };
  cache.set(name, clip);
  return clip;
}
module.exports = { drawSeat, seatedClip };
