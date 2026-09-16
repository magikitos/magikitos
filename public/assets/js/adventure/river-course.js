"use strict";
/** Authored river banks, shared by physics, shoreline paint and flow. Coordinates
 * are [y, west bank, east bank]. Monotone Hermite interpolation avoids overshoot,
 * repeated sine waves and width jumps; constant end spans make seamless joins. */
const cache = new WeakMap();
function course(river) {
  if (cache.has(river)) return cache.get(river);
  const points = river.banks;
  if (!points?.length) return null;
  const slopes = points.map((p, i) =>
    [1, 2].map((col) => {
      if (!i || i === points.length - 1) return 0;
      const a = (p[col] - points[i - 1][col]) / (p[0] - points[i - 1][0]);
      const b = (points[i + 1][col] - p[col]) / (points[i + 1][0] - p[0]);
      return a * b > 0 ? (2 * a * b) / (a + b) : 0;
    }),
  );
  const data = {
    points,
    slopes,
    left: Math.min(...points.map((p) => p[1])),
    right: Math.max(...points.map((p) => p[2])),
  };
  cache.set(river, data);
  return data;
}
function riverSection(river, y) {
  const data = course(river);
  if (!data)
    return {
      left: river.rect[0],
      right: river.rect[0] + river.rect[2],
      tangent: 0,
    };
  const { points, slopes } = data;
  let i = 1;
  while (i < points.length - 1 && y > points[i][0]) i++;
  const a = points[i - 1],
    b = points[i],
    h = b[0] - a[0];
  const t = Math.max(0, Math.min(1, (y - a[0]) / h));
  const t2 = t * t,
    t3 = t2 * t;
  const values = [1, 2].map(
    (col, j) =>
      (2 * t3 - 3 * t2 + 1) * a[col] +
      (t3 - 2 * t2 + t) * h * slopes[i - 1][j] +
      (-2 * t3 + 3 * t2) * b[col] +
      (t3 - t2) * h * slopes[i][j],
  );
  const derivatives = [1, 2].map(
    (col, j) =>
      ((6 * t2 - 6 * t) * a[col] +
        (3 * t2 - 4 * t + 1) * h * slopes[i - 1][j] +
        (-6 * t2 + 6 * t) * b[col] +
        (3 * t2 - 2 * t) * h * slopes[i][j]) /
      h,
  );
  return {
    left: values[0],
    right: values[1],
    tangent: (derivatives[0] + derivatives[1]) / 2,
  };
}
function riverEnvelope(river) {
  const data = course(river);
  return data
    ? { left: data.left, right: data.right }
    : { left: river.rect[0], right: river.rect[0] + river.rect[2] };
}
module.exports = { riverSection, riverEnvelope };
