"use strict";
const { TILE, distance } = require("./geometry");
/** A* over dry actor-sized cells; geometric checks also protect curved shore edges. */
function findPath(world, from, target) {
  let sx = Math.floor(from.x / TILE),
    sy = Math.floor(from.y / TILE),
    tx = Math.floor(target.x / TILE),
    ty = Math.floor(target.y / TILE);

  if (!world.walkable(tx, ty)) return null;
  if (!world.walkable(sx, sy)) {
    const connectors = [];
    for (let y = sy - 1; y <= sy + 1; y++)
      for (let x = sx - 1; x <= sx + 1; x++) {
        const p = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
        if (world.walkable(x, y) && world.clearSegment(from, p))
          connectors.push(p);
      }
    connectors.sort((a, b) => distance(a, from) - distance(b, from));
    for (const point of connectors) {
      const route = findPath(world, point, target);
      if (route) return [point, ...route];
    }
    return null;
  }
  const start = sy * world.width + sx,
    goal = ty * world.width + tx,
    w = world.width;
  const g = new Float32Array(world.blocked.length).fill(Infinity),
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
  while (heap.length) {
    const cur = pop();
    if (closed[cur]) continue;
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
      if (!out.length || !world.clearSegment(from, out[0]))
        out.unshift({ x: (sx + 0.5) * TILE, y: (sy + 0.5) * TILE });
      return out;
    }
    closed[cur] = 1;
    const x = cur % w,
      y = Math.floor(cur / w);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (
          (!dx && !dy) ||
          !world.walkable(x + dx, y + dy) ||
          (dx &&
            dy &&
            (!world.walkable(x + dx, y) || !world.walkable(x, y + dy)))
        )
          continue;
        const id = (y + dy) * w + x + dx,
          cost = g[cur] + (dx && dy ? Math.SQRT2 : 1);
        if (closed[id] || cost >= g[id]) continue;
        if (
          !world.clearTerrainSegment(
            { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE },
            { x: (x + dx + 0.5) * TILE, y: (y + dy + 0.5) * TILE },
          )
        )
          continue;
        g[id] = cost;
        parents[id] = cur;
        push(id, cost + heuristic(id));
      }
  }
  return null;
}

module.exports = { findPath };
