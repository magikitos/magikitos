"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const {
  validateConstruction,
  objectCost,
  maskFromRows,
} = require("../public/assets/js/adventure/construction-layout");
const {
  catalogGround,
} = require("../public/assets/js/adventure/construction-ground");
const { freeSpot } = require("./community-spot.cjs");

/**
 * ⛔ LOS DOS MOTORES JUZGAN EL MISMO BOSQUE, Y SE LES PREGUNTA DESDE DOS ARTEFACTOS DISTINTOS.
 *
 * El navegador lee `world.json` —lo que viaja incrustado en la página— y calcula el suelo de la
 * pantalla que ya tiene cargada; la autoridad lee `game-contract.json` —lo que se instala en la
 * web— con las filas de suelo horneadas dentro. Leer los dos del mismo fichero sería una prueba
 * que no puede fallar: lo que aquí se comprueba es justamente que el mundo que se pinta y el
 * contrato que manda dicen lo mismo, mapa a mapa y motivo a motivo.
 *
 * Y se prueba en dos escenarios a propósito:
 *
 *  · EL BOSQUE DE VERDAD, para la máscara de suelo y para que cada pieza del catálogo quepa donde
 *    dice que cabe. Aquí no se cablea ni una coordenada: el sitio legal se BUSCA, porque el dueño
 *    mueve las cosas en el Estudio y una prueba con coordenadas escritas a mano caduca sola.
 *  · UNA ZONA DE MENTIRA de 20×12 con un río en medio, para la TOPOLOGÍA: dos islas, un rincón
 *    protegido y sitio de sobra para trazar. Las reglas de paso, de lo prohibido y de vecindad
 *    hablan de formas, no de este mapa, y probarlas contra el bosque real las ataría a dónde está
 *    hoy la barbacoa.
 */
const web = process.env.GAME_WEB_REPO || path.resolve("..", "magikitos");
const authority = path.join(web, "src/game/community.php");
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
const catalog = world.construction;
const release = JSON.parse(fs.readFileSync(".local/build/current.json")).id;
const contract = JSON.parse(
  fs.readFileSync(
    path.join(".local/build/releases", release, "game-contract.json"),
  ),
).construction;

/** Lo que contesta la autoridad a cada caso: el motivo, o null si lo acepta. */
function authorityReasons(catalogo, cases) {
  const php =
    "require $argv[1];" +
    "$d=json_decode(stream_get_contents(STDIN),true);$out=[];" +
    "foreach($d['cases'] as $c){try{" +
    "communityValidate($c['items'],$c['zone'],$d['catalog'],$c['candidate']??null);" +
    "$out[]=null;}catch(Throwable $e){$out[]=$e->getMessage();}}" +
    "echo json_encode($out);";
  return JSON.parse(
    execFileSync("php", ["-r", php, authority], {
      input: JSON.stringify({ catalog: catalogo, cases }),
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    }),
  );
}
/** Los dos motores contestan lo mismo a todos estos casos, o se dice exactamente a cuál no. */
function parity(catalogoJs, catalogoPhp, grounds, cases, etiqueta) {
  const dicho = authorityReasons(catalogoPhp, cases);
  cases.forEach((c, i) =>
    assert.equal(
      validateConstruction(
        c.items,
        c.zone,
        catalogoJs,
        grounds[c.zone],
        c.candidate ?? null,
      ),
      dicho[i],
      etiqueta + ": " + JSON.stringify(c),
    ),
  );
  return cases.length;
}

/**
 * 1. EL SUELO ES EL MISMO, CELDA A CELDA.
 *
 * Es la costura donde esto se rompería sin avisar: el servidor juzga contra unas filas horneadas
 * el día del build y el navegador contra la pantalla que tiene delante. Si alguien cambia el
 * tamaño de un duende, o mueve un árbol, o toca el muestreo de las cinco esquinas, lo único que
 * pasaría es que el fantasma diría que sí y la autoridad que no, en un rincón cualquiera.
 */
