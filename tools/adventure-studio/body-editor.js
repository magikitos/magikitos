"use strict";
/**
 * ⛔ EL CUERPO Y LA ENTRADA SE DIBUJAN ENCIMA DEL ELEMENTO (21-sep-2026, decisión del dueño: «debo
 * poder mover y editar el rectángulo directamente en el mapa», y «bloquear la edición… así se
 * evita desplazar el mapa mientras estoy dibujando»).
 *
 * Mientras este editor está abierto es él quien recibe el ratón: arrastrar el fondo ya no mueve el
 * mapa, así que una caja se dibuja sin que el suelo se escape debajo (la barra espaciadora sigue
 * sirviendo para apartarse). Se edita en el espacio LOCAL del elemento —casillas desde su pie— que
 * es donde vive el dato, y se dibuja con la escala, el reflejo y el giro de la copia que estás
 * mirando, para que lo que se arrastra sea lo que se ve.
 */
const { TILE } = require("../../public/assets/js/adventure/geometry");
const {
  ENTRANCE_LIMITS,
} = require("../../public/assets/js/adventure/portals");
const { MIN_SIDE, MAX_BOXES } = require("./element-edits");
const $ = (id) => document.getElementById(id);
/** Los ocho tiradores de una caja, en fracción de su ancho y alto. */
const GRIPS = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [1, 0.5],
  [1, 1],
  [0.5, 1],
  [0, 1],
  [0, 0.5],
];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clone = (value) => JSON.parse(JSON.stringify(value));

