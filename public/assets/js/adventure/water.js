"use strict";
const { hash, TILE } = require("./model");
/** World-anchored ripples; only visible water cells, no terrain-cache invalidation per frame. */
/**
 * Cada celda de 32×24 decide UNA vez si lleva onda y dónde (semilla, fase, ancho y si cae en
 * agua): antes se rehacía el hash de texto y dos consultas de agua —con la costa y los ríos
 * dentro— por celda y por fotograma, miles de veces por segundo con el lago a la vista. Lo que
 * cambia con el tiempo (el vaivén de píxel y medio y el brillo) se sigue calculando al pintar.
 */
function rippleCell(world, col, row) {
  const cells = (world.ripples ||= new Map()),
    key = col * 65536 + row;
  if (cells.has(key)) return cells.get(key);
  const seed = hash(world.data.seed + ":" + col + ":" + row);
  let cell = null;
  if (seed % 3 !== 0) {
    const x = col * 32 + (seed % 19),
      y = row * 24 + ((seed >>> 5) % 17),
      width = 4 + (seed % 7);
    if (world.waterAt(x / TILE, y / TILE) && world.waterAt((x + width) / TILE, y / TILE))
      cell = { x, y, width, phase: (seed % 628) / 100, double: seed % 4 === 0 };
  }
  cells.set(key, cell);
  return cell;
}
function drawRipples(c, world, view, time = 0) {
  if (world.data.indoor) return;
  // Solo las celdas de la propia pantalla: la vista traducida a una vecina puede sobresalir de
  // su rectángulo, y fuera de él no hay agua que ondear ni celda que guardar.
  const rows = Math.ceil((world.height * TILE) / 24),
    cols = Math.ceil((world.width * TILE) / 32);
  for (
    let row = Math.max(0, Math.floor(view.y / 24) - 1);
    row < Math.min(rows, Math.ceil((view.y + view.height) / 24) + 1);
    row++
  )
    for (
      let col = Math.max(0, Math.floor(view.x / 32) - 1);
      col < Math.min(cols, Math.ceil((view.x + view.width) / 32) + 1);
      col++
    ) {
      const cell = rippleCell(world, col, row);
      if (!cell) continue;
      const x = cell.x + Math.round(Math.sin(time * 0.55 + cell.phase) * 1.5),
        y = cell.y,
        width = cell.width;
      c.fillStyle =
        "rgba(192,226,197," +
        (0.1 + Math.sin(time * 0.65 + cell.phase) * 0.06) +
        ")";
      c.fillRect(x, y, width, 1);
      if (cell.double) c.fillRect(x + 2, y + 2, Math.max(2, width - 4), 1);
    }
}
module.exports = { drawRipples };
