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
const { entranceReachable } = require("../../public/assets/js/adventure/portals");
const { DOCK_ENTRANCE_LIMITS, boardingPoint, walkableBox, walkableDefinition, withWalkable } = require("../../public/assets/js/adventure/dock-geometry");
const { validWalkable } = require("../../public/assets/js/adventure/bridge-geometry");
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
    this.view.probe?.enable(false);
    // El estado ANTES del aviso: `begin` repinta el inspector y tiene que verlo ya abierto.
    this.enabled = true;
    this.begin();
    this.view.editor = this;
    this.target = row;
    this.scope = scope;
    this.original = clone(scope.body);
    this.solids = clone(scope.body.solids || []);
    this.entrance = scope.body.entrance ? clone(scope.body.entrance) : null;
    this.walkable = scope.dock ? walkableBox(withWalkable(row.e.dockGeometry, scope.body.walkable)) : null;
    this.selected = scope.dock ? { kind: "entrance" } : this.solids.length ? { kind: "solid", index: 0 } : null;
    this.press = null;
    this.view.bodies = true;
    $("bodies").checked = true;
    this.focus();
    this.refresh();
  }
  /**
   * Encajar el dibujo, TODAS sus cajas y la entrada; no centrar solo el pie.
   * También aleja si se estaba demasiado cerca para ver una pieza diagonal completa.
   */
  focus() {
    const e = this.entity();
    if (!e) return;
    const { bodyBounds, bodyView } = require("./body-framing");
    const frame = this.view.renderer.sprites.frame(require("./catalog").frameName(e));
    this.bounds = bodyBounds(e, frame, { solids: this.solids, entrance: this.entrance, walkable: this.walkable });
    const viewport = this.view.viewport.getBoundingClientRect();
    const tools = this.view.viewport.querySelector(".map-tools").getBoundingClientRect();
    this.view.restoreView(bodyView(this.bounds, viewport, { x: 32, y: tools.bottom - viewport.top + 24 }));
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
    if (this.target?.layer === "docks") return this.view.dockRows.find(r => r.e.id === this.target.e.id)?.e;
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
      /**
       * ⛔ «AÑADIR ENTRADA» MIENTRAS YA SE VE UNA ES MENTIRA (22-sep-2026, pregunta del dueño:
       * «¿por qué no me deja editar la entrada que ya sale?»). La que se ve sin haber dibujado
       * nada es DERIVADA: `doorGeometry` la calcula desde el borde de abajo del cuerpo, así que no
       * hay nada que agarrar y se mueve sola cuando mueves la caja. El botón decía «Añadir», que
       * suena a que habría dos. Dice lo que hace —dibujar la tuya— y el panel cuenta de dónde sale
       * la automática, que es la parte que no se puede adivinar mirando el mapa.
       */
      const derivada = !this.entrance && this.scope.portal;
      /**
       * ⛔ SI NO SE PUEDE PISAR, SALE ROJA Y NO SE GUARDA (22-sep-2026, decisión del dueño: «no
       * permitas que la entrada esté dentro de colisión sin margen, que salga rojo si no es
       * válida»). El validador ya la rechaza al aplicar, pero enterarse al guardar es enterarse
       * tarde: se ve mientras se arrastra.
       */
      this.unreachable = this.scope.dock
        ? !validWalkable(this.body().walkable) || !boardingPoint({ ...withWalkable(this.entity().dockGeometry, this.body().walkable), boarding: this.entrance.map(v => v * TILE) })
        : Boolean(this.entrance) && !entranceReachable(this.entrance, this.solids);
      $("body-finish").disabled = this.unreachable;
      $("body-help").textContent =
        "Arrastra dentro para mover, de una esquina para redimensionar. El mapa está quieto mientras editas; mantén Espacio para apartarte." +
        (derivada
          ? " La entrada que ves es AUTOMÁTICA: sale del borde de abajo del cuerpo y se mueve con él, por eso no se puede coger. Dibuja la tuya para cambiarla."
          : "") +
        (this.unreachable
          ? " ⛔ LA ENTRADA QUEDA DENTRO DEL CUERPO: el pie del duende no llega ahí y la puerta no abriría. Bájala hasta que salga del cuerpo."
          : "");
      $("body-instances").textContent = this.scope.reach;
      if (this.scope.dock) $("body-help").textContent = "Verde: suelo caminable sobre el agua. Violeta: entrada para embarcar. Selecciona una zona y ajusta su rectángulo. Se comparte por variante, sin cambiar el dibujo ni el río." + (this.unreachable ? " ⛔ La superficie debe quedar dentro del dibujo y permitir apoyar los pies en la entrada." : "");
      $("body-delete").disabled = !this.selected || !!this.scope.dock;
      $("body-add").disabled = this.solids.length >= MAX_BOXES || !!this.scope.dock;
      $("body-entrance").textContent = this.entrance
        ? "Quitar entrada"
        : "Dibujar entrada";
      $("body-entrance").hidden = !this.scope.portal || !!this.scope.dock;
      this.paintBoxes();
      this.paintNumbers();
    }
    this.view.probe?.refreshWorld();
    this.view.dirty = true;
  }
  body() {
    return { solids: clone(this.solids),
      ...(this.scope.portal ? { entrance: this.entrance ? clone(this.entrance) : null } : {}),
      ...(this.scope.dock ? { walkable: walkableDefinition(this.entity().dockGeometry, this.walkable) } : {}) };
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
        box.map((v) => v.toFixed(2).replace(/\.?0+$/, "")).join(" ") +
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
    if (this.walkable)
      rows.unshift('<button type="button" class="body-box walkable' +
        (this.selected?.kind === "walkable" ? " on" : "") +
        '" data-box="walkable">Caminable · ' + this.walkable.map(v => v.toFixed(2)).join(" ") + '</button>');
    $("body-boxes").innerHTML = rows.join("");
    for (const button of $("body-boxes").querySelectorAll("[data-box]"))
      button.onclick = () => {
        this.selected =
          ["entrance", "walkable"].includes(button.dataset.box)
            ? { kind: button.dataset.box }
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
      : selection.kind === "walkable" ? this.walkable
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
      ...(this.walkable ? [{ kind: "walkable" }] : []),
    ];
    candidates.sort((a, b) => Number(b.kind === this.selected?.kind && b.index === this.selected?.index) -
      Number(a.kind === this.selected?.kind && a.index === this.selected?.index));
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
          before: { solids: clone(this.solids), entrance: clone(this.entrance), walkable: clone(this.walkable) },
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
        : press.selection.kind === "walkable" ? press.before.walkable
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
      const limits = this.scope.dock ? DOCK_ENTRANCE_LIMITS : ENTRANCE_LIMITS;
      this.entrance = [
        clamp(box[0], -limits.offset, limits.offset),
        clamp(box[1], -limits.offset, limits.offset),
        clamp(box[2], ...limits.width),
        clamp(box[3], ...limits.height),
      ];
    } else if (selection.kind === "walkable") this.walkable = box;
    else this.solids[selection.index] = box;
  }
  up(cancel = false) {
    const press = this.press;
    this.press = null;
    if (!press) return;
    if (cancel) {
      this.solids = press.before.solids;
      this.entrance = press.before.entrance;
      this.walkable = press.before.walkable;
    }
    this.refresh();
  }
  cancelGesture() {
    this.up(true);
  }
  addBox() {
    if (this.scope.dock) return;
    if (this.solids.length >= MAX_BOXES) return;
    this.solids.push([-0.5, -0.5, 1, 0.75]);
    this.selected = { kind: "solid", index: this.solids.length - 1 };
    this.refresh();
  }
  /**
   * ⛔ LA ENTRADA NACE DONDE NACE LA AUTOMÁTICA (22-sep-2026). Nacía en `[0, 0, 1, 3/16]`, y dy=0
   * cae DENTRO del cuerpo de casi todo: el botón te daba una entrada roja e inguardable, y había
   * que adivinar que el remedio era bajarla. Ahora sale por debajo de la caja más baja, con los
   * mismos 6 px que usa `doorGeometry` al derivarla, así que nace válida y solo queda ajustarla.
   */
  toggleEntrance() {
    if (this.entrance) {
      this.entrance = null;
      this.selected = null;
      this.refresh();
      return;
    }
    const suelo = this.solids.reduce((bajo, [, y, , h]) => Math.max(bajo, y + h), 0);
    this.entrance = [-0.5, suelo + 6 / 16, 1, 3 / 16];
    this.selected = { kind: "entrance" };
    this.refresh();
  }
  remove() {
    if (this.scope.dock) return;
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
    if (this.scope.dock) this.walkable = walkableBox(withWalkable(this.entity().dockGeometry, this.original.walkable));
    this.refresh();
  }
  finish() {
    // Enter tampoco la cuela: el aviso de la barra y el botón apagado no sirven de nada si el
    // atajo se salta la comprobación.
    if (this.unreachable) return;
    // La entrada quitada viaja como `null`: sin la clave, quien aplica la propuesta no sabría
    // distinguir «no la he tocado» de «quítala», y el elemento se quedaría con la de antes.
    if (
      this.commit.apply(this.scope, this.body())
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
    /**
     * El rótulo se dibuja al tamaño de la PANTALLA, no del mundo: escalado con el elemento sería
     * gigante al acercarse, que es justo cuando se edita. Para eso se deshace la escala del
     * elemento (`k`) antes de escribir, en vez de pedir una fuente de 0,2 px: un `font` por debajo
     * de 1 px es territorio de mínimos del navegador y no se dibuja igual en todos.
     */
    const k = scale * TILE;
    const paint = (box, selection, colour, fill, name) => {
      const on =
        this.selected &&
        this.selected.kind === selection.kind &&
        this.selected.index === selection.index;
      if (on && !this.unreachable) {
        colour = selection.kind === "entrance" ? "#ffc4ff" : selection.kind === "walkable" ? "#c5ff75" : "#36e6ff";
        fill = selection.kind === "entrance" ? "#e59bff99" : selection.kind === "walkable" ? "#94e76099" : "#36e6ff88";
      }
      c.fillStyle = this.view.probe?.enabled ? colour + "22" : fill;
      c.strokeStyle = colour;
      c.lineWidth = line * (on ? 1.6 : 1);
      c.fillRect(box[0], box[1], box[2], box[3]);
      c.strokeRect(box[0], box[1], box[2], box[3]);
      c.save();
      // La geometría gira con el acceso; el rótulo siempre se lee de pie.
      c.translate(box[0] + line * 2, box[1]);
      if (entity.flip) c.scale(-1, 1);
      c.rotate(-((entity.rotation || 0) * Math.PI) / 180);
      c.scale(1 / k, 1 / k);
      this.view.label(
        c,
        name,
        0,
        0,
        colour,
      );
      c.restore();
      if (!on || this.view.probe?.enabled) return;
      c.fillStyle = colour;
      for (const [gx, gy] of GRIPS)
        c.fillRect(
          box[0] + box[2] * gx - grip,
          box[1] + box[3] * gy - grip,
          grip * 2,
          grip * 2,
        );
    };
    /**
     * ⛔ EL NÚMERO SOLO CUANDO HAY VARIAS (21-sep-2026, dueño: «¿por qué lo llamas colisión 1?»).
     * Con una sola caja, el «1» promete un «2» que no existe. Varias sí las hay de verdad —el arco
     * de jardín son dos patas con el hueco libre en medio, y los delimitadores de copas hasta
     * tres—, y ahí el número es lo que dice cuál estás cogiendo.
     */
    const varias = this.solids.length > 1;
    if (this.walkable) paint(this.walkable, { kind: "walkable" },
      this.unreachable ? "#ff6b6b" : "#94e760", this.unreachable ? "#ff6b6b55" : "#94e76044", "Caminable");
    this.solids.forEach((box, index) =>
      paint(
        box,
        { kind: "solid", index },
        "#9de0f5",
        "#69cbe93d",
        varias ? "Colisión " + (index + 1) : "Colisión",
      ),
    );
    /**
     * ⛔ LA ENTRADA NO PUEDE SER DEL MISMO AZUL QUE UNA COLISIÓN (21-sep-2026). Eran `#9de0f5` y
     * `#87e5ff`: dos cianes pálidos que nadie distingue, para dos cosas que hacen lo contrario
     * —una te para, la otra te deja pasar—. La entrada va en violeta, que no se usa en ninguna
     * otra capa del Studio, y cada caja lleva su nombre escrito encima.
     */
    if (this.entrance)
      paint(
        this.entrance,
        { kind: "entrance" },
        this.unreachable ? "#ff6b6b" : "#e59bff",
        this.unreachable ? "#ff6b6b55" : "#e59bff55",
        this.scope.dock ? "Embarcar" : this.unreachable ? "Entrada · no se puede pisar" : "Entrada",
      );
    c.restore();
  }
}
module.exports = { BodyEditor, toLocal };
