"use strict";
const WALK_SPEED = 72;
const RUN_SPEED = 138;

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
  speed(actor, path) {
    if (path.length && routeDistance(actor, path) <= 48) this.running = false;
    return this.running ? RUN_SPEED : WALK_SPEED;
  }
}
module.exports = { TravelPace, routeDistance, WALK_SPEED, RUN_SPEED };
