"use strict";
const { overlaps } = require("./geometry");

/**
 * ⛔ EL BOSQUE ENTERO SE CONSTRUYE, Y LO QUE SE ENUMERA ES LO PROHIBIDO (17-sep-2026, decisión
 * del dueño: «que realmente todo el mapa en general sea construible… añadiría zonas protegidas
 * donde no se puede construir, pero no hacer zonas permitidas sino al revés, zonas prohibidas»).
 *
 * Hasta hoy una zona era un RECTÁNGULO dentro de una pantalla y todo lo demás era intocable: el
 * claro de los sauces medía 48×30 dentro de un río de 128×144. Eso convertía el mundo compartido
 * en una parcela, y una parcela no es un espacio social. Ahora la zona ES la pantalla y lo que se
 * escribe a mano es la lista de sitios donde NO se puede dejar nada.
 *
 * La diferencia importa más de lo que parece: una lista de permitido hay que ampliarla cada vez
 * que el mapa crece, y mientras nadie la amplía el mundo está cerrado; una lista de prohibido
 * nace cubriendo el mapa entero y solo se toca cuando aparece algo que proteger.
 *
 * DOS FORMAS DE OCUPAR EL SUELO, Y UNA SOLA REGLA PARA LAS DOS (17-sep-2026).
 *
 * Una pieza suelta —un banco, una farolita— ocupa su HUELLA, un rectángulo que gira con ella.
 * Una vallita o un camino ocupan un TRAZADO: una polilínea de vértices, exactamente el mismo dato
 * que dibuja el Estudio (`fence: { points }`), para que una valla del bosque y una valla de la
 * casa se pinten igual, colisionen igual y se puedan editar por los dos sitios. Lo pidió el
 * dueño: «el resultado guardado debe ser el mismo de modo que se renderice igual venga del
 * estudio o venga del publico y sea editable por ambos».
 *
 * Todo lo que juzga el terreno —dentro del mapa, sobre hierba, sin pisar a nadie, sin cerrarle el
 * paso a la gente— pregunta lo mismo: `shapes()`, que devuelve los rectángulos que esa pieza
 * ocupa sea cual sea su forma. Y el coste también: una pieza suelta cuesta lo que cuesta y un
 * trazado cuesta POR CELDA, que es lo que hace que una valla larga valga más que una corta.
 */
const POLYLINE_HALF = 0.25; // lo que el trazado ocupa a cada lado, en tiles
const POLYLINE_MAX_POINTS = 8;
const POLYLINE_MAX_LENGTH = 24;
const POLYLINE_MIN_SEGMENT = 1;

/**
 * ⛔ UN TRAZADO SE EMPALMA O SE APARTA, PERO NO SE PONE AL LADO (decisión del dueño: «solo hacer
 * extensión o bifurcación pero no paralelo a camino; en paralelo a camino debe haber x celdas, lo
 * mismo para vallas»).
 *
 * Sin esta regla, el bosque compartido acaba como acaba siempre: seis caminos paralelos a media
 * celda porque cada persona traza el suyo al lado del anterior. Con ella, unirse a lo que ya hay
 * es lo FÁCIL —tocar vale— y duplicarlo es lo que no se puede.
 *
 * Se mide sobre el trazo NUEVO, muestreando cada media celda, la distancia al trazo más cercano
 * de su mismo tipo. De ahí salen dos cosas, y las dos son la misma idea:
 *
 *  · CONTACTO (d ≤ JOIN): un empalme, un cruce o una bifurcación. Vale, pero en TRAMOS CORTOS —
 *    si el contacto dura más de `CONTACT_RUN` celdas no te estás uniendo, estás calcando.
 *  · BANDA (JOIN < d < separación): ahí no se puede vivir. Se permite solo mientras te ALEJAS de
 *    un empalme, que es lo que hace cualquier bifurcación de verdad al nacer: se mide la
 *    distancia recorrida a lo largo del propio trazo desde el contacto más cercano.
 *
 * Distinto tipo no se estorba: una valla al lado de un camino es exactamente lo que uno quiere
 * poner, así que la regla solo mira a los de su especie. Que una valla no se pueda plantar ENCIMA
 * de un camino lo dice la otra regla, la de ocupar el mismo sitio.
 */
const POLYLINE_JOIN = 0.5; // tocarse: un empalme, no un vecino
const POLYLINE_CONTACT_RUN = 1.5; // lo más que puede durar un contacto sin ser un calco
const POLYLINE_SAMPLE = 0.5; // cada cuánto se mira, en tiles

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
        (v) =>
          Number.isFinite(v) && Math.abs(v) <= 64 && Number.isInteger(v * 2),
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

