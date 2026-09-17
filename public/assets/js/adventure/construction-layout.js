"use strict";
const { overlaps } = require("./geometry");

/**
 * ⛔ DOS FORMAS DE OCUPAR EL SUELO, Y UNA SOLA REGLA PARA LAS DOS (17-sep-2026).
 *
 * Una pieza suelta —un banco, una farolita— ocupa su HUELLA, un rectángulo que gira con ella.
 * Una vallita ocupa un TRAZADO: una polilínea de vértices, exactamente el mismo dato que dibuja
 * el Estudio (`fence: { points }`), para que una valla del bosque y una valla de la casa se
 * pinten igual, colisionen igual y se puedan editar por los dos sitios. Lo pidió el dueño: «el
 * resultado guardado debe ser el mismo de modo que se renderice igual venga del estudio o venga
 * del publico y sea editable por ambos».
 *
 * Todo lo que juzga el terreno —dentro del claro, sobre hierba, sin pisar a nadie, sin cerrarle
 * el paso a la gente— pregunta lo mismo: `shapes()`, que devuelve los rectángulos que esa pieza
 * ocupa sea cual sea su forma. Y el coste también: una pieza suelta cuesta lo que cuesta y un
 * trazado cuesta POR CELDA, que es lo que hace que una valla larga valga más que una corta.
 */
const POLYLINE_HALF = 0.25; // lo que el trazado ocupa a cada lado, en tiles
const POLYLINE_MAX_POINTS = 8;
const POLYLINE_MAX_LENGTH = 24;
const POLYLINE_MIN_SEGMENT = 1;

function bounds(object, definition) {
  let [x, y, w, h] = definition.footprint;
  if (object.rotation === 1) [x, y, w, h] = [-y - h, x, h, w];
  return { x: object.x + x, y: object.y + y, w, h };
}
const rect = ([x, y, w, h]) => ({ x, y, w, h });

/** El largo de un trazado en tiles. Los puntos son relativos a la propia pieza. */
function polylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
    );
  return length;
}

/**
 * Por qué un trazado no vale, o null si vale. El primer vértice es SIEMPRE [0,0]: la pieza está
 * donde empieza su valla, así que su x/y significa lo mismo que en cualquier otra pieza.
 */
function polylineReason(points) {
  if (
    !Array.isArray(points) ||
    points.length < 2 ||
    points.length > POLYLINE_MAX_POINTS ||
    !Array.isArray(points[0]) ||
    points[0][0] !== 0 ||
    points[0][1] !== 0
  )
    return "invalid_points";
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      !p.every(
        (v) => Number.isFinite(v) && Math.abs(v) <= 64 && Number.isInteger(v * 2),
      )
    )
      return "invalid_points";
    if (
      i &&
      Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) <
        POLYLINE_MIN_SEGMENT
    )
      return "invalid_points";
  }
  return polylineLength(points) > POLYLINE_MAX_LENGTH ? "too_long" : null;
}

/** Los rectángulos que una pieza ocupa: uno si es una huella, uno por tramo si es un trazado. */
function shapes(object, definition) {
  if (definition.shape !== "polyline") return [bounds(object, definition)];
  const out = [];
  for (let i = 1; i < object.points.length; i++) {
    const a = object.points[i - 1],
      b = object.points[i];
    out.push({
      x: object.x + Math.min(a[0], b[0]) - POLYLINE_HALF,
      y: object.y + Math.min(a[1], b[1]) - POLYLINE_HALF,
      w: Math.abs(b[0] - a[0]) + POLYLINE_HALF * 2,
      h: Math.abs(b[1] - a[1]) + POLYLINE_HALF * 2,
    });
  }
  return out;
}

