"use strict";
const { hash, random } = require("./geometry");
const { paintGround } = require("./ground");
const room = require("./room-shape");
/** Native-pixel chunks: a natural cutaway floor, never a floating human foundation. */
function paintInteriorGround(c, world, ox, oy, context, artwork = null) {
  const data = world.data,
    width = world.width * 16,
    height = world.height * 16,
    palette = room.theme(data);
  paintGround(c, world, ox, oy);
  if (context) {
    c.save();
    c.translate(-ox, -oy);
    // The background is baked and defocused once, never filtered every frame.
    c.imageSmoothingEnabled = true;
    c.drawImage(context, -384, -384, width + 768, height + 768);
    c.restore();
  }
  // Un interior dibujado (`interior.artwork`): la estampa ES la sala, sobre la caja del marco, y no
  // se pinta ni suelo ni pared procedimental encima. Ver terrain.artwork.
  if (artwork) {
    const inset = data.interior?.inset || { left: 0, right: 0, top: 0, bottom: 0 };
    c.save();
    c.translate(-ox, -oy);
    c.imageSmoothingEnabled = false;
    c.drawImage(
      artwork,
      inset.left * 16,
      inset.top * 16,
      width - (inset.left + inset.right) * 16,
      height - (inset.top + inset.bottom) * 16,
    );
    c.restore();
    return;
  }
  c.fillStyle = "#18362b55";
  c.fillRect(0, 0, 256, 256);
  c.save();
  c.translate(-ox, -oy);
  room.trace(c, data);
  c.lineJoin = "round";
  c.strokeStyle = "#172c2250";
  c.lineWidth = 24;
  c.stroke();
  c.strokeStyle = palette.seam;
  c.lineWidth = 12;
  c.stroke();
  c.save();
  room.trace(c, data);
  c.clip();
  c.fillStyle = palette.base;
  c.fillRect(0, 0, width, height);
  const from = Math.floor(oy / 12),
    to = Math.floor((oy + 256) / 12);
  for (let row = from; row <= to; row++) {
    const shift = (row % 3) * 19;
    for (
      let col = Math.floor((ox - shift) / 64);
      col <= Math.floor((ox + 256 - shift) / 64);
      col++
    ) {
      const x = col * 64 + shift,
        y = row * 12,
        r = random(hash(data.seed + ":floor:" + row + ":" + col));
      c.fillStyle = r() > 0.55 ? palette.light : palette.base;
      c.fillRect(x, y, 63, 11);
      c.fillStyle = palette.grain;
      c.fillRect(
        x + 7 + Math.floor(r() * 9),
        y + 6,
        20 + Math.floor(r() * 22),
        1,
      );
      if (palette.woven) {
        c.fillRect(x + 31, y, 1, 12);
        c.fillStyle = palette.light;
        c.fillRect(x + 2, y + 2, 27, 1);
        c.fillRect(x + 34, y + 8, 27, 1);
      } else if (r() > 0.72) {
        c.fillRect(x + 21, y + 5, 5, 2);
        c.fillStyle = palette.light;
        c.fillRect(x + 22, y + 7, 4, 1);
      }
    }
  }
  room.trace(c, data);
  c.strokeStyle = "#30261635";
  c.lineWidth = 18;
  c.stroke();
  c.restore();
  c.restore();
}
module.exports = { paintInteriorGround };
