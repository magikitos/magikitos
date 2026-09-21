"use strict";
/** Resolve appearance and harvest together once: the same concrete effects ship to client and API. */
function resolveHarvestYields(world, { resolveAppearance, variantOf }) {
  for (const scene of Object.values(world.scenes)) {
    scene.entities = scene.entities.map(entity => {
      if (!entity.harvest) return entity;
      const variant = variantOf(entity, scene.id);
      if (!variant?.yield) return entity;
      const resolved = resolveAppearance(entity, scene.id);
      const amounts = variant.yield;
      for (const [item, amount] of Object.entries(amounts))
        if (!world.items[item] || !Number.isInteger(amount) || amount < 1 || amount > (world.items[item].max || 99))
          throw Error("Invalid variant harvest: " + entity.id + "/" + item);
      return {
        ...resolved,
        hiddenWhen: { items: Object.fromEntries(Object.entries(amounts).map(([item, amount]) =>
          [item, (world.items[item].max || 99) - amount + 1])) },
        rules: entity.rules.map(rule => ({ ...rule, effects: rule.effects.map(effect =>
          effect.type === "item" && effect.amount > 0 && amounts[effect.item]
            ? { ...effect, amount: amounts[effect.item] } : effect) })),
      };
    });
  }
  return world;
}
module.exports = { resolveHarvestYields };
