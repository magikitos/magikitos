"use strict";

// Every walking heading is authored, including left diagonals. No flat-image rotation.
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
function pushFrame(actor) {
  if (!actor.pushing) return null;
  const pose = actor.pushing.moved ? [1, 2, 3, 2][Math.floor((actor.walkDistance || 0) / 4) % 4] : 0;
  return `person-0-${actor.pushing.direction}-push-${pose}`;
}
function runFrame(actor, running) {
  if (!running) return null;
  return `person-0-${actor.direction || "down"}-run-${Math.floor((actor.walkDistance || 0) / 9) % 4}`;
}
module.exports = { DIRECTIONS, facing, recordStep, characterFrame, pushFrame, runFrame };
