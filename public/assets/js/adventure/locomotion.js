"use strict";
const { move } = require("./movement");
const { facing } = require("./characters");
const WALK_SPEED = 72;
const ROLL_DISTANCE = 86;
const ROLL_DURATION = 0.48;

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
    return `person-0-${roll.direction}-roll-${pose}`;
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
module.exports = { RollMotion, DoublePress, WALK_SPEED, ROLL_DISTANCE };
