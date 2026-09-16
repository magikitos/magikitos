"use strict";
const {
  TILE,
  segmentDistance,
} = require("../../public/assets/js/adventure/geometry");
const clone = (value) => JSON.parse(JSON.stringify(value));
const $ = (id) => document.getElementById(id);
/** Studio-only polyline interaction. Drag previews are overlays; expensive terrain rebuilds happen on commit. */
class PathEditor {
  constructor(view, getPaths, commit, onMode) {
    Object.assign(this, {
      view,
      getPaths,
      commit,
      onMode,
      enabled: false,
      selected: null,
      preview: null,
      drawing: null,
      press: null,
      inserting: false,
    });
    view.editor = this;
    $("paths-mode").onclick = () => this.enable(true);
    $("objects-mode").onclick = () => this.enable(false);
    $("path-new").onclick = () => {
      this.cancel();
      this.drawing = [];
      this.selected = null;
      this.refresh();
    };
    $("path-finish").onclick = () => this.finish();
    $("path-cancel").onclick = () => {
      this.cancel();
      this.refresh();
    };
    $("path-insert").onclick = () => {
      this.inserting = !this.inserting;
      this.refresh();
    };
    $("path-delete").onclick = () => this.removePath();
    $("path-delete-point").onclick = () => this.removePoint();
    for (const axis of ["x", "y"])
      $("path-" + axis).onchange = () => {
        const { path, point } = this.selected || {};
        if (point == null) return;
        const paths = clone(this.getPaths());
        paths[path][point][axis === "x" ? 0 : 1] = Number(
          $("path-" + axis).value,
        );
        this.commit(paths);
        this.refresh();
      };
  }
  enable(value) {
    if (!this.view.world) return;
    this.cancel();
    this.enabled = value && !this.view.world.data.indoor;
    this.view.select(null, null);
    this.onMode(this.enabled);
    this.refresh();
  }
  cancel() {
    this.preview = null;
    this.drawing = null;
    this.press = null;
    this.inserting = false;
    this.view.dirty = true;
  }
  cancelGesture() {
    this.preview = null;
    this.press = null;
    this.refresh();
  }
  sceneChanged() {
    this.cancel();
    this.selected = null;
    if (this.view.world?.data.indoor) this.enabled = false;
    this.onMode(this.enabled);
    this.refresh();
  }
  paths() {
    return this.preview || this.getPaths();
  }
  snap(p) {
    const step = Number($("path-snap").value),
      world = this.view.world;
    return [
      Math.max(0, Math.min(world.width, Math.round(p.x / TILE / step) * step)),
      Math.max(0, Math.min(world.height, Math.round(p.y / TILE / step) * step)),
    ];
  }
  vertex(p) {
    let best = null,
      distance = 11 / this.view.zoom;
    this.getPaths().forEach((points, path) =>
      points.forEach(([x, y], point) => {
        const d = Math.hypot(p.x - x * TILE, p.y - y * TILE);
        if (d < distance) {
          best = { path, point };
          distance = d;
        }
      }),
    );
    return best;
  }
  segment(p) {
    let best = null,
      distance = 12 / this.view.zoom / TILE;
    this.getPaths().forEach((points, path) => {
      for (let point = 0; point < points.length - 1; point++) {
        const a = points[point],
          b = points[point + 1],
          d = segmentDistance(p.x / TILE, p.y / TILE, a, b);
        if (d < distance) {
          best = { path, point };
          distance = d;
        }
      }
    });
    return best;
  }
  down(p) {
    const hit = this.vertex(p);
    this.press = { origin: p, hit, moved: false };
    if (!this.drawing && !this.inserting && hit) {
      this.selected = hit;
      this.refresh();
    }
  }
  motion(p) {
    const drag = this.press;
    if (!drag || !drag.hit || this.drawing || this.inserting) return;
    if (
      !drag.moved &&
      Math.hypot(p.x - drag.origin.x, p.y - drag.origin.y) * this.view.zoom < 4
    )
      return;
    drag.moved = true;
    this.preview ||= clone(this.getPaths());
    this.preview[drag.hit.path][drag.hit.point] = this.snap(p);
    this.paintCoordinates();
    this.view.dirty = true;
  }
  up(cancel = false) {
    const press = this.press;
    this.press = null;
    if (cancel) {
      this.preview = null;
      this.refresh();
      return;
    }
    if (!press) return;
    if (press.moved) {
      const paths = this.preview;
      this.preview = null;
      this.commit(paths);
      this.refresh();
      return;
    }
    const p = press.origin;
    if (this.drawing) {
      const hit = this.vertex(p),
        point = hit
          ? clone(this.getPaths()[hit.path][hit.point])
          : this.snap(p);
      const last = this.drawing.at(-1);
      if (!last || last[0] !== point[0] || last[1] !== point[1])
        this.drawing.push(point);
    } else if (this.inserting) {
      const hit = this.segment(p);
      if (hit) {
        const paths = clone(this.getPaths()),
          a = paths[hit.path][hit.point],
          b = paths[hit.path][hit.point + 1];
        const dx = b[0] - a[0],
          dy = b[1] - a[1],
          t = Math.max(
            0,
            Math.min(
              1,
              ((p.x / TILE - a[0]) * dx + (p.y / TILE - a[1]) * dy) /
                (dx * dx + dy * dy),
            ),
          );
        paths[hit.path].splice(
          hit.point + 1,
          0,
          this.snap({ x: (a[0] + t * dx) * TILE, y: (a[1] + t * dy) * TILE }),
        );
        this.selected = { path: hit.path, point: hit.point + 1 };
        this.inserting = false;
        this.commit(paths);
      }
    } else {
      const hit = press.hit || this.segment(p);
      this.selected = hit
        ? { path: hit.path, point: press.hit ? hit.point : null }
        : null;
    }
    this.refresh();
  }
  finish() {
    if (!this.drawing || this.drawing.length < 2) return;
    const paths = clone(this.getPaths());
    paths.push(this.drawing);
    if (this.commit(paths)) {
      this.selected = { path: paths.length - 1, point: null };
      this.drawing = null;
    }
    this.refresh();
  }
  removePath() {
    if (this.selected == null || this.drawing) return;
    const paths = clone(this.getPaths());
    paths.splice(this.selected.path, 1);
    this.selected = null;
    this.inserting = false;
    this.commit(paths);
    this.refresh();
  }
  removePoint() {
    const { path, point } = this.selected || {};
    if (point == null || this.getPaths()[path]?.length <= 2 || this.drawing)
      return;
    const paths = clone(this.getPaths());
    paths[path].splice(point, 1);
    this.selected = { path, point: Math.min(point, paths[path].length - 1) };
    this.commit(paths);
    this.refresh();
  }
  key(e) {
    if (!this.enabled) return false;
    if (e.key === "Escape") {
      this.cancel();
      this.selected = null;
      this.refresh();
      return true;
    }
    if (e.key === "Enter" && this.drawing) {
      this.finish();
      return true;
    }
    if (["Delete", "Backspace"].includes(e.key)) {
      if (this.drawing) {
        this.drawing.pop();
        this.refresh();
      } else if (this.selected?.point != null) this.removePoint();
      else this.removePath();
      return true;
    }
    const delta = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[e.key];
    if (delta && this.selected?.point != null && !this.drawing) {
      const paths = clone(this.getPaths()),
        p = paths[this.selected.path][this.selected.point],
        step = Number($("path-snap").value) * (e.shiftKey ? 4 : 1);
      p[0] += delta[0] * step;
      p[1] += delta[1] * step;
      this.commit(paths);
      this.refresh();
      return true;
    }
    return false;
  }
  paintCoordinates() {
    const p = this.paths()[this.selected?.path]?.[this.selected?.point];
    for (const [index, axis] of ["x", "y"].entries()) {
      $("path-" + axis).disabled = !p;
      $("path-" + axis).value = p ? p[index] : "";
    }
  }
  refresh() {
    if (!this.view.world) return;
    const paths = this.getPaths();
    if (this.selected && !paths[this.selected.path]) this.selected = null;
    if (this.selected?.point >= paths[this.selected?.path]?.length)
      this.selected.point = null;
    $("paths-mode").disabled = !!this.view.world.data.indoor;
    $("paths-mode").title = this.view.world.data.indoor
      ? "Los interiores tienen suelo de madera"
      : "Editar trazados de tierra";
    $("paths-mode").setAttribute("aria-pressed", String(this.enabled));
    $("objects-mode").setAttribute("aria-pressed", String(!this.enabled));
    $("map-hint").textContent = this.enabled
      ? "Mano / Espacio: mover mapa · rueda / pellizco: zoom"
      : "Arrastrar fondo: mover mapa · rueda / pellizco: zoom";
    $("map").setAttribute(
      "aria-label",
      this.enabled
        ? "Editor de caminos: selecciona un trazado y arrastra sus puntos; flechas para ajustes finos."
        : "Selecciona y arrastra un elemento. Usa las flechas para ajustes finos.",
    );
    $("object-library").hidden = this.enabled;
    $("path-library").hidden = !this.enabled;
    $("path-properties").hidden = !this.enabled;
    $("path-list").replaceChildren(
      ...paths.map((points, path) => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.path = path;
        b.textContent =
          "Camino " + (path + 1) + " · " + points.length + " puntos";
        b.setAttribute("aria-pressed", String(this.selected?.path === path));
        b.onclick = () => {
          this.cancel();
          this.selected = { path, point: null };
          const x =
              (points.reduce((n, p) => n + p[0], 0) / points.length) * TILE,
            y = (points.reduce((n, p) => n + p[1], 0) / points.length) * TILE;
          this.view.camera.x = x - this.view.renderer.width / 2;
          this.view.camera.y = y - this.view.renderer.height / 2;
          this.refresh();
        };
        return b;
      }),
    );
    const creating = !!this.drawing;
    $("path-new").disabled = creating;
    $("path-finish").hidden = $("path-cancel").hidden = !creating;
    $("path-finish").disabled = !creating || this.drawing.length < 2;
    $("path-insert").disabled = creating || !paths.length;
    $("path-insert").setAttribute("aria-pressed", String(this.inserting));
    $("path-delete").disabled = creating || !this.selected;
    $("path-delete-point").disabled =
      creating ||
      this.selected?.point == null ||
      paths[this.selected.path].length <= 2;
    $("path-selection").textContent = this.selected
      ? "Camino " +
        (this.selected.path + 1) +
        (this.selected.point == null
          ? ""
          : " · punto " + (this.selected.point + 1))
      : "Selecciona un trazado o crea uno nuevo";
    $("path-hint").textContent = creating
      ? "Marca puntos en el mapa. Terminar o Enter guarda el camino; Esc cancela. Puedes unirlo a un punto existente."
      : this.inserting
        ? "Toca un tramo para insertar un punto."
        : "Toca un camino y arrastra sus puntos. Mano o Espacio para mover el mapa. El suelo se actualiza al soltar.";
    this.paintCoordinates();
    this.view.dirty = true;
  }
  draw(c) {
    if (!this.enabled) return;
    const z = this.view.zoom;
    const stroke = (points, color, nodes) => {
      c.strokeStyle = color;
      c.lineWidth = 2 / z;
      c.beginPath();
      points.forEach(([x, y], i) =>
        i ? c.lineTo(x * TILE, y * TILE) : c.moveTo(x * TILE, y * TILE),
      );
      c.stroke();
      if (nodes)
        points.forEach(([x, y], i) => {
          c.beginPath();
          c.arc(
            x * TILE,
            y * TILE,
            (this.selected?.point === i ? 7 : 5) / z,
            0,
            Math.PI * 2,
          );
          c.fillStyle = this.selected?.point === i ? "#fff4c7" : "#d8b470";
          c.fill();
          c.strokeStyle = "#263a2d";
          c.stroke();
        });
    };
    this.paths().forEach((points, path) =>
      stroke(
        points,
        this.selected?.path === path ? "#ffe1a1" : "#f6dba280",
        this.selected?.path === path,
      ),
    );
    if (this.drawing) stroke(this.drawing, "#fff4c7", true);
  }
}
module.exports = { PathEditor };
