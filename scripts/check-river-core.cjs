"use strict";
const assert = require("node:assert/strict"),
  cp = require("node:child_process");
const { World, TILE } = require("../public/assets/js/adventure/model");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { planReaction, active } = require("../public/assets/js/adventure/rules");
const {
  canFloat,
  currentAt,
  VesselMotion,
  HULL_RADIUS,
  riverBodyAt,
  yieldToRiverBodies,
} = require("../public/assets/js/adventure/river-navigation");
const {
  riverBodies,
  riverVisitors,
} = require("../public/assets/js/adventure/river-life");
const { inRect } = require("../public/assets/js/adventure/geometry");
const {
  MODES,
  crossingAt,
  crossingArrival,
} = require("../public/assets/js/adventure/crossings");
const { riverSection } = require("../public/assets/js/adventure/river-course");
const {
  docks,
  atDock,
  enteringDock,
  dockPath,
} = require("../public/assets/js/adventure/docks");
const catalog = JSON.parse(
  cp.execFileSync("php", [
    "-r",
    'echo json_encode(require "data/aventura/world.php");',
  ]),
);
let checks = 0;
const check = (ok, message) => {
  assert(ok, message);
  checks++;
};
for (const data of Object.values(catalog.scenes)) {
  if (!data.navigation) continue;
  const world = new World(data);
  for (const dock of docks(data)) {
    check(
      world.canStand(dock.dry.x, dock.dry.y),
      `${data.id}/${dock.id} safe jetty tip`,
    );
    const outward = dock.outward,
      inward = { x: -outward.x, y: -outward.y };
    const side = { x: -outward.y, y: outward.x };
    for (const [mode, point, intent] of [
      ["foot", dock.dry, outward],
      ["boat", dock.wet, inward],
    ]) {
      check(atDock(dock, point, mode), "Tip lies in its crossing");
      check(enteringDock(dock, point, intent, mode), "Intentional crossing");
      check(!enteringDock(dock, point, null, mode), "Idle does not board/land");
      check(
        !enteringDock(dock, point, side, mode),
        "Sideways does not board/land",
      );
      check(
        !enteringDock(dock, point, { x: -intent.x, y: -intent.y }, mode),
        "Moving away does not board/land",
      );
    }
    const start = { x: dock.land[0] * TILE, y: dock.land[1] * TILE };
    const path = dockPath(world, start, dock);
    check(path?.length, `${data.id}/${dock.id} reachable click approach`);
    assert.deepEqual(path.at(-1), dock.dry);
    const delta = {
      x: path.at(-1).x - path.at(-2).x,
      y: path.at(-1).y - path.at(-2).y,
    };
    check(
      enteringDock(dock, dock.dry, delta, "foot"),
      "Final pointer leg crosses straight, not sideways",
    );
  }
  for (const landing of data.navigation.landings) {
    check(
      world.canStand(...landing.land.map((n) => n * TILE)),
      `${data.id}/${landing.id} dry landing`,
    );
    check(
      canFloat(world, ...landing.water.map((n) => n * TILE)),
      `${data.id}/${landing.id} whole-hull clearance`,
    );
    check(
      !canFloat(world, ...landing.land.map((n) => n * TILE)),
      "Boat cannot go onto the jetty",
    );
  }
  // Solo a las salidas por AGUA se les pide que el otro lado flote; las de tierra tienen su
  // propio barrido más abajo, donde lo que se les pide es suelo firme.
  for (const exit of data.navigation.exits.filter(
    (e) => (e.mode || "boat") !== "foot",
  ))
    check(
      canFloat(
        new World(catalog.scenes[exit.scene]),
        ...exit.position.map((n) => n * TILE),
      ),
      `${data.id}/${exit.id} safe destination`,
    );
}
const world = new World(catalog.scenes.overworld),
  state = cleanSave(null, catalog);
