"use strict";
const fences = require("../../public/assets/js/adventure/fences");
const {
  TILE,
  segmentDistance,
} = require("../../public/assets/js/adventure/geometry");
const $ = (id) => document.getElementById(id);
/** One authored polyline; preview is local until its atomic, undoable commit. */
class FenceEditor {
  constructor(view, commit, begin, end) {
    Object.assign(this, {
      view,
      commit,
      begin,
      end,
      enabled: false,
      points: [],
      selected: null,
    });
    $("fences-mode").onclick = () => this.start();
    $("fence-edit").onclick = () => this.start(view.selected);
    $("fence-finish").onclick = () => this.finish();
    $("fence-cancel").onclick = () => this.stop();
    $("fence-delete-point").onclick = () => this.remove();
  }
  start(row) {
    this.begin();
    this.enabled = true;
    this.view.editor = this;
    this.target = row?.e.fence ? { id: row.e.id, layer: row.layer } : null;
    this.points = this.target
      ? row.e.fence.points.map((p) => [
          row.e.x / TILE + p[0],
          row.e.y / TILE + p[1],
        ])
      : [];
    this.selected = null;
    this.press = null;
    this.view.select(null, null);
    this.refresh();
  }
  stop() {
    this.enabled = false;
    this.press = null;
    this.points = [];
    this.refresh();
    this.end();
  }
  refresh() {
    $("fence-properties").hidden = !this.enabled;
    $("fences-mode").setAttribute("aria-pressed", String(this.enabled));
    $("fence-finish").disabled = this.points.length < 2;
    $("fence-delete-point").disabled = this.selected === null;
    $("fence-count").textContent =
      this.points.length + " esquinas · postes intermedios automáticos";
    this.view.dirty = true;
  }
  snap(p) {
    const step = Number($("snap").value),
      w = this.view.world;
    const point = [
      Math.max(
        0,
        Math.min(w.width - 0.0625, Math.round(p.x / TILE / step) * step),
      ),
      Math.max(
        0,
        Math.min(w.height - 0.0625, Math.round(p.y / TILE / step) * step),
      ),
    ];
    let d = 10 / this.view.zoom / TILE;
    for (const { e } of this.view.elements())
      if (e.fence && e.id !== this.target?.id)
        for (const q of [e.fence.points[0], e.fence.points.at(-1)]) {
          const candidate = [e.x / TILE + q[0], e.y / TILE + q[1]],
            distance = Math.hypot(
              candidate[0] - point[0],
              candidate[1] - point[1],
            );
          if (distance < d) {
            d = distance;
            point[0] = candidate[0];
            point[1] = candidate[1];
          }
        }
    return point;
  }
  down(p) {
    const i = this.points.findIndex(
      (q) =>
        Math.hypot(q[0] * TILE - p.x, q[1] * TILE - p.y) < 11 / this.view.zoom,
    );
    this.press = {
      origin: p,
      index: i,
      moved: false,
      before: this.points.map((q) => [...q]),
    };
    if (i >= 0) this.selected = i;
    this.refresh();
  }
  motion(p) {
    if (!this.press || this.press.index < 0) return;
    if (
      Math.hypot(p.x - this.press.origin.x, p.y - this.press.origin.y) *
        this.view.zoom <
        4 &&
      !this.press.moved
    )
      return;
    this.press.moved = true;
    this.points[this.press.index] = this.snap(p);
    this.view.dirty = true;
  }
  up(cancel = false) {
    const press = this.press;
    this.press = null;
    if (!press) return;
    if (cancel) {
      this.points = press.before;
      this.refresh();
      return;
    }
    if (!press.moved && press.index < 0) {
      const p = this.snap(press.origin);
      const segment = this.points.findIndex(
        (a, i) =>
          i < this.points.length - 1 &&
          segmentDistance(p[0], p[1], a, this.points[i + 1]) <
            8 / this.view.zoom / TILE,
      );
      if (segment >= 0) {
        this.points.splice(segment + 1, 0, p);
        this.selected = segment + 1;
      } else if (
        !this.points.length ||
        Math.hypot(
          p[0] - this.points.at(-1)[0],
          p[1] - this.points.at(-1)[1],
        ) >= 0.25
      ) {
        this.points.push(p);
        this.selected = this.points.length - 1;
      }
    }
    this.refresh();
  }
  cancelGesture() {
    if (this.press) this.points = this.press.before;
    this.press = null;
    this.refresh();
  }
  remove() {
    if (this.selected !== null) {
      this.points.splice(this.selected, 1);
      this.selected = null;
      this.refresh();
    }
  }
  finish() {
    if (this.points.length < 2) return;
    if (this.commit(this.target, this.points)) this.stop();
  }
  key(e) {
    if (!this.enabled) return false;
    if (e.key === "Escape") this.stop();
    else if (e.key === "Enter") this.finish();
    else if (["Backspace", "Delete"].includes(e.key)) {
      if (this.selected === null) this.selected = this.points.length - 1;
      this.remove();
    } else return false;
    return true;
  }
  draw(c) {
    if (!this.enabled) return;
    if (this.points.length >= 2) {
      try {
        const [x, y] = this.points[0];
        const e = {
          x: x * TILE,
          y: y * TILE,
          fence: { points: this.points.map((p) => [p[0] - x, p[1] - y]) },
        };
        const parts = fences.parts(e);
        c.save();
        try {
          c.globalAlpha = 0.85;
          for (const part of parts) fences.drawPart(c, part);
        } finally {
          c.restore();
        }
      } catch (_) {} // A temporarily overlapping dragged vertex is never committed.
    }
    c.strokeStyle = "#ffe0a0";
    c.lineWidth = 1 / this.view.zoom;
    c.beginPath();
    this.points.forEach((p, i) =>
      i
        ? c.lineTo(p[0] * TILE, p[1] * TILE)
        : c.moveTo(p[0] * TILE, p[1] * TILE),
    );
    c.stroke();
    this.points.forEach((p, i) => {
      c.fillStyle = i === this.selected ? "#fff5d0" : "#dda955";
      c.beginPath();
      c.arc(p[0] * TILE, p[1] * TILE, 5 / this.view.zoom, 0, Math.PI * 2);
      c.fill();
    });
  }
}
module.exports = { FenceEditor };
