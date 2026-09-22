"use strict";
/**
 * THE outdoor ground painter, pure over scene data: the main thread and the terrain worker call
 * these same functions, so a tile painted off-thread is byte-identical to one painted here.
 * Interiors stay on the main thread (`Terrain.chunk`): they stamp sprites and blur a backdrop.
 */
const { TILE, random, hash, waterAt, segmentDistance } = require("./geometry");
const { paintGround, paintVoid, voidWaterAt } = require("./ground");

/**
 * El grano del suelo: 460 briznas deterministas por baldosa, las mismas en una pantalla y en el
 * hueco del plano, para que la costura no se note. `sample(x, y)` dice qué hay bajo ese píxel
 * —`null` si es agua, o uno de los materiales de abajo— y el azar avanza igual pase lo que pase,
 * que es lo que mantiene el dibujo idéntico entre partidas.
 */
const GRASS = { colors: ["#89a364", "#5c7c48"], grass: true, shoulder: false },
  SHOULDER = { ...GRASS, shoulder: true },
  ROAD = { colors: ["#b7a877", "#d4c795"], grass: false, shoulder: false },
  SAND = { colors: ["#c4bb8d", "#e2d4aa"], grass: false, shoulder: false };
function paintTufts(c, rand, sample) {
  for (let i = 0; i < 460; i++) {
    const x = Math.floor(rand() * 256),
      y = Math.floor(rand() * 256),
      blade = sample(x, y);
    if (!blade) {
      if (i % 10 === 0) rand(); // Preserve deterministic land decoration sequence.
      continue;
    }
    c.fillStyle = blade.colors[rand() < 0.5 ? 0 : 1];
    c.fillRect(x, y, 1 + Math.floor(rand() * 2), 1);
    if (blade.grass && (i % 11 === 0 || (blade.shoulder && i % 3 === 0))) {
      c.fillRect(x + 1, y - 2, 1, 3);
      c.fillRect(x + 2, y - 1, 1, 1);
    }
    if (blade.grass && i % 113 === 0) {
      c.fillStyle = "#e0c87d";
      c.fillRect(x, y - 2, 2, 2);
    }
  }
}

/** The part of a scene the ground depends on: small enough to post to the worker per tile. */
function groundData(data) {
  return {
    id: data.id,
    seed: data.seed,
    width: data.width,
    height: data.height,
    baseWater: data.baseWater,
    paths: data.paths,
    communityPaths: data.communityPaths,
    rivers: data.rivers,
    waters: data.waters,
    islands: data.islands,
    bridges: data.bridges,
    regions: (data.regions || []).filter((r) => r.ground === "stone"),
  };
}

/** What `paintOutdoorChunk` asks of a world, built from ground data alone (the worker's side). */
function groundModel(data, origin) {
  const segments = [];
  for (const path of data.paths || [])
    for (let i = 1; i < path.length; i++) segments.push([path[i - 1], path[i]]);
  return {
    data,
    origin,
    waterAt: (x, y) => waterAt(data, x, y),
    pathDistance(x, y) {
      let best = Infinity;
      for (const [a, b] of segments) best = Math.min(best, segmentDistance(x, y, a, b));
      return best;
    },
  };
}

/** One 256 px outdoor tile. `world` is a World or a `groundModel`. */
function paintOutdoorChunk(c, world, key, ox, oy) {
  const data = world.data,
    rand = random(hash(key));
  c.fillStyle = data.baseWater ? "#5b9f9a" : "#547c4c";
  c.fillRect(0, 0, 256, 256);
  paintGround(c, world, ox, oy);
  for (const region of data.regions || [])
    if (region.ground === "stone") {
      const [rx, ry, rw, rh] = region.rect;
      c.save();
      c.beginPath();
      c.rect(rx * TILE - ox, ry * TILE - oy, rw * TILE, rh * TILE);
      c.clip();
      c.fillStyle = "#82907a";
      c.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 8)
        for (let x = y % 16 ? -6 : 0; x < 256; x += 12) {
          c.fillStyle = ["#a4aa88", "#a0a686", "#959f81"][Math.floor(rand() * 3)];
          c.fillRect(x, y, 11, 7);
          c.fillStyle = "#b5b598";
          c.fillRect(x + 1, y, 9, 1);
        }
      c.restore();
    }
  paintTufts(c, rand, (x, y) => {
    const tx = (ox + x) / TILE,
      ty = (oy + y) / TILE;
    if (world.waterAt(tx, ty)) return null;
    // La arena manda sobre el camino: una playa con sendero sigue siendo playa.
    if (
      data.baseWater &&
      (data.islands || []).every(
        (p) => ((tx - p.x) / (p.rx - 2.5)) ** 2 + ((ty - p.y) / (p.ry - 2.5)) ** 2 >= 1,
      )
    )
      return SAND;
    const pathDistance = world.pathDistance(tx, ty);
    if (pathDistance < 1) return ROAD;
    // Sparse grass tips at the path shoulder; no bright patches over the earth.
    return pathDistance < 1.6 ? SHOULDER : GRASS;
  });
}

/** One tile of the void between screens: the nearest edge continued, grass grain, no paths. */
function paintVoidChunk(c, plane, key, ox, oy) {
  paintVoid(c, plane, ox, oy);
  paintTufts(c, random(hash(key)), (x, y) => (voidWaterAt(plane, ox + x, oy + y) ? null : GRASS));
}

/** The continuous-world plane with only the ground data of each screen, to post once. */
function planeGround(plane) {
  return {
    bounds: plane.bounds,
    scenes: plane.scenes.map((s) => ({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h, data: groundData(s.data) })),
  };
}

module.exports = {
  paintTufts, paintOutdoorChunk, paintVoidChunk, groundData, groundModel, planeGround,
  GRASS, SHOULDER, ROAD, SAND,
};
