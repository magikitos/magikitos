"use strict";
const { TILE, distance } = require("./geometry");

/** String-pull the route using the same live body geometry as movement. Keep
 * long visible diagonals instead of steering through every tile center. The
 * 64-waypoint horizon bounds work even in a deliberately zig-zagging maze. */
function smoothPath(world, from, points, ignore = from) {
  const result = [];
  let previous = from,
    index = 0;
  while (index < points.length) {
    if (world.clearSegment(previous, points.at(-1), ignore)) {
      result.push(points.at(-1));
      break;
    }
    let next = Math.min(points.length - 1, index + 63);
    while (next > index && !world.clearSegment(previous, points[next], ignore))
      next--;
    const point = points[next];
    // Adjacent visible legs on the same line need no steering waypoint either.
    const before = result.length > 1 ? result[result.length - 2] : from;
    const ax = previous.x - before.x,
      ay = previous.y - before.y;
    const bx = point.x - previous.x,
      by = point.y - previous.y;
    if (
      result.length &&
      Math.abs(ax * by - ay * bx) < 1e-6 &&
      ax * bx + ay * by >= 0
    )
      result.pop();
    result.push(point);
    previous = point;
    index = next + 1;
  }
  return result;
}
/** A* over dry actor-sized cells; geometric checks also protect curved shore edges.
 *
 * ⛔ `limit` ACOTA LAS CASILLAS QUE SE CIERRAN, y lo piden los vecinos, nunca el jugador. Un
 * destino al otro lado de la pradera —o uno al que no se llega— hace que el A* recorra el mapa
 * entero: 67 ms medidos en un solo tick, casi 300 en un teléfono, y ese era el tirón al volver a la
 * pradera. Quien clica quiere llegar aunque cueste; a un vecino le basta con dar la vuelta. */
function findPath(world, from, target, ignore = from, limit = Infinity) {
  // Occupancy cells alone miss feet overlapping a prop at a cell edge, and
  // residents are deliberately not baked into the static grid. Cache the live
  // body checks only for this search; the next search sees their new positions.
  // Los límites se miran AQUÍ, una vez: quien contesta por una casilla contesta por una casilla
  // que existe, y así el mundo del pie y el de la barca dicen lo mismo sin repetir la guarda.
  const cells = new Map();
  const walkable = (x, y) => {
    if (x < 0 || y < 0 || x >= world.width || y >= world.height) return false;
    const id = y * world.width + x;
    if (!cells.has(id)) cells.set(id, world.cellCanStand(x, y, ignore));
    return cells.get(id);
  };
  const clear = (a, b) => world.clearSegment(a, b, ignore);
  let sx = Math.floor(from.x / TILE),
    sy = Math.floor(from.y / TILE),
    tx = Math.floor(target.x / TILE),
    ty = Math.floor(target.y / TILE);

  if (!walkable(tx, ty)) return null;
  const destination = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
  if (clear(from, destination)) return [destination];
  if (
    !walkable(sx, sy) ||
    !clear(from, { x: (sx + 0.5) * TILE, y: (sy + 0.5) * TILE })
  ) {
    const connectors = [];
    for (let y = sy - 1; y <= sy + 1; y++)
      for (let x = sx - 1; x <= sx + 1; x++) {
        const p = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
        if (walkable(x, y) && clear(from, p)) connectors.push(p);
      }
    connectors.sort((a, b) => distance(a, from) - distance(b, from));
    for (const point of connectors) {
      const route = findPath(world, point, target, ignore, limit);
      if (route) return [point, ...route];
    }
    return null;
  }
  const start = sy * world.width + sx,
    goal = ty * world.width + tx,
    w = world.width;
  const g = new Float32Array(world.width * world.height).fill(Infinity),
    parents = new Int32Array(g.length).fill(-1),
    closed = new Uint8Array(g.length);
  // Binary heap keeps long cross-map clicks O(n log n), not repeated linear open-list scans.
  const heap = [];
  const heuristic = (id) => Math.hypot((id % w) - tx, Math.floor(id / w) - ty);
  const push = (id, cost) => {
    let i = heap.length;
    heap.push({ id, cost });
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].cost <= cost) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const first = heap[0],
      last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= heap.length) break;
        if (c + 1 < heap.length && heap[c + 1].cost < heap[c].cost) c++;
        if (heap[i].cost <= heap[c].cost) break;
        [heap[i], heap[c]] = [heap[c], heap[i]];
        i = c;
      }
    }
    return first.id;
  };
  g[start] = 0;
  push(start, heuristic(start));
  let expanded = 0;
  while (heap.length) {
    const cur = pop();
    if (closed[cur]) continue;
    if (++expanded > limit) return null;
    if (cur === goal) {
      const out = [];
      for (let n = goal; n !== start; n = parents[n])
        out.push({
          x: ((n % w) + 0.5) * TILE,
          y: (Math.floor(n / w) + 0.5) * TILE,
        });
      out.reverse();
      // Re-targeting mid-step must not turn back to the center of the current tile.
      // Keep that alignment waypoint only when skipping it would cut a blocked corner.
      if (!out.length || !clear(from, out[0]))
        out.unshift({ x: (sx + 0.5) * TILE, y: (sy + 0.5) * TILE });
      return smoothPath(world, from, out, ignore);
    }
    closed[cur] = 1;
    steps(w, walkable, clear, cur, (id, step, open) => {
      const cost = g[cur] + step;
      if (closed[id] || cost >= g[id] || !open()) return;
      g[id] = cost;
      parents[id] = cur;
      push(id, cost + heuristic(id));
    });
  }
  return null;
}
/**
 * The eight moves out of a cell, with the rule every search shares: no corner cutting and a clear
 * straight segment between the two cell centres. `findPath` and `reachableCells` both walk
 * through here, so "reachable" can never disagree with "has a route".
 */
