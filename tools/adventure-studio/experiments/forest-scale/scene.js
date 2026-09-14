"use strict";
/** Independent authored scene. No production scene import, mutation, travel, inventory or save. */
const PRESETS = {
  near: {
    label: "Cercana",
    nature: 0.8,
    found: 0.85,
    description:
      "Un mundo acogedor, con objetos reconocibles y más espacio visual.",
  },
  tiny: {
    label: "Diminuta",
    nature: 1.25,
    found: 1.1,
    description:
      "La seta te hace sombra. El zapato es una posada. Esta es la propuesta de partida.",
  },
  micro: {
    label: "Minúscula",
    nature: 1.75,
    found: 1.35,
    description:
      "Raíces como acantilados y helechos como árboles. Más asombro, más oclusión.",
  },
};
const STOPS = [
  {
    id: "boot",
    title: "La Posada del Cordón",
    subtitle: "Antes olía a pie. Ahora sirven infusiones.",
    position: [35, 47],
    focus: "boot-inn",
    note: "Un objeto humano encontrado convierte el tamaño del duende en algo evidente, sin enseñar un humano.",
  },
  {
    id: "roots",
    title: "El barrio de las raíces",
    subtitle: "El vecino de arriba vive literalmente arriba.",
    position: [49, 31],
    focus: "stump-home",
    note: "El árbol se lee por su base y sus raíces; no hace falta enseñar una copa entera en pantalla.",
  },
  {
    id: "mushrooms",
    title: "Un paraguas con esporas",
    subtitle: "Aquí un champiñón no cabe en el bolsillo.",
    position: [31, 67],
    focus: "giant-bolete",
    note: "Compara la silueta del protagonista con el sombrero de la seta, manteniendo el mismo zoom.",
  },
  {
    id: "river",
    title: "La orilla de lo inmenso",
    subtitle: "Para cruzar esto no valen dos saltitos.",
    position: [78, 56],
    focus: "leaf-home",
    note: "Solo se ve esta orilla. El agua continúa fuera del escenario y no se puede rodear a pie.",
  },
  {
    id: "found",
    title: "La maceta del revés",
    subtitle: "La hipoteca son dos hojas y una bellota.",
    position: [62, 72],
    focus: "pot-home",
    note: "Reutilizar objetos encontrados da personalidad a cada vivienda sin volver a la casita humana.",
  },
];
function makeScene(preset = "tiny") {
  const p = PRESETS[preset];
  if (!p) throw Error("Unknown scale study");
  const entity = (
    id,
    sprite,
    x,
    y,
    scale = 1,
    solid = [-2.8, -2.4, 5.6, 2.6],
    extra = {},
  ) => ({ id, sprite, x, y, scale, solid, rules: [], ...extra });
  const entities = [
    entity(
      "boot-inn",
      "boot-inn",
      30,
      44,
      1.15 * p.found,
      [-3.9, -3.6, 7.5, 3.8],
    ),
    entity("stump-home", "stump-home", 47, 26, 1.25, [-3, -3.8, 6, 4]),
    entity("leaf-home", "leaf-home", 73, 51, 0.85, [-2.7, -3, 5.4, 3.2]),
    entity("mushroom-home", "mushroom-home", 50, 62, 0.9, [-2, -3.3, 4, 3.5]),
    entity("log-workshop", "log-workshop", 21, 62, 1, [-4, -3.7, 8, 3.9]),
    entity("pot-home", "pot-home", 59, 68, 1.1 * p.found, [-3, -3.7, 6, 3.9]),
    entity(
      "root-grandfather",
      "ancient-root",
      25,
      28,
      2.9 * p.nature,
      [-1.8, -2.4, 3.6, 2.4],
    ),
    entity(
      "root-east",
      "ancient-root",
      69,
      26,
      2.4 * p.nature,
      [-1.7, -2.2, 3.4, 2.4],
      { flip: true },
    ),
    entity(
      "root-west",
      "ancient-root",
      8,
      49,
      2.1 * p.nature,
      [-1.6, -2.5, 3.2, 2.6],
    ),
    entity(
      "root-south",
      "ancient-root",
      72,
      84,
      2 * p.nature,
      [-1.5, -2.2, 3, 2.4],
    ),
    entity(
      "giant-bolete",
      "giant-bolete",
      32,
      63,
      1.12 * p.nature,
      [-1.4, -2.1, 2.8, 2.3],
    ),
    entity(
      "red-cluster",
      "scarlet-mushrooms",
      61,
      45,
      0.85 * p.nature,
      [-2, -1.8, 4, 2],
    ),
    entity(
      "clover-west",
      "giant-clover",
      18,
      74,
      1.25 * p.nature,
      [-0.8, -0.6, 1.6, 0.8],
    ),
    entity(
      "clover-central",
      "giant-clover",
      39,
      30,
      0.8 * p.nature,
      [-0.8, -0.6, 1.6, 0.8],
      { flip: true },
    ),
    entity(
      "clover-river",
      "giant-clover",
      81,
      40,
      1 * p.nature,
      [-0.8, -0.6, 1.6, 0.8],
    ),
    entity(
      "fern-north",
      "giant-fern",
      43,
      13,
      1.7 * p.nature,
      [-1, -1, 2, 1.2],
    ),
    entity(
      "fern-west",
      "giant-fern",
      14,
      36,
      1.35 * p.nature,
      [-1, -1, 2, 1.2],
      { flip: true },
    ),
    entity(
      "fern-river",
      "giant-fern",
      79,
      73,
      1.4 * p.nature,
      [-1, -1, 2, 1.2],
    ),
    entity(
      "fern-south",
      "giant-fern",
      43,
      83,
      1.35 * p.nature,
      [-1, -1, 2, 1.2],
    ),
    entity("arch", "root-arch", 51, 47, 1.2 * p.nature, [-3.3, -1.3, 1.2, 1.8]),
  ];
  // A root arch has two supports; its central opening remains physically passable.
  const arch = entities.find((e) => e.id === "arch");
  entities.push({
    ...arch,
    id: "arch-support",
    sprite: null,
    solid: [2.1, -1.3, 1.2, 1.8],
  });
  return {
    id: "forest-scale-" + preset,
    width: 112,
    height: 88,
    seed: 73191,
    indoor: false,
    spawn: { x: 35, y: 47 },
    paths: [
      [
        [26, 44.5],
        [30, 46],
        [35, 48],
        [41, 48],
        [47, 48],
        [55, 52],
        [66, 55],
        [79, 56],
      ],
      [
        [41, 48],
        [42, 39],
        [47, 31],
        [47, 27],
      ],
      [
        [35, 48],
        [34, 57],
        [37, 66],
        [48, 67],
        [59, 72],
        [66, 72],
      ],
      [
        [37, 66],
        [26, 67],
        [21, 63],
      ],
      [
        [48, 67],
        [50, 63],
      ],
      [
        [66, 55],
        [72, 56],
        [73, 52],
      ],
    ],
    waters: [],
    clearings: [],
    regions: [],
    coasts: [
      {
        side: "east",
        points: [
          [83, 0],
          [83, 17],
          [88, 34],
          [84, 50],
          [85, 61],
          [79, 77],
          [82, 88],
        ],
      },
    ],
    scenery: [],
    entities,
  };
}
module.exports = { makeScene, PRESETS, STOPS };
