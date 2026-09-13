"use strict";
const { recordStep } = require("./characters");
/** Shared kinematic movement for player and residents; every step checks live colliders. */
function move(
  world,
  actor,
  dx,
  dy,
  onContact = () => {},
  { slide = true, onStep = () => true } = {},
) {
  const before = { x: actor.x, y: actor.y },
    steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
  for (let i = 0; i < steps; i++) {
    const nx = actor.x + dx / steps,
      ny = actor.y + dy / steps;
    const hit = world.collisionAt(nx, ny, actor);
    if (hit) {
      onContact(hit);
      break;
    }
    if (world.canStand(nx, ny, actor)) {
      actor.x = nx;
      actor.y = ny;
    } else if (slide) {
      if (world.canStand(nx, actor.y, actor)) actor.x = nx;
      if (world.canStand(actor.x, ny, actor)) actor.y = ny;
    } else break;
    if (onStep() === false) break;
  }
  return recordStep(actor, actor.x - before.x, actor.y - before.y);
}
function follow(world, actor, path, dt, speed, onContact = () => {}) {
  if (!path.length) return false;
  const point = path[0],
    dx = point.x - actor.x,
    dy = point.y - actor.y,
    d = Math.hypot(dx, dy);
  if (d < 0.7) {
    path.shift();
    return false;
  }
  const step = Math.min(d, speed * dt);
  const moving = move(
    world,
    actor,
    (dx / d) * step,
    (dy / d) * step,
    onContact,
  );
  if (!moving && path.length && d > 0.7) path.splice(0);
  return moving;
}
module.exports = { move, follow };
