"use strict";
const { TILE } = require("../../public/assets/js/adventure/geometry");
/** Read-only topology review; scenery/path proposals remain the one Studio workspace. */
function drawRiverOverlay(ctx, data, zoom) {
  if (!data.navigation) return;
  ctx.save();
  ctx.lineWidth = 2 / zoom;
  ctx.font = `${12 / zoom}px sans-serif`;
  for (const field of data.navigation.currents || []) {
    const [x, y, rx, ry] = field.area.map((n) => n * TILE);
    ctx.strokeStyle = "#9de0f5";
    ctx.fillStyle = "#69cbe918";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const [dx, dy] = field.vector,
      length = Math.hypot(dx, dy) || 1;
    const a = Math.atan2(dy, dx),
      endX = x + ((dx / length) * 35) / zoom,
      endY = y + ((dy / length) * 35) / zoom;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    for (const side of [-1, 1]) {
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - (Math.cos(a + side * 0.5) * 9) / zoom,
        endY - (Math.sin(a + side * 0.5) * 9) / zoom,
      );
    }
    ctx.stroke();
    ctx.fillStyle = "#ebffff";
    ctx.fillText(`${Math.round(length)} px/s`, x + 6 / zoom, y - 7 / zoom);
  }
  for (const landing of data.navigation.landings || []) {
    const [x, y] = landing.land.map((n) => n * TILE),
      [wx, wy] = landing.water.map((n) => n * TILE);
    ctx.strokeStyle = "#ffe5a1";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(wx, wy);
    ctx.stroke();
    for (const [px, py] of [
      [x, y],
      [wx, wy],
    ]) {
      ctx.beginPath();
      ctx.arc(px, py, 5 / zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff1bf";
    ctx.fillText(landing.id, x + 7 / zoom, y);
  }
  for (const exit of data.navigation.exits || []) {
    const [x, y, w, h] = exit.area.map((n) => n * TILE);
    ctx.strokeStyle = "#edb8e8";
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#ffe0fb";
    ctx.fillText(`→ ${exit.scene}`, x, y + h + 14 / zoom);
  }
  ctx.restore();
}
module.exports = { drawRiverOverlay };
