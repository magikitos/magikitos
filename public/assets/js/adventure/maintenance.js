"use strict";
/**
 * EL BOSQUE SE MANTIENE SOLO (docs/AUTOMANTENIMIENTO.md, 19-sep-2026): las reglas PURAS de la hierba
 * que vuelve y de la bombita, sin red ni DOM, para que el navegador, las pruebas y el gemelo PHP
 * (`src/game/community-maintenance.php` en la web) digan exactamente lo mismo.
 *
 * ⛔ EL RELOJ DEL BOSQUE NO ES UNA FECHA. `clock` y cada marca de `steps` son MINUTOS DE PRESENCIA
 * en la zona (avanzan solo con alguien dentro), nunca una diferencia de fechas: con una fecha, el
 * primer camino de una pantalla vacía se moriría antes de que llegara nadie a usarlo.
 */
const { shapes } = require("./construction-layout");
const { overlaps } = require("./geometry");

/** Cuánto le queda a un tramo: 0 recién pisado … 1 muerto. */
function segmentWear(clock, step, minutes) {
  if (!minutes || !Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(1, (clock - step) / minutes));
}

/**
 * ⛔ SOLO MUEREN LOS TRAMOS DE LOS EXTREMOS. El camino se erosiona de las puntas hacia dentro y
 * nunca se parte en dos: un tramo del medio solo es elegible cuando ya es un extremo. Los puntos
 * son relativos a la pieza (el primero es siempre [0,0]), así que al morir el primer tramo la
 * pieza se recoloca en el vértice siguiente y el resto se vuelve a referir a él. Un tramo sin
 * marca cuenta como recién pisado. Con menos de dos puntos, la pieza entera se retira.
 */
function erodePath(object, steps, clock, minutes) {
  let points = object.points.map((p) => [p[0], p[1]]);
  const marks = (steps || []).slice(0, Math.max(0, points.length - 1)).map((s) => (Number.isFinite(s) ? s : clock));
  while (marks.length < points.length - 1) marks.push(clock);
  let x = object.x,
    y = object.y,
    changed = false;
  const dead = (i) => minutes > 0 && clock - marks[i] >= minutes;
  while (points.length >= 2 && dead(0)) {
    const [dx, dy] = points[1];
    points.shift();
    marks.shift();
    x += dx;
    y += dy;
    points = points.map((p) => [p[0] - dx, p[1] - dy]);
    changed = true;
  }
  while (points.length >= 2 && dead(marks.length - 1)) {
    points.pop();
    marks.pop();
    changed = true;
  }
  return { x, y, points, steps: marks, retired: points.length < 2, changed };
}

/**
 * Por qué una bombita no puede ir en esa pieza, o null si puede. Mismo orden que el servidor:
 * primero lo tuyo (llevas bombita), luego la pieza (existe, se puede volar, no es patrimonio, no
 * está ya minada, no está en un rincón protegido). Los caminos declaran `bombable: false`.
 */
function bombReason(object, definition, zone, { hasBomb = true } = {}) {
  if (!hasBomb) return "bomb_required";
  if (!object || !definition) return "object_missing";
  if (definition.bombable === false) return "not_bombable";
  if (object.heritage) return "heritage_protected";
  if (object.bomb) return "already_mined";
  for (const r of zone?.protected || [])
    for (const s of shapes(object, definition))
      if (overlaps(s, { x: r[0], y: r[1], w: r[2], h: r[3] })) return "protected_access";
  return null;
}
/** "armed" hasta media hora antes, "warning" el último tramo, "due" cuando ya toca explotar. */
function bombPhase(now, explodesAt, warningMs) {
  if (now >= explodesAt) return "due";
  if (now >= explodesAt - warningMs) return "warning";
  return "armed";
}
/** Dónde se apoya la bombita: pegada a la esquina inferior derecha de lo que va a volar. */
function bombSpot(object, definition) {
  const parts = shapes(object, definition);
  let right = -Infinity,
    bottom = -Infinity;
  for (const s of parts) {
    right = Math.max(right, s.x + s.w);
    bottom = Math.max(bottom, s.y + s.h);
  }
  return { x: right + 0.35, y: bottom };
}
module.exports = { segmentWear, erodePath, bombReason, bombPhase, bombSpot };
