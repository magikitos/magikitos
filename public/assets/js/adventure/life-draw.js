"use strict";
/**
 * What residents SAY and DO that is drawn, not a sprite: speech bubbles, a snore, a catch. Pixel
 * primitives on the canvas, crisp at any zoom, so the whole of `life.js` works with the art that
 * already exists; `REQUIRED-ART.md` lists the sheets that would replace the stand-ins.
 */
const INK = "#2d3a2c",
  PAPER = "#fbf6e4";

/** A 1-px pixel glyph from rows of "#": crisp, no fonts involved. */
function glyph(c, rows, x, y, color = INK) {
  c.fillStyle = color;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === "#") c.fillRect(x + i, y + j, 1, 1);
  });
}
const GLYPHS = {
  note: ["..##", "..#.", "..#.", "###.", "##.."],
  bang: ["#", "#", "#", ".", "#"],
  heart: [".#.#.", "#####", "#####", ".###.", "..#.."],
  wave: ["#..#", "#..#", "####", ".##."],
};

/** A small rounded bubble with a tail, `w`×`h` px, centred on `x` with its tail at `y`. */
function bubbleBox(c, x, y, w, h) {
  const left = Math.round(x - w / 2),
    top = Math.round(y - h - 3);
  c.fillStyle = INK;
  c.fillRect(left + 1, top, w - 2, h);
  c.fillRect(left, top + 1, w, h - 2);
  c.fillRect(Math.round(x) - 1, top + h, 3, 2);
  c.fillStyle = PAPER;
  c.fillRect(left + 1, top + 1, w - 2, h - 2);
  c.fillRect(Math.round(x), top + h - 1, 1, 2);
  return { left, top };
}

const EMOTE = { talk: "emote-talk", note: "emote-note", sleep: "emote-zzz", catch: "emote-bang", hello: "emote-wave", love: "emote-heart", read: "emote-book" };
/** The resident's bubble over its head (`top` is the head's y), if it has one right now. An
 *  `emotes` sheet (REQUIRED-ART.md §5) replaces the pixel stand-in icon by icon. */
function drawBubble(c, e, top, now, time, sprites = null) {
  const b = e.bubble;
  if (!b || b.until < now) return;
  const x = e.x,
    y = top - 2;
  const emote = EMOTE[b.kind];
  if (sprites?.has(emote) && sprites.frame(emote)) {
    sprites.draw(c, emote, Math.round(x - 6), Math.round(y - 14 - Math.sin(time * 6) * 0.6));
    return;
  }
  if (b.kind === "sleep") {
    // Three z's drifting up and out, no box: a snore is not something said.
    for (let i = 0; i < 3; i++) {
      const t = (time * 0.5 + i / 3) % 1;
      c.globalAlpha = Math.min(1, (1 - t) * 1.6);
      glyph(c, ["###", "..#", ".#.", "###"], Math.round(x + 4 + t * 8 + i), Math.round(y - t * 14), "#e9e3c6");
    }
    c.globalAlpha = 1;
    return;
  }
  if (b.kind === "talk") {
    const { left, top: t } = bubbleBox(c, x, y, 13, 8);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = Math.floor(time * 3) % 3 === i ? INK : "#8c9a86";
      c.fillRect(left + 3 + i * 3, t + 3, 2, 2);
    }
    return;
  }
  const art = { note: GLYPHS.note, catch: GLYPHS.bang, hello: GLYPHS.wave, love: GLYPHS.heart }[b.kind];
  if (!art) return;
  const w = art[0].length + 6,
    h = art.length + 4;
  const { left, top: t } = bubbleBox(c, x, y - Math.round(Math.sin(time * 6) * 0.6), w, h);
  glyph(c, art, left + 3, t + 2, b.kind === "catch" ? "#b0442f" : INK);
}

/** Rings where the fish bit, for a second and a half after the catch. */
function drawSplash(c, e, now, sprites = null) {
  if (!e.splash || !e.fishing) return;
  const age = (now - e.splash.at) / 1500;
  if (age >= 1) return;
  const [tx, ty] = e.fishing.target.map((v) => v * 16);
  const frame = "fish-splash-" + Math.min(2, Math.floor(age * 3));
  if (sprites?.has(frame) && sprites.frame(frame)) {
    sprites.draw(c, frame, Math.round(tx - 8), Math.round(ty - 8));
    return;
  }
  c.strokeStyle = `rgba(236,244,236,${0.7 * (1 - age)})`;
  c.lineWidth = 1;
  for (const r of [3 + age * 10, age * 6]) {
    c.beginPath();
    c.ellipse(tx, ty + 1, r, r * 0.45, 0, 0, Math.PI * 2);
    c.stroke();
  }
}

module.exports = { drawBubble, drawSplash };
