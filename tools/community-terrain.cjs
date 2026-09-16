"use strict";
const { World, TILE } = require("../public/assets/js/adventure/model");
/** Build-time only: same authored terrain/colliders as gameplay. The server gets
 * compact rows, not a second hand-maintained definition of where water/trees are. */
function compileCommunityTerrain(world) {
  for (const zone of Object.values(world.construction.zones)) {
    const model = new World(world.scenes[zone.scene]);
    zone.terrain = Array.from({ length: model.height }, (_, y) =>
      Array.from({ length: model.width }, (_, x) =>
        [
          [0.2, 0.2],
          [0.8, 0.2],
          [0.2, 0.8],
          [0.8, 0.8],
          [0.5, 0.5],
        ].every(([dx, dy]) => model.canStand((x + dx) * TILE, (y + dy) * TILE))
          ? "1"
          : "0",
      ).join(""),
    );
  }
  return world;
}
module.exports = { compileCommunityTerrain };
