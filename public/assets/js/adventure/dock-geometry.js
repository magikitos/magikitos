"use strict";
const { TILE, FOOTPRINT } = require("./geometry");
const { bridgeWalkable } = require("./bridge-geometry");
// Local coordinates: x points out along the planks, y across them. One definition
// serves every orientation, without rotating the artwork or copying scene numbers.
const DOCK_ENTRANCE_LIMITS = Object.freeze({ offset: 2, width: [0.125, 2], height: [0.5, 3] });
function validDockEntrance(area) {
  const l = DOCK_ENTRANCE_LIMITS;
  return Array.isArray(area) && area.length === 4 && area.every(Number.isFinite) &&
    Math.abs(area[0]) <= l.offset && Math.abs(area[1]) <= l.offset &&
    area[2] >= l.width[0] && area[2] <= l.width[1] &&
    area[3] >= l.height[0] && area[3] <= l.height[1];
}
function dockPoint(dock, along, across) {
  return { x: dock.dry.x + dock.outward.x * along - dock.outward.y * across,
    y: dock.dry.y + dock.outward.y * along + dock.outward.x * across };
}
function localBounds(dock, rectangle, inset = true) {
  const [bx, by, bw, bh] = rectangle.map(v => v * TILE),
    mx = inset ? FOOTPRINT.halfWidth + FOOTPRINT.shoreMargin : 0,
    my = inset ? FOOTPRINT.halfHeight + FOOTPRINT.shoreMargin : 0;
  if (bw <= mx * 2 || bh <= my * 2) return null;
  const corners = [[bx + mx, by + my], [bx + bw - mx, by + my],
    [bx + mx, by + bh - my], [bx + bw - mx, by + bh - my]].map(([px, py]) => {
      const dx = px - dock.dry.x, dy = py - dock.dry.y;
      return [dx * dock.outward.x + dy * dock.outward.y,
        dy * dock.outward.x - dx * dock.outward.y];
    });
  return [Math.min(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1])),
    Math.max(...corners.map(p => p[0])), Math.max(...corners.map(p => p[1]))];
}
function boardingPoint(dock) {
  const [x, y, w, h] = dock.boarding;
  const bounds = localBounds(dock, dock.walkableRect || dock.bridge);
  if (!bounds) return null;
  const minX = Math.max(x, bounds[0]), maxX = Math.min(x + w, bounds[2]),
    minY = Math.max(y, bounds[1]), maxY = Math.min(y + h, bounds[3]);
  if (maxX <= minX || maxY <= minY) return null;
  const middle = (lo, hi) => lo <= 0 && hi > 0 ? 0 : (lo + hi) / 2;
  return dockPoint(dock, middle(minX, maxX), middle(minY, maxY));
}
function arrivalPoint(dock) {
  const bounds = localBounds(dock, dock.walkableRect || dock.bridge);
  if (!bounds) return null;
  const safe = (min, max) => Math.max(min + 0.001, Math.min(max - 0.001, 0));
  return dockPoint(dock, safe(bounds[0], bounds[2]), safe(bounds[1], bounds[3]));
}
function walkableBox(dock) {
  const [x, y, right, bottom] = localBounds(dock, dock.walkableRect || dock.bridge, false);
  return [x, y, right - x, bottom - y].map(v => v / TILE);
}
function walkableDefinition(dock, [x, y, w, h]) {
  const points = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]
    .map(([a, b]) => dockPoint(dock, a * TILE, b * TILE));
  const [bx, by, bw, bh] = dock.bridge;
  const left = Math.min(...points.map(p => p.x)) / TILE, top = Math.min(...points.map(p => p.y)) / TILE;
  return [(left - bx) / bw, (top - by) / bh,
    (Math.max(...points.map(p => p.x)) / TILE - left) / bw,
    (Math.max(...points.map(p => p.y)) / TILE - top) / bh].map(v => Math.round(v * 1e10) / 1e10);
}
function withWalkable(dock, definition) {
  return { ...dock, walkableRect: bridgeWalkable({ rect: dock.bridge, walkable: definition }) };
}
module.exports = { DOCK_ENTRANCE_LIMITS, validDockEntrance, dockPoint, boardingPoint,
  arrivalPoint, walkableBox, walkableDefinition, withWalkable };
