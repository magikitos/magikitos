"use strict";
const { families } = require("../../../../data/aventura/elements.json");
const { hash } = require("./geometry");
const aliases = new Map(
  Object.entries(families).flatMap(([id, f]) =>
    f.aliases.map((name) => [name, id]),
  ),
);
function familyId(entity) {
  return Object.hasOwn(families, entity.family)
    ? entity.family
    : aliases.get(entity.sprite) || null;
}
function familyOf(entity) {
  return families[familyId(entity)] || null;
}
function variantOf(entity, seed = "") {
  const family = familyOf(entity);
  if (!family) return null;
  const selected =
    entity.artVariant === "auto"
      ? null
      : entity.artVariant || family.defaults?.[entity.sprite];
  return (
    family.variants.find((v) => v.id === selected) ||
    family.variants[hash(seed + ":" + entity.id) % family.variants.length]
  );
}
function resolveAppearance(entity, seed) {
  const f = familyOf(entity),
    variant = variantOf(entity, seed);
  return variant
    ? {
        ...f.template,
        ...entity,
        artVariant: entity.artVariant || variant.id,
        artSprite: variant.sprite,
      }
    : entity;
}
function makeElement(family, id, x, y, artVariant = "auto") {
  const f = families[family];
  if (!f) throw Error("Familia desconocida");
  if (artVariant !== "auto" && !f.variants.some((v) => v.id === artVariant))
    throw Error("Variante desconocida");
  return { ...f.template, family, id, x, y, artVariant };
}
const frameName = (entity) => entity.artSprite || entity.sprite;
module.exports = {
  families,
  familyId,
  familyOf,
  variantOf,
  resolveAppearance,
  makeElement,
  frameName,
};