// Quien tiene barca la ve amarrada en el embarcadero donde la dejó, y en uno solo. Desde el
// recorte del mapa cada escena tiene UN amarre, así que el filtro por amarre solo se escribe
// donde hay más de uno: comprobamos las dos mitades de esa regla, porque el día que vuelva a
// haber dos muelles en una pantalla es cuando una barca podría duplicarse.
const parked = { ...state, inventory: { boat: 1 } };
for (const data of Object.values(catalog.scenes).filter(
  (s) => s.navigation?.landings?.length,
)) {
  const moored = new World(data).entities.filter(
    (e) => e.generated === "landing-vessel" && active(e, parked),
  );
  check(
    moored.length === data.navigation.landings.length &&
      moored.length === 1,
    `${data.id}: one owned boat, moored at its own jetty`,
  );
  check(
    data.navigation.landings.length === 1,
    `${data.id}: a second jetty would need the landing filter back`,
  );
}
for (const data of Object.values(catalog.scenes).filter((s) =>
  s.id.startsWith("river-"),
)) {
  const river = data.rivers[0],
    model = new World(data),
    vessel = new VesselMotion();
  const player = {
    x: (riverSection(river, data.height - 6).left + 3) * TILE,
    y: (data.height - 6) * TILE,
    direction: "up",
  };
  /* La ruta sube por el remanso de la orilla oeste MIENTRAS haya agua donde quepa el casco.
     Las raíces viejas cierran el río en su nacimiento (17-sep-2026): allí arriba las dos
     orillas se juntan, así que pedir que la barca llegue a y=3 sería pedirle que reme por la
     hierba. Se rema hasta donde el río llega, que es lo que de verdad se comprueba aquí. */
  const route = [];
  for (let y = data.height - 8; y >= 3; y -= 2) {
    const point = { x: (riverSection(river, y).left + 3) * TILE, y: y * TILE };
    if (!canFloat(model, point.x, point.y)) break;
    route.push(point);
  }
  check(route.length > 4, `${data.id}: the river is long enough to row up`);
  let index = 0;
  for (let frame = 0; frame < 60 * 60 && index < route.length; frame++) {
    const point = route[index];
    if (Math.hypot(point.x - player.x, point.y - player.y) < 8) {
      index++;
      continue;
    }
    vessel.step(
      model,
      player,
      { x: point.x - player.x, y: point.y - player.y },
      1 / 60,
    );
  }
  check(
    index === route.length,
    `${data.id}: a navigable upstream eddy route bypasses the strong current`,
  );
}
const apply = (name, action = "interact") => {
  const entity = world.entities.find((e) => e.id === name);
  const plan = planReaction(entity, state, catalog, { action });
  if (plan) Object.assign(state, plan.state);
  return plan;
};
check(!apply("picnic-bin"), "No litter bottle before picnic leaves");
apply("picnic-knife");
apply("picnic-twig");
apply("picnic-twigs");
apply("leaves-clearing");
apply("leaves-clearing");
check(
  state.inventory.twig === 2 && state.inventory.leaf === 1,
  "Separate pickups stack and a recovering plant cannot be harvested twice",
);
check(!apply("river-dock", "craft"), "Oars must first be earned");
apply("picnic-lighter");
apply("forest-mushrooms-fern");
apply("picnic-barbecue", "light");
apply("picnic-barbecue", "cook");
apply("picnic-bin");
apply("picnic-neighbor", "give");
const recipe = apply("river-dock", "craft");
check(
  recipe && state.inventory.boat === 1 && state.inventory.knife === 1,
  "Craft retains the knife",
);
check(
  !state.inventory.bottle &&
    state.inventory.twig === 1 &&
    state.inventory.leaf === 1 &&
    state.inventory.oars === 1,
  "Boat only consumes the bottle; oars and knife are reusable",
);
check(
  state.flags.picnicFed && state.wallet.balance === 0,
  "Brizno hands over his oars and nothing else: the game mints no setines",
);
check(!apply("river-dock", "board"), "Boarding has no dialogue/button action");
check(
  !world.entities.some((e) => e.id === "lake-ferryman"),
  "Brizno replaces the redundant ferryman",
);
check(!apply("river-dock", "craft"), "Cannot craft a duplicate boat");
state.flags.skewerCooked = true;
check(
  !active(
    world.entities.find((e) => e.id === "human-smoker"),
    state,
  ),
  "Humans leave once skewer is made",
);
const leftover = cleanSave(
  { ...state, inventory: {}, flags: { skewerCooked: true } },
  catalog,
);
check(
  planReaction(
    world.entities.find((e) => e.id === "picnic-bin"),
    leftover,
    catalog,
  ).state.inventory.bottle === 1,
  "Bottle remains obtainable after humans leave",
);
// Una partida guardada en una pantalla que ya no existe (el islote, los juncos, las kelihouses)
// no se pierde: cae al arranque con lo suyo intacto. Es lo único que hace seguro recortar el
// mapa, y por eso se comprueba con lo que la persona lleva encima y con su monedero.
const recovery = cleanSave(
  {
    scene: "islet",
    position: { x: 170, y: 410 },
    inventory: { knife: 1 },
    wallet: { balance: 17, claimed: { picnic: true } },
  },
  catalog,
);
check(
  recovery.scene === catalog.start &&
    recovery.inventory.knife === 1 &&
    recovery.wallet.balance === 17,
  "A save left on a retired screen wakes up at the start, carrying everything",
);
const ocean = new World({
  id: "water-test",
  width: 80,
  height: 80,
  seed: 1,
  baseWater: true,
  islands: [],
  waters: [],
  rivers: [],
  bridges: [],
  paths: [],
  clearings: [],
  entities: [],
  scenery: [],
  regions: [],
  navigation: { currents: [] },
});
check(
  !canFloat(ocean, HULL_RADIUS - 1, 100),
  "Whole hull stays inside the world",
);
const endpoints = [];
for (const fps of [30, 60, 120]) {
  const motion = new VesselMotion(),
    player = { x: 400, y: 400, direction: "down" };
  for (let i = 0; i < fps * 3; i++)
    motion.step(ocean, player, { x: 1, y: -1 }, 1 / fps);
  endpoints.push(player);
  check(player.direction === "up-right", "Eight-direction rowing");
  check(canFloat(ocean, player.x, player.y), "Movement remains legal");
}
check(
  Math.hypot(endpoints[0].x - endpoints[2].x, endpoints[0].y - endpoints[2].y) <
    2,
  "Frame-rate-independent travel",
);
ocean.data.navigation.currents = [{ area: [40, 40, 30, 30], vector: [0, 120] }];
const swept = { x: 640, y: 500, direction: "up" },
  motion = new VesselMotion();
