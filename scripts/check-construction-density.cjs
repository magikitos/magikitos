"use strict";
/**
 * ⛔ EL PRECIO SUBE CON LO PISADO, Y LOS DOS GEMELOS DICEN EL MISMO NÚMERO (AUTOMANTENIMIENTO.md
 * §A1, 19-sep-2026). La curva 2^(d/D) se comprueba sobre una tabla de entradas en JS y en PHP, con
 * una zona sintética de suelo conocido; y en NEGATIVO: una copia del gemelo PHP con el exponente
 * cambiado tiene que dar otro precio, o esta prueba no estaría vigilando nada.
 */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  objectCost,
  densityMultiplier,
  coveredTiles,
  walkableCells,
  maskFromRows,
} = require("../public/assets/js/adventure/construction-layout");

const web = process.env.GAME_WEB_REPO || path.resolve("..", "magikitos");
const authority = path.join(web, "src/game/community.php");
assert(fs.existsSync(authority), "La autoridad PHP tiene que estar al lado: " + authority);

// Una zona de 20×12 con dos filas de agua: 200 celdas pisables.
const rows = Array.from({ length: 12 }, (_, y) => (y < 2 ? "0".repeat(20) : "1".repeat(20)));
const ground = maskFromRows(rows);
assert.equal(walkableCells(ground), 200, "La máscara cuenta 200 celdas pisables");
const catalog = {
  definitions: {
    "forest-path": { shape: "polyline", paint: "path", costPerTile: { leaf: 1 }, densityDoubling: 0.02, surfaces: ["flat-ground"], rotations: [0], variants: [{ id: "tierra" }] },
    "twig-fence": { shape: "polyline", family: "fence-line", costPerTile: { twig: 2 }, densityDoubling: 0.02, surfaces: ["flat-ground"], rotations: [0], variants: [{ id: "ramitas" }] },
    "old-fence": { shape: "polyline", family: "fence-line", costPerTile: { twig: 1 }, surfaces: ["flat-ground"], rotations: [0], variants: [{ id: "x" }] },
    "woodland-bench": { footprint: [-1, -0.5, 2, 1], cost: { twig: 6 }, surfaces: ["flat-ground"], rotations: [0], variants: [{ id: "b" }] },
  },
  zones: { prueba: { scene: "prueba", terrain: rows } },
};
const line = (id, kind, ...points) => ({ id, kind, variant: "x", x: 0, y: 2, rotation: 0, points, revision: 1 });
// Lo que hay ya en la zona: 4 celdas de camino, 3 + 5 de valla (dos familias distintas).
const items = [
  line("p1", "forest-path", [0, 0], [4, 0]),
  line("f1", "twig-fence", [0, 0], [3, 0]),
  line("f2", "old-fence", [0, 0], [5, 0]),
  { id: "b1", kind: "woodland-bench", variant: "b", x: 10, y: 6, rotation: 0, revision: 1 },
];
assert.equal(coveredTiles(items, catalog.definitions["forest-path"], catalog), 4, "El camino cuenta sus celdas");
assert.equal(coveredTiles(items, catalog.definitions["twig-fence"], catalog), 8, "Las vallas suman por familia, aunque sean de dos tipos");
assert.equal(coveredTiles(items, catalog.definitions["twig-fence"], catalog, "f1"), 5, "La candidata no cuenta");

// La curva: d = cubiertas/200, multiplicador 2^(d/0,02). 4 celdas → d=0,02 → ×2; 8 → ×4; 0 → ×1.
const casos = [
  { kind: "forest-path", points: [[0, 0], [3, 0]], items, mult: 2, cost: { leaf: 6 } },
  { kind: "twig-fence", points: [[0, 0], [3, 0]], items, mult: 4, cost: { twig: 24 } },
  { kind: "twig-fence", points: [[0, 0], [2.5, 0]], items: [], mult: 1, cost: { twig: 6 } },
  { kind: "forest-path", points: [[0, 0], [1, 0]], items: items.concat(Array.from({ length: 9 }, (_, i) => line("x" + i, "forest-path", [0, 0], [4, 0]))), mult: 2 ** 10, cost: { leaf: 1024 } },
  { kind: "old-fence", points: [[0, 0], [3, 0]], items, mult: 1, cost: { twig: 3 } }, // sin densityDoubling no se entera
  { kind: "forest-path", points: [[0, 0], [1, 0]], items: [line("q", "forest-path", [0, 0], [1, 0])], mult: Math.round(2 ** 0.25 * 1e6) / 1e6, cost: { leaf: 2 } },
];
for (const c of casos) {
  const d = catalog.definitions[c.kind], m = densityMultiplier(d, c.items, catalog, ground, "nueva");
  assert.equal(m, c.mult, `multiplicador ${c.kind} ${JSON.stringify(c.points)}`);
  assert.deepEqual(objectCost({ id: "nueva", kind: c.kind, points: c.points }, d, m), c.cost, `coste ${c.kind} ${JSON.stringify(c.points)}`);
}
assert.equal(densityMultiplier(catalog.definitions["woodland-bench"], items, catalog, ground), 1, "Una pieza suelta no tiene densidad");

// El gemelo PHP, exacto, y su mutación negativa.
const php = (source) =>
  JSON.parse(
    execFileSync(
      "php",
      [
        "-r",
        source +
          "$d=json_decode(stream_get_contents(STDIN),true);$out=[];" +
          "foreach($d['casos'] as $c){$m=communityDensityMultiplier($c['kind'],$c['items'],$d['catalog'],$d['catalog']['zones']['prueba'],'nueva');" +
          "$out[]=['mult'=>$m,'cost'=>communityObjectCost(['id'=>'nueva','kind'=>$c['kind'],'points'=>$c['points']],$d['catalog']['definitions'][$c['kind']],$m)];}" +
          "echo json_encode($out);",
      ],
      { input: JSON.stringify({ catalog, casos }), encoding: "utf8" },
    ),
  );
const dicho = php("require '" + authority + "';");
casos.forEach((c, i) => {
  assert.equal(dicho[i].mult, c.mult, "PHP multiplicador " + i);
  assert.deepEqual(dicho[i].cost, c.cost, "PHP coste " + i);
});
// Negativo: la misma autoridad con el exponente roto tiene que dar otro precio.
const roto = fs.readFileSync(authority, "utf8").replace("round(2 ** ($d / $doubling) * 1e6)", "round(3 ** ($d / $doubling) * 1e6)");
assert(roto !== fs.readFileSync(authority, "utf8"), "La mutación encuentra la fórmula");
const tmp = path.join(require("node:os").tmpdir(), "community-roto-" + process.pid + ".php");
fs.writeFileSync(tmp, roto.replace(/require_once __DIR__ \. "\/([a-z-]+)\.php";/g, (_, f) => `require_once "${path.join(web, "src/game", f)}.php";`));
try {
  const mutado = php("require '" + tmp + "';");
  assert.notDeepEqual(mutado[0], dicho[0], "Un gemelo con el exponente cambiado da otro precio, y la prueba lo caza");
} finally {
  fs.unlinkSync(tmp);
}
console.log("PASS construction density: 2^(d/D) por familia sobre las celdas pisables, JS y PHP exactos en " + casos.length + " casos, la candidata no cuenta, y la mutación del exponente se detecta.");
