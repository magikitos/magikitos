"use strict";
const {
  TILE,
  waterAt,
  inRect,
  collisionBounds,
  clamp,
  riverOffset,
} = require("./geometry");
const { facing } = require("./characters");

// The hull, not Ascua's walking footprint. Oars skim the water and are not a solid body.
const HULL_RADIUS = 26;
const ROW_SPEED = 82;
const FAST_ROW_SPEED = 205;
const probes = [[0, 0]];
for (let y = -HULL_RADIUS; y <= HULL_RADIUS; y += 4)
  for (let x = -HULL_RADIUS; x <= HULL_RADIUS; x += 4)
    if (x * x + y * y <= HULL_RADIUS * HULL_RADIUS) probes.push([x, y]);
for (let i = 0; i < 32; i++)
  probes.push([
    Math.cos((i * Math.PI) / 16) * HULL_RADIUS,
    Math.sin((i * Math.PI) / 16) * HULL_RADIUS,
  ]);

function canFloat(world, x, y) {
  const data = world.data || world;
  if (
    ![x, y].every(Number.isFinite) ||
    x < HULL_RADIUS ||
    y < HULL_RADIUS ||
    x > data.width * TILE - HULL_RADIUS ||
    y > data.height * TILE - HULL_RADIUS
  )
    return false;
  if (
    !probes.every(([dx, dy]) => waterAt(data, (x + dx) / TILE, (y + dy) / TILE))
  )
    return false;
  return !(world.colliders || []).some((e) => {
    const b = collisionBounds(e);
    const px = clamp(x, b.x, b.x + b.w),
      py = clamp(y, b.y, b.y + b.h);
    return Math.hypot(x - px, y - py) < HULL_RADIUS;
  });
}

/** Currents are authored vector fields. Soft edges avoid invisible discontinuities. */
function currentAt(data, x, y) {
  const result = { x: 0, y: 0 };
  for (const current of data.navigation?.currents || []) {
    const [cx, cy, rx, ry] = current.area;
    const bend =
      current.channel && data.rivers?.[0]
        ? riverOffset(data.rivers[0], y / TILE)
        : 0;
    const d = Math.hypot((x / TILE - cx - bend) / rx, (y / TILE - cy) / ry);
    const strength = clamp((1 - d) * 4, 0, 1);
    result.x += current.vector[0] * strength;
    result.y += current.vector[1] * strength;
  }
  return result;
}

/** Pure, sub-stepped boat physics. Blocked movement slides; never teleports through a bank. */
class VesselMotion {
  constructor() {
    this.stop();
  }
  stop() {
    this.vx = this.vy = this.stroke = 0;
    this.rowing = false;
  }
  step(world, player, intent, dt, fast = false) {
    dt = clamp(dt, 0, 0.05);
    const length = intent ? Math.hypot(intent.x, intent.y) : 0;
    this.rowing = length > 0;
    const flow = currentAt(world.data, player.x, player.y);
    const speed = fast ? FAST_ROW_SPEED : ROW_SPEED;
    const tx = (length ? (intent.x / length) * speed : 0) + flow.x;
    const ty = (length ? (intent.y / length) * speed : 0) + flow.y;
    const blend = 1 - Math.exp(-dt * (length ? 8 : 4));
    this.vx += (tx - this.vx) * blend;
    this.vy += (ty - this.vy) * blend;
    if (length) player.direction = facing(intent.x, intent.y, player.direction);
    const dx = this.vx * dt,
      dy = this.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
    let moved = false;
    for (let i = 0; i < steps; i++) {
      if (canFloat(world, player.x + dx / steps, player.y + dy / steps)) {
        player.x += dx / steps;
        player.y += dy / steps;
        moved ||= Math.abs(dx) + Math.abs(dy) > 0.01;
      } else {
        if (canFloat(world, player.x + dx / steps, player.y)) {
          player.x += dx / steps;
          moved ||= Math.abs(dx) > 0.01;
        } else this.vx = 0;
        if (canFloat(world, player.x, player.y + dy / steps)) {
          player.y += dy / steps;
          moved ||= Math.abs(dy) > 0.01;
        } else this.vy = 0;
      }
    }
    if (this.rowing) this.stroke += dt * (fast ? 1.4 : 1);
    else this.stroke = 0;
    return moved;
  }
  frame(direction, reduced = false) {
    const row =
      this.rowing && !reduced
        ? [1, 2, 3, 2][Math.floor(this.stroke * 5) % 4]
        : 0;
    return `boat-ascua-${direction || "down"}-${row}`;
  }
}

function riverExit(data, player) {
  return (data.navigation?.exits || []).find((e) =>
    inRect(player.x / TILE, player.y / TILE, e.area),
  );
}

module.exports = {
  HULL_RADIUS,
  ROW_SPEED,
  FAST_ROW_SPEED,
  canFloat,
  currentAt,
  VesselMotion,
  riverExit,
};
