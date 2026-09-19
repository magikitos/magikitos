"use strict";
/**
 * CRUZAR POR UN BORDE DEL MAPA.
 *
 * Hay dos formas de cambiar de pantalla y son distintas por buenas razones. Una PUERTA es una
 * entidad con reglas: puede pedirte algo, tiene animación y recuerda por dónde entraste para
 * devolverte ahí; vive en el sistema de reglas y ahí se queda. Un BORDE es geometría pura: no hay
 * entidad, no hay regla, solo estás pegado a este lado del mapa. Esto es lo segundo.
 *
 * ⛔ Y ES UNA SOLA PIEZA PARA LAS DOS FORMAS DE MOVERSE (17-sep-2026). Hasta hoy los bordes vivían
 * DENTRO de la física de la barca, mezclados con remos y corrientes, así que poder cruzar también
 * a pie habría sido un segundo camino con su propio manejo de errores y su propio aviso. Cada
 * salida declara por qué modo se cruza (`foot`, `boat` o los dos) y el bucle de andar y el de
 * remar preguntan lo mismo.
 *
 * ⛔ Y DESDE EL 19-SEP-2026 EL CRUCE NO SE VE (mundo continuo, decisión del dueño). Las pantallas
 * exteriores están pegadas en un plano (`world-layout.js`), las llegadas de los datos están en el
 * propio borde, la cámara viaja con el duende y la salida de vuelta queda cerrada hasta salir de
 * su banda. Lo que cambia por dentro —mundo, escena guardada, presencia— sigue cambiando; lo que
 * se ve es el mismo bosque.
 */
const { TILE, inRect, clamp } = require("./geometry");

/** Lo que el casco de la barca se deja de margen con el borde; a pie no hay margen que valga. */
const { HULL_RADIUS } = require("./river-navigation");

const MODES = Object.freeze(["foot", "boat"]);
const crosses = (exit, mode) => (exit.mode || "boat") === mode || exit.mode === "both";
/** El margen que se le da al borde en la banda: lo que el cuerpo se deja al pegarse a él. */
const marginFor = (mode) => (mode === "boat" ? HULL_RADIUS : TILE / 2) / TILE;
/**
 * ⛔ EL DISPARO DEL CRUCE ES FINO A PROPÓSITO: 0,15 casillas (2,4 px) del borde para los dos
 * modos. Cuanto más tarde se dispare, más pequeño es el paso entre donde estabas y donde apareces
 * (la llegada está a 0,1 casillas del borde de destino): medido, unos cuatro píxeles, menos de lo
 * que se anda en un fotograma corriendo. Con la costura abierta el casco ya puede llegar hasta ahí.
 * El contrato del servidor conserva el margen ancho de `crossingAreas`, así que lo que dispara el
 * cliente cae siempre dentro de lo que el servidor admite.
 *
 * Y como un paso puede saltarse una banda tan fina (nueve píxeles a veinte fotogramas), quien ya
 * está MÁS ALLÁ del borde dentro de la banda también cruza (`beyondEdge`), con el origen recogido
 * al propio borde, que es lo que el servidor exige ver.
 */
const SEAM_TRIGGER = 0.15;
/** Hasta dónde se admite haber rebasado el borde antes de cruzar, en casillas. */
const OVERSHOOT = 2;

/**
 * ⛔ LA BANDA DE SALIDA NO LLEGABA HASTA DONDE LLEGA QUIEN CRUZA. Las bandas están dibujadas en
 * tiles y el cuerpo que cruza se planta a cierta distancia del borde del mapa: pegándose al borde
 * de abajo la barca acaba en la fila 142,375 y la banda termina en la 142,2. Medido, le ocurría a
 * las diez salidas de aguas abajo, a las de la izquierda y a la del islote. El síntoma es el peor
 * posible: el camino sigue estando ahí delante y el juego no responde.
 *
 * No se arregla ensanchando rectángulos a mano —que habría que rehacer el día que cambie el
 * tamaño de un cuerpo— sino preguntando lo que importa: si estás PEGADO al borde por un lado que
 * tiene salida. La banda sigue mandando en el TRAMO del borde por el que se pasa (la boca del río
 * del bosque son sus veinticinco columnas y no el lago entero); lo único que se le suma es el
 * hueco que el propio cuerpo se deja.
 */
function crossingAt(data, point, mode = "boat", margin = marginFor(mode), edgeOnly = false) {
  const exits = (data.navigation?.exits || []).filter((e) => crosses(e, mode));
  const tx = point.x / TILE,
    ty = point.y / TILE;
  // Preserve authored-area priority when the extended edge bands overlap. `edgeOnly` es el
  // disparo del cliente en el mundo continuo: la zona autorada (que puede medir tres casillas de
  // fondo) sigue valiendo para el contrato del servidor, pero cruzar se decide pegado al borde.
  return (!edgeOnly && exits.find((e) => inRect(tx, ty, e.area))) ||
    exits.find((e) => crossingAreas(data, e, mode, margin).slice(1).some(([x, y, w, h]) =>
      tx >= x && tx <= x + w && ty >= y && ty <= y + h)) || null;
}

