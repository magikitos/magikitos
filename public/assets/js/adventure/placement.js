"use strict";
const {resolveAppearance}=require("./elements");
const { TILE, random } = require("./geometry");
/** Deterministic vegetation only; authored scene placements always have priority. */
function populate(world) {
  const data = world.data;
  if (Array.isArray(data.scenery)) {
    for (const placement of data.scenery) {
      const prop = {
        ...resolveAppearance(placement, data.id),
        x: placement.x * TILE,
        y: placement.y * TILE,
      };
      // Scenery is presentation/terrain. Movable puzzle props live in the authored entity layer.
      delete prop.pushable;
      world.props.push(prop);
      if (prop.solid) {
        const r = require("./geometry").collisionBounds(prop);
        for (let y = Math.floor(r.y / TILE); y < (r.y + r.h) / TILE; y++)
          for (let x = Math.floor(r.x / TILE); x < (r.x + r.w) / TILE; x++)
            world.setBlocked(x, y);
      }
    }
    return;
  }
  const rand = random(data.seed);
  if (!data.indoor)
    for (let y = 4; y < world.height - 3; y += 3.8)
      for (let x = 4; x < world.width - 3; x += 3.8) {
        const tx = Math.floor(x + (rand() - 0.35) * 2.9) + 0.5,
          ty = Math.floor(y + (rand() - 0.35) * 2.9) + 0.5;
        if (
          world.pathDistance(tx, ty) < 2.7 ||
          !(data.decoration?.treeRegions || ["forest"]).includes(
            world.region(tx, ty),
          ) ||
          data.clearings.some(([cx, cy, r]) => Math.hypot(tx - cx, ty - cy) < r)
        )
          continue;
        if (
          world.entities.some(
            (e) => Math.hypot(tx - e.x / TILE, ty - e.y / TILE) < 4,
          ) ||
          world.waterAt(tx, ty) ||
          world.waterAt(tx + 2, ty + 2)
        )
          continue;
        // Broad groves and gaps break up the planting grid; art remains at native scale.
        const density =
          0.68 + Math.sin(tx * 0.19) * 0.13 + Math.cos(ty * 0.23) * 0.1;
        if (rand() > density) continue;
        const trees = data.decoration?.trees || ["oak", "hornbeam"];
        const nearby = world.props
          .filter((p) => Math.hypot(p.x / TILE - tx, p.y / TILE - ty) < 4.2)
          .map((p) => p.sprite);
        const varied = trees.filter((name) => !nearby.includes(name));
        const choices = varied.length ? varied : trees;
        world.props.push({
          id: `tree-${x}-${y}`,
          solid: [-0.5, -0.5, 1, 1],
          sprite: choices[Math.floor(rand() * choices.length)],
          x: tx * TILE,
          y: ty * TILE,
        });
        world.setBlocked(Math.floor(tx), Math.floor(ty));
      }
  if (!data.indoor)
    for (
      let i = 0;
      i <
      (data.decoration?.count ?? Math.round((world.width * world.height) / 36));
      i++
    ) {
      const tx = 3 + rand() * (world.width - 6),
        ty = 3 + rand() * (world.height - 6);
      if (
        world.pathDistance(tx, ty) < 2 ||
        world.waterAt(tx, ty) ||
        !world.walkable(Math.floor(tx), Math.floor(ty))
      )
        continue;
      if (
        world.entities.some(
          (e) => Math.hypot(e.x / TILE - tx, e.y / TILE - ty) < 2.3,
        )
      )
        continue;
      const region = world.region(tx, ty);
      if (data.decoration?.[region]?.length === 0) continue;
      const sprites = data.decoration?.[region] || ["bush", "rocks"];
      world.props.push({
        id: `decor-${i}`,
        sprite: sprites[Math.floor(rand() * sprites.length)],
        x: tx * TILE,
        y: ty * TILE,
      });
    }
  world.props = world.props.map((p) => {
    const prop = resolveAppearance(p, data.id);
    delete prop.pushable;
    return prop;
  });
}
module.exports = { populate };
