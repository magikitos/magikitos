"use strict";
const { docks } = require("../../public/assets/js/adventure/docks");
const { TILE } = require("../../public/assets/js/adventure/geometry");
const { walkableBox } = require("../../public/assets/js/adventure/dock-geometry");
/** Selectable editor handles over real terrain jetties. Never extra rendered objects. */
function dockElements(scene) {
  return docks(scene).map(d => ({ layer: "docks", e: {
    id: "dock-access-" + d.id, sprite: "jetty", family: "dock-jetty", artVariant: "planks",
    dockAccess: true, dockGeometry: d, x: d.dry.x, y: d.dry.y,
    rotation: Math.atan2(d.outward.y, d.outward.x) * 180 / Math.PI,
    entrance: d.boarding.map(v => v / TILE),
    walkable: walkableBox(d),
    hitRect: { x: d.bridge[0] * TILE, y: d.bridge[1] * TILE, w: d.bridge[2] * TILE, h: d.bridge[3] * TILE },
  } }));
}
module.exports = { dockElements };