/**
 * La salida cuya banda has REBASADO: el punto está fuera de la pantalla, a menos de OVERSHOOT
 * casillas del borde y dentro del tramo de la banda. Es la red de seguridad del disparo fino.
 */
function beyondEdge(data, point, mode = "boat") {
  const tx = point.x / TILE,
    ty = point.y / TILE;
  for (const exit of (data.navigation?.exits || []).filter((e) => crosses(e, mode))) {
    const [ax, ay, aw, ah] = exit.area,
      vertical = exit.direction === "up" || exit.direction === "down";
    const along = vertical ? tx : ty,
      depth =
        exit.direction === "up" ? -ty
        : exit.direction === "down" ? ty - data.height
        : exit.direction === "left" ? -tx
        : tx - data.width;
    const [from, to] = vertical ? [ax, ax + aw] : [ay, ay + ah];
    if (depth > 0 && depth < OVERSHOOT && along >= from && along <= to) return exit;
  }
  return null;
}
/** El origen de un cruce, recogido al propio borde: el servidor solo admite orígenes dentro del mapa. */
function ontoEdge(data, exit, point) {
  const w = data.width * TILE,
    h = data.height * TILE;
  return {
    x: exit.direction === "left" ? Math.max(point.x, 0) : exit.direction === "right" ? Math.min(point.x, w - 0.01) : point.x,
    y: exit.direction === "up" ? Math.max(point.y, 0) : exit.direction === "down" ? Math.min(point.y, h - 0.01) : point.y,
  };
}

/** The same arrival trigger geometry is compiled into the private live contract. */
function crossingAreas(data, exit, mode, margin = marginFor(mode)) {
  if (!crosses(exit, mode)) return [];
  const [x, y, w, h] = exit.area;
  const edge = {
    up: [x - margin, 0, w + margin * 2, margin],
    down: [x - margin, data.height - margin, w + margin * 2, margin],
    left: [0, y - margin, margin, h + margin * 2],
    right: [data.width - margin, y - margin, margin, h + margin * 2],
  };
  return [exit.area, edge[exit.direction]];
}

/**
 * Por dónde se entra en la pantalla de al lado. El punto escrito en los datos dice a qué
 * PROFUNDIDAD se aparece —desde el mundo continuo, en el propio borde— y quien cruza pone el
 * resto: se conserva su desvío respecto al centro del paso, así que quien cruzaba pegado a una
 * orilla sigue pegado a esa orilla. Con los centros de banda alineados por el plano, esto es
 * exactamente el mismo punto del bosque visto desde la otra pantalla.
 *
 * El desvío se acota a la propia banda: una salida no puede escupirte más lejos de lo ancha que
 * es. Y quien llama prueba este punto ANTES que el escrito, que es el respaldo para cuando el
 * terreno de enfrente hace otra curva.
 */
function crossingArrival(exit, point) {
  const [ax, ay, aw, ah] = exit.area;
  const vertical = exit.direction === "up" || exit.direction === "down";
  const half = (vertical ? aw : ah) / 2;
  const drift = clamp(
    (vertical ? point.x : point.y) / TILE - ((vertical ? ax : ay) + half),
    -half,
    half,
  );
  return {
    x: (exit.position[0] + (vertical ? drift : 0)) * TILE,
    y: (exit.position[1] + (vertical ? 0 : drift)) * TILE,
  };
}