/** Los vértices de un trazado en coordenadas de la pantalla. */
function absolutePoints(object) {
  return object.points.map((p) => [object.x + p[0], object.y + p[1]]);
}

/** Lo cerca que pasa un punto de un segmento y POR DÓNDE. La aritmética de toda la vecindad. */
function pointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    len = dx * dx + dy * dy;
  let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { distance: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)), t };
}

/**
 * Lo más cerca que pasa un punto de cualquiera de estos trazos, y si eso que tiene más cerca es
 * una PUNTA: el primer vértice del primer tramo o el último del último.
 *
 * ⛔ PASAR CERCA DE DONDE UN TRAZO SE ACABA NO ES IR EN PARALELO A ÉL, y sin esa distinción una
 * PUERTECITA ERA IMPOSIBLE. Medido con el validador de verdad, dos vallas en línea: empalmadas
 * valen; a media celda valen y no se lo discute nadie, aunque dejen cero de paso; y de UNA celda
 * a DOS Y MEDIA —que es justo el hueco por el que cabe un duende— se caían todas por
 * `too_close`. Solo volvía a valer a partir de la separación entera, tres celdas, que son cuarenta
 * píxeles de portón. O sea que se podía empalmar o dejar un portón, y nada en medio, porque la
 * regla mide distancia de punto a segmento y con eso una puerta y un paralelo son el mismo número.
 *
 * Lo que NO se afloja: contra el INTERIOR de un trazo la banda sigue prohibida, así que un
 * paralelo de verdad se cae igual en cuanto avanza un par de celdas y lo más cercano deja de ser
 * la punta. La regla sigue diciendo lo que decía; lo único que aprende es por dónde le pasas.
 */
function distanceToTraces(px, py, traces) {
  let best = Infinity,
    tip = false;
  for (const points of traces)
    for (let i = 1; i < points.length; i++) {
      const near = pointToSegment(
        px,
        py,
        points[i - 1][0],
        points[i - 1][1],
        points[i][0],
        points[i][1],
      );
      if (near.distance >= best) continue;
      best = near.distance;
      tip = (i === 1 && near.t <= 0) || (i === points.length - 1 && near.t >= 1);
    }
  return { distance: best, tip };
}

/**
 * Las muestras del trazo candidato: cuánto llevas recorrido y a qué distancia pasa lo más cercano
 * de su mismo tipo. Muestrear a media celda es lo mismo que hace la rejilla de colocación, así
 * que no aparece una precisión que la persona no pueda ni elegir.
 */
function traceSamples(points, traces) {
  const out = [];
  let travelled = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1],
      [bx, by] = points[i],
      length = Math.hypot(bx - ax, by - ay),
      steps = Math.max(1, Math.round(length / POLYLINE_SAMPLE));
    for (let s = i === 1 ? 0 : 1; s <= steps; s++) {
      const t = s / steps;
      out.push({
        at: travelled + length * t,
        ...distanceToTraces(ax + (bx - ax) * t, ay + (by - ay) * t, traces),
      });
    }
    travelled += length;
  }
  return out;
}

/** Por qué este trazo no puede vivir donde lo pones, o null. Ver el bloque de arriba. */
function neighbourhoodReason(samples, separation) {
  let run = null;
  for (const sample of samples) {
    if (sample.distance <= POLYLINE_JOIN) {
      run ??= sample.at;
      if (sample.at - run > POLYLINE_CONTACT_RUN) return "too_close";
    } else run = null;
  }
  if (!(separation > POLYLINE_JOIN)) return null;
  const joins = samples
    .filter((s) => s.distance <= POLYLINE_JOIN)
    .map((s) => s.at);
  for (const sample of samples) {
    if (sample.distance <= POLYLINE_JOIN || sample.distance >= separation)
      continue;
    // Le pasas por la PUNTA: una puertecita, una esquina o un empalme que aún no toca.
    if (sample.tip) continue;
    if (!joins.some((at) => Math.abs(sample.at - at) <= separation))
      return "too_close";
  }
  return null;
}

/** Lo que cuesta una pieza: lo suyo, o tantos palitos por celda de trazado. */
function objectCost(object, definition) {
  if (definition.shape !== "polyline") return definition.cost;
  const tiles = Math.max(1, Math.ceil(polylineLength(object.points)));
  return Object.fromEntries(
    Object.entries(definition.costPerTile).map(([id, n]) => [id, n * tiles]),
  );
}

