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
    if (!variant) return entity;
    /**
     * La VARIANTE manda sobre lo que la entidad traiga: al cambiar de orientación no puede heredar
     * la silueta de la anterior, que es lo que una resolución previa dejó puesto. Y si la variante
     * no dice nada, vale el cuerpo compuesto que la entidad sí trae (un arco con dos patas).
     */
    const solids = variant.solids || entity.solids;
    const resolved = {
      ...family.template, ...entity, ...(solids ? { solids } : {}),
      // La entrada de la variante vale igual que su cuerpo: el compilador ya la mezcla
      // (`world.php`), y sin esto el Studio dibujaba la puerta en un sitio y el juego en otro.
      ...(variant.entrance && !entity.entrance ? { entrance: variant.entrance } : {}),
      artVariant: entity.artVariant || variant.id, artSprite: variant.sprite,
    };
    /**
     * ⛔ UN CUERPO COMPUESTO SUSTITUYE AL SIMPLE, NO SE SUMA (21-sep-2026). `collisionBodies`
     * rechaza a quien lleve los dos, y la plantilla de la familia trae `solid` justo cuando la
     * variante trae `solids`: sin esta línea, dar varias cajas a un elemento que heredaba una
     * sola rompía la escena entera al construirla.
     */
    if (solids) delete resolved.solid;
    return resolved;
  };
  return { familyOf, variantOf, resolveAppearance };
}
module.exports = { appearanceFor };