for (let i = 0; i < 120; i++)
  motion.step(ocean, swept, { x: 0, y: -1 }, 1 / 60);
check(
  swept.y > 500,
  "Strong current pushes back against rowing; no health loss",
);
check(
  !("health" in state) && !catalog.economy.fares.lake,
  "No damage or ticket economy",
);
const persisted = cleanSave(
  {
    ...state,
    scene: "river-willows",
    position: { x: 48 * 16, y: 60 * 16 },
    navigation: { mode: "boat", direction: "up" },
  },
  catalog,
);
check(
  persisted.navigation.mode === "boat",
  "Reload preserves legal boating position",
);
const {
  drawCurrentTraces,
} = require("../public/assets/js/adventure/current-traces");
const rapids = new World(catalog.scenes["river-rapids"]);
const starts = [];
const ctx = {
  beginPath() {},
  stroke() {},
  lineTo() {},
  quadraticCurveTo() {},
  moveTo(x, y) {
    starts.push([x, y]);
  },
};
drawCurrentTraces(
  ctx,
  rapids,
  { x: 0, y: 0 },
  { width: rapids.width * TILE, height: rapids.height * TILE },
  2.3,
);
check(
  starts.length > 70 && starts.length <= 384,
  "Visible foam is plentiful but bounded",
);
const swift = starts.filter(
  ([x, y]) => Math.hypot(...Object.values(currentAt(rapids.data, x, y))) > 55,
);
check(swift.length > 45, "Foam coincides with strong meandering currents");
check(
  Math.max(...swift.map((p) => p[1])) - Math.min(...swift.map((p) => p[1])) >
    700,
  "Tracers span the rapids, not a tiny patch at the ellipse centre",
);
starts.length = 0;
drawCurrentTraces(
  ctx,
  rapids,
  { x: -5000, y: -5000 },
  { width: 100, height: 100 },
  2.3,
);
check(starts.length === 0, "No off-screen current rendering");

