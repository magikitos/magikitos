"use strict";
/** One shared catalogue; only the authoring labels/options belong to the Studio. */
const elements = require("../../public/assets/js/adventure/elements");
function variantOptions(family, variants = family.variants) {
  return family.randomVariants === false
    ? variants
    : [{ id: "auto", label: "Variada · fija por objeto" }, ...variants];
}
module.exports = { ...elements, variantOptions };
