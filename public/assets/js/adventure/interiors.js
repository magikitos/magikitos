"use strict";
const { TILE } = require("./geometry");
/** Cutaway architecture is scene data; the floor footprint is also used by World collisions. */
function wall(c, x, y, w, h, height = 22) {
  c.fillStyle = "#362c2450";
  c.fillRect(x + 3, y + h, w + 3, 5);
  c.fillStyle = "#63472e";
  c.fillRect(x, y - height, w, h + height);
  c.fillStyle = "#9e8252";
  c.fillRect(x, y - height, w, 3);
  c.fillStyle = "#43341f";
  if (w > h)
    for (let px = x + 7; px < x + w; px += 13)
      c.fillRect(px, y - height + 3, 2, h + height - 3);
  else
    for (let py = y - height + 6; py < y + h; py += 13)
      c.fillRect(x + 2, py, Math.max(1, w - 4), 2);
  c.fillStyle = "#b1a373";
  c.fillRect(x + 1, y - height + 1, Math.max(1, w - 2), 1);
}
function drawInteriors(c, world) {
  if (!world.data.indoor) return;
  const width = world.width * TILE,
    height = world.height * TILE;
  const room = require("./room-shape"),
    palette = room.theme(world.data),
    points = room.outline(world.data);
  c.save();
  c.lineJoin = "round";
  c.lineCap = "round";
  // Branch/living-bark walls follow the same outline as the physical room.
  room.trace(c, world.data);
  c.strokeStyle = palette.wall;
  c.lineWidth = 10;
  c.stroke();
  room.trace(c, world.data);
  c.strokeStyle = palette.rim;
  c.lineWidth = 2;
  c.stroke();
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    if ((a[1] + b[1]) / 2 > height * 0.63) continue; // south is a low cutaway lip, not an occluding wall
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(a[0], a[1] - 38);
    c.lineTo(b[0], b[1] - 38);
    c.lineTo(b[0], b[1]);
    c.closePath();
    c.fillStyle = palette.wall;
    c.fill();
    c.beginPath();
    c.moveTo(a[0], a[1] - 38);
    c.lineTo(b[0], b[1] - 38);
    c.strokeStyle = palette.rim;
    c.lineWidth = 4;
    c.stroke();
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 10; d < length; d += 18) {
      const x = a[0] + ((b[0] - a[0]) * d) / length,
        y = a[1] + ((b[1] - a[1]) * d) / length;
      c.strokeStyle = palette.seam;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y - 34);
      c.lineTo(x + 2, y - 4);
      c.stroke();
      c.fillStyle = palette.rim;
      c.fillRect(Math.round(x - 2), Math.round(y - 11), 1, 5);
    }
  }
  c.restore();
  for (const window of world.entities.filter(
    (e) => e.sprite === "window-arched",
  )) {
    c.save();
    require("./room-shape").trace(c, world.data);
    c.clip();
    for (let step = 0; step < 52; step++) {
      c.fillStyle = "rgba(246,224,147," + 0.11 * (1 - step / 65) + ")";
      c.fillRect(
        Math.round(window.x - 15 + step * 0.28),
        window.y + step,
        29 + Math.floor(step * 0.16),
        1,
      );
    }
    c.restore();
  }
  for (const rug of world.data.rugs || []) {
    const x = (rug.x - rug.width / 2) * TILE,
      y = (rug.y - rug.height / 2) * TILE,
      w = rug.width * TILE,
      h = rug.height * TILE;
    // A plaited leaf mat, not a rectangular human carpet. Every room may tint it.
    c.save();
    c.beginPath();
    c.moveTo(x, y + h * 0.5);
    c.lineTo(x + w * 0.15, y + h * 0.12);
    c.lineTo(x + w * 0.45, y);
    c.lineTo(x + w * 0.82, y + h * 0.18);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w * 0.82, y + h * 0.86);
    c.lineTo(x + w * 0.46, y + h);
    c.lineTo(x + w * 0.15, y + h * 0.83);
    c.closePath();
    c.fillStyle = rug.color;
    c.fill();
    c.strokeStyle = "#9e9970";
    c.lineWidth = 3;
    c.stroke();
    c.clip();
    c.strokeStyle = "rgba(214,205,153,.25)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x + 3, y + h * 0.5);
    c.lineTo(x + w - 3, y + h * 0.5);
    c.stroke();
    for (let dx = 12; dx < w - 10; dx += 15) {
      c.beginPath();
      c.moveTo(x + dx, y + h * 0.5);
      c.lineTo(x + dx - 12, y + 4);
      c.stroke();
      c.beginPath();
      c.moveTo(x + dx, y + h * 0.5);
      c.lineTo(x + dx - 12, y + h - 4);
      c.stroke();
    }
    c.restore();
  }
  for (const door of world.entities.filter((e) => e.sprite === "doorway")) {
    // A floor-level opening through the south wall; no upright block hiding the exit.
    const left = Math.round(door.x - 14),
      top = height - 40;
    c.fillStyle = "#9e835d";
    c.fillRect(left, top, 28, 40);
    for (let y = top + 6; y < height; y += 8) {
      c.fillStyle = "#b39a72";
      c.fillRect(left + 1, y, 26, 1);
    }
    c.fillStyle = "#66523a";
    c.fillRect(left - 4, top, 4, 40);
    c.fillRect(left + 28, top, 4, 40);
    c.fillStyle = "#b79863";
    c.fillRect(left - 3, top + 2, 1, 38);
    c.fillRect(left + 29, top + 2, 1, 38);
    // Two low timber steps connect the opening to the moss outside.
    c.fillStyle = "#536051";
    c.fillRect(left - 4, height, 36, 12);
    for (let step = 0; step < 2; step++) {
      c.fillStyle = step ? "#8c764f" : "#ac9868";
      c.fillRect(left - step * 3, height + step * 5, 28 + step * 6, 4);
      c.fillStyle = "#c1b895";
      c.fillRect(left + 1 - step * 3, height + step * 5, 26 + step * 6, 1);
    }
  }
}
function drawPartition(c, part) {
  const [x, y, w, h] = part.rect.map((n) => n * TILE);
  wall(c, x, y, w, h, part.height ?? 22);
}
module.exports = { drawInteriors, drawPartition };
