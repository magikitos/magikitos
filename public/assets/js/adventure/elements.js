"use strict";
const { residentFamilies } = require("./resident-families");
const families = { ...require("../../../../data/aventura/elements.json").families, ...residentFamilies };
const { familyOf, variantOf, resolveAppearance } =
  require("./element-appearance").appearanceFor(families);
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
  familyOf,
  variantOf,
  resolveAppearance,
  makeElement,
  frameName,
};
