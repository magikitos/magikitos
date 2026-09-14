"use strict";
/** Authored paths are bounded polylines in tile units; no raster/image editing involved. */
function validatePaths(scene, paths) {
  if (scene.indoor)
    throw Error("Los caminos de tierra se editan en exteriores");
  if (!Array.isArray(paths) || paths.length > 128)
    throw Error("Máximo 128 caminos por escena");
  let count = 0;
  return paths.map((path) => {
    if (!Array.isArray(path) || path.length < 2 || path.length > 256)
      throw Error("Cada camino necesita entre 2 y 256 puntos");
    count += path.length;
    if (count > 2048) throw Error("Demasiados puntos en esta escena");
    const points = path.map((p) => {
      if (
        !Array.isArray(p) ||
        p.length !== 2 ||
        !p.every(Number.isFinite) ||
        p[0] < 0 ||
        p[1] < 0 ||
        p[0] > scene.width ||
        p[1] > scene.height
      )
        throw Error("Punto de camino fuera del mapa");
      return p.map((n) => Math.round(n * 1000) / 1000);
    });
    for (let i = 1; i < points.length; i++)
      if (
        points[i][0] === points[i - 1][0] &&
        points[i][1] === points[i - 1][1]
      )
        throw Error("Dos puntos seguidos no pueden ocupar el mismo sitio");
    return points;
  });
}
module.exports = { validatePaths };
