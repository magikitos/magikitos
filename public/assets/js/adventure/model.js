"use strict";
const geometry = require("./geometry");
const {
  TILE,
  clamp,
  distance,
  segmentDistance,
  collisionBounds,
  actorBounds,
  overlaps,
  FOOTPRINT,
  dryFootprint,
  waterAt,
} = geometry;
const { matches, active } = require("./rules");
const { CollisionGrid, collisionBodies } = require("./collision-grid");
const { resolveAppearance } = require("./elements");
const { restorePositions } = require("./movables");
const room = require("./room-shape");
const { populate } = require("./placement");
const { findPath } = require("./navigation");
class World {
  constructor(data) {
    this.data = data;
    this.width = data.width;
    this.height = data.height;
    this.entities = data.entities
      .map((e) => resolveAppearance(e, data.id))
      .map((e) => ({
        ...e,
        x: e.x * TILE,
        y: e.y * TILE,
        ...(e.pushable
          ? { homePosition: { x: e.x * TILE, y: e.y * TILE } }
          : {}),
      }));
    this.architecture = (data.walls || []).map((wall, i) => ({
      id: "wall-" + i,
      x: wall.rect[0] * TILE,
      y: wall.rect[1] * TILE,
      solid: [0, 0, wall.rect[2], wall.rect[3]],
      rules: [],
      wall,
      depth: (wall.rect[1] + wall.rect[3]) * TILE,
    }));
    this.props = [];
    this.blocked = new Uint8Array(this.width * this.height);
    this.segments = [];
    for (const path of data.paths)
      for (let i = 1; i < path.length; i++)
        this.segments.push([path[i - 1], path[i]]);
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        this.blocked[y * this.width + x] = Number(
          x < 2 || y < 2 || x >= this.width - 2 || y >= this.height - 2,
        );
      }
    const boundaries = this.blocked.slice();
    populate(this);
    // Vegetation occupancy guides procedural placement, but is not terrain.
    // Its exact physical bodies enter the shared collision index below.
    this.blocked = boundaries;
    this.terrain = boundaries.slice();
    // Static navigation is built once. Picking up a leaf only refreshes entity occupancy.
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++)
        if (!this.terrainCanStand((x + 0.5) * TILE, (y + 0.5) * TILE))
          this.setBlocked(x, y);
    this.navigationTerrain = this.blocked.slice();
    this.refresh({ flags: {}, inventory: {} });
  }
  region(x, y) {
    return (
      this.data.regions.find(
        (r) =>
          x >= r.rect[0] &&
          y >= r.rect[1] &&
          x < r.rect[0] + r.rect[2] &&
          y < r.rect[1] + r.rect[3],
      )?.id || (this.data.indoor ? this.data.id : "forest")
    );
  }
  waterAt(x, y) {
    return waterAt(this.data, x, y);
  }
  pathDistance(x, y) {
    let best = Infinity;
    for (const [a, b] of this.segments)
      best = Math.min(best, segmentDistance(x, y, a, b));
    return best;
  }
  setBlocked(x, y) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height)
      this.blocked[y * this.width + x] = 1;
  }
  walkable(x, y) {
    return (
      x >= 0 &&
      y >= 0 &&
      x < this.width &&
      y < this.height &&
      !this.blocked[y * this.width + x]
    );
  }
  canStand(x, y, ignore = null) {
    return this.terrainCanStand(x, y) && !this.collisionAt(x, y, ignore);
  }
  terrainCanStand(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const { halfWidth: hw, halfHeight: hh } = FOOTPRINT;
    return (
      [
        [-hw, -hh],
        [hw, -hh],
        [-hw, hh],
        [hw, hh],
      ].every(([dx, dy]) =>
        this.terrainWalkable(
          Math.floor((x + dx) / TILE),
          Math.floor((y + dy) / TILE),
        ),
      ) &&
      [
        [-hw, -hh],
        [hw, -hh],
        [-hw, hh],
        [hw, hh],
      ].every(([dx, dy]) => room.contains(this.data, x + dx, y + dy)) &&
      dryFootprint(this.data, x, y)
    );
  }
  refresh(state) {
    this.state = state;
    restorePositions(this, state);
    this.blocked = this.navigationTerrain.slice();
    this.occupancy = new Uint16Array(this.blocked.length);
    this.collisionGrid = new CollisionGrid();
    this.colliders = [
      ...this.architecture,
      ...this.props,
      ...this.entities,
    ].flatMap(collisionBodies).filter(
      (e) =>
        e.solid &&
        active(e, state) &&
        (!e.solidWhen || matches(state, e.solidWhen)),
    );
    for (const entity of this.colliders) {
      this.collisionGrid.add(entity);
      this.markBody(entity, 1);
    }
  }
  markBody(entity, delta) {
    const r = collisionBounds(entity);
    for (
      let y = Math.max(0, Math.floor(r.y / TILE));
      y < Math.min(this.height, (r.y + r.h) / TILE);
      y++
    )
      for (
        let x = Math.max(0, Math.floor(r.x / TILE));
        x < Math.min(this.width, (r.x + r.w) / TILE);
        x++
      ) {
        const i = y * this.width + x;
        this.occupancy[i] += delta;
        this.blocked[i] = Number(
          this.navigationTerrain[i] || this.occupancy[i] > 0,
        );
      }
  }
  relocate(entity, x, y) {
    if (!this.collisionGrid.bounds.has(entity)) {
      entity.x = x;
      entity.y = y;
      return;
    }
    this.markBody(entity, -1);
    this.collisionGrid.remove(entity);
    entity.x = x;
    entity.y = y;
    this.markBody(entity, 1);
    this.collisionGrid.add(entity);
  }
  terrainWalkable(x, y) {
    return (
      x >= 0 &&
      y >= 0 &&
      x < this.width &&
      y < this.height &&
      !this.terrain[y * this.width + x]
    );
  }
  collisionAt(x, y, ignore = null) {
    return (
      this.collisionGrid.at(x, y, ignore) ||
      (this.actors || []).find(
        (e) => e !== ignore && overlaps(actorBounds(x, y), collisionBounds(e)),
      ) ||
      null
    );
  }
  distanceTo(point, entity) {
    const r = collisionBounds(entity);
    return Math.hypot(
      point.x - clamp(point.x, r.x, r.x + r.w),
      point.y - clamp(point.y, r.y, r.y + r.h),
    );
  }
  path(from, target) {
    return findPath(this, from, target);
  }
  approach(from, target, radius = 3, minDistance = 0) {
    const candidates = [],
      tx = Math.floor(target.x / TILE),
      ty = Math.floor(target.y / TILE);
    for (let y = ty - radius; y <= ty + radius; y++)
      for (let x = tx - radius; x <= tx + radius; x++)
        if (this.walkable(x, y)) {
          const point = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
          if (
            this.canStand(point.x, point.y, from) &&
            (target.solid || target.neighbor
              ? this.distanceTo(point, target) >= 4 &&
                this.distanceTo(point, target) < TILE * 1.5
              : distance(point, target) >= minDistance)
          )
            candidates.push(point);
        }
    candidates.sort(
      (a, b) =>
        distance(a, target) - distance(b, target) ||
        distance(a, from) - distance(b, from),
    );
    for (const point of candidates) {
      const path = this.path(from, point);
      if (path) return path;
    }
    return null;
  }
  clearSegment(from, to, ignore = from) {
    const dx = to.x - from.x,
      dy = to.y - from.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
    for (let i = 1; i <= steps; i++)
      if (
        !this.canStand(
          from.x + (dx * i) / steps,
          from.y + (dy * i) / steps,
          ignore,
        )
      )
        return false;
    return true;
  }
}
module.exports = { World, ...geometry };