function steps(w, walkable, clear, cur, visit) {
  const x = cur % w,
    y = Math.floor(cur / w);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (
        (!dx && !dy) ||
        !walkable(x + dx, y + dy) ||
        (dx && dy && (!walkable(x + dx, y) || !walkable(x, y + dy)))
      )
        continue;
      const id = (y + dy) * w + x + dx;
      visit(id, dx && dy ? Math.SQRT2 : 1, () =>
        clear(
          { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE },
          { x: (x + dx + 0.5) * TILE, y: (y + dy + 0.5) * TILE },
        ),
      );
    }
}
/**
 * ⛔ UNA SOLA INUNDACIÓN PARA SABER A QUÉ SE PUEDE LLEGAR (23-sep-2026, repaso de rendimiento).
 * `approach()` probaba hasta 169 casillas alrededor del objetivo con una búsqueda completa cada
 * una, así que tocar algo al otro lado del río congelaba el juego 13,8 s en un portátil (medido).
 * Esto recorre UNA vez lo alcanzable desde `from` y devuelve las casillas tocadas; con eso se
 * elige la mejor candidata alcanzable y se busca ruta solo a ella.
 */
function reachableCells(world, from, ignore = from, limit = Infinity) {
  const w = world.width,
    known = new Map();
  const walkable = (x, y) => {
    if (x < 0 || y < 0 || x >= world.width || y >= world.height) return false;
    const id = y * w + x;
    if (!known.has(id)) known.set(id, world.cellCanStand(x, y, ignore));
    return known.get(id);
  };
  const clear = (a, b) => world.clearSegment(a, b, ignore);
  const seen = new Uint8Array(world.width * world.height),
    queue = [];
  const sx = Math.floor(from.x / TILE),
    sy = Math.floor(from.y / TILE);
  // Same start rule as `findPath`: the own cell if you can stand there and reach its centre,
  // otherwise every neighbour you can step onto in a straight line.
  const centre = (x, y) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
  const seed = (x, y) => {
    const id = y * w + x;
    if (!seen[id]) {
      seen[id] = 1;
      queue.push(id);
    }
  };
  if (walkable(sx, sy) && clear(from, centre(sx, sy))) seed(sx, sy);
  else
    for (let y = sy - 1; y <= sy + 1; y++)
      for (let x = sx - 1; x <= sx + 1; x++)
        if (walkable(x, y) && clear(from, centre(x, y))) seed(x, y);
  for (let i = 0; i < queue.length && i < limit; i++)
    steps(w, walkable, clear, queue[i], (id, _step, open) => {
      if (seen[id] || !open()) return;
      seen[id] = 1;
      queue.push(id);
    });
  return seen;
}

module.exports = { findPath, smoothPath, reachableCells };
