"use strict";
const { playerVariant } = require("./player-art");

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
// One cycle = both feet. Four readable poses, not four animation frames per
// browser tick. At 84/216 world px/s these give 7.64/12 pose changes/s.
// Keep a single phase through pace/direction changes: dividing the lifetime
// distance by a different stride on Space made the supporting leg jump.
const GAITS = Object.freeze({
  walk: Object.freeze({ stride: 44, poses: Object.freeze([1, 2, 3, 2]) }),
  run: Object.freeze({ stride: 72, poses: Object.freeze([0, 1, 2, 3]) }),
});
function advanceGait(actor, distance, pace = "walk") {
  if (!(distance > 0)) return;
  actor.gaitPhase = ((actor.gaitPhase || 0) + distance / GAITS[pace].stride) % 1;
}
function gaitPose(actor, pace) {
  // Tolerate floating-point rounding at exact quarter-cycle boundaries.
  const slot = Math.floor(((actor.gaitPhase || 0) + 1e-9) * 4) % 4;
  return GAITS[pace].poses[slot];
}
function recordStep(actor, dx, dy, pace = "walk") {
  const travelled = Math.hypot(dx, dy);
  if (travelled < 0.001) return false;
  actor.direction = facing(dx, dy, actor.direction);
  actor.walkDistance = (actor.walkDistance || 0) + travelled;
  advanceGait(actor, travelled, pace);
  return true;
}
function characterFrame(variant, actor, moving) {
  const base = `person-${variant}-${actor.direction || "down"}`;
  const pose = moving ? gaitPose(actor, "walk") : 0;
  return pose ? `${base}-walk-${pose}` : base;
}
function pushFrame(actor) {
  if (!actor.pushing) return null;
  const pose = actor.pushing.moved ? [1, 2, 3, 2][Math.floor((actor.walkDistance || 0) / 4) % 4] : 0;
  return `person-${playerVariant(actor)}-${actor.pushing.direction}-push-${pose}`;
}
function runFrame(actor, running) {
  if (!running) return null;
  return `person-${playerVariant(actor)}-${actor.direction || "down"}-run-${gaitPose(actor, "run")}`;
}
module.exports = { DIRECTIONS, GAITS, facing, advanceGait, gaitPose, recordStep, characterFrame, pushFrame, runFrame };
