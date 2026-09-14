"use strict";
const rows = [
  ["blanket", "picnic-blanket", 360, 352, "rigid", -1000],
  ["smoker", "picnic-smoker", 296, 304, "actor"],
  ["friend", "picnic-human-friend", 424, 304, "actor"],
  ["tortilla", "picnic-tortilla", 376, 352, "rigid"],
  ["basket", "picnic-basket", 464, 376, "rigid"],
  ["knife", "picnic-knife", 392, 376, "rigid"],
  ["lighter", "lighter", 260.8, 315.2, "rigid"],
  ["guacamole", "picnic-guacamole", 345.6, 321.6, "rigid"],
  ["chips", "picnic-potato-chips", 331.2, 353.6, "rigid"],
  ["lemonade", "picnic-lemonade", 342.4, 290.4, "rigid"],
  ["soda", "picnic-orange-soda", 409.6, 321.6, "rigid"],
  ["speaker", "picnic-speaker", 384, 272, "rigid"],
  ["home", "human-house", 654, 388, "rigid"],
  ["fern", "giant-fern", 145, 504, "fern"],
  ["fern-back", "giant-fern", 694, 188, "fern"],
  ["clover", "giant-clover", 585, 579, "foliage"],
  ["daisies", "flowers-daisy-gold", 275, 425, "foliage"],
  ["daisies-garden", "flowers-daisy-gold", 201, 534, "foliage"],
  ["daisies-left", "flowers-daisy-gold", 210, 325, "foliage"],
  ["planter", "flower-pot", 534, 400, "planter"],
  ["planter-garden", "flower-pot", 306, 533, "planter"],
  ["bolete", "giant-bolete", 261, 504, "rigid"],
  ["hero", "person-0-down", 372, 421, "reference"],
];
const ENTITIES = rows.map(([id, sprite, x, y, motion, depth]) => ({
  id,
  sprite,
  x,
  y,
  motion,
  depth,
}));
const SELECTIVE = new Set([
  "smoker",
  "friend",
  "fern",
  "daisies-garden",
  "planter",
]);
const STOPS = {
  picnic: { label: "Picnic", center: [362, 335] },
  garden: { label: "Jardín", center: [235, 462] },
  home: { label: "Refugio", center: [629, 366] },
};
const DETAIL = [
  "picnic-knife",
  "lighter",
  "flowers-daisy-gold",
  "giant-fern",
  "giant-clover",
  "flower-pot",
  "giant-bolete",
  "human-house",
  "picnic-smoker",
  "picnic-human-friend",
];
function groundScene() {
  return {
    id: "definition-motion-study",
    seed: 73191,
    width: 64,
    height: 48,
    paths: [
      [
        [4, 30],
        [18, 29],
        [24, 28],
        [34, 29],
        [43, 27],
        [46, 21],
      ],
      [
        [35, 29],
        [36, 25],
        [40, 24],
      ],
    ],
    regions: [],
    entities: [],
    walls: [],
    scenery: [],
    waters: [],
    rivers: [],
    bridges: [],
  };
}
module.exports = { ENTITIES, SELECTIVE, STOPS, DETAIL, groundScene };
