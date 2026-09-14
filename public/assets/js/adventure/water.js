"use strict";
const { hash, TILE } = require("./model");
/** World-anchored ripples; only visible water cells, no terrain-cache invalidation per frame. */
function drawRipples(c, world, view, time = 0) {
  if (world.data.indoor) return;
  for (
    let row = Math.floor(view.y / 24) - 1;
    row < Math.ceil((view.y + view.height) / 24) + 1;
    row++
  )
    for (
      let col = Math.floor(view.x / 32) - 1;
      col < Math.ceil((view.x + view.width) / 32) + 1;
      col++
    ) {
      const seed = hash(world.data.seed + ":" + col + ":" + row);
      if (seed % 3 === 0) continue;
      const phase = (seed % 628) / 100;
      const x =
        col * 32 +
        (seed % 19) +
        Math.round(Math.sin(time * 0.55 + phase) * 1.5);
      const y = row * 24 + ((seed >>> 5) % 17);
      const width = 4 + (seed % 7);
      if (
        !world.waterAt(x / TILE, y / TILE) ||
        !world.waterAt((x + width) / TILE, y / TILE)
      )
        continue;
      c.fillStyle =
        "rgba(192,226,197," +
        (0.1 + Math.sin(time * 0.65 + phase) * 0.06) +
        ")";
      c.fillRect(x, y, width, 1);
      if (seed % 4 === 0) c.fillRect(x + 2, y + 2, Math.max(2, width - 4), 1);
    }
}
module.exports = { drawRipples };
