"use strict";
const WALK_SPEED = 72;
const LARGE_WALK_SPEED = 84;
const RUN_SPEED = 216;

/** CSS size of the visible game, never display resolution, DPR or map zoom.
 * The short edge keeps a phone at its base pace in either orientation. */
function walkingSpeed(view = {}) {
  if (!(view.width > 0 && view.height > 0)) return WALK_SPEED;
  const t = Math.max(0, Math.min(1, (Math.min(view.width, view.height) - 480) / 480));
  return WALK_SPEED + (LARGE_WALK_SPEED - WALK_SPEED) * t * t * (3 - 2 * t);
}

/** World-pixel distances: independent of screen, zoom and input device. */
function routeDistance(actor, path) {
  let previous = actor, distance = 0;
  for (const point of path) {
    distance += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return distance;
}

/** Long taps run, the final approach walks. No implicit movement abilities. */
class TravelPace {
  constructor() { this.clear(); }
  clear() { this.running = false; }
  begin(actor, path) { this.running = routeDistance(actor, path) >= 80; }
  speed(actor, path, walking = WALK_SPEED) {
    if (path.length && routeDistance(actor, path) <= 48) this.running = false;
    return this.running ? RUN_SPEED : walking;
  }
}
module.exports = { TravelPace, routeDistance, walkingSpeed, WALK_SPEED, LARGE_WALK_SPEED, RUN_SPEED };
