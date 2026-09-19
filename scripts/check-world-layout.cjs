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
assert.deepEqual(at("river-willows"), { x: 64, y: -144 }, "Los sauces, encima de la boca del río");
assert.deepEqual(at("river-rapids"), { x: 64, y: -288 });
assert.deepEqual(at("river-roots"), { x: 64, y: -432 });
assert.deepEqual(at("human-hedge"), { x: 192, y: -432 }, "El jardín humano, a la derecha de las raíces");
for (const [id, s] of Object.entries(scenes))
  if (s.indoor) assert(!layout.offsets.has(id), id + " es interior y no entra en el plano");
assert.deepEqual(
  [layout.bounds.x0, layout.bounds.y0, layout.bounds.x1, layout.bounds.y1],
  [0, -432, 320, 112],
  "La caja del plano",
);

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
assert(willows.terrainWalkable(95, 0) && willows.terrainWalkable(95, 1), "La banda del prado abre el marco de arriba");
assert(willows.terrainWalkable(17, 0), "…y la del oeste");
assert(!willows.terrainWalkable(130, 0), "Fuera de las bandas el marco sigue cerrado");
assert(!willows.terrainWalkable(48, 0), "El río no se pisa aunque su banda esté abierta a la barca");
// Más allá del borde, sin vecina en memoria: la banda continúa y el resto es pared.
assert(willows.terrainWalkable(95, -1) && willows.terrainWalkable(95, -2), "La banda se da por continuada dos casillas");
assert(!willows.terrainWalkable(95, -3), "…y no más");
assert(!willows.terrainWalkable(130, -1), "Fuera de la banda, más allá del borde, no hay suelo");
assert(willows.walkable(95, -1) === false, "El buscador de rutas no sale de la pantalla");

// 4. Enlazadas, las preguntas cruzan a la vecina en sus coordenadas.
const seams = seamsOf(scenes, layout.offsets, "river-willows");
assert.deepEqual(
  seams.map((s) => [s.scene, s.dx, s.dy, s.exits.length]).sort(),
  [["overworld", -64, 144, 3], ["river-rapids", 0, -144, 3]].sort(),
  "Una costura por vecina, con todas sus salidas: a la pradera se baja por el río y por dos pasos a pie",
);
// La pradera y los sauces se pasan a pie por todo el borde compartido donde hay césped, y por el
// río se rema por el agua entera, que en las últimas filas de los sauces se abre hasta el lago.
assert(willows.terrainWalkable(10, 143) && willows.terrainWalkable(10, 142), "El prado de los sauces se abre hacia la pradera");
assert(willows.terrainWalkable(70, 143) === false, "…pero el agua del abanico no se pisa");
assert.equal(crossingAt(willows.data, { x: 10 * TILE, y: 143.95 * TILE }, "foot", SEAM_TRIGGER, true)?.id, "meadow-down");
assert(canFloat(willows, 60 * TILE, (144 - 0.3) * TILE), "La banda de barca ensanchada flota hasta el borde por la derecha del cauce");
const overworld = new World(scenes.overworld);
assert(overworld.terrainWalkable(80, 0) && overworld.terrainWalkable(80, 1), "La pradera se abre hacia los sauces por arriba");
assert(!overworld.terrainWalkable(20, 0), "…y no fuera del borde compartido");
assert.equal(crossingAt(overworld.data, { x: 80 * TILE, y: 0.05 * TILE }, "foot", SEAM_TRIGGER, true)?.id, "meadow-up");
assert(canFloat(overworld, 120 * TILE, 0.3 * TILE), "La boca del lago flota hasta el borde de arriba");
willows.link(seams.filter((s) => s.scene === "river-rapids").map((s) => ({ ...s, world: rapids })));
assert(willows.terrainWalkable(95, -1), "Con la vecina enlazada, su primera fila contesta");
assert(willows.terrainWalkable(95, -5) === rapids.terrainWalkable(95, 139), "…y cualquier casilla suya");
const beyond = willows.beyond({ x: 95 * TILE, y: -10 });
assert(beyond && beyond.world === rapids && beyond.x === 95 * TILE && beyond.y === 144 * TILE - 10, "Un punto de más allá se traduce a la vecina");
assert.equal(willows.beyond({ x: 95 * TILE, y: 200 * TILE }), null, "Sin vecina por abajo enlazada, no hay a dónde traducir");

