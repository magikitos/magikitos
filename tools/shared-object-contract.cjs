"use strict";
const { World } = require("../public/assets/js/adventure/model");
const { TILE, FOOTPRINT, collisionBounds } = require("../public/assets/js/adventure/geometry");
const { collisionBodies } = require("../public/assets/js/adventure/collision-grid");
const { placementProbes, entranceBounds } = require("../public/assets/js/adventure/movable-geometry");
const { WALK_SPEED } = require("../public/assets/js/adventure/locomotion");
const { PUSH_SPEED_RATIO } = require("../public/assets/js/adventure/movables");
const { resolveAppearance } = require("../public/assets/js/adventure/elements");
const rect = r => [r.x, r.y, r.w, r.h];

/** Native-pixel dry-ground mask, compiled from the actual walking physics, not a second map.
 * Run-length rows keep this compact without sacrificing thin shores/bridges to tile sampling.
 * This is server-only metadata. No browser downloads it; no dependencies are added to Node. */
function compileGround(model) {
  const width = model.width * TILE, height = model.height * TILE, rows = [];
  for (let y = 0; y < height; y++) {
    const row = []; let start = -1;
    for (let x = 0; x <= width; x++) {
      const dry = x < width && model.terrainCanStand(x, y);
      if (dry && start < 0) start = x;
      if (!dry && start >= 0) { row.push(start, x); start = -1; }
    }
    rows.push(row);
  }
  return { encoding: "pixel-runs", width, height, rows };
}

function sharedObjectContract(scene, zone) {
  // Family-authored props inherit their footprint/pushability exactly as in World/Studio.
  // Do not require map files to duplicate the family's physical template.
  const shared = scene.entities.filter(e => e.shared === true).map(e => resolveAppearance(e, scene.id));
  if (!zone || scene.indoor) {
    if (shared.length) throw Error(`Shared props require an outdoor community zone: ${scene.id}`);
    return null;
  }
  // All community zones need the same locked construction snapshot and revision channel,
  // including a clearing before anyone authors a pushable prop there.
  for (const e of shared) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(e.id) || !e.pushable || !e.solid ||
        e.portal || e.actor || e.neighbor || e.resource || e.solids || e.fence ||
        e.hiddenWhen || e.visibleWhen || e.solidWhen || e.rules?.length)
      throw Error(`Shared prop must be unconditional, solid and movable: ${scene.id}/${e.id}`);
  }
  if (new Set(shared.map(e => e.id)).size !== shared.length) throw Error("Duplicate shared prop");
  const model = new World(scene);
  const props = Object.fromEntries(model.entities.filter(e => e.shared === true).map(e => {
    const bounds = collisionBounds({ ...e, x: 0, y: 0 });
    return [e.id, { x: e.x, y: e.y, bounds: rect(bounds), probes: placementProbes(bounds) }];
  }));
  // Reserve every authored quest footprint, even one hidden by a PERSONAL flag. Otherwise one
  // player's crate could cover another player's lighter or NPC. Never share puzzle progress.
  const bodies = [...model.architecture, ...model.props, ...model.entities]
    .filter(e => !e.shared).flatMap(collisionBodies).filter(e => e.solid)
    .map(e => rect(collisionBounds(e)));
  return { ground: compileGround(model), props, bodies,
    protected: [...entranceBounds(scene).map(rect), ...(zone.protected || []).map(r => r.map(n => n * TILE))],
    footprint: [-FOOTPRINT.halfWidth, -FOOTPRINT.halfHeight, FOOTPRINT.halfWidth * 2, FOOTPRINT.halfHeight * 2],
    pushSpeed: WALK_SPEED * PUSH_SPEED_RATIO };
}
module.exports = { sharedObjectContract, compileGround };
