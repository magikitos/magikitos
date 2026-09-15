"use strict";
const { TILE } = require("./geometry");
/** Resolve saved entrance IDs against current scene data, never stale saved coordinates. */
function portalArrival(catalog, scene, portal) {
  if (
    typeof scene !== "string" ||
    typeof portal !== "string" ||
    !Object.hasOwn(catalog.scenes, scene)
  )
    return null;
  const entity = catalog.scenes[scene].entities.find(
    (e) => e.id === portal && e.portal,
  );
  const point = entity?.arrival;
  if (
    !Array.isArray(point) ||
    point.length !== 2 ||
    !point.every(Number.isFinite)
  )
    return null;
  return { x: point[0] * TILE, y: point[1] * TILE };
}
/** Doors require a deliberate vertical approach. Standing, skimming sideways or retreating never enters. */
function acceptsEntry(entity, motion) {
  if (!entity.entryDirection) return true; // Stairs have their own landing semantics.
  return Boolean(
    motion &&
    motion.y * entity.entryDirection > 0.00001 &&
    Math.abs(motion.y) >= Math.abs(motion.x),
  );
}
/** Shared interiors return to the building actually entered, including buildings on another map. */
function doorDestination(catalog, from, door, travel, entrance) {
  const fallback = {
    scene: travel.scene,
    position: { x: travel.x * TILE, y: travel.y * TILE },
  };
  const outside = catalog.scenes[entrance?.scene];
  if (
    !from.indoor ||
    !door.portal ||
    door.entryDirection !== 1 ||
    catalog.scenes[travel.scene].indoor ||
    !outside ||
    outside.indoor
  )
    return fallback;
  const position = portalArrival(catalog, entrance.scene, entrance.portal);
  return position ? { scene: entrance.scene, position } : fallback;
}
/** A tap routes to the front of a door, then crosses inward; it never teleports from the side. */
function portalPath(world, from, entity) {
  const [x, y, w, h] = entity.threshold;
  const target = { x: (x + w / 2) * TILE, y: (y + h / 2) * TILE };
  if (!entity.entryDirection) return world.path(from, target) || [];
  const lead = { x: target.x, y: target.y - entity.entryDirection * TILE * 2 };
  const path = world.path(from, lead);
  if (
    !path ||
    !world.clearSegment(path.at(-1) || from, lead, from) ||
    !world.clearSegment(lead, target, from)
  )
    return [];
  return [...path, lead, target];
}
module.exports = { portalArrival, acceptsEntry, portalPath, doorDestination };
