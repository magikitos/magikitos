"use strict";
const { TILE, collisionBounds, overlaps, actorBounds } = require("./geometry");
const { facing } = require("./characters");
const PUSH_SPEED_RATIO = 0.42;
/** Movable props use the same world-space body as rendering/navigation. No rigid-body engine. */
function canPlace(
  world,
  entity,
  x,
  y,
  { ignoreActor = null, protectEntrances = true } = {},
) {
  if (
    !entity.pushable ||
    entity.portal ||
    entity.actor ||
    entity.neighbor ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < 0 ||
    x >= world.width * TILE ||
    y >= world.height * TILE
  )
    return false;
  const rect = collisionBounds({ ...entity, x, y });
  // Check the whole body, including its perimeter; a wider box cannot hang over water.
  for (let py = rect.y; py <= rect.y + rect.h; py += Math.min(4, rect.h))
    for (let px = rect.x; px <= rect.x + rect.w; px += Math.min(4, rect.w))
      if (!world.terrainCanStand(px, py)) return false;
  for (const [px, py] of [
    [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h],
  ])
    if (!world.terrainCanStand(px, py)) return false;
  if (
    world.colliders.some(
      (e) => e !== entity && overlaps(rect, collisionBounds(e)),
    )
  )
    return false;
  if (
    (world.actors || []).some(
      (e) => e !== ignoreActor && overlaps(rect, actorBounds(e.x, e.y)),
    )
  )
    return false;
  if (protectEntrances) {
    for (const e of world.entities) {
      if (!e.threshold) continue;
      const [tx, ty, w, h] = e.threshold;
      const door = {
        x: (tx - 0.7) * TILE,
        y: (ty - 1) * TILE,
        w: (w + 1.4) * TILE,
        h: (h + 2) * TILE,
      };
      if (overlaps(rect, door)) return false;
    }
    const spawn = world.data.spawn;
    if (
      spawn &&
      overlaps(rect, {
        x: (spawn.x - 0.8) * TILE,
        y: (spawn.y - 0.8) * TILE,
        w: 1.6 * TILE,
        h: 1.6 * TILE,
      })
    )
      return false;
  }
  return true;
}
function tryPush(world, actor, entity, dx, dy, state) {
  if (!entity.pushable || !entity.solid || (!dx && !dy)) return false;
  // Dominant-axis movement keeps puzzle blocks aligned; no sideways dragging or chain pushes.
  const horizontal = Math.abs(dx) > Math.abs(dy),
    step = Math.hypot(dx, dy) * PUSH_SPEED_RATIO;
  const mx = horizontal ? Math.sign(dx) * step : 0,
    my = horizontal ? 0 : Math.sign(dy) * step;
  const x = entity.x + mx,
    y = entity.y + my;
  actor.pushing = { direction: facing(mx, my), moved: false };
  if (!canPlace(world, entity, x, y, { ignoreActor: actor })) return false;
  const previous = { x: entity.x, y: entity.y };
  world.relocate(entity, x, y);
  if (!world.canStand(actor.x + mx, actor.y + my, actor)) {
    world.relocate(entity, previous.x, previous.y);
    return false;
  }
  const objects = (state.objects ||= Object.create(null));
  const scene = (objects[world.data.id] ||= Object.create(null));
  scene[entity.id] = {
    x,
    y,
  };
  actor.pushing.moved = true;
  return { x: mx, y: my };
}
function restorePositions(world, state) {
  for (const entity of world.entities) {
    if (!entity.pushable) continue;
    const saved = state.objects?.[world.data.id]?.[entity.id];
    const p =
      saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
        ? saved
        : entity.homePosition;
    if (p) {
      entity.x = p.x;
      entity.y = p.y;
    }
  }
}
/** Storage is untrusted. Unknown props, overlapping boxes, wet ground and blocked doors are discarded. */
function cleanPositions(value, catalog, state) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    return result;
  const { World } = require("./model");
  for (const [id, data] of Object.entries(catalog.scenes)) {
    const input = value[id];
    if (!input || typeof input !== "object" || Array.isArray(input)) continue;
    const world = new World(data);
    world.refresh({ ...state, objects: {} });
    const candidates = new Map();
    for (const entity of world.entities) {
      const p = input[entity.id];
      if (
        !entity.pushable ||
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.y < 0 ||
        p.x >= world.width * TILE ||
        p.y >= world.height * TILE
      )
        continue;
      candidates.set(entity, p);
      world.relocate(entity, p.x, p.y);
    }
    // Validate the final arrangement together: moving A into B's vacated place is legal.
    // Reverted invalid props may invalidate another placement; converge monotonically.
    let changed = true;
    while (changed) {
      changed = false;
      for (const [entity, p] of candidates)
        if (!canPlace(world, entity, p.x, p.y)) {
          candidates.delete(entity);
          world.relocate(entity, entity.homePosition.x, entity.homePosition.y);
          changed = true;
        }
    }
    if (candidates.size)
      result[id] = Object.fromEntries(
        [...candidates].map(([e, p]) => [e.id, { x: p.x, y: p.y }]),
      );
  }
  return result;
}
/** A tap approaches a reachable side, then uses ordinary collision-aware movement for one tile.
 * Same mechanic on touch, mouse and keyboard: no teleport, no device-specific puzzle UI. */
function pushPath(world, actor, entity) {
  if (!entity.pushable) return null;
  const r = collisionBounds(entity),
    foot = require("./geometry").FOOTPRINT;
  const sides = [
    { x: r.x - foot.halfWidth - 0.25, y: r.y + r.h / 2, dx: 1, dy: 0 },
    { x: r.x + r.w + foot.halfWidth + 0.25, y: r.y + r.h / 2, dx: -1, dy: 0 },
    { x: r.x + r.w / 2, y: r.y - foot.halfHeight - 0.25, dx: 0, dy: 1 },
    { x: r.x + r.w / 2, y: r.y + r.h + foot.halfHeight + 0.25, dx: 0, dy: -1 },
  ].sort(
    (a, b) =>
      Math.hypot(actor.x - a.x, actor.y - a.y) -
      Math.hypot(actor.x - b.x, actor.y - b.y),
  );
  for (const side of sides) {
    if (
      !world.canStand(side.x, side.y, actor) ||
      !canPlace(
        world,
        entity,
        entity.x + side.dx * TILE,
        entity.y + side.dy * TILE,
        { ignoreActor: actor },
      )
    )
      continue;
    const start = { x: side.x, y: side.y };
    const path = world.clearSegment(actor, start, actor)
      ? [start]
      : world.path(actor, start);
    if (!path) continue;
    return [
      ...path,
      start,
      {
        x: start.x + side.dx * (TILE + 0.25),
        y: start.y + side.dy * (TILE + 0.25),
      },
    ];
  }
  return null;
}
module.exports = {
  PUSH_SPEED_RATIO,
  canPlace,
  tryPush,
  restorePositions,
  cleanPositions,
  pushPath,
};
