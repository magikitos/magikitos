"use strict";

// Sprites turn in world space, never by rotating a flat image. The two left diagonals
// are baked mirrors of their right-facing counterparts, with the same foot anchor.
const DIRECTIONS = [
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
];
function facing(dx, dy, previous = "down") {
  if (Math.hypot(dx, dy) < 0.001) return previous;
  return DIRECTIONS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
}
function recordStep(actor, dx, dy) {
  const travelled = Math.hypot(dx, dy);
  if (travelled < 0.001) return false;
  actor.direction = facing(dx, dy, actor.direction);
  actor.walkDistance = (actor.walkDistance || 0) + travelled;
  return true;
}
function characterFrame(variant, actor, moving) {
  const base = `person-${variant}-${actor.direction || "down"}`;
  const pose = moving
    ? [1, 2, 3, 2][Math.floor((actor.walkDistance || 0) / 7) % 4]
    : 0;
  return pose ? `${base}-walk-${pose}` : base;
}
module.exports = { DIRECTIONS, facing, recordStep, characterFrame };
