"use strict";
const { TILE, FOOTPRINT } = require("./geometry");
/**
 * Gemelo en JS de `adventureDoorGeometry` (src/adventure-geometry.php): el umbral, la dirección de
 * entrada y la llegada de una puerta, desde su pie o desde una `entrance` dibujada a mano en el
 * Studio ([dx, dy, ancho, alto] relativos al pie). El Studio lo usa para enseñar en vivo lo que el
 * compilador escribirá; `check-door-geometry.cjs` exige que los dos digan lo mismo.
 */
/**
 * ⛔ HASTA TRES CASILLAS DE ANCHO (22-sep-2026, decisión del dueño: «necesito poder hacerlas más
 * anchas, un 50% más que ahora»). Eran dos. El tope de ancho nunca fue mecánico como el de alto
 * —ese sí: media casilla, porque una franja alta rompe la guarda de dirección y el pestillo—, era
 * un juicio para que no se entrase por el lado de la puerta. Con tres sigue habiendo que venir
 * ANDANDO HACIA ella y con lo vertical mandando, que es lo que de verdad la protege. Vive por
 * duplicado en `src/adventure-geometry.php` y lo casa `check-door-geometry.cjs`.
 */
const ENTRANCE_LIMITS = Object.freeze({ offset: 12, width: [0.25, 3], height: [1 / 16, 0.5] });
function validEntrance(entrance) {
  if (!Array.isArray(entrance) || entrance.length !== 4 || !entrance.every(Number.isFinite)) return false;
  const [dx, dy, w, h] = entrance;
  return (
    Math.abs(dx) <= ENTRANCE_LIMITS.offset &&
    Math.abs(dy) <= ENTRANCE_LIMITS.offset &&
    w >= ENTRANCE_LIMITS.width[0] &&
    w <= ENTRANCE_LIMITS.width[1] &&
    h >= ENTRANCE_LIMITS.height[0] &&
    h <= ENTRANCE_LIMITS.height[1]
  );
}
/**
 * ⛔ UNA ENTRADA DENTRO DEL CUERPO NO ABRE NUNCA (22-sep-2026, decisión del dueño: «no permitas que
 * la entrada esté dentro de colisión sin margen, que salga rojo si no es válida»).
 *
 * El umbral se prueba contra el PUNTO del duende, y ese punto no puede meterse en un sólido: su
 * huella mide 12×10 px, así que nunca se acerca a un cuerpo a menos de 6 px por los lados ni 5 por
 * arriba y abajo. Una franja dibujada dentro del cuerpo —o pegada a él— queda fuera de alcance y la
 * puerta se queda cerrada para siempre, sin que nada avise. Medido en la casa de hojas: 297 puntos
 * dentro del umbral, 0 donde el duende pueda estar.
 *
 * No vale con pedir que no se toquen: una franja que solape A MEDIAS sigue siendo buena si le queda
 * un trozo libre. Lo que se exige es que quede ALGO: se engordan los cuerpos con la media huella
 * —que es justo hasta donde llega el punto— y se comprueba que no cubran la franja entera. Con seis
 * cajas como mucho, se resuelve exacto por compresión de coordenadas: los bordes parten la franja
 * en celdas y basta con que el centro de UNA caiga libre.
 */
