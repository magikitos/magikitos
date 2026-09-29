"use strict";
const { TILE, distance } = require("./geometry");
const { gaitPose, facing } = require("./characters");
const { follow } = require("./movement");

/** Story hosts keep their authored rules and identity while using the residents' walking gait. */
function hostFrame(entity) {
  const pose = entity.moving ? gaitPose(entity, "walk") : 0;
  return `${entity.sprite}-${entity.direction || "down"}${pose ? "-walk-" + pose : ""}`;
}

function strollHosts(game, dt) {
  const world = game.world;
  for (const host of world.entities) {
    if (!host.stroll) continue;
    const stroll = host.stroll;
    const motion = host.hostMotion ||= { home: { x: host.x, y: host.y }, stop: 0, pause: stroll.pause, path: [] };
    host.moving = false;
    // A selected host waits for you, and faces you when close. Talking never becomes a chase.
    if (game.journey.target === host || distance(host, game.player) < TILE * 1.8) {
      host.direction = facing(game.player.x - host.x, game.player.y - host.y, host.direction);
      motion.pause = stroll.pause;
      continue;
    }
    if (motion.pause > 0) {
      motion.pause -= dt;
      continue;
    }
    if (!motion.path.length) {
      motion.stop = (motion.stop + 1) % stroll.points.length;
      const [x, y] = stroll.points[motion.stop];
      const target = { x: motion.home.x + x * TILE, y: motion.home.y + y * TILE };
      motion.path = world.path(host, target, 120) || [];
      if (!motion.path.length) { motion.pause = stroll.pause; continue; }
    }
    const x = host.x, y = host.y;
    host.moving = follow(world, host, motion.path, dt, stroll.speed);
    const nextX = host.x, nextY = host.y;
    // Relocate the real collision body too; no stale wall at the host's starting spot.
    host.x = x; host.y = y;
    world.relocate(host, nextX, nextY);
    if (!motion.path.length) motion.pause = stroll.pause;
  }
}

module.exports = { hostFrame, strollHosts };
