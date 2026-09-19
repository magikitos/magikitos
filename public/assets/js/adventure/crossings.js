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
 */
const { TILE, inRect, clamp } = require("./geometry");

/** Lo que el casco de la barca se deja de margen con el borde; a pie no hay margen que valga. */
const { HULL_RADIUS } = require("./river-navigation");

const MODES = Object.freeze(["foot", "boat"]);
const crosses = (exit, mode) => (exit.mode || "boat") === mode || exit.mode === "both";

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
function crossingAt(data, point, mode = "boat") {
  const exits = (data.navigation?.exits || []).filter((e) => crosses(e, mode));
  const tx = point.x / TILE,
    ty = point.y / TILE;
  // Preserve authored-area priority when the extended edge bands overlap.
  return exits.find((e) => inRect(tx, ty, e.area)) ||
    exits.find((e) => crossingAreas(data, e, mode).slice(1).some(([x, y, w, h]) =>
      tx >= x && tx <= x + w && ty >= y && ty <= y + h)) || null;
}

/** The same arrival trigger geometry is compiled into the private live contract. */
function crossingAreas(data, exit, mode) {
  if (!crosses(exit, mode)) return [];
  const margin = (mode === "boat" ? HULL_RADIUS : TILE / 2) / TILE;
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
 * Por dónde se entra en la pantalla de al lado. El punto escrito en los datos dice a qué ALTURA
 * se aparece —adentro, para no volver a cruzar el borde sin querer— y quien cruza pone el resto:
 * se conserva su desvío respecto al centro del paso, así que quien cruzaba pegado a una orilla
 * sigue pegado a esa orilla. Sin esto, cada costura te devolvía al centro de un tirón, que es lo
 * que se siente como que las dos pantallas no encajan.
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
  }
  /** Se llama cada fotograma desde el bucle que toque. Devuelve true si se ha empezado a cruzar. */
  check(mode) {
    const g = this.game;
    if (g.transitioning || g.dialogue || g.blocked()) return false;
    const exit = crossingAt(g.world.data, g.player, mode);
    // Salir de la banda rehabilita el reintento: quedarse pegado a una orilla que falló una vez
    // no puede dejarte encerrado para siempre.
    if (!exit) {
      this.failed = null;
      return false;
    }
    if (exit.id === this.failed) return false;
    this.travel(exit, mode);
    return true;
  }
  async travel(exit, mode) {
    const g = this.game;
    if (g.transitioning) return;
    g.transitioning = true;
    // ⛔ CRUZAR NO SUELTA EL DEDO. Se para el viaje de este lado, pero el gesto sigue siendo el
    // mismo gesto: quien cruza arrastrando el mapa tiene que seguir mandando al otro lado, y
    // limpiarlo aquí dejaba la barca parada en mitad del agua con el dedo todavía en la pantalla.
    g.pauseMovement({ keepControls: true, keepPointerGesture: true });
    let prepared;
    try {
      const state = {
        ...g.state,
        navigation: { ...g.state.navigation, mode, direction: exit.direction },
      };
      prepared = await g.scenes.prepare(
        exit.scene,
        [
          crossingArrival(exit, g.player),
          { x: exit.position[0] * TILE, y: exit.position[1] * TILE },
        ],
        state,
      );
      await g.live?.cross("edge", exit.id, prepared.id, prepared.position, mode);
      g.state = state;
      g.scenes.enter(prepared, { keepControls: true, keepPointerGesture: true });
      g.toast(g.text(g.world.data.label || "riverDock"));
      g.save();
    } catch (error) {
      console.error("Crossing:", error);
      // Se conservan la barca y el saco en la orilla de partida; se reintenta al apartarse.
      this.failed = exit.id;
      g.toast(g.text("travelError"));
    } finally {
      prepared?.packs.release?.();
      g.transitioning = false;
      // ⛔ EL DEDO SIGUE PUESTO AL OTRO LADO. Cruzar cambia el mundo entero debajo del gesto y
      // detiene el viaje; no hace falta replantar nada a mano: el guiado se recalcula cada
      // fotograma desde el dedo y la cámara de AHORA (`MapGestures.update`), y al ver que la
      // escena ha cambiado planta el primer destino en cuanto `transitioning` se suelta.
    }
  }
}
module.exports = { MODES, crossingAt, crossingAreas, crossingArrival, Crossings };
