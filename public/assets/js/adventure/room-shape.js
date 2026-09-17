"use strict";
/** One scene-authored footprint shared by navigation, floor, wall and light clipping.
 * Normalised vertices let a room grow without divergent wall coordinates. */
const cache = new WeakMap();
function outline(data) {
  if (cache.has(data)) return cache.get(data);
  const bounds = data.interior?.inset || {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  };
  const points = (
    data.interior?.outline || [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
  ).map(([x, y]) => [
    (bounds.left + x * (data.width - bounds.left - bounds.right)) * 16,
    (bounds.top + y * (data.height - bounds.top - bounds.bottom)) * 16,
  ]);
  cache.set(data, points);
  return points;
}
function contains(data, x, y) {
  if (!data.interior?.outline) return true;
  const points = outline(data);
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i],
      [bx, by] = points[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
      inside = !inside;
  }
  return inside;
}
function trace(c, data) {
  const points = outline(data);
  c.beginPath();
  c.moveTo(...points[0]);
  for (const p of points.slice(1)) c.lineTo(...p);
  c.closePath();
}
const THEMES = Object.freeze({
  mushroom: {
    base: "#b39776", light: "#c3ab89", grain: "#a58b6b",
    wall: "#8a644a", rim: "#d5bb92", seam: "#785840", woven: false,
  },
  clay: {
    base: "#b08666", light: "#bd9878", grain: "#a57c5d",
    wall: "#8b573e", rim: "#ceab80", seam: "#774831", woven: false,
  },
  bark: {
    base: "#92704d",
    light: "#a7865f",
    grain: "#87623f",
    wall: "#5b3c25",
    rim: "#b29463",
    seam: "#3d2b1f",
    woven: false,
  },
  leaf: {
    base: "#8c9161",
    light: "#a3a879",
    grain: "#7a8256",
    wall: "#58613b",
    rim: "#abb477",
    seam: "#37432a",
    woven: true,
  },
  leather: {
    base: "#95714d",
    light: "#ae8960",
    grain: "#846140",
    wall: "#553923",
    rim: "#b28a56",
    seam: "#36281e",
    woven: false,
  },
});
function theme(data) {
  return THEMES[data.interior?.material] || THEMES.bark;
}
module.exports = { outline, contains, trace, theme };