/**
 * ⛔ EL BORDE DEL MAPA Y LA BANDA DE SALIDA TIENEN QUE LLEGAR AL MISMO SITIO.
 *
 * Las bandas van dibujadas en tiles y el casco se planta a HULL_RADIUS del borde, así que había
 * un carril de 0,175 tiles donde la barca estaba pegada al final del río y no pasaba nada: agua
 * delante, borde detrás y el juego mudo. Le ocurría a todas las salidas de aguas abajo, a las de
 * la izquierda y a la del islote. Esto barre CADA salida punto por punto: donde la barca flote
 * pegada a ese borde, la salida tiene que dispararse.
 */
{
  const afloat = {
    inventory: { boat: 1 },
    flags: {},
    timers: {},
    wallet: { balance: 0, claimed: {} },
    navigation: { mode: "boat" },
  };
  /* Cuántas salidas por AGUA hay en el mundo, contadas aparte del barrido. No es una cifra a
     mano —el mapa se recorta y se amplía— pero tampoco es una tautología: lo que vigila es que
     el barrido no se salte ninguna por un `continue`, que es como se apagaría sin avisar. Las
     que solo se cruzan a pie tienen su propio barrido y aquí no pintan nada. */
  // ⛔ UN MODO INVENTADO NO SE CRUZA POR NINGÚN LADO. `crossingAt` filtra por el modo que le
  // pidan, así que una salida con `mode: "nadando"` no falla: simplemente no existe para nadie,
  // y ese borde queda mudo sin que nada lo diga. Los modos válidos son los dos de la casa más
  // «both», y esa lista vive en el módulo, no aquí.
  for (const [id, data] of Object.entries(catalog.scenes))
    for (const exit of data.navigation?.exits || [])
      check(
        [...MODES, "both"].includes(exit.mode || "boat"),
        id + "/" + exit.id + ": modo de cruce desconocido (" + exit.mode + ")",
      );
  const porAgua = Object.values(catalog.scenes).reduce(
    (n, data) =>
      n +
      (data.navigation?.exits || []).filter((e) => (e.mode || "boat") !== "foot")
        .length,
    0,
  );
  let bordes = 0;
  for (const [id, data] of Object.entries(catalog.scenes)) {
    const exits = (data.navigation?.exits || []).filter(
      (e) => (e.mode || "boat") !== "foot",
    );
    if (!exits.length) continue;
    const world = new World(data);
    world.actors = [];
    world.refresh(afloat);
    for (const exit of exits) {
      const vertical = exit.direction === "up" || exit.direction === "down";
      const fixed =
        exit.direction === "up" || exit.direction === "left"
          ? HULL_RADIUS
          : (vertical ? data.height : data.width) * TILE - HULL_RADIUS;
      const span = (vertical ? data.width : data.height) * 4;
      let tocados = 0;
      for (let step = 0; step <= span; step++) {
        const along = (step / 4) * TILE;
        const point = vertical ? { x: along, y: fixed } : { x: fixed, y: along };
        if (!canFloat(world, point.x, point.y)) continue;
        // Solo se exige la salida donde su propia banda alcanza: la boca del río del bosque son
        // sus columnas y no el lago entero, que también moja el borde de arriba.
        const [ax, ay, aw, ah] = exit.area;
        const [from, to] = vertical ? [ax, ax + aw] : [ay, ay + ah];
        const hull = HULL_RADIUS / TILE;
        if (along / TILE < from - hull || along / TILE > to + hull) continue;
        tocados++;
        check(
          crossingAt(data, point, "boat")?.id === exit.id,
          id + "/" + exit.id + ": pegado al borde en " + (along / TILE).toFixed(2) + " y sin salida",
        );
      }
      check(tocados > 0, id + "/" + exit.id + ": ni un punto flotable en su borde");
      bordes++;
      // Y el punto de llegada conserva por dónde ibas, sin salirse nunca de lo ancha que es la
      // banda: cruzar pegado a una orilla y aparecer en el centro es lo que se siente como que
      // las dos pantallas no encajan.
      const [ax, ay, aw, ah] = exit.area;
      const half = (vertical ? aw : ah) / 2;
      for (const drift of [-99, -half / 2, 0, half / 2, 99]) {
        const player = vertical
          ? { x: (ax + half + drift) * TILE, y: fixed }
          : { x: fixed, y: (ay + half + drift) * TILE };
        const arrival = crossingArrival(exit, player);
        const moved = vertical
          ? arrival.x / TILE - exit.position[0]
          : arrival.y / TILE - exit.position[1];
        check(
          Math.abs(moved) <= half + 1e-9,
          id + "/" + exit.id + ": la llegada se sale de la banda (" + moved + ")",
        );
        check(
          Math.abs(moved - Math.max(-half, Math.min(half, drift))) < 1e-9,
          id + "/" + exit.id + ": la llegada no conserva el rumbo",
        );
        const fija = vertical ? arrival.y / TILE : arrival.x / TILE;
        check(
          fija === exit.position[vertical ? 1 : 0],
          id + "/" + exit.id + ": la llegada se ha movido a lo largo del río",
        );
      }
    }
  }
/**
 * ⛔ Y LO MISMO A PIE, QUE ES LA OTRA MITAD DE LA COSTURA (17-sep-2026).
 *
 * Por el río se sube remando y por la pradera se sube andando, y las dos tienen que llegar a la
 * misma pantalla sin un solo punto muerto. Aquí no vale el truco de «pegado al borde»: entre lo
 * andable y el borde del mapa hay dos tiles de margen, así que lo que manda es la BANDA, y la
 * banda tiene que cubrir toda la franja por la que de verdad se puede llegar.
 *
 * Se barre columna a columna: donde se pueda plantar el pie lo más cerca del borde, la salida
 * tiene que dispararse, y el sitio donde aparece al otro lado tiene que ser suelo firme para
 * CUALQUIER desvío, porque el desvío se conserva al cruzar.
 */
{
  const state = cleanSave(null, catalog);
  let aPie = 0;
  for (const [id, data] of Object.entries(catalog.scenes)) {
    const world = new World(data);
    world.refresh(state);
    for (const exit of (data.navigation?.exits || []).filter(
      (e) => e.mode === "foot" || e.mode === "both",
    )) {
      const vertical = exit.direction === "up" || exit.direction === "down";
      check(vertical, id + "/" + exit.id + ": las costuras a pie son de arriba o de abajo");
      const arriba = exit.direction === "up";
      const [ax, ay, aw, ah] = exit.area;
      const destino = new World(catalog.scenes[exit.scene]);
      destino.refresh(state);
      let pisadas = 0;
      for (let along = ax; along <= ax + aw; along += 0.25) {
        // El pie más adelantado de esa columna: se entra desde el borde hacia dentro.
        let borde = null;
        for (let d = 0; d <= 8; d += 0.05) {
          const y = arriba ? d : data.height - d;
          if (world.canStand(along * TILE, y * TILE)) {
            borde = y;
            break;
          }
        }
        if (borde === null) continue;
        pisadas++;
        const point = { x: along * TILE, y: borde * TILE };
        check(
          crossingAt(data, point, "foot")?.id === exit.id,
          id + "/" + exit.id + ": se llega al borde en " + along.toFixed(2) + " y no pasa nada",
        );
        // Y donde aparece, se aguanta de pie.
        const arrival = crossingArrival(exit, point);
        check(
          destino.canStand(arrival.x, arrival.y),
          id + "/" + exit.id + ": la llegada en " + (arrival.x / TILE).toFixed(2) + " no es suelo",
        );
        // Sin rebotar: la banda de vuelta no puede alcanzar el sitio donde acabas de aparecer.
        check(
          crossingAt(catalog.scenes[exit.scene], arrival, "foot")?.direction !==
            (arriba ? "down" : "up"),
          id + "/" + exit.id + ": la llegada cae dentro de la costura de vuelta",
        );
      }
      check(pisadas > 0, id + "/" + exit.id + ": ni un punto pisable en su banda");
      aPie++;
    }
  }
  check(aPie === 8, "Ocho costuras a pie entre las tres pantallas del río, no " + aPie);
}

  check(porAgua > 0, "Hay salidas por agua que barrer");
  check(
    bordes === porAgua,
    "Barridas todas las salidas por agua (" + bordes + " de " + porAgua + ")",
  );
}