/** El viaje en sí: uno para los dos modos, con un solo manejo de error y un solo aviso. */
class Crossings {
  constructor(game) {
    this.game = game;
    this.failed = null;
    /** La salida por la que acabas de LLEGAR: cerrada hasta que salgas de su banda, o rebotarías. */
    this.latched = null;
    /** Un toque más allá del borde, guardado para volver a tocarlo al otro lado. */
    this.pending = null;
  }
  /** Se llama cada fotograma desde el bucle que toque. Devuelve true si se ha empezado a cruzar. */
  check(mode) {
    const g = this.game;
    if (g.transitioning || g.dialogue || g.blocked()) return false;
    const exit =
      crossingAt(g.world.data, g.player, mode, SEAM_TRIGGER, true) ||
      beyondEdge(g.world.data, g.player, mode);
    // Salir de la banda rehabilita el reintento y suelta el cerrojo de la llegada: quedarse
    // pegado a una orilla que falló una vez no puede dejarte encerrado para siempre.
    if (!exit) {
      this.failed = null;
      this.latched = null;
      return false;
    }
    if (exit.id === this.failed || exit.id === this.latched) return false;
    this.travel(exit, mode);
    return true;
  }
  /**
   * ⛔ UN TOQUE MÁS ALLÁ DEL BORDE ES UN VIAJE A LA PANTALLA DE AL LADO (mundo continuo). La ruta
   * de esta pantalla no sabe andar por la otra, así que el viaje va en dos tramos: hasta el punto
   * de la costura donde la recta al sitio corta el borde —dentro de la banda y ya en el disparo
   * del cruce— y, una vez al otro lado, el mismo toque se repite en las coordenadas de allí, que
   * es lo que hace que tocar un banco de la pantalla vecina acabe sentándote en él.
   */
  aimBeyond(beyond, point) {
    const g = this.game,
      world = g.world;
    // Entre las salidas a pie hacia esa vecina, la de la banda más cercana al sitio tocado: al
    // tramo de al lado se va por el río, por el prado o por el oeste, y andando solo valen dos.
    const from = { x: g.player.x, y: g.player.y };
    const exits = beyond.seam.exits.filter((e) => crosses(e, "foot"));
    if (!exits.length) return;
    const nearestBand = (e) => {
      const [ax, ay, aw, ah] = e.area,
        vertical = e.direction === "up" || e.direction === "down";
      const along = vertical ? point.x : point.y;
      const [lo, hi] = vertical ? [ax * TILE, (ax + aw) * TILE] : [ay * TILE, (ay + ah) * TILE];
      return Math.max(0, lo - along, along - hi);
    };
    const exit = exits.sort((a, b) => nearestBand(a) - nearestBand(b))[0];
    const vertical = exit.direction === "up" || exit.direction === "down";
    const edge =
      exit.direction === "up" || exit.direction === "left"
        ? 0
        : (vertical ? world.height : world.width) * TILE;
    const span = vertical ? point.y - from.y : point.x - from.x;
    const t = clamp((edge - (vertical ? from.y : from.x)) / (span || 1e-9), 0, 1);
    const hit = { x: from.x + (point.x - from.x) * t, y: from.y + (point.y - from.y) * t };
    const [ax, ay, aw, ah] = exit.area,
      inset = (SEAM_TRIGGER - 0.15) * TILE;
    const target = vertical
      ? {
          x: clamp(hit.x, (ax + 0.5) * TILE, (ax + aw - 0.5) * TILE),
          y: exit.direction === "up" ? inset : world.height * TILE - inset,
        }
      : {
          x: exit.direction === "left" ? inset : world.width * TILE - inset,
          y: clamp(hit.y, (ay + 0.5) * TILE, (ay + ah - 0.5) * TILE),
        };
    this.pending = { scene: beyond.seam.scene, point: { x: beyond.x, y: beyond.y } };
    if (!g.journey.start(world, g.player, { kind: "ground", point: target })) {
      this.pending = null;
      g.toast(g.s.blocked);
    }
  }
  async travel(exit, mode) {
    const g = this.game;
    if (g.transitioning) return;
    g.transitioning = true;
    // ⛔ CRUZAR NO SUELTA EL DEDO. Se para el viaje de este lado, pero el gesto sigue siendo el
    // mismo gesto: el mando del dedo es un vector, como una tecla pulsada, y `directionIntent` lo
    // lee igual en la pantalla nueva en cuanto `transitioning` se suelta.
    g.pauseMovement({ keepControls: true, keepPointerGesture: true });
    // Quien ha rebasado el borde se recoge a él antes de cruzar: es el origen que el servidor
    // admite y el que la llegada geométrica toma como referencia.
    Object.assign(g.player, ontoEdge(g.world.data, exit, g.player));
    const arrival = crossingArrival(exit, g.player);
    // ⛔ LA CÁMARA VIAJA CON EL DUENDE. La misma traslación que lleva al duende de estas
    // coordenadas a las de la vecina se aplica a la cámara: lo que se ve no se mueve ni un píxel
    // por cruzar, solo cambia qué pantalla es «la tuya» por debajo.
    const camera = {
      x: g.camera.x - (g.player.x - arrival.x),
      y: g.camera.y - (g.player.y - arrival.y),
    };
    const pending = this.pending?.scene === exit.scene ? this.pending : null;
    this.pending = null;
    let prepared;
    try {
      const state = {
        ...g.state,
        navigation: { ...g.state.navigation, mode, direction: exit.direction },
      };
      prepared = await g.scenes.prepare(
        exit.scene,
        [arrival, { x: exit.position[0] * TILE, y: exit.position[1] * TILE }],
        state,
        { seam: true },
      );
      await g.live?.cross("edge", exit.id, prepared.id, prepared.position, mode);
      g.state = state;
      g.scenes.enter(prepared, { keepControls: true, keepPointerGesture: true, camera });
      // Se aparece dentro de la banda de vuelta a propósito; esa salida queda cerrada hasta que
      // se salga de ella, que si no se volvería por donde se vino en el mismo fotograma.
      this.latched = crossingAt(g.world.data, g.player, mode, SEAM_TRIGGER, true)?.id || null;
      g.save();
      if (pending) g.tap(pending.point);
    } catch (error) {
      console.error("Crossing:", error);
      // Se conservan la barca y el saco en la orilla de partida; se reintenta al apartarse.
      this.failed = exit.id;
      g.toast(g.text("travelError"));
    } finally {
      prepared?.packs.release?.();
      g.transitioning = false;
    }
  }
}
module.exports = { MODES, SEAM_TRIGGER, OVERSHOOT, crossingAt, crossingAreas, crossingArrival, beyondEdge, ontoEdge, Crossings };
