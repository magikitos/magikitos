"use strict";
/**
 * ⛔ LA HIERBA VUELVE POR LOS EXTREMOS (AUTOMANTENIMIENTO.md §A3). Mueren los tramos de las puntas y
 * nunca los del medio; el camino no se parte; con menos de dos puntos se retira entero; sin
 * presencia el reloj no avanza y no muere nada; nada devuelve material (no hay material que
 * devolver en la función: solo geometría). Y el gemelo PHP dice lo mismo, con mutación negativa.
 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const { erodePath, segmentWear } = require("../public/assets/js/adventure/maintenance");
const web = process.env.GAME_WEB_REPO || path.resolve("..", "magikitos");
const twin = path.join(web, "src/game/community-maintenance.php");
assert(fs.existsSync(twin), "El gemelo PHP tiene que estar al lado: " + twin);

const M = 720; // minutos de presencia hasta que un tramo muere
const camino = { x: 10, y: 20, points: [[0, 0], [3, 0], [3, 4], [7, 4]] }; // tres tramos
const casos = [
  // [nombre, steps, clock, esperado]
  ["recién puesto: nada muere", [0, 0, 0], 0, { x: 10, y: 20, points: camino.points, retired: false, changed: false }],
  ["sin presencia no hay edad aunque pasen días", [5, 5, 5], 5, { x: 10, y: 20, points: camino.points, retired: false, changed: false }],
  ["justo en el umbral muere el primer tramo y la pieza se recoloca", [0, 700, 700], M, { x: 13, y: 20, points: [[0, 0], [0, 4], [4, 4]], retired: false, changed: true }],
  ["el último tramo muere por su punta", [700, 700, 0], M, { x: 10, y: 20, points: [[0, 0], [3, 0], [3, 4]], retired: false, changed: true }],
  ["un tramo del MEDIO no muere aunque nadie lo pise", [700, 0, 700], M, { x: 10, y: 20, points: camino.points, retired: false, changed: false }],
  ["las dos puntas mueren y el medio queda", [0, 700, 0], M, { x: 13, y: 20, points: [[0, 0], [0, 4]], retired: false, changed: true }],
  ["la erosión sigue hacia dentro cuando el nuevo extremo también está muerto", [0, 0, 700], M, { x: 13, y: 24, points: [[0, 0], [4, 0]], retired: false, changed: true }],
  ["todo muerto: la pieza entera se retira", [0, 0, 0], M, { x: 17, y: 24, points: [[0, 0]], retired: true, changed: true }],
  ["tramos sin marca cuentan como recién pisados", [0], M, { x: 13, y: 20, points: [[0, 0], [0, 4], [4, 4]], retired: false, changed: true }],
  ["un minuto antes del umbral no muere nada", [0, 0, 0], M - 1, { x: 10, y: 20, points: camino.points, retired: false, changed: false }],
];
for (const [nombre, steps, clock, esperado] of casos) {
  const r = erodePath(camino, steps, clock, M);
  assert.deepEqual({ x: r.x, y: r.y, points: r.points, retired: r.retired, changed: r.changed }, esperado, nombre);
  assert.equal(r.steps.length, Math.max(0, r.points.length - 1), nombre + ": una marca por tramo");
}
assert.equal(erodePath(camino, [0, 0, 0], 5000, 0).changed, false, "Sin overgrowth.minutes no muere nada");
assert.equal(segmentWear(360, 0, M), 0.5, "A mitad de presupuesto el desgaste es 0,5 (ahí asoma la hierba)");
assert.equal(segmentWear(100, 200, M), 0, "Una marca del futuro (reloj del cliente atrasado) no desgasta");
assert.equal(segmentWear(5000, 0, M), 1, "El desgaste se satura en 1");

// El gemelo PHP, caso a caso, y la mutación negativa del umbral.
const php = (source) => JSON.parse(execFileSync("php", ["-r",
  source + "$d=json_decode(stream_get_contents(STDIN),true);$out=[];" +
  "foreach($d['casos'] as $c){$r=communityErodePath($d['camino'],$c[1],$c[2],$d['M']);$out[]=['x'=>$r['x'],'y'=>$r['y'],'points'=>$r['points'],'retired'=>$r['retired'],'changed'=>$r['changed']];}" +
  "$out[]=communitySegmentWear(360,0,$d['M']);echo json_encode($out);"],
  { input: JSON.stringify({ camino, casos, M }), encoding: "utf8" }));
const dicho = php("require '" + twin + "';");
casos.forEach(([nombre, , , esperado], i) => assert.deepEqual(dicho[i], esperado, "PHP: " + nombre));
assert.equal(dicho[casos.length], 0.5, "PHP: desgaste a mitad");
const original = fs.readFileSync(twin, "utf8"), roto = original.replace("$clock - $marks[$i] >= $minutes", "$clock - $marks[$i] > $minutes");
assert(roto !== original, "La mutación encuentra el umbral");
const tmp = path.join(require("node:os").tmpdir(), "maintenance-roto-" + process.pid + ".php");
fs.writeFileSync(tmp, roto.replace(/require_once __DIR__ \. "\/([a-z-]+)\.php";/g, (_, f) => `require_once "${path.join(web, "src/game", f)}.php";`));
try {
  const mutado = php("require '" + tmp + "';");
  assert(JSON.stringify(mutado) !== JSON.stringify(dicho), "Un gemelo con el umbral corrido da otro resultado, y la prueba lo caza");
} finally { fs.unlinkSync(tmp); }
console.log("PASS forest overgrowth: " + casos.length + " casos de erosión por los extremos, nunca por el medio, retirada entera con menos de dos puntos, reloj de presencia, JS y PHP iguales y mutación del umbral detectada.");