/**
 * ⛔ EL RÍO ES DE TODOS: los otros duendes y el corcho de quien pesca son cuerpos, no decorado.
 *
 * Se comprueba con el MISMO reloj con el que se dibujan, que es lo único que garantiza que el
 * choque cae donde se ve a alguien. Y se comprueba que un cuerpo que ya te envuelve NO te
 * encierra: sin eso, llegar a una pantalla justo donde pasa una cáscara de nuez te dejaba sin
 * poder remar hasta que se fuera.
 */
{
  const data = catalog.scenes["river-willows"];
  const world = new World(data);
  world.actors = [];
  world.refresh({
    inventory: { boat: 1 },
    flags: {},
    timers: {},
    wallet: { balance: 0, claimed: {} },
    navigation: { mode: "boat" },
  });
  const time = 7.5;
  const bodies = riverBodies(data, time);
  check(bodies.length >= 2, "El tramo tiene vecino que rema y alguien pescando");
  for (const body of bodies)
    check(body.bump === "riverBump", "Cada cuerpo trae su propia queja: " + body.id);
  const rower = bodies.find((b) => b.id.endsWith("-rower"));
  const float = bodies.find((b) => b.id.endsWith("-angler"));
  check(!!rower && !!float, "Los dos cuerpos del tramo");
  // El vecino que rema está donde el renderizador lo pinta, al mismo tiempo.
  const drawn = riverVisitors(data, time).find((v) => v.id === rower.id);
  check(drawn.x === rower.x && drawn.y === rower.y, "Chocar y dibujar leen el mismo reloj");
  world.riverBodies = bodies;
  check(!canFloat(world, rower.x, rower.y), "No se rema por encima de un vecino");
  check(
    !canFloat(world, rower.x + rower.radius + HULL_RADIUS - 2, rower.y),
    "Ni rozándolo",
  );
  check(
    canFloat(world, rower.x + rower.radius + HULL_RADIUS + 2, rower.y) ||
      !canFloat({ ...world, riverBodies: [] }, rower.x + rower.radius + HULL_RADIUS + 2, rower.y),
    "Un palmo más allá el agua vuelve a ser agua",
  );
  check(riverBodyAt(world, rower.x, rower.y)?.id === rower.id, "Y se sabe con quién chocas");
  check(
    riverBodyAt(world, rower.x, rower.y, { x: rower.x, y: rower.y }) === null,
    "Quien ya te envuelve no te encierra",
  );
  check(
    canFloat(world, rower.x, rower.y, { x: rower.x, y: rower.y }),
    "Y se puede salir de dentro de un cuerpo remando",
  );
  // Sin cuerpos, el mismo sitio flota: lo que bloquea es el vecino, no la orilla.
  check(canFloat({ ...world, riverBodies: [] }, rower.x, rower.y), "El canal está libre sin él");
  // Y remar contra él apunta a quién fue, una sola vez.
  const motion = new VesselMotion();
  const player = { x: rower.x - rower.radius - HULL_RADIUS - 6, y: rower.y, direction: "right" };
  for (let i = 0; i < 40; i++)
    motion.step(world, player, { x: 1, y: 0 }, 1 / 60, false);
  const bump = motion.takeBump();
  check(bump?.id === rower.id, "Remando contra el vecino, el vecino contesta");
  check(motion.takeBump() === null, "Y la queja se consume al leerla");
  check(
    player.x < rower.x - rower.radius,
    "La barca se queda fuera de su casco por mucho que se empuje",
  );
  // Y al revés: quien te alcanza con la barca parada tampoco te pasa por encima.
  const parked = { x: rower.x + 2, y: rower.y + 1, direction: "down" };
  const quien = yieldToRiverBodies(world, parked, 1 / 60);
  check(quien?.id === rower.id, "Un vecino encima aparta la barca y dice quién fue");
  let apartado = parked;
  for (let i = 0; i < 400; i++) yieldToRiverBodies(world, apartado, 1 / 60);
  check(
    Math.hypot(apartado.x - rower.x, apartado.y - rower.y) >= rower.radius + HULL_RADIUS - 0.5,
    "Apartarse termina fuera de su casco, no a mitad de camino",
  );
  check(canFloat(world, apartado.x, apartado.y), "Y siempre sobre agua");
  check(
    yieldToRiverBodies(world, { x: apartado.x, y: apartado.y }, 1 / 60) === null,
    "Fuera de todo cuerpo no hay nada que apartar",
  );
}

console.log(`${checks} river, recipe, geometry, current and save checks PASS`);