const grounds = {};
let celdas = 0;
for (const [id, zone] of Object.entries(contract.zones)) {
  const mine = catalogGround(world, zone.scene);
  const baked = maskFromRows(zone.terrain);
  assert.deepEqual(
    [baked.width, baked.height],
    [mine.width, mine.height],
    id + ": la máscara horneada no mide lo que la pantalla",
  );
  const [bx, by, bw, bh] = zone.bounds;
  assert.deepEqual(
    [bx, by, bw, bh],
    [0, 0, mine.width, mine.height],
    id + ": la zona ya no es una parcela, es la pantalla entera",
  );
  for (let i = 0; i < mine.cells.length; i++)
    if (mine.cells[i] !== baked.cells[i])
      assert.fail(
        id +
          ": el suelo discrepa en el tile " +
          (i % mine.width) +
          "," +
          Math.floor(i / mine.width),
      );
  celdas += mine.cells.length;
  grounds[id] = mine;
  assert(
    zone.accessGroups.length && zone.accessGroups.every((g) => g.length),
    id + ": una zona sin anclajes de paso no protege nada",
  );
}

/**
 * 2. CADA PIEZA, EN CADA PANTALLA DEL BOSQUE. El sitio lo busca `community-spot.cjs`, y que una
 * pieza no quepa en ninguna parte de una pantalla ya es el hallazgo.
 */
const candidateFor = (kind, d, x, y) => ({
  // La pieza que se está colocando es la CANDIDATA y las reglas de permiso solo la miran a ella,
  // así que sin id no habría a quién mirar y media prueba no probaría nada.
  id: "nueva",
  kind,
  variant: d.variants[0].id,
  rotation: d.rotations[0],
  x,
  y,
  ...(d.shape === "polyline"
    ? {
        points: [
          [0, 0],
          [3, 0],
          [3, 2],
        ],
      }
    : {}),
});
const cases = [];
for (const zone of Object.keys(catalog.zones)) {
  const [, , zw] = catalog.zones[zone].bounds;
  for (const [kind, d] of Object.entries(catalog.definitions)) {
    const candidate = freeSpot({
      catalog,
      zone,
      ground: grounds[zone],
      make: (x, y) => candidateFor(kind, d, x, y),
    });
    assert(candidate, "Hay sitio para " + kind + " en " + zone);
    const caso = (items) => cases.push({ zone, items, candidate: "nueva" });
    for (const rotation of d.rotations) caso([{ ...candidate, rotation }]);
    for (const override of [
      { x: -1 },
      { x: 1.1 },
      { x: zw + 1 },
      { y: -1 },
      { rotation: 3 },
      { variant: "invented" },
      { kind: "unknown" },
    ])
      caso([{ ...candidate, ...override }]);
    caso([candidate, candidate]);
    if (d.shape === "polyline")
      for (const points of [
        undefined,
        [],
        [[0, 0]],
        [
          [1, 0],
          [4, 0],
        ],
        [
          [0, 0],
          [0.5, 0],
        ],
        [
          [0, 0],
          [0, 0.3],
        ],
        [
          [0, 0],
          [30, 0],
        ],
        [
          [0, 0],
          [3, 0],
          [6, 0],
          [9, 0],
          [12, 0],
          [15, 0],
          [18, 0],
          [21, 0],
          [24, 0],
        ],
        [
          [0, 0],
          [3, "x"],
        ],
        [
          [0, 0],
          [3.3, 0],
        ],
      ])
        caso([{ ...candidate, points }]);
    else
      caso([
        {
          ...candidate,
          points: [
            [0, 0],
            [3, 0],
          ],
        },
      ]);
  }
}
const reales = parity(catalog, contract, grounds, cases, "bosque");

/**
 * 3. LA TOPOLOGÍA, EN UNA ZONA DE MENTIRA: dos islas de cinco y seis filas con un río en medio,
 * un rincón prohibido y sitio de sobra para trazar. Aquí viven las cuatro reglas que no hablan de
 * este mapa sino de formas, y por eso no se prueban contra el bosque: el día que el dueño mueva
 * la barbacoa, esta prueba tiene que seguir midiendo lo mismo.
 */
const filas = Array.from({ length: 12 }, (_, y) =>
  (y === 6 ? "0" : "1").repeat(20),
);
const banco = {
  scene: "prueba",
  surface: "flat-ground",
  maxObjects: 96,
  bounds: [0, 0, 20, 12],
  // Un rincón que se deja como está, igual que la esquina del merendero.
  protected: [[2, 2, 3, 3]],
  terrain: filas,
  // Las dos orillas no están unidas a pie: se exige que cada una siga entera, no que se toquen.
  accessGroups: [
    [
      [1, 1],
      [18, 1],
    ],
    [
      [1, 10],
      [18, 10],
    ],
  ],
};
const conBanco = (c) => ({ ...c, zones: { ...c.zones, prueba: banco } });
const bancoJs = conBanco(catalog),
  bancoPhp = conBanco(contract);