/** Un punto del mundo en casillas locales del elemento: deshace giro, escala y reflejo. */
function toLocal(entity, point) {
  const dx = (point.x - entity.x) / TILE,
    dy = (point.y - entity.y) / TILE;
  const angle = (-(entity.rotation || 0) * Math.PI) / 180,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  const x = dx * cos - dy * sin,
    y = dx * sin + dy * cos;
  const scale = entity.scale ?? 1;
  return { x: (x / scale) * (entity.flip ? -1 : 1), y: y / scale };
}
class BodyEditor {
  constructor(view, commit, begin, end) {
    Object.assign(this, {
      view,
      commit,
      begin,
      end,
      enabled: false,
      solids: [],
      entrance: null,
      selected: null,
    });
    $("body-edit").onclick = () => this.start(view.selection[0]);
    $("body-finish").onclick = () => this.finish();
    $("body-add").onclick = () => this.addBox();
    $("body-entrance").onclick = () => this.toggleEntrance();
    $("body-delete").onclick = () => this.remove();
    $("body-reset").onclick = () => this.reset();
    for (const id of ["body-x", "body-y", "body-w", "body-h"]) {
      $(id).onchange = () => this.readNumbers();
      // Enter dentro de un número también termina: el atajo del documento no llega a un input.
      $(id).onkeydown = (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        this.readNumbers();
        this.finish();
      };
    }
  }
  /** `row` es la copia que se está mirando; lo que se edita es su ELEMENTO. */
  start(row) {
    const scope = row && this.commit.scopeOf(row);
    if (!scope) return;
    // El estado ANTES del aviso: `begin` repinta el inspector y tiene que verlo ya abierto.
    this.enabled = true;
    this.begin();
    this.view.editor = this;
    this.target = row;
    this.scope = scope;
    this.original = clone(scope.body);
    this.solids = clone(scope.body.solids || []);
    this.entrance = scope.body.entrance ? clone(scope.body.entrance) : null;
    this.selected = this.solids.length ? { kind: "solid", index: 0 } : null;
    this.press = null;
    this.view.bodies = true;
    $("bodies").checked = true;
    this.focus();
    this.refresh();
  }
  /**
   * Un cuerpo no se dibuja al 35 %: al abrir el editor la vista se acerca al elemento lo justo
   * para que sus tiradores se puedan coger con el dedo, sin alejar a quien ya estaba cerca.
   */
  focus() {
    const e = this.entity();
    if (!e) return;
    const zoom = Math.max(this.view.zoom, 1.5);
    this.view.restoreView({
      zoom,
      camera: {
        x: e.x - this.view.viewport.clientWidth / zoom / 2,
        y: e.y - this.view.viewport.clientHeight / zoom / 2,
      },
    });
  }
  stop() {
    this.enabled = false;
    this.press = null;
    this.view.editor = null;
    this.refresh();
    this.end();
  }
  /** El elemento vivo, ya con la propuesta encima: de ahí salen su sitio y su transformación. */
  entity() {
    return (
      this.target &&
      (this.target.layer === "entities"
        ? this.view.world.entities
        : this.view.world.props
      ).find((e) => e.id === this.target.e.id)
    );
  }
  refresh() {
    $("body-properties").hidden = !this.enabled;
    $("body-section").hidden = this.enabled || !this.scopeReady();
    if (this.enabled) {
      $("body-title").textContent = this.scope.label;
      $("body-help").textContent =
        "Arrastra dentro para mover, de una esquina para redimensionar. El mapa está quieto mientras editas; mantén Espacio para apartarte.";
      $("body-instances").textContent = this.scope.reach;
      $("body-delete").disabled = !this.selected;
      $("body-add").disabled = this.solids.length >= MAX_BOXES;
      $("body-entrance").textContent = this.entrance
        ? "Quitar entrada"
        : "Añadir entrada";
      $("body-entrance").hidden = !this.scope.portal;
      this.paintBoxes();
      this.paintNumbers();
    }
    this.view.dirty = true;
  }
  scopeReady() {
    return Boolean(this.view.selection.length === 1);
  }
  paintBoxes() {
    const rows = this.solids.map((box, index) => {
      const active =
        this.selected?.kind === "solid" && this.selected.index === index;
      return (
        '<button type="button" class="body-box' +
        (active ? " on" : "") +
        '" data-box="' +
        index +
        '">Caja ' +
        (index + 1) +
        " · " +
        box.map((v) => v.toFixed(2).replace(/\\.?0+$/, "")).join(" ") +
        "</button>"
      );
    });
    if (this.entrance)
      rows.push(
        '<button type="button" class="body-box entrance' +
          (this.selected?.kind === "entrance" ? " on" : "") +
          '" data-box="entrance">Entrada · ' +
          this.entrance.map((v) => v.toFixed(2).replace(/\.?0+$/, "")).join(" ") +
          "</button>",
      );
    $("body-boxes").innerHTML = rows.join("");
    for (const button of $("body-boxes").querySelectorAll("[data-box]"))
      button.onclick = () => {
        this.selected =
          button.dataset.box === "entrance"
            ? { kind: "entrance" }
            : { kind: "solid", index: Number(button.dataset.box) };
        this.refresh();
      };
  }
  /** Los mismos cuatro números que se arrastran, para quien prefiera escribirlos. */
  paintNumbers() {
    const box = this.boxOf();
    for (const [index, id] of ["body-x", "body-y", "body-w", "body-h"].entries()) {
      $(id).value = box ? Math.round(box[index] * 10000) / 10000 : "";
      $(id).disabled = !box;
    }
  }
  readNumbers() {
    if (!this.selected) return;
    const box = ["body-x", "body-y", "body-w", "body-h"].map((id) =>
      Number($(id).value),
    );
    if (box.some((v) => !Number.isFinite(v))) return;
    box[2] = Math.max(MIN_SIDE, box[2]);
    box[3] = Math.max(MIN_SIDE, box[3]);
    this.write(this.selected, box);
    this.refresh();
  }
  step() {
    return Number($("snap").value) || 1 / 16;
  }
  boxOf(selection = this.selected) {
    if (!selection) return null;
    return selection.kind === "entrance"
      ? this.entrance
      : this.solids[selection.index];
  }
  /** Qué tirador cae bajo el dedo: una esquina, un lado o el interior de una caja. */
  pick(point) {
    const entity = this.entity();
    if (!entity) return null;
    const local = toLocal(entity, point),
      grip = 9 / this.view.zoom / TILE / (entity.scale ?? 1);
    const candidates = [
      ...(this.entrance ? [{ kind: "entrance" }] : []),
      ...this.solids.map((_, index) => ({ kind: "solid", index })),
    ];
    for (const selection of candidates) {
      const box = this.boxOf(selection);
      for (const [gx, gy] of GRIPS) {
        const hx = box[0] + box[2] * gx,
          hy = box[1] + box[3] * gy;
        if (Math.abs(local.x - hx) <= grip && Math.abs(local.y - hy) <= grip)
          return { selection, grip: [gx, gy], local };
      }
    }
    for (const selection of candidates) {
      const box = this.boxOf(selection);
      if (
        local.x >= box[0] &&
        local.x <= box[0] + box[2] &&
        local.y >= box[1] &&
        local.y <= box[1] + box[3]
      )
        return { selection, grip: null, local };
    }
    return null;
  }
  down(point) {
    const hit = this.pick(point);
    this.press = hit
      ? {
          ...hit,
          before: { solids: clone(this.solids), entrance: clone(this.entrance) },
          moved: false,
        }
      : null;
    if (hit) this.selected = hit.selection;
    this.refresh();
  }
  motion(point) {
    const press = this.press,
      entity = this.entity();
    if (!press || !entity) return;
    const local = toLocal(entity, point),
      step = this.step();
    const round = (v) => Math.round(v / step) * step;
    const before =
      press.selection.kind === "entrance"
        ? press.before.entrance
        : press.before.solids[press.selection.index];
    const dx = round(local.x - press.local.x),
      dy = round(local.y - press.local.y);
    if (!dx && !dy && !press.moved) return;
    press.moved = true;
    const next = [...before];
    if (!press.grip) {
      next[0] = round(before[0] + dx);
      next[1] = round(before[1] + dy);
    } else {
      const [gx, gy] = press.grip;
      if (gx === 0) {
        const right = before[0] + before[2];
        next[0] = Math.min(round(before[0] + dx), right - MIN_SIDE);
        next[2] = right - next[0];
      } else if (gx === 1) next[2] = Math.max(MIN_SIDE, round(before[2] + dx));
      if (gy === 0) {
        const bottom = before[1] + before[3];
        next[1] = Math.min(round(before[1] + dy), bottom - MIN_SIDE);
        next[3] = bottom - next[1];
      } else if (gy === 1) next[3] = Math.max(MIN_SIDE, round(before[3] + dy));
    }
    this.write(press.selection, next);
    this.refresh();
  }
  /** Los límites viven en un solo sitio: la entrada los tiene escritos, el cuerpo es libre. */
  write(selection, box) {
    if (selection.kind === "entrance") {
      this.entrance = [
        clamp(box[0], -ENTRANCE_LIMITS.offset, ENTRANCE_LIMITS.offset),
        clamp(box[1], -ENTRANCE_LIMITS.offset, ENTRANCE_LIMITS.offset),
        clamp(box[2], ...ENTRANCE_LIMITS.width),
        clamp(box[3], ...ENTRANCE_LIMITS.height),
      ];
    } else this.solids[selection.index] = box;
  }
  up(cancel = false) {
    const press = this.press;
    this.press = null;
    if (!press) return;
    if (cancel) {
      this.solids = press.before.solids;
      this.entrance = press.before.entrance;
    }
    this.refresh();
  }
  cancelGesture() {
    this.up(true);
  }
  addBox() {
    if (this.solids.length >= MAX_BOXES) return;
    this.solids.push([-0.5, -0.5, 1, 0.75]);
    this.selected = { kind: "solid", index: this.solids.length - 1 };
    this.refresh();
  }
  toggleEntrance() {
    this.entrance = this.entrance ? null : [0, 0, 1, 3 / 16];
    this.selected = this.entrance ? { kind: "entrance" } : null;
    this.refresh();
  }
  remove() {
    if (!this.selected) return;
    if (this.selected.kind === "entrance") this.entrance = null;
    else this.solids.splice(this.selected.index, 1);
    this.selected = null;
    this.refresh();
  }
  reset() {
    this.solids = clone(this.original.solids || []);
    this.entrance = this.original.entrance
      ? clone(this.original.entrance)
      : null;
    this.selected = null;
    this.refresh();
  }
  finish() {
    if (
      this.commit.apply(this.scope, {
        solids: clone(this.solids),
        ...(this.entrance ? { entrance: clone(this.entrance) } : {}),
      })
    )
      this.stop();
  }
  key(e) {
    if (!this.enabled) return false;
    if (e.key === "Escape") this.stop();
    else if (e.key === "Enter") this.finish();
    else if (["Backspace", "Delete"].includes(e.key)) this.remove();
    else if (e.key.startsWith("Arrow") && this.selected) {
      const box = [...this.boxOf()],
        step = this.step() * (e.shiftKey ? 4 : 1);
      box[e.key === "ArrowLeft" || e.key === "ArrowRight" ? 0 : 1] +=
        e.key === "ArrowLeft" || e.key === "ArrowUp" ? -step : step;
      this.write(this.selected, box);
      this.refresh();
    } else return false;
    e.preventDefault();
    return true;
  }
  draw(c) {
    if (!this.enabled) return;
    const entity = this.entity();
    if (!entity) return;
    const scale = entity.scale ?? 1;
    c.save();
    c.translate(entity.x, entity.y);
    c.rotate(((entity.rotation || 0) * Math.PI) / 180);
    c.scale(scale * (entity.flip ? -1 : 1) * TILE, scale * TILE);
    const line = 1.5 / this.view.zoom / TILE / scale,
      grip = 5 / this.view.zoom / TILE / scale;
    const paint = (box, selection, colour, fill) => {
      const on =
        this.selected &&
        this.selected.kind === selection.kind &&
        this.selected.index === selection.index;
      c.fillStyle = fill;
      c.strokeStyle = colour;
      c.lineWidth = line * (on ? 1.6 : 1);
      c.fillRect(box[0], box[1], box[2], box[3]);
      c.strokeRect(box[0], box[1], box[2], box[3]);
      if (!on) return;
      c.fillStyle = colour;
      for (const [gx, gy] of GRIPS)
        c.fillRect(
          box[0] + box[2] * gx - grip,
          box[1] + box[3] * gy - grip,
          grip * 2,
          grip * 2,
        );
    };
    this.solids.forEach((box, index) =>
      paint(box, { kind: "solid", index }, "#9de0f5", "#69cbe93d"),
    );
    if (this.entrance)
      paint(this.entrance, { kind: "entrance" }, "#87e5ff", "#87e5ff55");
    c.restore();
  }
}
module.exports = { BodyEditor, toLocal };
