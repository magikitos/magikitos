// Archived experiment only. Production intentionally has no roll ability.
"use strict";
const { move } = require("../../../../public/assets/js/adventure/movement");
const { facing } = require("../../../../public/assets/js/adventure/characters");
const WALK_SPEED = 72;
const RUN_SPEED = 138;
const ROLL_DISTANCE = 112;
const ROLL_DURATION = 0.34;

/** Distances are in world pixels, independent of screen size and zoom. */
function routeDistance(actor, path) {
  let previous = actor, distance = 0;
  for (const point of path) {
    distance += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return distance;
}

/** A roll cannot steer: only use the straight prefix, never cut a route's corner. */
function rollRunway(actor, path) {
  let previous = actor, heading = null, distance = 0;
  for (const point of path) {
    const dx = point.x - previous.x, dy = point.y - previous.y;
    const length = Math.hypot(dx, dy);
    previous = point;
    if (length < 0.01) continue;
    const direction = { x: dx / length, y: dy / length };
    if (heading && direction.x * heading.x + direction.y * heading.y < 0.995) break;
    heading = direction;
    distance += length;
  }
  return distance;
}

class TravelPace {
  clear() { this.running = false; this.rollPending = false; }
  constructor() { this.clear(); }
  begin(actor, path, allowRoll = true) {
    const distance = routeDistance(actor, path);
    this.running = distance >= 80;
    this.rollPending = allowRoll && distance >= 240;
  }
  speed(actor, path) {
    if (path.length && routeDistance(actor, path) <= 48) this.running = false;
    return this.running ? RUN_SPEED : WALK_SPEED;
  }
  rollDistance(actor, path) {
    if (!this.rollPending || !path.length) return 0;
    if (routeDistance(actor, path) < 180) { this.rollPending = false; return 0; }
    const runway = rollRunway(actor, path);
    return runway >= ROLL_DISTANCE ? ROLL_DISTANCE : 0;
  }
}

/** One impulse, fixed heading, no key-repeat, and the same live collisions as walking. */
class RollMotion {
  constructor() {
    this.stop();
  }
  stop() {
    this.current = null;
  }
  start(dx, dy, distance = ROLL_DISTANCE) {
    const length = Math.hypot(dx, dy);
    if (this.current || length < 0.001 || distance < 1) return false;
    this.current = {
      x: dx / length,
      y: dy / length,
      direction: facing(dx, dy),
      elapsed: 0,
      distance: Math.min(distance, ROLL_DISTANCE),
    };
    return true;
  }
  step(world, actor, dt, onContact, onStep) {
    const roll = this.current;
    if (!roll || dt <= 0) return { moved: false, finished: false };
    const before = roll.elapsed / ROLL_DURATION;
    roll.elapsed = Math.min(ROLL_DURATION, roll.elapsed + dt);
    const after = roll.elapsed / ROLL_DURATION;
    // Integrated easing: total distance is independent of frame rate.
    const integral = (t) => 1.3 * t - 0.3 * t * t;
    const distance = roll.distance * (integral(after) - integral(before));
    let hit = false;
    const moved = move(
      world,
      actor,
      roll.x * distance,
      roll.y * distance,
      (entity) => {
        hit = true;
        onContact(entity);
      },
      { slide: false, onStep },
    );
    actor.direction = roll.direction;
    if (hit || !moved || roll.elapsed >= ROLL_DURATION) this.stop();
    return { moved, finished: !this.current };
  }
  frame() {
    const roll = this.current;
    if (!roll) return null;
    const pose = Math.min(3, Math.floor((roll.elapsed / ROLL_DURATION) * 4));
    // Land upright. The former fourth frame was another deep squat after the flip.
    return `person-0-${roll.direction}-${pose === 3 ? "recover-0" : `roll-${pose}`}`;
  }
}

/** Pointer agnostic: a mouse, pen or touch all use the same two-press gesture. */
class DoublePress {
  constructor() {
    this.previous = null;
  }
  press(x, y, time, type) {
    const last = this.previous;
    const twice = Boolean(
      last &&
      last.type === type &&
      time - last.time <= 320 &&
      Math.hypot(x - last.x, y - last.y) <= 28,
    );
    this.previous = twice ? null : { x, y, time, type };
    return twice;
  }
  clear() {
    this.previous = null;
  }
}
module.exports = {
  RollMotion, DoublePress, TravelPace, routeDistance, rollRunway,
  WALK_SPEED, RUN_SPEED, ROLL_DISTANCE, ROLL_DURATION,
};
