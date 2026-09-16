"use strict";
const { TILE, inRect } = require("./geometry");
const cache = new WeakMap();

/** Transport thresholds derive from the actual jetty, not a proximity bubble.
 * land/water remain the authored safe anchors. The dry threshold is at the end
 * of the planks, so boarding never pulls somebody walking past the bank. */
function docks(data) {
  if (cache.has(data)) return cache.get(data);
  const result = (data.navigation?.landings || []).map((landing) => {
    const [lx, ly] = landing.land,
      [wx, wy] = landing.water;
    const length = Math.hypot(wx - lx, wy - ly);
    const outward = { x: (wx - lx) / length, y: (wy - ly) / length };
    const bridge = data.bridges?.find(
      (b) => b.sprite === "jetty" && inRect(lx, ly, b.rect),
    );
    if (!length || !bridge)
      throw Error(
        "Landing requires a containing jetty: " + data.id + "/" + landing.id,
      );
    const [x, y, w, h] = bridge.rect;
    const horizontal = Math.abs(outward.x) > Math.abs(outward.y);
    const tip = horizontal
      ? { x: outward.x > 0 ? x + w : x, y: ly }
      : { x: lx, y: outward.y > 0 ? y + h : y };
    return {
      ...landing,
      outward,
      bridge: bridge.rect,
      dry: {
        x: tip.x * TILE - outward.x * 10,
        y: tip.y * TILE - outward.y * 10,
      },
      wet: { x: wx * TILE, y: wy * TILE },
      width: ((horizontal ? h : w) * TILE) / 2 - 4,
    };
  });
  cache.set(data, result);
  return result;
}
function dockAt(data, point) {
  return docks(data).find(
    (d) =>
      inRect(point.x / TILE, point.y / TILE, d.bridge) ||
      Math.hypot(point.x - d.wet.x, point.y - d.wet.y) < 30,
  );
}
function atDock(dock, point, mode) {
  const target = mode === "boat" ? dock.wet : dock.dry;
  const dx = point.x - target.x,
    dy = point.y - target.y;
  const along = dx * dock.outward.x + dy * dock.outward.y;
  const across = Math.abs(dx * dock.outward.y - dy * dock.outward.x);
  return (
    across <= dock.width &&
    (mode === "boat" ? along >= -24 && along <= 12 : along >= -5 && along <= 14)
  );
}
function enteringDock(dock, point, intent, mode) {
  if (!intent || !atDock(dock, point, mode)) return false;
  const length = Math.hypot(intent.x, intent.y);
  const toward =
    (intent.x * dock.outward.x + intent.y * dock.outward.y) *
    (mode === "boat" ? -1 : 1);
  return length > 0.00001 && toward / length > 0.65;
}
/** Approach along the boards, then cross the tip head-on, including pointer travel. */
function dockPath(world, actor, dock) {
  const approach = {
    x: dock.dry.x - dock.outward.x * 20,
    y: dock.dry.y - dock.outward.y * 20,
  };
  const path =
    world.path(actor, approach) || world.approach(actor, approach, 1);
  if (
    !path?.length ||
    !world.clearSegment(path.at(-1), approach, actor) ||
    !world.clearSegment(approach, dock.dry, actor)
  )
    return null;
  return [...path, approach, { ...dock.dry }];
}
module.exports = { docks, dockAt, atDock, enteringDock, dockPath };
