"use strict";
const MODES = {
  illustration: {
    letter: "A",
    title: "Bosque ilustrado",
    short: "Sprites 2.5D",
    description:
      "El arte actual, colocado en un espacio 3D. Las láminas miran a la cámara: al girar no aparece una trasera real.",
    effort: "Menos arte nuevo · giro limitado aconsejable",
  },
  hybrid: {
    letter: "B",
    title: "Volumen + pixel art",
    short: "Híbrido",
    description:
      "Casas, árboles y desniveles con volumen real. Los duendes conservan sus sprites de ocho direcciones.",
    effort: "Equilibrio propuesto · requiere modelar el entorno",
  },
  volume: {
    letter: "C",
    title: "Pequeña maqueta",
    short: "Todo 3D",
    description:
      "También los duendes tienen volumen. Puedes ver sus orejas, gorro y mochila desde cualquier lado.",
    effort: "Libertad completa · nueva dirección de personajes",
  },
};
const STOPS = {
  plaza: { label: "Plaza", x: 32, z: 42 },
  river: { label: "Puente", x: 45, z: 39.5 },
  lookout: { label: "Mirador", x: 16, z: 24 },
};
const PROPS = [
  {
    id: "boot",
    kind: "boot",
    sprite: "tavern",
    x: 23,
    z: 29,
    height: 8,
    solid: [-3.4, -1.6, 6.8, 3.2],
  },
  {
    id: "leaves",
    kind: "hut",
    sprite: "human-house",
    x: 41,
    z: 28,
    height: 6.8,
    solid: [-2, -2, 4, 3.4],
  },
  {
    id: "stump",
    kind: "stump",
    sprite: "cottage",
    x: 33,
    z: 18,
    height: 8,
    solid: [-2.3, -2.3, 4.6, 4],
  },
  {
    id: "fountain",
    kind: "fountain",
    sprite: "fountain",
    x: 32,
    z: 34,
    height: 2.8,
    solid: [-1.5, -1.5, 3, 3],
  },
  {
    id: "bolete",
    kind: "mushroom",
    sprite: "giant-bolete",
    x: 41,
    z: 44,
    height: 5.2,
    solid: [-0.85, -0.8, 1.7, 1.6],
  },
  {
    id: "red-mushroom",
    kind: "mushroom",
    sprite: "scarlet-mushrooms",
    x: 11,
    z: 22,
    height: 4,
    red: true,
    solid: [-0.75, -0.7, 1.5, 1.4],
  },
  {
    id: "fern-left",
    kind: "fern",
    sprite: "giant-fern",
    x: 20,
    z: 44,
    height: 4,
    solid: [-0.45, -0.45, 0.9, 0.9],
  },
  {
    id: "fern-right",
    kind: "fern",
    sprite: "giant-fern",
    x: 46,
    z: 28,
    height: 4.2,
    solid: [-0.45, -0.45, 0.9, 0.9],
  },
  {
    id: "tree-west",
    kind: "tree",
    sprite: "ancient-root",
    x: 8,
    z: 35,
    height: 17,
    solid: [-1.7, -1.7, 3.4, 3.4],
  },
  {
    id: "tree-north",
    kind: "tree",
    sprite: "ancient-root",
    x: 22,
    z: 12,
    height: 18,
    solid: [-1.8, -1.8, 3.6, 3.6],
  },
  {
    id: "birch",
    kind: "tree",
    sprite: "forest-birch",
    x: 44,
    z: 17,
    height: 16,
    birch: true,
    solid: [-1.2, -1.2, 2.4, 2.4],
  },
  {
    id: "tree-south",
    kind: "tree",
    sprite: "forest-birch",
    x: 18,
    z: 54,
    height: 15,
    birch: true,
    solid: [-1.2, -1.2, 2.4, 2.4],
  },
  {
    id: "camp",
    kind: "fire",
    sprite: "fire",
    x: 26,
    z: 43,
    height: 1,
    solid: [-0.5, -0.5, 1, 1],
  },
  {
    id: "bench",
    kind: "bench",
    sprite: "bench",
    x: 25,
    z: 39,
    height: 1.3,
    solid: [-1.4, -0.4, 2.8, 0.8],
  },
];
const NEIGHBORS = [
  { x: 29, z: 38, variant: 2, hat: "#873d66", skin: "#bc885f" },
  { x: 38, z: 35, variant: 2, hat: "#3e7887", skin: "#e5b590" },
  { x: 24, z: 44.7, variant: 2, hat: "#779251", skin: "#784c38" },
];
const PATHS = [
  [
    [32, 59],
    [32, 43],
    [35, 39],
    [37, 35],
    [35, 30],
    [32, 29],
    [28, 31],
    [27, 36],
    [29, 39],
    [35, 39],
    [41, 39.5],
    [48, 39.5],
    [59, 39.5],
  ],
  [
    [28, 31],
    [23, 32],
    [23, 30],
  ],
  [
    [35, 30],
    [41, 31],
    [41, 29],
  ],
  [
    [32, 29],
    [33, 24],
    [33, 20],
  ],
  [
    [28, 31],
    [23, 33],
    [16, 33],
    [16, 27],
    [16, 24],
  ],
  [
    [29, 39],
    [26, 41],
    [26, 43],
  ],
];
function heightAt(x, z) {
  if (x >= 47 && x <= 57 && z >= 38 && z <= 41) return 0.3;
  if (x >= 8 && x <= 22 && z >= 14 && z <= 26) return 2.4;
  if (x >= 14 && x <= 18 && z > 26 && z <= 32) return (32 - z) * 0.4;
  return 0;
}
function makeScene() {
  const cliffs = [
    { x: 8, y: 14, solid: [-0.2, -0.2, 0.4, 12.4] },
    { x: 22, y: 14, solid: [-0.2, -0.2, 0.4, 12.4] },
    { x: 8, y: 14, solid: [-0.2, -0.2, 14.4, 0.4] },
    { x: 8, y: 26, solid: [-0.2, -0.2, 6.2, 0.4] },
    { x: 18, y: 26, solid: [0, -0.2, 4.2, 0.4] },
    { x: 14, y: 26, solid: [-0.2, 0, 0.4, 6] },
    { x: 18, y: 26, solid: [-0.2, 0, 0.4, 6] },
  ];
  return {
    id: "camera-study",
    width: 64,
    height: 64,
    seed: 907,
    spawn: { x: 32, y: 42 },
    paths: PATHS,
    waters: [],
    rivers: [{ rect: [48, 0, 8, 64] }],
    bridges: [{ rect: [47, 38, 10, 3], sprite: "jetty" }],
    scenery: [],
    clearings: [],
    regions: [],
    entities: [
      ...PROPS.map((p) => ({ ...p, y: p.z, rules: [] })),
      ...NEIGHBORS.map((n, i) => ({
        id: "neighbor-" + i,
        x: n.x,
        y: n.z,
        solid: [-0.4, -0.25, 0.8, 0.5],
        rules: [],
      })),
      ...cliffs.map((p, i) => ({ ...p, id: "cliff-" + i, rules: [] })),
    ],
  };
}
module.exports = { MODES, STOPS, PROPS, NEIGHBORS, PATHS, heightAt, makeScene };
