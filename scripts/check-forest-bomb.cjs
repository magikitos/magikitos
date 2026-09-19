"use strict";
/**
 * ⛔ LA BOMBITA SE RECHAZA DONDE HAY QUE RECHAZARLA (AUTOMANTENIMIENTO.md §B2): patrimonio, rincón
 * protegido, camino (`bombable: false`), ya minada y sin bombita en el saco. La mecha tiene tres
 * fases (armada, aviso a media hora, toca). El gemelo PHP dice lo mismo, con mutación negativa.
 */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const { bombReason, bombPhase, bombSpot } = require("../public/assets/js/adventure/maintenance");
const web = process.env.GAME_WEB_REPO || path.resolve("..", "magikitos");
const twin = path.join(web, "src/game/community-maintenance.php");
const construction = JSON.parse(fs.readFileSync("data/aventura/construction.json", "utf8"));
const defs = construction.definitions;
assert.equal(defs["forest-path"].bombable, false, "Los caminos no se bombardean: su regla es la hierba");
assert(Object.values(defs).filter((d) => d.bombable !== false).length >= 5, "Casi todo lo demás sí se puede volar");
assert(construction.bomb.fuseMs === 5 * 3600000 && construction.bomb.warningMs === 30 * 60000, "Cinco horas de mecha y aviso a media hora");
const zone = { protected: [[0, 0, 10, 10]] };
const banco = (extra = {}) => ({ id: "b", kind: "woodland-bench", variant: "ramitas", x: 30, y: 30, rotation: 0, revision: 1, heritage: false, ...extra });
const casos = [
  ["sin bombita en el saco", banco(), "woodland-bench", { hasBomb: false }, "bomb_required"],
  ["un camino no se vuela", { id: "p", kind: "forest-path", x: 30, y: 30, points: [[0, 0], [3, 0]], heritage: false }, "forest-path", {}, "not_bombable"],
  ["el patrimonio no se vuela", banco({ heritage: true }), "woodland-bench", {}, "heritage_protected"],
  ["ya tiene una puesta", banco({ bomb: { explodesAt: 1 } }), "woodland-bench", {}, "already_mined"],
  ["dentro de un rincón protegido", banco({ x: 5, y: 5 }), "woodland-bench", {}, "protected_access"],
  ["una valla también se vuela", { id: "f", kind: "twig-fence", x: 30, y: 30, points: [[0, 0], [3, 0]], heritage: false }, "twig-fence", {}, null],
  ["un banco libre: adelante", banco(), "woodland-bench", {}, null],
];
for (const [nombre, object, kind, opts, esperado] of casos)
  assert.equal(bombReason(object, defs[kind], zone, opts), esperado, nombre);
assert.equal(bombReason(null, defs["woodland-bench"], zone), "object_missing");
const T = construction.bomb;
assert.equal(bombPhase(0, T.fuseMs, T.warningMs), "armed");
assert.equal(bombPhase(T.fuseMs - T.warningMs, T.fuseMs, T.warningMs), "warning", "A media hora del final, aviso");
assert.equal(bombPhase(T.fuseMs - 1, T.fuseMs, T.warningMs), "warning");
assert.equal(bombPhase(T.fuseMs, T.fuseMs, T.warningMs), "due", "Cumplida la mecha, toca");
const spot = bombSpot(banco(), defs["woodland-bench"]);
assert(spot.x > 31 && spot.y === 30.5, "La bombita se apoya en la esquina inferior derecha de la pieza " + JSON.stringify(spot));

const php = (source) => JSON.parse(execFileSync("php", ["-r",
  source + "$d=json_decode(stream_get_contents(STDIN),true);$out=[];" +
  "foreach($d['casos'] as $c){$out[]=communityBombReason($c[1],$d['defs'][$c[2]],$d['zone'],!isset($c[3]['hasBomb'])||$c[3]['hasBomb']);}" +
  "$out[]=communityBombPhase(0,$d['T']['fuseMs'],$d['T']['warningMs']);$out[]=communityBombPhase($d['T']['fuseMs']-$d['T']['warningMs'],$d['T']['fuseMs'],$d['T']['warningMs']);$out[]=communityBombPhase($d['T']['fuseMs'],$d['T']['fuseMs'],$d['T']['warningMs']);" +
  "echo json_encode($out);"],
  { input: JSON.stringify({ casos: casos.map(([n, o, k, opts]) => [n, o, k, opts]), defs, zone, T }), encoding: "utf8" }));
const dicho = php("require '" + twin + "';");
casos.forEach(([nombre, , , , esperado], i) => assert.equal(dicho[i], esperado, "PHP: " + nombre));
assert.deepEqual(dicho.slice(casos.length), ["armed", "warning", "due"], "PHP: las tres fases de la mecha");
const original = fs.readFileSync(twin, "utf8"), roto = original.replace('if (($definition["bombable"] ?? true) === false) return "not_bombable";', "");
assert(roto !== original, "La mutación encuentra la regla del camino");
const tmp = path.join(require("node:os").tmpdir(), "bomb-roto-" + process.pid + ".php");
fs.writeFileSync(tmp, roto.replace(/require_once __DIR__ \. "\/([a-z-]+)\.php";/g, (_, f) => `require_once "${path.join(web, "src/game", f)}.php";`));
try {
  const mutado = php("require '" + tmp + "';");
  assert(JSON.stringify(mutado) !== JSON.stringify(dicho), "Un gemelo que deja volar caminos da otro veredicto, y la prueba lo caza");
} finally { fs.unlinkSync(tmp); }
console.log("PASS forest bomb: " + casos.length + " veredictos (patrimonio, protegido, camino, ya minada, sin bombita), tres fases de mecha, sitio de la bombita, JS y PHP iguales y mutación detectada.");