const bancoGround = { prueba: maskFromRows(filas) };
const pieza = (kind, x, y, points, id = "nueva") => ({
  id,
  kind,
  variant: bancoJs.definitions[kind].variants[0].id,
  rotation: 0,
  x,
  y,
  ...(points ? { points } : {}),
});
const traza = (kind, x, y, points, id) => pieza(kind, x, y, points, id);
const corte = (kind) => [
  traza(kind, 10, 0.5, [
    [0, 0],
    [0, 4.5],
  ]),
];
const topologia = [
  // Una valla de orilla a orilla parte la isla del norte en dos; el mismo trazo como camino es
  // exactamente lo que un camino viene a hacer.
  { items: corte("twig-fence"), esperado: "blocked_access" },
  { items: corte("forest-path"), esperado: null },
  // Lo prohibido juzga lo que PONES: la misma pieza, en el mismo sitio, pasa si ya estaba.
  {
    items: [pieza("woodland-bench", 3.5, 3.5)],
    esperado: "protected_access",
  },
  {
    items: [pieza("woodland-bench", 3.5, 3.5, null, "vieja")],
    candidate: null,
    esperado: null,
  },
  // El agua no es suelo.
  { items: [pieza("woodland-bench", 10, 6.5)], esperado: "blocked_terrain" },
  // La otra isla también cuenta: tapar su anclaje la deja incomunicada de sí misma.
  { items: [pieza("woodland-bench", 18, 10)], esperado: "blocked_access" },
  { items: [pieza("woodland-bench", 10, 9)], esperado: null },
];
// Y la vecindad de los trazados, que es la regla que estrena el bosque abierto.
const base = traza(
  "twig-fence",
  2,
  8,
  [
    [0, 0],
    [6, 0],
  ],
  "vieja",
);
for (const [etiqueta, nuevo, esperado] of [
  [
    "empalmar por la punta",
    traza("twig-fence", 8, 8, [
      [0, 0],
      [3, 0],
    ]),
    null,
  ],
  [
    "bifurcar por el medio",
    traza("twig-fence", 5, 8, [
      [0, 0],
      [0, 3],
    ]),
    null,
  ],
  [
    "apartarse las celdas que pide",
    traza("twig-fence", 2, 11, [
      [0, 0],
      [6, 0],
    ]),
    null,
  ],
  /**
   * ⛔ LA PUERTECITA. Una valla en línea con otra y con un hueco por el que se pasa NO es un
   * paralelo, y hasta el 18-sep-2026 se caía por `too_close`: la regla medía distancia de punto
   * a segmento y con eso una puerta y un paralelo son el mismo número. Se prueba el hueco por
   * arriba y por abajo del que de verdad usa una persona.
   */
  [
    "abrir una puertecita de una celda y media",
    traza("twig-fence", 9.5, 8, [
      [0, 0],
      [2, 0],
    ]),
    null,
  ],
  [
    "abrir una puertecita de dos celdas y media",
    traza("twig-fence", 10.5, 8, [
      [0, 0],
      [1, 0],
    ]),
    null,
  ],
  [
    "ponerse en paralelo a dos celdas",
    traza("twig-fence", 2, 10, [
      [0, 0],
      [6, 0],
    ]),
    "too_close",
  ],
  [
    "calcar el trazo pegadito",
    traza("twig-fence", 2, 8.5, [
      [0, 0],
      [6, 0],
    ]),
    "too_close",
  ],
  [
    "un camino no estorba a una valla",
    traza("forest-path", 2, 10, [
      [0, 0],
      [6, 0],
    ]),
    null,
  ],
])
  topologia.push({ items: [base, nuevo], esperado, etiqueta });
for (const caso of topologia) {
  const dicho = validateConstruction(
    caso.items,
    "prueba",
    bancoJs,
    bancoGround.prueba,
    caso.candidate === undefined ? "nueva" : caso.candidate,
  );
  assert.equal(
    dicho,
    caso.esperado,
    "topología · " + (caso.etiqueta || JSON.stringify(caso.items)),
  );
}
const sinteticos = parity(
  bancoJs,
  bancoPhp,
  bancoGround,
  topologia.map((c) => ({
    zone: "prueba",
    items: c.items,
    candidate: c.candidate === undefined ? "nueva" : c.candidate,
  })),
  "zona de prueba",
);

/**
 * 4. Y LO QUE CUESTA UN TRAZADO LO DICEN LOS DOS IGUAL, porque el servidor no se fía del precio
 * que le manden: lo vuelve a medir sobre los vértices.
 */