function entranceReachable(entrance, solids = []) {
  if (!Array.isArray(entrance) || entrance.length !== 4) return false;
  const [ex, ey, ew, eh] = entrance;
  const margenX = FOOTPRINT.halfWidth / TILE,
    margenY = FOOTPRINT.halfHeight / TILE;
  const bloques = (Array.isArray(solids) ? solids : [])
    .filter((b) => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite))
    .map(([x, y, w, h]) => [x - margenX, y - margenY, w + margenX * 2, h + margenY * 2]);
  if (!bloques.length) return true;
  const cortes = (inicio, largo, lado) => {
    const puntos = new Set([inicio, inicio + largo]);
    for (const b of bloques)
      for (const v of [b[lado], b[lado] + b[lado + 2]])
        if (v > inicio && v < inicio + largo) puntos.add(v);
    return [...puntos].sort((a, b) => a - b);
  };
  const xs = cortes(ex, ew, 0),
    ys = cortes(ey, eh, 1);
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2,
        cy = (ys[j] + ys[j + 1]) / 2;
      if (!bloques.some((b) => cx > b[0] && cx < b[0] + b[2] && cy > b[1] && cy < b[1] + b[3]))
        return true;
    }
  return false;
}
function doorGeometry(scene, entity) {
  const stairs = entity.portal === "stairs";
  if (entity.entrance !== undefined) {
    if (stairs) throw new Error("Stairs derive their landing; no authored entrance: " + entity.id);
    if (!validEntrance(entity.entrance)) throw new Error("Entrance out of range: " + entity.id);
    const [dx, dy, w, h] = entity.entrance,
      indoor = Boolean(scene.indoor),
      top = entity.y + dy;
    if (indoor && entity.y >= scene.height - 2) throw new Error("Indoor door outside walkable floor");
    return {
      threshold: [entity.x + dx, top, w, h],
      entryDirection: indoor ? 1 : -1,
      arrival: [entity.x + dx + w / 2, indoor ? top - 2 : top + h + 2],
    };
  }
  if (stairs) {
    const front = entity.y + entity.solid[1] + entity.solid[3];
    return {
      threshold: [entity.x - 0.7, front, 1.4, entity.y + 0.35 - front],
      arrival: [entity.x, entity.y + 1.7],
    };
  }
  if (scene.indoor) {
    const top = scene.height - 2 - 9 / 16;
    if (entity.y >= scene.height - 2) throw new Error("Indoor door outside walkable floor");
    return { threshold: [entity.x - 0.5, top, 1, 4 / 16], entryDirection: 1, arrival: [entity.x, top - 2] };
  }
  const floor = entity.solid
    ? entity.y + entity.solid[1] + entity.solid[3] + 6 / 16
    : entity.y - 0.3;
  return { threshold: [entity.x - 0.5, floor, 1, 6 / 16], entryDirection: -1, arrival: [entity.x, floor + 2] };
}
/** Resolve saved entrance IDs against current scene data, never stale saved coordinates. */
function portalArrival(catalog, scene, portal) {
  if (
    typeof scene !== "string" ||
    typeof portal !== "string" ||
    !Object.hasOwn(catalog.scenes, scene)
  )
    return null;
  const entity = catalog.scenes[scene].entities.find(
    (e) => e.id === portal && e.portal,
  );
  const point = entity?.arrival;
  if (
    !Array.isArray(point) ||
    point.length !== 2 ||
    !point.every(Number.isFinite)
  )
    return null;
  return { x: point[0] * TILE, y: point[1] * TILE };
}
/** Doors require a deliberate vertical approach. Standing, skimming sideways or retreating never enters. */
function acceptsEntry(entity, motion) {
  if (!entity.entryDirection) return true; // Stairs have their own landing semantics.
  return Boolean(
    motion &&
    motion.y * entity.entryDirection > 0.00001 &&
    Math.abs(motion.y) >= Math.abs(motion.x),
  );
}
/** Shared interiors return to the building actually entered, including buildings on another map. */
function doorDestination(catalog, from, door, travel, entrance) {
  const fallback = {
    scene: travel.scene,
    position: { x: travel.x * TILE, y: travel.y * TILE },
  };
  const outside = catalog.scenes[entrance?.scene];
  if (
    !from.indoor ||
    !door.portal ||
    door.entryDirection !== 1 ||
    catalog.scenes[travel.scene].indoor ||
    !outside ||
    outside.indoor
  )
    return fallback;
  const position = portalArrival(catalog, entrance.scene, entrance.portal);
  return position ? { scene: entrance.scene, position } : fallback;
}
/** A tap routes to the front of a door, then crosses inward; it never teleports from the side. */
function portalPath(world, from, entity) {
  const [x, y, w, h] = entity.threshold;
  const target = { x: (x + w / 2) * TILE, y: (y + h / 2) * TILE };
  if (!entity.entryDirection) return world.path(from, target) || [];
  const lead = { x: target.x, y: target.y - entity.entryDirection * TILE * 2 };
  // The exact lead can be clear while its navigation-cell centre is occupied
  // by a nearby prop. Approach a neighbouring cell, then verify the final
  // precise segments rather than rejecting a perfectly reachable doorway.
  const path = world.path(from, lead) || world.approach(from, lead, 1);
  if (
    !path ||
    !world.clearSegment(path.at(-1) || from, lead, from) ||
    !world.clearSegment(lead, target, from)
  )
    return [];
  return [...path, lead, target];
}
module.exports = { portalArrival, acceptsEntry, portalPath, doorDestination, doorGeometry, validEntrance, entranceReachable, ENTRANCE_LIMITS };
