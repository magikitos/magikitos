"use strict";
/** CSS-pixel thumb geometry, shared by the game and the Studio physics probe. */
const STICK_DEAD = 10, STICK_RADIUS = 100, DRAG_SLOP = 8;
function steerStick(stick, point) {
  stick.finger = { x: point.x, y: point.y };
  const dx = point.x - stick.origin.x, dy = point.y - stick.origin.y, length = Math.hypot(dx, dy);
  if (length > STICK_RADIUS)
    stick.origin = { x: point.x - dx / length * STICK_RADIUS, y: point.y - dy / length * STICK_RADIUS };
}
function stickIntent(stick) {
  if (!stick) return null;
  const dx = stick.finger.x - stick.origin.x, dy = stick.finger.y - stick.origin.y, length = Math.hypot(dx, dy);
  return length < STICK_DEAD ? null : { x: dx / length, y: dy / length };
}
module.exports = { STICK_DEAD, STICK_RADIUS, DRAG_SLOP, steerStick, stickIntent };