// 5. El agua no acaba en el borde donde hay una salida a remo.
assert(canFloat(willows, 48 * TILE, (144 - 0.3) * TILE), "La barca llega al borde de abajo por la banda del río");
assert(canFloat(willows, 48 * TILE, 0.3 * TILE), "…y al de arriba");
assert(!canFloat(willows, 10 * TILE, (144 - 0.3) * TILE), "Fuera de la banda el margen del casco manda");
assert(canFloat(rapids, 48 * TILE, (144 - 0.3) * TILE), "El tramo de arriba abre su borde de abajo igual");

// 6. El disparo del cruce va pegado al borde, no en la zona autorada de tres casillas; y quien
//    se ha pasado del borde de un paso también cruza, recogido al borde.
assert.equal(crossingAt(willows.data, { x: 95 * TILE, y: 0.1 * TILE }, "foot", SEAM_TRIGGER, true)?.id, "meadow-up");
assert.equal(crossingAt(willows.data, { x: 95 * TILE, y: 0.5 * TILE }, "foot", SEAM_TRIGGER, true), null, "A media casilla del borde todavía no se cruza");
assert.equal(crossingAt(willows.data, { x: 95 * TILE, y: 1.5 * TILE }, "foot")?.id, "meadow-up", "El contrato del servidor conserva la zona autorada");
assert.equal(crossingAt(willows.data, { x: 48 * TILE, y: 0.1 * TILE }, "boat", SEAM_TRIGGER, true)?.id, "upstream");
assert.equal(beyondEdge(willows.data, { x: 95 * TILE, y: -0.7 * TILE }, "foot")?.id, "meadow-up", "Rebasado el borde dentro de la banda, se cruza igual");
assert.equal(beyondEdge(willows.data, { x: 130 * TILE, y: -0.7 * TILE }, "foot"), null, "…pero no fuera de la banda");
assert.equal(beyondEdge(willows.data, { x: 95 * TILE, y: -2.5 * TILE }, "foot"), null, "…ni a más de dos casillas");
const upExit = willows.data.navigation.exits.find((e) => e.id === "meadow-up");
assert.deepEqual(ontoEdge(willows.data, upExit, { x: 95 * TILE, y: -7 }), { x: 95 * TILE, y: 0 }, "El origen se recoge al borde");

// 7. La cámara recorre el plano entero desde cualquier pantalla.
willows.frame = frameOf(layout, "river-willows");
assert.deepEqual(willows.frame, { x: -64, y: -288, w: 320, h: 544 });
const limits = cameraLimits(willows, { width: 400, height: 300 });
assert.deepEqual(limits.x, [-64 * TILE, -64 * TILE + 320 * TILE - 400]);
assert.deepEqual(limits.y, [-288 * TILE, -288 * TILE + 544 * TILE - 300]);
const lone = new World(scenes["overworld"]);
assert.deepEqual(cameraLimits(lone, { width: 400, height: 300 }).x, [0, 144 * TILE - 400], "Sin marco, la pantalla es el límite");

// 8. La precarga sabe qué pantallas toca la vista, las más cercanas primero.
const seen = scenesIntersecting(scenes, layout.offsets, "overworld", { x: 60 * TILE, y: -40 * TILE, width: 400, height: 300 }, 0);
assert.deepEqual(seen, ["river-willows"], "Mirando por encima de la boca del río se ve el tramo de los sauces");
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
