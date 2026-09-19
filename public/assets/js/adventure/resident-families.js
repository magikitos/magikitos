"use strict";
const profiles = require("../../../../data/aventura/residents.json");
/** Lightweight, generated identities; production prompts and source artwork never enter the bundle. */
const residentFamilies = {};
for (const p of profiles) {
  if (p.playableOnly) continue;
  const id = "resident-" + p.family,
    sprite = `person-${p.id}-down`;
  const family = (residentFamilies[id] ||= {
    label: p.label.split(" ")[0],
    category: p.gender === "F" ? "Duendes · vecinas" : "Duendes · vecinos",
    template: {
      sprite,
      portrait: true,
      label: "neighbors",
      rules: [{ effects: [{ type: "dialogue", key: "neighborGreeting" }] }],
      solid: [-0.5, -0.3125, 1, 0.625],
    },
    aliases: [],
    defaults: {},
    variants: [],
  });
  family.aliases.push(sprite);
  family.defaults[sprite] = p.key;
  family.variants.push({ id: p.key, label: p.label, sprite });
}
module.exports = { residentFamilies };
