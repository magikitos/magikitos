"use strict";
/** Pure browser-side catalogue layout. PHP supplies public products, never game placements. */
function furnishWorkshop(catalog, products = []) {
  const world = structuredClone(catalog),
    room = world.scenes.workshop;
  if (!room || !products.length) return world;
  const height = Math.max(27, 12 + Math.ceil(products.length / 4) * 6),
    delta = height - room.height;
  room.height = height;
  room.spawn = { x: 16.5, y: height - 5.5 };
  room.entities = room.entities.filter(
    (e) => !e.product && !["shop-shelf", "work-table"].includes(e.id),
  );
  for (const entity of room.entities) {
    if (entity.id === "shop") entity.y = 4.5;
    if (entity.id !== "exit") continue;
    entity.y += delta;
    entity.threshold = [
      entity.threshold[0],
      entity.threshold[1] + delta,
      ...entity.threshold.slice(2),
    ];
    entity.arrival = [entity.arrival[0], entity.arrival[1] + delta];
  }
  for (const scene of Object.values(world.scenes))
    for (const entity of scene.entities)
      for (const rule of entity.rules)
        for (const effect of rule.effects)
          if (effect.type === "travel" && effect.scene === "workshop")
            Object.assign(effect, room.spawn);
  for (const [i, product] of products.entries())
    room.entities.push({
      id: "product-" + product.id,
      sprite: "workbench",
      x: 6.5 + (i % 4) * 6,
      y: 8.5 + Math.floor(i / 4) * 6,
      product,
      solid: [-1.4, -1, 2.8, 1.2],
      rules: [],
    });
  return world;
}
module.exports = { furnishWorkshop };