/**
 * La máscara de suelo: una celda por tile, 1 si ahí se puede estar de pie. Sale del MISMO sitio
 * en los dos lados —el compilador la hornea para el servidor y el navegador la saca de la
 * pantalla que ya tiene cargada—, así que no hay una segunda definición a mano de dónde hay agua
 * o árboles. Se comprueba a máquina que las dos coinciden.
 */
function groundMask(width, height, standable) {
  const cells = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (standable(x, y)) cells[y * width + x] = 1;
  return { width, height, cells };
}
/** La misma máscara leída de las filas compactas que viajan en el contrato. */
function maskFromRows(rows) {
  const height = rows.length,
    width = rows[0]?.length || 0,
    cells = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (rows[y][x] === "1") cells[y * width + x] = 1;
  return { width, height, cells };
}
const standing = (ground, x, y) =>
  x >= 0 &&
  y >= 0 &&
  x < ground.width &&
  y < ground.height &&
  ground.cells[y * ground.width + x] === 1;

function validateConstruction(items, zoneId, catalog, ground, candidateId, sharedBounds = []) {
  const zone = catalog.zones[zoneId];
  if (!zone) return "unknown_zone";
  if (items.length > (zone.maxObjects ?? catalog.maxObjectsPerZone))
    return "zone_full";
  const occupied = [],
    blocking = [...sharedBounds];
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
    const a = rect(zone.bounds);
    // ⛔ UN CAMINO NO ES UN OBSTÁCULO. Ocupa sitio —no se entierra un banco debajo— pero se
    // ANDA por encima, así que no puede contar en el relleno por inundación: si contara, tres
    // caminos cruzando el claro lo dejarían incomunicado, que es exactamente lo contrario de lo
    // que hace un camino.
    const pisable = def.walkable === true;
    // ⛔ UN TRAZADO SE PISA A SÍ MISMO EN CADA ESQUINA, y eso no es chocar con nada: los tramos
    // comparten vértice por definición. Así que sus rectángulos se juzgan contra lo que YA había
    // y entran todos juntos al final, no de uno en uno contra los suyos.
    const own = shapes(object, def);
    /**
     * ⛔ LO PROHIBIDO JUZGA LO QUE PONES, NO LO QUE YA HABÍA.
     *
     * Las dos reglas nuevas —dónde no se puede dejar nada y no calcar un trazo— miran SOLO a la
     * pieza candidata, y eso no es una laguna: es lo que impide que ampliar la lista de sitios
     * protegidos condene un banco que alguien colocó hace tres semanas cuando ese sitio era
     * legal. Si la validación entera se aplicara a todo, bastaría con proteger un rincón nuevo
     * para que el rincón se quedara CONGELADO: cualquier cosa que alguien intentara poner, en
     * cualquier esquina, fallaría por culpa de un banco ajeno. Lo que sí juzga a todos es la
     * disposición —caber en el mapa, no pisarse, no cerrarle el paso a nadie—, porque eso
     * describe el resultado y no el permiso.
     */
    // Mismo criterio que la autoridad: sin id no hay candidato. Con `undefined === undefined`
    // una pieza sin identidad se juzgaría a sí misma como la recién puesta y los dos motores
    // dirían cosas distintas sobre el mismo mapa.
    const candidate = object.id != null && object.id === candidateId;
    for (const b of own) {
      if (!pisable && sharedBounds.some(r => overlaps(b, r))) return "objects_overlap";
      if (
        b.x < a.x ||
        b.y < a.y ||
        b.x + b.w > a.x + a.w ||
        b.y + b.h > a.y + a.h
      )
        return "outside_zone";
      if (candidate && zone.protected.some((r) => overlaps(b, rect(r))))
        return "protected_access";
      // Dos trazados del mismo tipo SÍ pueden tocarse: eso es un empalme, y sin permitirlo no
      // existirían ni la extensión ni la bifurcación. Lo que no pueden es calcarse, y de eso se
      // encarga la regla de vecindad unas líneas más abajo.
      if (
        occupied.some((r) => !(r.joins === object.kind) && overlaps(b, r.rect))
      )
        return "objects_overlap";
      if (ground)
        for (let y = b.y; y <= b.y + b.h; y += 0.25)
          for (let x = b.x; x <= b.x + b.w; x += 0.25)
            if (!standing(ground, Math.floor(x), Math.floor(y)))
              return "blocked_terrain";
    }
    if (def.shape === "polyline" && candidate) {
      const mine = absolutePoints(object);
      // Se descarta POR IDENTIDAD y no por referencia, igual que la autoridad: es lo que hace que
      // los dos motores lean la misma lista de vecinos cuando la pieza llega por la red.
      const others = items
        .filter(
          (o) =>
            (o.id ?? null) !== (object.id ?? null) &&
            o.kind === object.kind &&
            catalog.definitions[o.kind].shape === "polyline",
        )
        .map(absolutePoints);
      if (others.length) {
        const reason = neighbourhoodReason(
          traceSamples(mine, others),
          def.separation ?? 0,
        );
        if (reason) return reason;
      }
    }
    for (const b of own)
      occupied.push({
        rect: b,
        joins: def.shape === "polyline" ? object.kind : null,
      });
    if (!pisable) blocking.push(...own);
  }
  return accessConnected(zone, ground, blocking) ? null : "blocked_access";
}
const terrainCache = new WeakMap();
/** Dense half-tile occupancy: O(cells + stamped footprints), not a hash/string
 * flood fill testing every object at every step of every pointer movement. */
