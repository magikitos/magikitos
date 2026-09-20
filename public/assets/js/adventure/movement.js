"use strict";
const { skirtEdge } = require("./obstacles");
const { recordStep } = require("./characters");
/** Shared kinematic movement for player and residents; every step checks live colliders. */
function move(
  world,
  actor,
  dx,
  dy,
  onContact = () => {},
  {
    slide = true,
    onStep = () => true,
    resolveCollision = () => false,
    edgeSlide = () => false,
    gait = "walk",
  } = {},
) {
  const before = { x: actor.x, y: actor.y },
    steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
  actor.pushing = null;
  for (let i = 0; i < steps; i++) {
    const nx = actor.x + dx / steps,
      ny = actor.y + dy / steps;
    const hit = world.collisionAt(nx, ny, actor);
    if (hit) {
      const resolved = resolveCollision(hit, dx / steps, dy / steps);
      if (
        resolved &&
        Number.isFinite(resolved.x) &&
        Number.isFinite(resolved.y) &&
        world.canStand(actor.x + resolved.x, actor.y + resolved.y, actor)
      ) {
        actor.x += resolved.x;
        actor.y += resolved.y;
        if (onStep(resolved) === false) break;
        continue;
      }
      onContact(hit);
      if (slide && edgeSlide(hit))
        skirtEdge(world, actor, hit, dx / steps, dy / steps);
      onStep({ x: dx / steps, y: dy / steps });
      break;
    }
    if (world.canStand(nx, ny, actor)) {
      actor.x = nx;
      actor.y = ny;
    } else if (slide) {
      if (world.canStand(nx, actor.y, actor)) actor.x = nx;
      if (world.canStand(actor.x, ny, actor)) actor.y = ny;
    } else break;
    if (onStep({ x: dx / steps, y: dy / steps }) === false) break;
  }
  return recordStep(actor, actor.x - before.x, actor.y - before.y, gait);
}
function follow(
  world,
  actor,
  path,
  dt,
  speed,
  onContact = () => {},
  onStep,
  options = {},
) {
  let budget = Math.max(0, speed * dt),
    moved = false,
    interrupted = false;
  // Spend the whole distance budget across waypoints, also on fast/low-FPS devices.
  while (path.length && budget > 0.001 && !interrupted) {
    const point = path[0],
      dx = point.x - actor.x,
      dy = point.y - actor.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) {
      if (world.canStand(point.x, point.y, actor)) Object.assign(actor, point);
      path.shift();
      continue;
    }
    const step = Math.min(distance, budget);
    const moving = move(
      world,
      actor,
      (dx / distance) * step,
      (dy / distance) * step,
      (entity) => {
        interrupted = true;
        onContact(entity);
      },
      {
        ...options,
        onStep: (motion) => {
          if (onStep?.(motion) === false) interrupted = true;
          return !interrupted;
        },
      },
    );
    budget -= step;
    moved ||= moving;
    if (!moving) {
      if (actor.pushing?.waiting) break; // Shared push awaits authority; keep its final leg.
      path.splice(0);
      break;
    }
    if (Math.hypot(point.x - actor.x, point.y - actor.y) < 0.001) {
      if (!interrupted && world.canStand(point.x, point.y, actor))
        Object.assign(actor, point);
      path.shift();
    }
  }
  return moved;
}
module.exports = { move, follow };
