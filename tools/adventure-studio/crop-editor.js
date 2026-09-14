"use strict";
const { croppedFrame, cropFor } = require("./sprite-edits");
/** Editor-only pixel inspection. The game consumes baked frames, never this code. */
class CropEditor {
  constructor(canvas, sprites, onChange) {
    this.canvas = canvas;
    this.sprites = sprites;
    this.onChange = onChange;
    this.originals = new Map();
    for (const pack of sprites.packs.values())
      for (const [name, frame] of Object.entries(pack.frames))
        this.originals.set(name, structuredClone(frame));
    canvas.addEventListener("pointerdown", (e) => this.down(e));
    canvas.addEventListener("pointermove", (e) => this.move(e));
    canvas.addEventListener("pointerup", (e) => this.up(e));
    canvas.addEventListener("pointercancel", (e) => this.up(e, true));
  }
  apply(snapshot, edits) {
    for (const [name, original] of this.originals) {
      const record = snapshot.sprites?.[name];
      if (!record) continue;
      const pack = this.sprites.packs.get(this.sprites.owners.get(name));
      pack.frames[name] = croppedFrame(
        original,
        edits[name]?.crop || cropFor(record),
      );
    }
  }
  select(name, record, edit) {
    this.name = name;
    this.record = record;
    this.crop = record ? (edit?.crop || cropFor(record)).slice() : null;
    this.paint();
  }
  sourceCanvas() {
    const [w, h] = this.record.definition.size,
      cv = document.createElement("canvas");
    const pack = this.sprites.packs.get(this.sprites.owners.get(this.name)),
      f = this.originals.get(this.name);
    const density = f.pixelRatio;
    cv.width = w * density;
    cv.height = h * density;
    cv.getContext("2d").drawImage(
      pack.image,
      f.x,
      f.y,
      f.w * density,
      f.h * density,
      ...f.trim.map(n => n * density),
      f.w * density,
      f.h * density,
    );
    return cv;
  }
  paint() {
    const c = this.canvas.getContext("2d");
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.record) return;
    const [w, h] = this.record.definition.size;
    this.scale = Math.max(
      1,
      Math.floor(
        Math.min((this.canvas.width - 32) / w, (this.canvas.height - 32) / h),
      ),
    );
    this.origin = [
      Math.floor((this.canvas.width - w * this.scale) / 2),
      Math.floor((this.canvas.height - h * this.scale) / 2),
    ];
    const [ox, oy] = this.origin,
      k = this.scale,
      [x, y, cw, ch] = this.crop;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.sourceCanvas(), ox, oy, w * k, h * k);
    c.fillStyle = "rgba(12,22,19,.48)";
    c.fillRect(ox, oy, w * k, y * k);
    c.fillRect(ox, oy + (y + ch) * k, w * k, (h - y - ch) * k);
    c.fillRect(ox, oy + y * k, x * k, ch * k);
    c.fillRect(ox + (x + cw) * k, oy + y * k, (w - x - cw) * k, ch * k);
    c.strokeStyle = "#a8edbb";
    c.lineWidth = 1;
    c.strokeRect(ox + x * k + 0.5, oy + y * k + 0.5, cw * k, ch * k);
    for (const [dx, dy] of [
      [x, y],
      [x + cw, y],
      [x, y + ch],
      [x + cw, y + ch],
    ]) {
      c.fillStyle = "#d9f5c8";
      c.fillRect(ox + dx * k - 3, oy + dy * k - 3, 7, 7);
    }
    const f = this.originals.get(this.name),
      ax = f.anchor[0] + f.trim[0],
      ay = f.anchor[1] + f.trim[1];
    c.strokeStyle = "#ffc76a";
    c.beginPath();
    c.moveTo(ox + ax * k - 5, oy + ay * k);
    c.lineTo(ox + ax * k + 5, oy + ay * k);
    c.moveTo(ox + ax * k, oy + ay * k - 5);
    c.lineTo(ox + ax * k, oy + ay * k + 5);
    c.stroke();
    for (const [i, id] of ["crop-x", "crop-y", "crop-w", "crop-h"].entries())
      document.getElementById(id).value = this.crop[i];
  }
  position(e) {
    const r = this.canvas.getBoundingClientRect();
    return [
      ((e.clientX - r.left) * this.canvas.width) / r.width,
      ((e.clientY - r.top) * this.canvas.height) / r.height,
    ].map((n, i) => (n - this.origin[i]) / this.scale);
  }
  down(e) {
    if (!this.record || e.button !== 0) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const [x, y] = this.position(e),
      [cx, cy, w, h] = this.crop;
    const corner = [
      [cx, cy],
      [cx + w, cy],
      [cx, cy + h],
      [cx + w, cy + h],
    ].findIndex(([px, py]) => Math.hypot(x - px, y - py) * this.scale < 12);
    if (corner < 0 && (x < cx || x > cx + w || y < cy || y > cy + h)) return;
    this.drag = {
      point: [x, y],
      crop: [...this.crop],
      corner,
      pointer: e.pointerId,
    };
  }
  move(e) {
    if (!this.drag || this.drag.pointer !== e.pointerId) return;
    const p = this.position(e),
      [x, y, w, h] = this.drag.crop;
    const dx = Math.round(p[0] - this.drag.point[0]),
      dy = Math.round(p[1] - this.drag.point[1]);
    const [mw, mh] = this.record.definition.size,
      limit = (v, a, b) => Math.max(a, Math.min(b, v));
    if (this.drag.corner < 0)
      this.crop = [limit(x + dx, 0, mw - w), limit(y + dy, 0, mh - h), w, h];
    else {
      const right = this.drag.corner % 2 === 1,
        bottom = this.drag.corner >= 2;
      const left = right ? x : limit(x + dx, 0, x + w - 1),
        top = bottom ? y : limit(y + dy, 0, y + h - 1);
      const r = right ? limit(x + w + dx, x + 1, mw) : x + w,
        b = bottom ? limit(y + h + dy, y + 1, mh) : y + h;
      this.crop = [left, top, r - left, b - top];
    }
    this.paint();
  }
  up(e, cancel = false) {
    if (!this.drag || this.drag.pointer !== e.pointerId) return;
    if (cancel) this.crop = this.drag.crop;
    this.drag = null;
    this.paint();
    if (!cancel) this.onChange([...this.crop]);
  }
  auto() {
    const cv = this.sourceCanvas(),
      { data } = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height);
    let x = cv.width,
      y = cv.height,
      r = -1,
      b = -1;
    for (let py = 0; py < cv.height; py++)
      for (let px = 0; px < cv.width; px++)
        if (data[(py * cv.width + px) * 4 + 3] > 0) {
          x = Math.min(x, px);
          y = Math.min(y, py);
          r = Math.max(r, px);
          b = Math.max(b, py);
        }
    if (r >= 0) {
      const d = this.originals.get(this.name).pixelRatio;
      const left = Math.floor(x / d), top = Math.floor(y / d);
      this.onChange([left, top, Math.ceil((r + 1) / d) - left, Math.ceil((b + 1) / d) - top]);
    }
  }
}
module.exports = { CropEditor };