const fence = catalog.definitions["twig-fence"];
const line = (...points) => pieza("twig-fence", 0, 0, points);
const costs = [
  line([0, 0], [3, 0]),
  line([0, 0], [3, 0], [3, 4]),
  line([0, 0], [0, 1]),
  line([0, 0], [2.5, 0]),
];
const phpCosts = JSON.parse(
  execFileSync(
    "php",
    [
      "-r",
      "require $argv[1];$d=json_decode(stream_get_contents(STDIN),true);$out=[];" +
        "foreach($d['objects'] as $o){$out[]=communityObjectCost($o,$d['catalog']['definitions']['twig-fence']);}" +
        "echo json_encode($out);",
      authority,
    ],
    {
      input: JSON.stringify({ catalog: contract, objects: costs }),
      encoding: "utf8",
    },
  ),
);
costs.forEach((o, i) =>
  assert.deepEqual(
    objectCost(o, fence),
    phpCosts[i],
    JSON.stringify(o.points),
  ),
);
assert.deepEqual(
  objectCost(costs[0], fence),
  { twig: 6 },
  "Three tiles of fence cost three tiles of twigs",
);
// Cavar no cuesta material: cuesta tener la pala. Un precio de cero no es un precio.
assert.deepEqual(
  objectCost(costs[0], catalog.definitions["forest-path"]),
  {},
  "A path is paid for with a tool, not with twigs",
);
assert.deepEqual(
  catalog.definitions["forest-path"].requires,
  { items: { rake: 1 } },
  "…and that tool is the rake",
);
assert(
  world.items.rake.reusable && world.items.rake.max === 1,
  "A rake lasts for ever and there is only ever one",
);
assert.deepEqual(
  catalog.definitions["forest-path"].removeCost,
  { grassSeed: 1 },
  "Taking a path away is sowing grass over it",
);

/**
 * 5. TODO MOTIVO QUE LA PERSONA PUEDE VER TIENE QUE TENER SU FRASE, y la lista de motivos la
 * escribe el SERVIDOR: se saca de su propio código en vez de copiarla aquí, que es como se
 * quedaría atrás el día que aparezca uno nuevo. Lo que se manda al genérico va declarado con su
 * razón: son fallos de forma o carreras entre dos personas, donde lo correcto ES reintentar.
 */
{
  const { RAZONES } = require("../public/assets/js/adventure/community");
  const php = fs.readFileSync(authority, "utf8");
  const codigos = new Set(
    [
      ...php.matchAll(
        /(?:GameApiFailure\(\d+|InvalidArgumentException\()\s*,?\s*"([a-z_]+)"/g,
      ),
    ].map((m) => m[1]),
  );
  // Fontanería a propósito: forma inválida (nadie los provoca tocando la pantalla) y carreras
  // entre dos personas, que es justo cuando «algo ha cambiado, vuelve a mirar» es la verdad.
  const genericos = new Set([
    "object_conflict",
    "zone_conflict",
    "object_missing",
    "zone_unavailable",
    "unknown_zone",
    "journey_required",
    "object_identity_changed",
    "invalid_kind",
    "invalid_object",
    "invalid_operation",
    "invalid_position",
    "invalid_revision",
    "invalid_variant",
  ]);
  const mudos = [...codigos].filter((c) => !RAZONES[c] && !genericos.has(c));
  assert.deepEqual(
    mudos,
    [],
    "Server refusals with no sentence of their own: " + mudos,
  );
  assert(codigos.size > 15, "The refusals were actually read from the authority");
  // Y la frase existe de verdad en los seis idiomas, que un motivo apuntando a una clave muerta
  // enseña el nombre de la clave justo cuando hay que explicar por qué no se ha podido.
  const core = JSON.parse(
    fs.readFileSync("data/aventura/locales/core.json", "utf8"),
  );
  for (const [codigo, clave] of Object.entries(RAZONES))
    for (const lang of ["es", "en", "de", "fr", "it", "pt"])
      assert(
        core[clave]?.[lang],
        "«" + codigo + "» dice «" + clave + "» y no hay " + lang,
      );
}
console.log(
  `PASS construcción: ${celdas} celdas de suelo idénticas entre el mundo y el contrato en ${Object.keys(contract.zones).length} pantallas, ` +
    `${reales} casos de paridad sobre el bosque real (cada pieza, cada pantalla, huellas, trazados y entrada rechazada), ` +
    `${sinteticos} de topología (dos islas, rincón prohibido, empalmes y calcos) y ${costs.length} trazados con precio.`,
);
