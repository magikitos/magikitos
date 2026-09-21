"use strict";
const { hash } = require("./geometry");
/** One deterministic selector for the renderer, Studio and offline resource compiler. */
function appearanceFor(families) {
  const aliases = new Map(Object.entries(families).flatMap(([id, f]) =>
    f.aliases.map(name => [name, id])));
  const familyOf = entity => families[Object.hasOwn(families, entity.family)
    ? entity.family : aliases.get(entity.sprite)] || null;
  const variantOf = (entity, seed = "") => {
    const family = familyOf(entity);
    if (!family) return null;
    const selected = entity.artVariant === "auto" ? null
      : entity.artVariant || family.defaults?.[entity.sprite];
    return family.variants.find(v => v.id === selected) ||
      family.variants[hash(seed + ":" + entity.id) % family.variants.length];
  };
  const resolveAppearance = (entity, seed) => {
    const family = familyOf(entity), variant = variantOf(entity, seed);
    return variant ? {
      ...family.template, ...entity,
      // A changed orientation must not inherit the previous silhouette's footprint.
      ...(variant.solids ? { solids: variant.solids } : {}),
      artVariant: entity.artVariant || variant.id, artSprite: variant.sprite,
    } : entity;
  };
  return { familyOf, variantOf, resolveAppearance };
}
module.exports = { appearanceFor };
