"use strict";
const { transformedRect } = require("./entity-art");
const { riverSection, riverEnvelope } = require("./river-course");
const TILE = 16;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function random(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(text) {
  let value = 2166136261;
  for (const c of String(text))
    value = Math.imul(value ^ c.charCodeAt(0), 16777619);
  return value >>> 0;
}
function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = clamp(
    ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1),
    0,
    1,
  );
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
function inRect(x, y, [rx, ry, w, h]) {
  return x >= rx && y >= ry && x < rx + w && y < ry + h;
}
function overlaps(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
function collisionBounds(entity) {
  if (entity.neighbor || entity.actor) return actorBounds(entity.x, entity.y);
  const source = entity.solid || [-0.4, -0.5, 0.8, 0.7];
  const box = transformedRect(entity, {
    x: source[0],
    y: source[1],
    w: source[2],
    h: source[3],
  });
  return {
    x: entity.x + box.x * TILE,
    y: entity.y + box.y * TILE,
    w: box.w * TILE,
    h: box.h * TILE,
  };
}
function insideThreshold(entity, point) {
  if (!entity.threshold) return false;
  const [x, y, w, h] = entity.threshold;
  return (
    point.x >= x * TILE &&
    point.x <= (x + w) * TILE &&
    point.y >= y * TILE &&
    point.y <= (y + h) * TILE
  );
}
function spriteBounds(frame, point) {
  return {
    x: point.x - frame.anchor[0],
    y: point.y - frame.anchor[1],
    w: frame.w,
    h: frame.h,
  };
}

/** Actor foot envelope in native pixels. All movement and actor contacts use this. */
const FOOTPRINT = Object.freeze({
  halfWidth: 6,
  halfHeight: 5,
  shoreMargin: 2,
});
function actorBounds(x, y) {
  return {
    x: x - FOOTPRINT.halfWidth,
    y: y - FOOTPRINT.halfHeight,
    w: FOOTPRINT.halfWidth * 2,
    h: FOOTPRINT.halfHeight * 2,
  };
}
/**
 * ⛔ YA NO HAY COSTAS DE UN SOLO LADO (20-sep-2026). El océano de la pradera era una línea `coasts`
 * con agua hasta el infinito por el este; con la rejilla pasó a ser el lago, un `rivers` de dos
 * orillas cerrado por el este y por el sur. Toda el agua abierta se describe con `rivers` (orillas
 * autoradas con Hermite monótona, `sway` opcional) y `waters` (elipses): un solo camino para la
 * física, la pintura y la máscara del servidor.
 */
/**
 * ⛔ EL AGUA DE UNA FILA SON INTERVALOS, NO UN ORÁCULO PUNTO A PUNTO (21-sep-2026, decisión del
 * dueño: «preguntar siempre si hay agua es un poco raro, hay que hacerlo eficientemente»).
 *
 * En una fila de píxeles el agua siempre es lo mismo: el cauce entre dos orillas, las elipses de
 * los charcos y los puentes que la tapan. Averiguarlo cuesta una interpolación de Hermite con dos
 * senos por río; preguntarlo después es comparar dos números. Y quien pregunta lo hace treinta
 * veces por pisada y ciento noventa y dos veces por fila de casillas, siempre sobre las MISMAS
 * filas: así que se calcula una vez por fila y se guarda.
 *
 * Los intervalos guardan la inclusividad de cada cosa, que no es la misma y es lo que mantiene la
 * respuesta idéntica: un cauce es [orilla, orilla) y una elipse es abierta por los dos lados.
 * Medido antes de esto: una sola búsqueda de camino junto al lago evaluaba la orilla 170.000
 * veces (45 ms); la máscara de construcción de la pradera, 704.842 veces (240 ms).
 */
const waterRows = new WeakMap();
const ROW_LIMIT = 2048;
const ovalSpan = (p, y) => {
  const t = (y - p.y) / p.ry;
  if (!(Math.abs(t) < 1)) return null;
  const half = p.rx * Math.sqrt(1 - t * t);
  return [p.x - half, p.x + half];
};
function waterSpans(data, y) {
  let rows = waterRows.get(data);
  if (!rows) waterRows.set(data, (rows = new Map()));
  const known = rows.get(y);
  if (known) return known;
  const row = {
    bridges: (data.bridges || [])
      .filter((b) => y >= b.rect[1] && y < b.rect[1] + b.rect[3])
      .map((b) => [b.rect[0], b.rect[0] + b.rect[2]]),
    bands: (data.rivers || [])
      .filter((r) => y >= r.rect[1] && y < r.rect[1] + r.rect[3])
      .map((r) => {
        const banks = riverSection(r, y);
        return [banks.left, banks.right];
      }),
    base: !!data.baseWater,
    islands: data.baseWater
      ? (data.islands || []).map((p) => ovalSpan(p, y)).filter(Boolean)
      : [],
    ovals: (data.waters || []).map((p) => ovalSpan(p, y)).filter(Boolean),
  };
  rows.set(y, row);
  if (rows.size > ROW_LIMIT) rows.delete(rows.keys().next().value);
  return row;
}
/** El mismo orden y la misma inclusividad que tenía la pregunta punto a punto. */
function waterInRow(row, x) {
  for (const [l, r] of row.bridges) if (x >= l && x < r) return false;
  for (const [l, r] of row.bands) if (x >= l && x < r) return true;
  if (row.base && !row.islands.some(([l, r]) => x > l && x < r)) return true;
  return row.ovals.some(([l, r]) => x > l && x < r);
}
/**
 * ¿Queda agua bajo el trozo de fila [left, right] que ocupa el pie? Se recorta el agua a ese trozo
 * y se le restan los puentes, que son lo único que la tapa. Con tres ríos, tres charcos y dos
 * puentes como mucho, restar intervalos es más barato que preguntar punto a punto, y es exacto:
 * no hay hueco entre dos sondas por donde se cuele una orilla.
 */
function waterInSpan(row, left, right) {
  const pieces = [];
  const clip = (l, r, openEnds) => {
    const a = Math.max(l, left),
      b = Math.min(r, right);
    // Un cauce es [orilla, orilla); una elipse es abierta por los dos lados.
    if (openEnds ? b > a : b >= a && a < r) pieces.push([a, b]);
  };
  for (const [l, r] of row.bands) clip(l, r, false);
  for (const [l, r] of row.ovals) clip(l, r, true);
  if (row.base) {
    const holes = row.islands.filter(([l, r]) => r > left && l < right);
    let from = left;
    for (const [l, r] of holes.sort((a, b) => a[0] - b[0])) {
      if (l > from) pieces.push([from, Math.min(l, right)]);
      from = Math.max(from, r);
    }
    if (from < right) pieces.push([from, right]);
  }
  if (!pieces.length) return false;
  if (!row.bridges.length) return true;
  for (const piece of pieces) {
    let [a, b] = piece;
    for (const [bl, br] of row.bridges) {
      if (bl <= a && br > a) a = Math.max(a, br);
      if (br >= b && bl <= b && bl > a) b = Math.min(b, bl);
    }
    if (b >= a && !row.bridges.some(([bl, br]) => bl <= a && br > b)) return true;
  }
  return false;
}
function waterAt(data, x, y) {
  return waterInRow(waterSpans(data, y), x);
}
/**
 * Las filas que el pie toca, cada dos píxeles: ocho. Cambiar esta lista cambia el suelo pisable y
 * la máscara que el servidor hornea, así que se cambia a la vez o no se cambia.
 */
const sx = FOOTPRINT.halfWidth + FOOTPRINT.shoreMargin,
  sy = FOOTPRINT.halfHeight + FOOTPRINT.shoreMargin;
const SHORE_ROWS = (() => {
  const rows = [];
  for (let dy = -sy; dy <= sy; dy += 2) rows.push(dy);
  return rows;
})();
/** Conservative broad phase. Skip shoreline probes only when the whole foot rectangle is dry. */
function waterNearby(data, x, y) {
  const left = (x - sx) / TILE,
    right = (x + sx) / TILE,
    top = (y - sy) / TILE,
    bottom = (y + sy) / TILE;
  if (
    data.baseWater &&
    !(data.islands || []).some((p) =>
      [
        [left, top],
        [right, top],
        [left, bottom],
        [right, bottom],
      ].every(
        ([px, py]) => ((px - p.x) / p.rx) ** 2 + ((py - p.y) / p.ry) ** 2 < 1,
      ),
    )
  )
    return true;
  for (const r of data.rivers || []) {
    const [, ry, , rh] = r.rect,
      banks = riverEnvelope(r);
    if (
      right >= banks.left &&
      left <= banks.right &&
      bottom >= ry &&
      top <= ry + rh
    )
      return true;
  }
  return data.waters.some((p) => {
    const nx = clamp(p.x, left, right),
      ny = clamp(p.y, top, bottom);
    return ((nx - p.x) / p.rx) ** 2 + ((ny - p.y) / p.ry) ** 2 <= 1;
  });
}
/**
 * ⛔ EL PIE ES UN RECTÁNGULO, NO UNA NUBE DE PUNTOS (21-sep-2026, decisión del dueño: «no puede
 * estar en el agua si no ha cogido el barco»).
 *
 * Las treinta sondas cada dos píxeles eran una aproximación del rectángulo, y dejaban pasar el agua
 * que se colaba ENTRE dos sondas: en el rincón donde el lago de la pradera se cierra quedaban
 * cuatro casillas pisables con una lengua de agua bajo la bota. Preguntar por el intervalo que el
 * pie ocupa en cada fila contesta lo MISMO en 143.646 casillas de 143.650 y lo correcto en las
 * otras cuatro, y lo hace con ocho preguntas en vez de treinta.
 */
function dryFootprint(data, x, y) {
  if (!waterNearby(data, x, y)) return true;
  const left = (x - sx) / TILE,
    right = (x + sx) / TILE;
  for (const dy of SHORE_ROWS)
    if (waterInSpan(waterSpans(data, (y + dy) / TILE), left, right))
      return false;
  return true;
}
/**
 * ⛔ UN TRAMO RECTO BARRE UNA BANDA DE FILAS, NO OCHOCIENTAS PISADAS SUELTAS (21-sep-2026).
 *
 * El pie recorre una línea, así que el agua que puede llegar a tocar está en las filas que esa
 * línea barre, y en cada fila ocupa un intervalo que se calcula UNA vez. Preguntando pisada a
 * pisada eran ocho interpolaciones de orilla por paso: 114.518 en un solo toque largo junto al
 * lago, 193 ms parado. Barriendo son las filas del tramo y ya está.
 *
 * El barrido es la unión continua de los pies, así que es un pelo más estricto que las pisadas
 * sueltas: como mucho renuncia a un atajo en línea recta de dos píxeles pegado a la orilla, y el
 * camino por casillas sigue existiendo. Nunca hace inalcanzable un sitio.
 */
function dryAlong(data, from, to) {
  const top = Math.min(from.y, to.y),
    bottom = Math.max(from.y, to.y);
  const steep = Math.abs(to.y - from.y) > 1e-9;
  for (let py = top - sy; py <= bottom + sy; py += 2) {
    // Las x del tramo cuyo pie llega a esta fila, más el ancho del pie.
    const lo = Math.max(top, py - sy),
      hi = Math.min(bottom, py + sy);
    if (lo > hi) continue;
    const at = (y) =>
      steep
        ? from.x + ((to.x - from.x) * (y - from.y)) / (to.y - from.y)
        : from.x;
    const xs = steep ? [at(lo), at(hi)] : [from.x, to.x];
    const left = (Math.min(...xs) - sx) / TILE,
      right = (Math.max(...xs) + sx) / TILE;
    if (waterInSpan(waterSpans(data, py / TILE), left, right)) return false;
  }
  return true;
}
module.exports = {
  TILE,
  clamp,
  distance,
  random,
  hash,
  segmentDistance,
  inRect,
  overlaps,
  collisionBounds,
  spriteBounds,
  insideThreshold,
  FOOTPRINT,
  actorBounds,
  waterAt,
  dryFootprint,
  dryAlong,
};
