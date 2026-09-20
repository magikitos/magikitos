"use strict";
/**
 * EL MUNDO CONTINUO SE COMPRUEBA SIN NAVEGADOR: el plano que sale de las salidas, las costuras
 * abiertas en el marco de cada pantalla, el enrutado de suelo y agua a la vecina, el disparo del
 * cruce pegado al borde y la cámara que recorre el plano. Ver `docs/MUNDO-CONTINUO.md`.
 */
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const {
  layoutScenes,
  seamsOf,
  frameOf,
  scenesIntersecting,
} = require("../public/assets/js/adventure/world-layout");
const { World, TILE } = require("../public/assets/js/adventure/model");
const { canFloat } = require("../public/assets/js/adventure/river-navigation");
const {
  crossingAt,
  crossingArrival,
  beyondEdge,
  ontoEdge,
  SEAM_TRIGGER,
} = require("../public/assets/js/adventure/crossings");
const { cameraLimits } = require("../public/assets/js/adventure/scene-frame");
const catalog = JSON.parse(fs.readFileSync(".local/build/world.json"));
const scenes = catalog.scenes;

// 1. El plano: sale de las salidas, sin conflictos ni solapes, y los interiores se quedan fuera.
const layout = layoutScenes(scenes, catalog.start);
assert.deepEqual(layout.conflicts, [], "Las salidas se ponen de acuerdo: " + JSON.stringify(layout.conflicts));
const at = (id) => layout.offsets.get(id);
assert.deepEqual(at("overworld"), { x: 0, y: 0 }, "La pradera es el origen");
assert.deepEqual(at("river-willows"), { x: 0, y: -144 }, "Los sauces, justo encima de la pradera");
assert.deepEqual(at("river-rapids"), { x: 0, y: -288 });
assert.deepEqual(at("river-roots"), { x: 0, y: -432 });
assert.deepEqual(at("human-hedge"), { x: 192, y: -432 }, "El jardín humano, a la derecha de las raíces");
for (const [id, s] of Object.entries(scenes))
  if (s.indoor) assert(!layout.offsets.has(id), id + " es interior y no entra en el plano");
assert.deepEqual(
  [layout.bounds.x0, layout.bounds.y0, layout.bounds.x1, layout.bounds.y1],
  [0, -432, 384, 144],
  "La caja del plano",
);
/**
 * ⛔ REJILLA PERFECTA (20-sep-2026, decisión del dueño: «todo el mundo sean escenarios del mismo
 * tamaño y encajen como una cuadrícula perfecta entre ellos, modular»). Toda pantalla exterior mide
 * la celda entera y cae en una celda exacta del plano: así no queda hueco entre pantallas que haya
 * que rellenar con césped de fondo, y una pantalla nueva solo puede entrar ocupando una celda.
 */
const CELL = { w: 192, h: 144 };
for (const [id, o] of layout.offsets) {
  const s = scenes[id];
  assert.deepEqual([s.width, s.height], [CELL.w, CELL.h], id + " mide una celda entera");
  assert(o.x % CELL.w === 0 && o.y % CELL.h === 0, id + " cae en una celda exacta: " + JSON.stringify(o));
}

// 2. Cada salida: la llegada está en el propio borde de destino, dentro de su banda, y las dos
//    pantallas coinciden en el punto del bosque salvo el paso mínimo del disparo.
let exits = 0;
for (const [id, s] of Object.entries(scenes))
  for (const exit of s.navigation?.exits || []) {
    exits++;
    const target = scenes[exit.scene],
      vertical = exit.direction === "up" || exit.direction === "down";
    const depth =
      exit.direction === "up" ? target.height - exit.position[1]
      : exit.direction === "down" ? exit.position[1]
      : exit.direction === "left" ? target.width - exit.position[0]
      : exit.position[0];
    assert(depth > 0 && depth <= SEAM_TRIGGER, `${id}/${exit.id}: la llegada está en el borde de destino (${depth})`);
    const [ax, ay, aw, ah] = exit.area;
    const half = (vertical ? aw : ah) / 2,
      along = (vertical ? ax : ay) + half + Math.min(3.7, half - 0.5); // descentrado, dentro de la banda
    const source = vertical
      ? { x: along * TILE, y: (exit.direction === "up" ? 0.3 : s.height - 0.3) * TILE }
      : { x: (exit.direction === "left" ? 0.3 : s.width - 0.3) * TILE, y: along * TILE };
    const arrival = crossingArrival(exit, source);
    const o = at(id),
      t = at(exit.scene);
    const gs = { x: o.x * TILE + source.x, y: o.y * TILE + source.y },
      ga = { x: t.x * TILE + arrival.x, y: t.y * TILE + arrival.y };
    const sideways = vertical ? Math.abs(gs.x - ga.x) : Math.abs(gs.y - ga.y),
      ahead = vertical ? Math.abs(gs.y - ga.y) : Math.abs(gs.x - ga.x);
    assert(sideways < 1e-6, `${id}/${exit.id}: al cruzar no se desvía de lado (${sideways} px)`);
    assert(ahead <= (SEAM_TRIGGER + 0.3) * TILE + 1e-6, `${id}/${exit.id}: el paso del cruce es de menos de una casilla (${ahead} px)`);
    // Y al otro lado hay una salida de vuelta que contiene la llegada: es la que se cierra al llegar.
    const mode = exit.mode === "both" ? "foot" : exit.mode || "boat";
    const back = crossingAt(target, arrival, mode, SEAM_TRIGGER, true);
    assert(back && back.scene === id, `${id}/${exit.id}: la llegada cae en la banda de vuelta hacia ${id}`);
  }
