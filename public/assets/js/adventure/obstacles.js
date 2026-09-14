"use strict";
const { collisionBounds, FOOTPRINT } = require("./geometry");
/** Edge assistance skirts a small prop's corner, never disables its solid body. */
function skirtEdge(world, actor, entity, dx, dy) {
  if (!entity.edgeSlide || entity.portal || entity.pushable) return false;
  const r = collisionBounds(entity),
    vertical = Math.abs(dy) >= Math.abs(dx);
  const here = vertical ? actor.x : actor.y;
  const low =
    (vertical ? r.x : r.y) -
    (vertical ? FOOTPRINT.halfWidth : FOOTPRINT.halfHeight) -
    0.1;
  const high =
    (vertical ? r.x + r.w : r.y + r.h) +
    (vertical ? FOOTPRINT.halfWidth : FOOTPRINT.halfHeight) +
    0.1;
  const target = Math.abs(here - low) < Math.abs(here - high) ? low : high;
  const gap = target - here;
  if (Math.abs(gap) > 7) return false;
  const step = Math.sign(gap) * Math.min(Math.abs(gap), Math.hypot(dx, dy));
  const x = actor.x + (vertical ? step : 0),
    y = actor.y + (vertical ? 0 : step);
  if (!world.canStand(x, y, actor)) return false;
  actor.x = x;
  actor.y = y;
  return true;
}
function releaseContact(world, actor, latch) {
  if (!latch) return null;
  const entity = [...world.entities, ...(world.actors || [])].find(
    (e) => e.id === latch,
  );
  return !entity || world.distanceTo(actor, entity) > 22 ? null : latch;
}
module.exports = { skirtEdge, releaseContact };