/** Lo que cuesta una pieza: lo suyo, o tantos palitos por celda de trazado. */
function objectCost(object, definition) {
  if (definition.shape !== "polyline") return definition.cost;
  const tiles = Math.max(1, Math.ceil(polylineLength(object.points)));
  return Object.fromEntries(
    Object.entries(definition.costPerTile).map(([id, n]) => [id, n * tiles]),
  );
}
function validateConstruction(items, zoneId, catalog) {
  const zone = catalog.zones[zoneId];
  if (!zone) return "unknown_zone";
  if (items.length > catalog.maxObjectsPerZone) return "zone_full";
  const occupied = [],
    blocking = [];
  for (const object of items) {
    const def = catalog.definitions[object.kind];
    if (!def) return "invalid_kind";
    if (
      !def.variants.some((v) => v.id === object.variant) ||
      !def.rotations.includes(object.rotation)
    )
      return "invalid_variant";
    if (!def.surfaces.includes(zone.surface)) return "wrong_surface";
    if (
      ![object.x, object.y].every(
        (n) =>
          Number.isFinite(n) && n >= 0 && n <= 2048 && Number.isInteger(n * 2),
      )
    )
      return "invalid_position";
    if (def.shape === "polyline") {
      const reason = polylineReason(object.points);
      if (reason) return reason;
    } else if (object.points !== undefined) return "invalid_points";
    const a = rect(zone.editable);
    // ⛔ UN CAMINO NO ES UN OBSTÁCULO. Ocupa sitio —no se entierra un banco debajo— pero se
    // ANDA por encima, así que no puede contar en el relleno por inundación: si contara, tres
    // caminos cruzando el claro lo dejarían incomunicado, que es exactamente lo contrario de lo
    // que hace un camino.
    const pisable = def.walkable === true;
    // ⛔ UN TRAZADO SE PISA A SÍ MISMO EN CADA ESQUINA, y eso no es chocar con nada: los tramos
    // comparten vértice por definición. Así que sus rectángulos se juzgan contra lo que YA había
    // y entran todos juntos al final, no de uno en uno contra los suyos.
    const own = shapes(object, def);
    for (const b of own) {
      if (
        b.x < a.x ||
        b.y < a.y ||
        b.x + b.w > a.x + a.w ||
        b.y + b.h > a.y + a.h
      )
        return "outside_zone";
      if (zone.protected.some((r) => overlaps(b, rect(r))))
        return "protected_access";
      if (occupied.some((r) => overlaps(b, r))) return "objects_overlap";
      if (zone.terrain)
        for (let y = b.y; y <= b.y + b.h; y += 0.25)
          for (let x = b.x; x <= b.x + b.w; x += 0.25)
            if (zone.terrain[Math.floor(y)]?.[Math.floor(x)] !== "1")
              return "blocked_terrain";
    }
    occupied.push(...own);
    if (!pisable) blocking.push(...own);
  }
  return accessConnected(zone, blocking) ? null : "blocked_access";
}
const terrainCache = new WeakMap();
/** Dense half-tile occupancy: O(cells + stamped footprints), not a hash/string
 * flood fill testing every object at every step of every pointer movement. */
function accessConnected(zone, occupied) {
  let base = terrainCache.get(zone);
  if (!base) {
    const [x, y, w, h] = zone.editable;
    const left = x * 2, top = y * 2, columns = w * 2 + 1, rows = h * 2 + 1;
    const cells = new Uint8Array(columns * rows);
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++)
      if (zone.terrain && zone.terrain[Math.floor((top + row) / 2)]?.[Math.floor((left + col) / 2)] !== "1")
        cells[row * columns + col] = 1;
    base = { left, top, columns, rows, cells };
    terrainCache.set(zone, base);
  }
  const {left, top, columns, rows} = base, cells = base.cells.slice();
  for (const b of occupied) {
    const x0 = Math.max(0, Math.floor((b.x - .4) * 2) + 1 - left);
    const x1 = Math.min(columns - 1, Math.ceil((b.x + b.w + .4) * 2) - 1 - left);
    const y0 = Math.max(0, Math.floor((b.y - .4) * 2) + 1 - top);
    const y1 = Math.min(rows - 1, Math.ceil((b.y + b.h + .4) * 2) - 1 - top);
    for (let y = y0; y <= y1; y++) cells.fill(1, y * columns + x0, y * columns + x1 + 1);
  }
  const at = ([x,y]) => (y * 2 - top) * columns + x * 2 - left;
  const start = at(zone.access[0]);
  if (cells[start]) return false;
  const queue = new Uint32Array(cells.length);
  queue[0] = start; cells[start] = 2;
  let tail = 1;
  const enqueue = i => { if (!cells[i]) { cells[i] = 2; queue[tail++] = i; } };
  for (let head = 0; head < tail; head++) {
    const i = queue[head], x = i % columns;
    if (x) enqueue(i - 1);
    if (x + 1 < columns) enqueue(i + 1);
    if (i >= columns) enqueue(i - columns);
    if (i + columns < cells.length) enqueue(i + columns);
  }
  return zone.access.every(p => cells[at(p)] === 2);
}
module.exports = {
  bounds,
  shapes,
  objectCost,
  polylineLength,
  validateConstruction,
  POLYLINE_MAX_POINTS,
  POLYLINE_MAX_LENGTH,
};
