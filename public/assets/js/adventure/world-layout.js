"use strict";
const { TILE } = require("./geometry");

/**
 * ⛔ EL BOSQUE ES UNO, AUNQUE ESTÉ DIBUJADO POR PANTALLAS (19-sep-2026, decisión del dueño: «que
 * el usuario juega y no sabe que está separado el juego por escenas diferentes»).
 *
 * Las pantallas exteriores se autoran por separado —cada una con sus aventuras, su zona de
 * construcción y su arte— y eso NO cambia: es la unidad de datos, del servidor y del Studio. Lo
 * que cambia es que en pantalla se colocan unas junto a otras en un solo plano, así que la
 * cámara puede enseñar dos a la vez y el duende pasa de una a otra sin corte.
 *
 * El plano no se escribe a mano: SALE DE LAS SALIDAS. Cada salida por un borde (`navigation.exits`)
 * dice hacia qué pantalla se va, por qué borde, por qué banda y a qué coordenada se llega; con eso
 * la vecina queda pegada por ese borde y alineada por el centro de la banda. Una pantalla nueva
 * entra en el plano con solo declarar su salida, y si dos salidas no se ponen de acuerdo sobre
 * dónde va una pantalla —o dos pantallas se pisan— el trazado lo dice como CONFLICTO, que es lo
 * que la prueba `check-world-layout` se niega a aceptar.
 *
 * Todo en CASILLAS y relativo a la pantalla de arranque, que es el origen. Los interiores no
 * entran: por una puerta sí se cambia de pantalla, y es natural que así sea.
 */
function layoutScenes(scenes, root) {
  const offsets = new Map([[root, { x: 0, y: 0 }]]);
  const conflicts = [];
  const queue = [root];
  while (queue.length) {
    const id = queue.shift(),
      scene = scenes[id],
      origin = offsets.get(id);
    for (const exit of scene.navigation?.exits || []) {
      const target = scenes[exit.scene];
      if (!target || target.indoor) continue;
      const want = placeBy(scene, origin, exit, target);
      const have = offsets.get(exit.scene);
      if (!have) {
        offsets.set(exit.scene, want);
        queue.push(exit.scene);
      } else if (have.x !== want.x || have.y !== want.y)
        conflicts.push({ scene: id, exit: exit.id, target: exit.scene, have, want });
    }
  }
  const placed = [...offsets].map(([id, o]) => ({ id, ...o, w: scenes[id].width, h: scenes[id].height }));
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i],
        b = placed[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
        conflicts.push({ overlap: [a.id, b.id] });
    }
  const bounds = placed.reduce(
    (r, s) => ({
      x0: Math.min(r.x0, s.x),
      y0: Math.min(r.y0, s.y),
      x1: Math.max(r.x1, s.x + s.w),
      y1: Math.max(r.y1, s.y + s.h),
    }),
    { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
  );
  return { offsets, conflicts, bounds };
}

/** Dónde cae la vecina de una salida: pegada por el borde y alineada por el centro de la banda. */
function placeBy(scene, origin, exit, target) {
  const [ax, ay, aw, ah] = exit.area,
    [px, py] = exit.position;
  switch (exit.direction) {
    case "up":
      return { x: origin.x + Math.round(ax + aw / 2 - px), y: origin.y - target.height };
    case "down":
      return { x: origin.x + Math.round(ax + aw / 2 - px), y: origin.y + scene.height };
    case "left":
      return { x: origin.x - target.width, y: origin.y + Math.round(ay + ah / 2 - py) };
    case "right":
      return { x: origin.x + scene.width, y: origin.y + Math.round(ay + ah / 2 - py) };
    default:
      throw Error("Unknown exit direction: " + exit.direction);
  }
}

/**
 * Las costuras de una pantalla: UNA por vecina del plano, con el desplazamiento en casillas de la
 * vecina respecto a esta —lo único que hace falta para traducir coordenadas entre las dos
 * (`local_vecina = local_mía − d`)— y las salidas que llevan a ella, que pueden ser varias (el
 * río, el prado y el oeste van los tres al mismo tramo).
 */
function seamsOf(scenes, offsets, id) {
  const mine = offsets.get(id);
  if (!mine) return [];
  const seams = new Map();
  for (const exit of scenes[id].navigation?.exits || []) {
    const there = offsets.get(exit.scene);
    if (!there) continue;
    if (!seams.has(exit.scene))
      seams.set(exit.scene, { scene: exit.scene, dx: there.x - mine.x, dy: there.y - mine.y, exits: [] });
    seams.get(exit.scene).exits.push(exit);
  }
  return [...seams.values()];
}

/** La caja del plano entero, en casillas LOCALES de una pantalla: hasta dónde puede mirar la cámara. */
function frameOf(layout, id) {
  const mine = layout.offsets.get(id);
  if (!mine || !Number.isFinite(layout.bounds.x0)) return null;
  const b = layout.bounds;
  return { x: b.x0 - mine.x, y: b.y0 - mine.y, w: b.x1 - b.x0, h: b.y1 - b.y0 };
}

/**
 * Qué pantallas del plano toca un rectángulo dado en píxeles LOCALES de `id`, con un margen: es
 * lo que la precarga mira para tener listo lo que la cámara está a punto de enseñar.
 */
function scenesIntersecting(scenes, offsets, id, rect, margin = 0) {
  const mine = offsets.get(id);
  if (!mine) return [];
  const hits = [];
  for (const [other, o] of offsets) {
    if (other === id) continue;
    const x = (o.x - mine.x) * TILE,
      y = (o.y - mine.y) * TILE,
      w = scenes[other].width * TILE,
      h = scenes[other].height * TILE;
    if (
      x < rect.x + rect.width + margin &&
      x + w > rect.x - margin &&
      y < rect.y + rect.height + margin &&
      y + h > rect.y - margin
    )
      hits.push({
        id: other,
        distance: Math.hypot(
          Math.max(0, x - (rect.x + rect.width), rect.x - (x + w)),
          Math.max(0, y - (rect.y + rect.height), rect.y - (y + h)),
        ),
      });
  }
  return hits.sort((a, b) => a.distance - b.distance).map((h) => h.id);
}

module.exports = { layoutScenes, seamsOf, frameOf, scenesIntersecting };
