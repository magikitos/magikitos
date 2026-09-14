"use strict";
/** The same hull is used at the jetty and in transit. Passengers are real character sprites.
 * Seat/lip coordinates are normalised to the visible hull; no baked duplicate occupants. */
function drawOccupiedBoat(c, sprites, name, passengers, lip, x, y, zoom = 1) {
  const f = sprites.frame(name);
  if (!f) return;
  c.save();
  c.translate(
    Math.round(x - f.anchor[0] * zoom),
    Math.round(y - f.anchor[1] * zoom),
  );
  c.scale(zoom, zoom);
  sprites.draw(c, name, 0, 0);
  c.save();
  c.beginPath();
  c.rect(-20, -60, f.w + 40, f.h * lip + 60);
  c.clip();
  for (const passenger of passengers) {
    const actor = sprites.frame(passenger.sprite);
    if (!actor) continue;
    sprites.draw(
      c,
      passenger.sprite,
      Math.round(f.w * passenger.seat[0] - actor.anchor[0]),
      Math.round(f.h * passenger.seat[1] - actor.anchor[1]),
    );
  }
  c.restore();
  c.restore();
}
module.exports = { drawOccupiedBoat };