assert(exits >= 18, "Se han mirado todas las salidas: " + exits);

// 3. El marco se abre en las bandas a pie y sigue cerrado en el resto del borde.
const willows = new World(scenes["river-willows"]),
  rapids = new World(scenes["river-rapids"]);
assert(willows.terrainWalkable(159, 0) && willows.terrainWalkable(159, 1), "La banda del prado abre el marco de arriba");
assert(willows.terrainWalkable(81, 0) && willows.terrainWalkable(20, 0), "…y la del oeste, que ahora cubre todo el césped hasta el borde");
assert(!willows.terrainWalkable(191, 0) && !willows.terrainWalkable(0, 0), "Las esquinas del marco siguen cerradas");
assert(!willows.terrainWalkable(112, 0), "El río no se pisa aunque su banda esté abierta a la barca");
// Más allá del borde, sin vecina en memoria: la banda continúa y el resto es pared.
assert(willows.terrainWalkable(159, -1) && willows.terrainWalkable(159, -2), "La banda se da por continuada dos casillas");
assert(!willows.terrainWalkable(159, -3), "…y no más");
assert(!willows.terrainWalkable(1, -1) && !willows.terrainWalkable(191, -1), "Fuera de las bandas, más allá del borde, no hay suelo");
assert(willows.walkable(159, -1) === false, "El buscador de rutas no sale de la pantalla");

// 4. Enlazadas, las preguntas cruzan a la vecina en sus coordenadas.
const seams = seamsOf(scenes, layout.offsets, "river-willows");
assert.deepEqual(
  seams.map((s) => [s.scene, s.dx, s.dy, s.exits.length]).sort(),
  [["overworld", 0, 144, 3], ["river-rapids", 0, -144, 3]].sort(),
  "Una costura por vecina, con todas sus salidas: a la pradera se baja por el río y por dos pasos a pie (el césped del oeste y la orilla este)",
);
// La pradera y los sauces se pasan a pie por todo el borde compartido donde hay césped —a los dos
// lados del río— y por el río se rema por el agua entera, que desemboca en el lago de la pradera.
assert(willows.terrainWalkable(10, 143) && willows.terrainWalkable(74, 142) && willows.terrainWalkable(168, 143), "El césped de los sauces se abre hacia la pradera a los dos lados del río");
assert(willows.terrainWalkable(120, 143) === false, "…pero el agua no se pisa");
assert.equal(crossingAt(willows.data, { x: 10 * TILE, y: 143.95 * TILE }, "foot", SEAM_TRIGGER, true)?.id, "meadow-down");
assert.equal(crossingAt(willows.data, { x: 160 * TILE, y: 143.95 * TILE }, "foot", SEAM_TRIGGER, true)?.id, "meadow-down-bank");
assert(canFloat(willows, 124 * TILE, (144 - 0.3) * TILE), "La banda de barca flota hasta el borde por la derecha del cauce");
const overworld = new World(scenes.overworld);
assert(overworld.terrainWalkable(80, 0) && overworld.terrainWalkable(20, 1) && overworld.terrainWalkable(168, 0), "La pradera se abre hacia los sauces por todo el césped de arriba");
assert(!overworld.terrainWalkable(120, 0), "…y no por el agua");
assert(!overworld.terrainWalkable(0, 0) && !overworld.terrainWalkable(191, 60), "El marco sigue cerrado donde no hay vecina");
assert.equal(crossingAt(overworld.data, { x: 80 * TILE, y: 0.05 * TILE }, "foot", SEAM_TRIGGER, true)?.id, "meadow-up");
assert(canFloat(overworld, 120 * TILE, 0.3 * TILE), "La boca del lago flota hasta el borde de arriba");
// El lago es un lago: cerrado por el este y por el sur, así que fuera del plano solo hay césped.
assert(!overworld.waterAt(191.5, 60) && !overworld.waterAt(150, 143.5) && overworld.waterAt(150, 60), "El lago tiene orilla este y sur dentro de la pradera");
willows.link(seams.filter((s) => s.scene === "river-rapids").map((s) => ({ ...s, world: rapids })));
assert(willows.terrainWalkable(159, -1), "Con la vecina enlazada, su primera fila contesta");
assert(willows.terrainWalkable(159, -5) === rapids.terrainWalkable(159, 139), "…y cualquier casilla suya");
const beyond = willows.beyond({ x: 159 * TILE, y: -10 });
assert(beyond && beyond.world === rapids && beyond.x === 159 * TILE && beyond.y === 144 * TILE - 10, "Un punto de más allá se traduce a la vecina");
assert.equal(willows.beyond({ x: 159 * TILE, y: 200 * TILE }), null, "Sin vecina por abajo enlazada, no hay a dónde traducir");

