"use strict";
const {
  catalogGround,
} = require("../public/assets/js/adventure/construction-ground");

/**
 * ⛔ LO QUE SE PUEDE Y LO QUE NO SE COMPILA DE LA PANTALLA, NO SE ESCRIBE A MANO.
 *
 * Solo en tiempo de horneado, del MISMO terreno y los MISMOS colisionadores que juega la gente.
 * El servidor recibe filas compactas: ni una segunda definición a mano de dónde hay agua o
 * árboles, que es lo que caduca el día que alguien mueve algo en el Studio.
 *
 * Y desde que el bosque entero se construye (17-sep-2026) esto compila tres cosas más, todas por
 * la misma razón. La barbacoa del merendero se movió un cuarto de casilla esa misma mañana y tapó
 * el felpudo de una casa: si los sitios protegidos y los anclajes de paso fueran una lista escrita
 * a mano, hoy estarían protegiendo el sitio donde la barbacoa ESTABA.
 *
 *  · `bounds`    la pantalla entera. La zona ya no es una parcela dentro del mapa.
 *  · `protected` lo prohibido: lo que el propio mundo puso ahí y hace algo —una puerta, un
 *                muelle, un vecino, una seta que se corta— con su margen para poder llegar, más
 *                los rectángulos que el catálogo escribe a mano para un sitio que es de AMBIENTE
 *                y no de un objeto: hoy el rincón del merendero humano y el de la barbacoa. Los
 *                halos se AÑADEN a esos, así que esto se corre una vez sobre un mundo recién
 *                leído, que es lo que hace el horneado.
 *  · `accessGroups` los sitios que tienen que seguir alcanzándose, agrupados por la ISLA en la que
 *                nacen: las dos orillas de un río no están unidas a pie, así que exigir que lo
 *                estén invalidaría cualquier cosa que se pusiera. Lo que se exige es que nadie
 *                reduzca lo que ya estaba unido.
 *
 * ⛔ Y LAS FILAS DE SUELO SE DEVUELVEN APARTE, NO SE PEGAN A LA ZONA. Los tres datos de arriba los
 * necesitan los dos lados y viajan en el mundo; la máscara la necesita SOLO el servidor, porque el
 * navegador la saca de la pantalla que ya tiene cargada (`construction-ground.js`). Medido: son
 * 73 KB de unos y ceros contra un mundo de 105 KB, y el mundo va INCRUSTADO en la página, en seis
 * idiomas — o sea un 70% más de HTML en cada carga para decir algo que el cliente sabe calcular.
 * Que las dos máscaras coincidan lo comprueba `check-construction-layout.cjs`, no la buena fe.
 */
/** Margen alrededor de cada cosa protegida, en tiles. Una puerta necesita más que una seta. */
const MARGIN = { portal: 1.5, dock: 1.5, neighbor: 1, entity: 0.5 };
/** Lo lejos que se busca suelo firme para anclar algo que vive sobre el agua o dentro de un seto. */
const ANCHOR_SEARCH = 4;

const standable = (ground, x, y) =>
  x >= 0 &&
  y >= 0 &&
  x < ground.width &&
  y < ground.height &&
  ground.cells[y * ground.width + x] === 1;

/** La caja de una entidad en tiles, con su margen. Sin `solid`, su propia casilla. */
function haloOf(entity, margin) {
  const [ox, oy, w, h] = entity.solid || [-0.5, -0.5, 1, 1];
  return [
    Math.round((entity.x + ox - margin) * 2) / 2,
    Math.round((entity.y + oy - margin) * 2) / 2,
    Math.round((w + margin * 2) * 2) / 2,
    Math.round((h + margin * 2) * 2) / 2,
  ];
}
/** Lo que hace algo en esta pantalla y por tanto nadie puede tapar ni encerrar. */
function landmarks(data) {
  const out = [];
  const add = (entity, kind) => out.push({ entity, kind });
  for (const entity of data.entities || []) {
    if (entity.generated) continue;
    if (entity.portal) add(entity, "portal");
    else if (entity.landing) add(entity, "dock");
    else if (entity.neighbor || entity.actor) add(entity, "neighbor");
    else if ((entity.rules || []).some((r) => (r.effects || []).length))
      add(entity, "entity");
    else if (entity.interactAs) add(entity, "entity");
  }
  for (const neighbor of data.neighbors || [])
    if (Number.isFinite(neighbor.x) && Number.isFinite(neighbor.y))
      add(neighbor, "neighbor");
  return out;
}

/** El suelo firme más cercano a un punto, o null si ahí no se puede estar y alrededor tampoco. */
function nearestStanding(ground, x, y) {
  const cx = Math.floor(x),
    cy = Math.floor(y);
  for (let r = 0; r <= ANCHOR_SEARCH; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (standable(ground, cx + dx, cy + dy)) return [cx + dx, cy + dy];
      }
  return null;
}

/** Etiqueta cada tile pisable con su isla. Es el mismo relleno que juzga después las vallas. */
function islands(ground) {
  const labels = new Int32Array(ground.width * ground.height).fill(-1);
  const queue = new Int32Array(ground.width * ground.height);
  let next = 0;
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] >= 0 || ground.cells[start] !== 1) continue;
    const label = next++;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = label;
    for (let head = 0; head < tail; head++) {
      const i = queue[head],
        x = i % ground.width;
      const push = (j) => {
        if (labels[j] < 0 && ground.cells[j] === 1) {
          labels[j] = label;
          queue[tail++] = j;
        }
      };
      if (x) push(i - 1);
      if (x + 1 < ground.width) push(i + 1);
      if (i >= ground.width) push(i - ground.width);
      if (i + ground.width < labels.length) push(i + ground.width);
    }
  }
  return labels;
}

function compileCommunityTerrain(world) {
  const terrain = {};
  for (const [id, zone] of Object.entries(world.construction.zones)) {
    const data = world.scenes[zone.scene];
    if (!data) throw Error("Zona sin pantalla: " + id);
    const ground = catalogGround(world, zone.scene);
    zone.bounds = [0, 0, ground.width, ground.height];
    terrain[id] = Array.from({ length: ground.height }, (_, y) =>
      Array.from({ length: ground.width }, (_, x) =>
        ground.cells[y * ground.width + x] ? "1" : "0",
      ).join(""),
    );
    const marks = landmarks(data);
    zone.protected = [
      ...(zone.protected || []),
      ...marks.map(({ entity, kind }) => haloOf(entity, MARGIN[kind])),
    ];
    // El anclaje de una puerta es el felpudo por el que se sale, no el edificio: una casa es
    // sólida y su casilla nunca sería pisable.
    const points = [
      [data.spawn.x, data.spawn.y],
      ...marks.map(({ entity }) => entity.arrival || [entity.x, entity.y]),
    ];
    const anchors = new Map();
    for (const [x, y] of points) {
      const spot = nearestStanding(ground, x, y);
      if (spot) anchors.set(spot.join(","), spot);
    }
    const labels = islands(ground);
    const groups = new Map();
    for (const spot of anchors.values()) {
      const label = labels[spot[1] * ground.width + spot[0]];
      if (label < 0) continue;
      (groups.get(label) || groups.set(label, []).get(label)).push(spot);
    }
    zone.accessGroups = [...groups.values()];
    if (!zone.accessGroups.length)
      throw Error("Zona sin un solo anclaje de paso: " + id);
  }
  return terrain;
}
module.exports = { compileCommunityTerrain };
