"use strict";
/** Authored river banks, shared by physics, shoreline paint and flow. Coordinates
 * are [y, west bank, east bank] — or, with `axis: "x"`, [x, north bank, south bank] for a
 * river that runs across the screen (23-sep-2026: the hedge canal and the roots branch were a
 * straight rectangle with square ends; now they meander like the other rivers). Monotone Hermite interpolation avoids overshoot,
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
  // Un vaivén suave y opcional (`river.sway`, en casillas) que se apaga en los dos extremos del
  // trazado, para que una orilla larga y autorada con pocos puntos no parezca una regla: es el
  // mismo que llevaba la costa de la pradera antes de ser el lago (20-sep-2026).
  // El vaivén arranca cuatro casillas después del primer punto y muere cuatro antes del último:
  // los puntos extremos viven fuera de la pantalla (−4 y alto+4) para que el cauce continúe en la
  // vecina, así que en el propio borde el vaivén es CERO y la orilla encaja píxel a píxel con la
  // pantalla de al lado, que no lo lleva.
  const sway = river.sway
    ? river.sway *
      Math.max(0, Math.min(1, (y - points[0][0] - 4) / 4, (points.at(-1)[0] - 4 - y) / 4)) *
      (Math.sin(y * 0.9 + 1.3) * 0.6 + Math.sin(y * 2.3) * 0.4)
    : 0;
  const values = [1, 2].map(
    (col, j) =>
      (2 * t3 - 3 * t2 + 1) * a[col] +
      (t3 - 2 * t2 + t) * h * slopes[i - 1][j] +
      (-2 * t3 + 3 * t2) * b[col] +
      (t3 - t2) * h * slopes[i][j] +
      sway,
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
  const data = course(river),
    sway = river.sway || 0;
  return data
    ? { left: data.left - sway, right: data.right + sway }
    : { left: river.rect[0], right: river.rect[0] + river.rect[2] };
}
const horizontal = (river) => river.axis === "x";
/** Tile box that holds every drop of the river: the broad phase for foot and boat probes. */
function riverBox(river) {
  const [x, y, w, h] = river.rect;
  if (!horizontal(river)) {
    const e = riverEnvelope(river);
    return { left: e.left, right: e.right, top: y, bottom: y + h };
  }
  const e = riverEnvelope(river);
  return { left: x, right: x + w, top: Math.max(y, e.left), bottom: Math.min(y + h, e.right) };
}
/**
 * A river across the screen is asked row by row like every other water (`waterSpans`), and in a
 * row it is whatever columns sit between its two banks. Banks are sampled once per native pixel
 * column (1/16 tile) and kept, so a row is a scan of numbers, never a Hermite per question.
 */
const COLS = 16;
const columns = new WeakMap();
function riverColumns(river) {
  let c = columns.get(river);
  if (c) return c;
  const [x0, , w] = river.rect,
    n = Math.ceil(w * COLS) + 1;
  c = { x0, n, north: new Float64Array(n), south: new Float64Array(n), scale: new Float64Array(n) };
  for (let i = 0; i < n; i++) {
    const s = riverSection(river, x0 + (i + 0.5) / COLS);
    c.north[i] = s.left;
    c.south[i] = s.right;
    c.scale[i] = 1 / Math.sqrt(1 + s.tangent * s.tangent);
  }
  columns.set(river, c);
  return c;
}
/** Water intervals of one row, in tiles, half-open like a bank: [west, east). */
function riverRowSpans(river, y) {
  const [x, ry, w, h] = river.rect;
  if (!(y >= ry && y < ry + h)) return [];
  if (!horizontal(river)) {
    const s = riverSection(river, y);
    return [[s.left, s.right]];
  }
  const c = riverColumns(river),
    spans = [];
  let start = -1;
  for (let i = 0; i <= c.n; i++) {
    const wet = i < c.n && y >= c.north[i] && y < c.south[i];
    if (wet && start < 0) start = i;
    else if (!wet && start >= 0) {
      spans.push([x + start / COLS, Math.min(x + w, x + i / COLS)]);
      start = -1;
    }
  }
  return spans;
}
/**
 * Signed distance (native pixels) from the nearest bank of this river for one pixel row, as
 * a function of x: positive inside the water. The shoreline paint needs it per pixel; it is
 * measured PERPENDICULAR to the bank (scale), and closes at the ends of the authored rect.
 */
function riverShore(river, y, tile) {
  const [rx, ry, rw, rh] = river.rect;
  if (!horizontal(river)) {
    const banks = riverSection(river, y),
      left = banks.left * tile,
      width = (banks.right - banks.left) * tile,
      vertical = Math.min(y - ry, ry + rh - y) * tile,
      scale = 1 / Math.sqrt(1 + banks.tangent * banks.tangent);
    if (width <= 0) return null;
    return (px) => {
      const dx = px - left;
      return Math.min(dx * scale, (width - dx) * scale, vertical);
    };
  }
  if (y < ry - 1 || y > ry + rh + 1) return null;
  const c = riverColumns(river);
  return (px) => {
    const t = px / tile,
      i = Math.floor((t - rx) * COLS);
    if (i < 0 || i >= c.n) return -10000;
    const across = Math.min(y - c.north[i], c.south[i] - y) * tile * c.scale[i];
    return Math.min(across, Math.min(t - rx, rx + rw - t) * tile);
  };
}
/** Physics that follows ONE channel down the screen (currents, rowers) reads the first
 * river that runs down it; a river across the screen has no such channel. */
const mainChannel = (data) => (data.rivers || []).find((r) => !horizontal(r)) || null;
module.exports = {
  riverSection,
  riverEnvelope,
  riverBox,
  riverRowSpans,
  riverShore,
  mainChannel,
};