// 5. El agua no acaba en el borde donde hay una salida a remo.
assert(canFloat(willows, 112 * TILE, (144 - 0.3) * TILE), "La barca llega al borde de abajo por la banda del río");
assert(canFloat(willows, 112 * TILE, 0.3 * TILE), "…y al de arriba");
assert(!canFloat(willows, 10 * TILE, (144 - 0.3) * TILE), "Fuera de la banda el margen del casco manda");
assert(canFloat(rapids, 112 * TILE, (144 - 0.3) * TILE), "El tramo de arriba abre su borde de abajo igual");

// 6. El disparo del cruce va pegado al borde, no en la zona autorada de tres casillas; y quien
//    se ha pasado del borde de un paso también cruza, recogido al borde.
assert.equal(crossingAt(willows.data, { x: 159 * TILE, y: 0.1 * TILE }, "foot", SEAM_TRIGGER, true)?.id, "meadow-up");
assert.equal(crossingAt(willows.data, { x: 159 * TILE, y: 0.5 * TILE }, "foot", SEAM_TRIGGER, true), null, "A media casilla del borde todavía no se cruza");
assert.equal(crossingAt(willows.data, { x: 159 * TILE, y: 1.5 * TILE }, "foot")?.id, "meadow-up", "El contrato del servidor conserva la zona autorada");
assert.equal(crossingAt(willows.data, { x: 112 * TILE, y: 0.1 * TILE }, "boat", SEAM_TRIGGER, true)?.id, "upstream");
assert.equal(beyondEdge(willows.data, { x: 159 * TILE, y: -0.7 * TILE }, "foot")?.id, "meadow-up", "Rebasado el borde dentro de la banda, se cruza igual");
assert.equal(beyondEdge(willows.data, { x: 112 * TILE, y: -0.7 * TILE }, "foot"), null, "…pero no por el agua");
assert.equal(beyondEdge(willows.data, { x: 159 * TILE, y: -2.5 * TILE }, "foot"), null, "…ni a más de dos casillas");
const upExit = willows.data.navigation.exits.find((e) => e.id === "meadow-up");
assert.deepEqual(ontoEdge(willows.data, upExit, { x: 159 * TILE, y: -7 }), { x: 159 * TILE, y: 0 }, "El origen se recoge al borde");

// 7. La cámara recorre el plano entero desde cualquier pantalla.
willows.frame = frameOf(layout, "river-willows");
assert.deepEqual(willows.frame, { x: 0, y: -288, w: 384, h: 576 });
const limits = cameraLimits(willows, { width: 400, height: 300 });
assert.deepEqual(limits.x, [0, 384 * TILE - 400]);
assert.deepEqual(limits.y, [-288 * TILE, -288 * TILE + 576 * TILE - 300]);
const lone = new World(scenes["overworld"]);
assert.deepEqual(cameraLimits(lone, { width: 400, height: 300 }).x, [0, 192 * TILE - 400], "Sin marco, la pantalla es el límite");

// 8. La precarga sabe qué pantallas toca la vista, las más cercanas primero.
const seen = scenesIntersecting(scenes, layout.offsets, "overworld", { x: 60 * TILE, y: -40 * TILE, width: 400, height: 300 }, 0);
assert.deepEqual(seen, ["river-willows"], "Mirando por encima del borde de arriba se ve el tramo de los sauces");
assert.deepEqual(
  scenesIntersecting(scenes, layout.offsets, "river-rapids", { x: 40 * TILE, y: -20 * TILE, width: 400, height: 200 * TILE }, 0).sort(),
  ["river-roots", "river-willows"],
  "Una vista alta toca los dos tramos vecinos y ninguno más",
);
assert.deepEqual(
  scenesIntersecting(scenes, layout.offsets, "river-rapids", { x: 40 * TILE, y: -20 * TILE, width: 400, height: 40 * TILE }, 0),
  ["river-roots"],
  "…y una vista que solo asoma por arriba toca solo el tramo de arriba",
);

console.log(
  `PASS mundo continuo: plano de ${layout.offsets.size} pantallas sin conflictos, ${exits} salidas con llegada en el borde y vuelta cerrada, costuras abiertas solo en sus bandas, suelo y agua enrutados a la vecina, disparo pegado al borde y cámara sobre el plano.`,
);