function baseCells(zone, ground) {
  let base = terrainCache.get(zone);
  if (base && base.ground === ground) return base;
  const [x, y, w, h] = zone.bounds;
  const left = x * 2,
    top = y * 2,
    columns = w * 2 + 1,
    rows = h * 2 + 1;
  const cells = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++)
      if (
        ground &&
        !standing(
          ground,
          Math.floor((left + col) / 2),
          Math.floor((top + row) / 2),
        )
      )
        cells[row * columns + col] = 1;
  base = { ground, left, top, columns, rows, cells };
  terrainCache.set(zone, base);
  return base;
}

/**
 * ⛔ CONSTRUIR NO PUEDE PARTIR EL MUNDO EN DOS, Y «EL MUNDO» YA NO ES UN CLARO.
 *
 * Con la pantalla entera construible, la pregunta deja de ser «¿se llega al claro?» y pasa a ser
 * «¿sigue llegándose a todo lo que importa?»: las puertas, los muelles, los vecinos y cada cosa
 * con la que se puede hacer algo. Esos anclajes los compila el mismo paso que hornea el suelo, y
 * van AGRUPADOS por la isla en la que nacen: las dos orillas de un río no están unidas a pie y
 * exigir que lo estén invalidaría cualquier cosa que se pusiera. Lo que se exige es que nadie
 * REDUZCA lo que ya estaba unido.
 */
function accessConnected(zone, ground, occupied) {
  const base = baseCells(zone, ground);
  const { left, top, columns, rows } = base,
    cells = base.cells.slice();
  for (const b of occupied) {
    const x0 = Math.max(0, Math.floor((b.x - 0.4) * 2) + 1 - left);
    const x1 = Math.min(
      columns - 1,
      Math.ceil((b.x + b.w + 0.4) * 2) - 1 - left,
    );
    const y0 = Math.max(0, Math.floor((b.y - 0.4) * 2) + 1 - top);
    const y1 = Math.min(rows - 1, Math.ceil((b.y + b.h + 0.4) * 2) - 1 - top);
    for (let y = y0; y <= y1; y++)
      cells.fill(1, y * columns + x0, y * columns + x1 + 1);
  }
  const at = ([x, y]) => (y * 2 - top) * columns + x * 2 - left;
  const queue = new Uint32Array(cells.length);
  // Cada isla se rellena con su propia marca y solo el 0 es suelo libre. No hace falta limpiar
  // entre una y otra: construir solo PARTE lo que estaba unido, nunca lo une, así que una celda
  // que alcanzó la primera isla es inalcanzable para la segunda por definición.
  for (let group = 0; group < zone.accessGroups.length; group++) {
    const anchors = zone.accessGroups[group],
      mark = group + 2;
    const start = at(anchors[0]);
    if (cells[start]) return false;
    let tail = 0;
    queue[tail++] = start;
    cells[start] = mark;
    const enqueue = (i) => {
      if (!cells[i]) {
        cells[i] = mark;
        queue[tail++] = i;
      }
    };
    for (let head = 0; head < tail; head++) {
      const i = queue[head],
        x = i % columns;
      if (x) enqueue(i - 1);
      if (x + 1 < columns) enqueue(i + 1);
      if (i >= columns) enqueue(i - columns);
      if (i + columns < cells.length) enqueue(i + columns);
    }
    if (!anchors.every((p) => cells[at(p)] === mark)) return false;
  }
  return true;
}
module.exports = {
  bounds,
  shapes,
  absolutePoints,
  objectCost,
  polylineReason,
  validateConstruction,
  groundMask,
  maskFromRows,
  POLYLINE_MIN_SEGMENT,
  POLYLINE_HALF,
};
