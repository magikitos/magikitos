"use strict";
const { Renderer } = require("../../public/assets/js/adventure/renderer");
const {
  collisionBodies,
} = require("../../public/assets/js/adventure/collision-grid");
const {
  World,
  TILE,
  collisionBounds,
} = require("../../public/assets/js/adventure/model");
const {
  artworkBounds,
} = require("../../public/assets/js/adventure/entity-art");
const { visibleWorld } = require("./visibility");
class MapViewport {
  constructor(canvas, viewport, onSelect, onMove, onChange) {
    Object.assign(this, {
      canvas,
      viewport,
      onSelect,
      onMove,
      onChange,
      zoom: 1,
      camera: { x: 0, y: 0 },
      selected: null,
      selection: [],
      grid: false,
      bodies: false,
      hideTrees: false,
      hand: false,
      dirty: true,
    });
    this.renderer = new Renderer(canvas, viewport);
    this.renderer.terrain.limit = 128;
    this.pointers = new Map();
    this.doubleTap = new (require("./element-double-tap").ElementDoubleTap)();
    this.state = { flags: {}, inventory: {}, traces: [] };
    this.game = {
      state: this.state,
      camera: this.camera,
      player: { x: -1000, y: -1000, direction: "down" },
      neighbors: [],
      hidePlayer: true,
      showAllEntities: true,
      dialogue: true,
      reducedMotion: true,
      self: { frame: () => null, drawGround() {}, drawStream() {} },
      roll: { frame: () => null },
    };
    this.probe = new (require("./physics-probe").PhysicsProbe)(this);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(viewport);
    canvas.addEventListener("pointerdown", (e) => this.down(e));
    canvas.addEventListener("pointermove", (e) => this.motion(e));
    canvas.addEventListener("pointerup", (e) => this.up(e));
    canvas.addEventListener("pointercancel", (e) => this.up(e, true));
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (this.drag?.type === "tool") {
          this.editor.cancelGesture();
          this.drag = null;
        }
        this.zoomAt(
          this.zoom * Math.exp(-e.deltaY * 0.002),
          e.clientX,
          e.clientY,
        );
      },
      { passive: false },
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.frame = requestAnimationFrame(() => this.tick());
  }
  async initialize() {
    await this.renderer.sprites.initialize("/studio-art/manifest.json");
    const packs = Object.keys(this.renderer.sprites.manifest.packs);
    // The local crop editor intentionally opens every source, unlike the game's viewport cache.
    // Its explicit budget is the measured authored library, not an unbounded cache exemption.
    this.renderer.sprites.residency.limit = Object.values(this.renderer.sprites.manifest.packs)
      .reduce((bytes, pack) => bytes + pack.width * pack.height * 4, 0);
    const prepared = await this.renderer.sprites.prepare([], packs);
    this.renderer.sprites.activate(prepared);
  }
  setScene(data, fit = false) {
    this.doubleTap.clear();
    const groundKey = JSON.stringify({
      ...data,
      entities: undefined,
      scenery: undefined,
    });
    if (groundKey !== this.groundKey) this.renderer.terrain.chunks.clear();
    this.groundKey = groundKey;
    this.world = new World(data);
    this.dockRows = require("./dock-elements").dockElements(data);
    this.game.world = visibleWorld(this.world, this.hideTrees);
    this.selected = null;
    this.selection = [];
    if (fit) this.fit();
    this.probe.refreshWorld();
    this.dirty = true;
  }
  setTreesHidden(hidden) {
    this.hideTrees = !!hidden;
    if (!this.world) return;
    this.game.world = visibleWorld(this.world, this.hideTrees);
    // No invisible selections: Delete, linked dragging and box selection must
    // only operate on things the editor can currently see.
    this.setSelection(this.selection.map(require("./selection").identifies));
    this.dirty = true;
  }
  restoreView({ zoom, camera }) {
    this.zoom = zoom;
    this.resize();
    Object.assign(this.camera, camera);
    this.dirty = true;
    this.onChange();
  }
  resize() {
    const r = this.viewport.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 2),
      oldWidth = this.renderer.width,
      oldHeight = this.renderer.height;
    if (!r.width || !r.height) return;
    this.renderer.width = r.width / this.zoom;
    this.renderer.height = r.height / this.zoom;
    if (oldWidth && oldHeight) {
      this.camera.x += (oldWidth - this.renderer.width) / 2;
      this.camera.y += (oldHeight - this.renderer.height) / 2;
    }
    this.renderer.scale = this.zoom;
    this.renderer.pixelScale = this.zoom * dpr;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.canvas.style.width = r.width + "px";
    this.canvas.style.height = r.height + "px";
    this.dirty = true;
  }
  fit() {
    if (!this.world) return;
    const r = this.viewport.getBoundingClientRect();
    this.zoom = Math.min(
      r.width / (this.world.width * TILE + 100),
      r.height / (this.world.height * TILE + 100),
    );
    this.resize();
    this.camera.x = (this.world.width * TILE - this.renderer.width) / 2;
    this.camera.y = (this.world.height * TILE - this.renderer.height) / 2;
    this.dirty = true;
    this.onChange();
  }
  point(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: this.camera.x + (clientX - r.left) / this.zoom,
      y: this.camera.y + (clientY - r.top) / this.zoom,
    };
  }
  zoomAt(zoom, clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    clientX ??= r.left + r.width / 2;
    clientY ??= r.top + r.height / 2;
    const p = this.point(clientX, clientY);
    this.zoom = Math.max(0.2, Math.min(6, zoom));
    this.resize();
    this.camera.x = p.x - (clientX - r.left) / this.zoom;
    this.camera.y = p.y - (clientY - r.top) / this.zoom;
    this.dirty = true;
    this.onChange();
  }
  elements() {
    const visible = this.game.world;
    return [
      ...visible.props.map((e) => ({ e, layer: "scenery" })),
      ...visible.entities.map((e) => ({ e, layer: "entities" })),
      ...(this.dockRows || []),
    ].sort((a, b) => a.e.y - b.e.y);
  }
  hit(point) {
    return this.elements()
      .reverse()
      .find(({ e }) => {
        if (e.hitRect) {
          const r = e.hitRect;
          return point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h;
        }
        if (e.fence)
          return require("../../public/assets/js/adventure/fences").hit(
            e,
            point,
          );
        const f = this.renderer.sprites.frame(
          require("../../public/assets/js/adventure/elements").frameName(e),
        );
        if (!f)
          return (
            e.sprite === "doorway" &&
            Math.hypot(e.x - point.x, e.y - point.y) < 20
          );
        const r = artworkBounds(e, f);
        return (
          point.x >= r.x &&
          point.x <= r.x + r.w &&
          point.y >= r.y &&
          point.y <= r.y + r.h
        );
      });
  }
  /** La puerta seleccionada cuya franja de entrada está bajo el puntero, o null. */
  setSelection(keys) {
    const { key } = require("./selection");
    const elements = new Map(this.elements().map((p) => [key(p), p]));
    this.selection = keys.map((p) => elements.get(key(p))).filter(Boolean);
    this.selected = this.selection.at(-1) || null;
    this.dirty = true;
    this.onSelect(this.selected);
  }
  select(id, layer, center = false, additive = false) {
    const keys = this.selection.map(require("./selection").identifies);
    const index = keys.findIndex((p) => p.id === id && p.layer === layer);
    if (additive) {
      if (index >= 0) keys.splice(index, 1);
      else if (id) keys.push({ id, layer });
    }
    this.setSelection(additive ? keys : id ? [{ id, layer }] : []);
    if (center && this.selected) {
      this.camera.x = this.selected.e.x - this.renderer.width / 2;
      this.camera.y = this.selected.e.y - this.renderer.height / 2;
    }
    this.dirty = true;
  }
  down(e) {
    if (!this.world || e.button > 1) return;
    e.preventDefault();
    this.canvas.focus();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.tapTarget = null;
    if (this.pointers.size === 2) {
      this.doubleTap.clear();
      this.probe.clear();
      if (this.drag?.type === "move") this.cancelDrag();
      if (this.drag?.type === "tool") this.editor.cancelGesture();
      const [a, b] = [...this.pointers.values()];
      this.pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: this.zoom,
      };
      this.drag = null;
      return;
    }
    const point = this.point(e.clientX, e.clientY);
    if (this.probe.enabled && !this.hand && e.button === 0) {
      this.drag = { type: "probe", point };
      this.probe.down(e);
      return;
    }
    if (this.editor?.enabled && !this.hand && !this.space && e.button === 0) {
      this.drag = { type: "tool" };
      this.editor.down(point, e);
      return;
    }
    const hit =
      !this.hand && !this.space && e.button === 0 ? this.hit(point) : null;
    if (hit) {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        this.doubleTap.clear();
        this.select(hit.e.id, hit.layer, false, true);
        this.drag = null;
        return;
      }
      const alreadySelected = this.selection.some(
        (p) => p.e.id === hit.e.id && p.layer === hit.layer,
      );
      if (!alreadySelected) this.select(hit.e.id, hit.layer, false, this.multi);
      this.tapTarget = { row: hit, origin: { x: e.clientX, y: e.clientY } };
      if (hit.e.dockAccess) { this.drag = null; return; }
      this.drag = {
        type: "move",
        id: hit.e.id,
        layer: hit.layer,
        start: point,
        entity: { x: hit.e.x, y: hit.e.y },
        origin: { x: e.clientX, y: e.clientY },
        moved: false,
        toggleOnClick: this.multi && alreadySelected,
      };
    } else if (
      !this.hand &&
      !this.space &&
      e.button === 0 &&
      (e.shiftKey || this.multi)
    ) {
      this.drag = {
        type: "box",
        start: point,
        end: point,
        previous: e.shiftKey
          ? this.selection.map(require("./selection").identifies)
          : [],
      };
      this.dirty = true;
    } else {
      this.drag = {
        type: "pan",
        x: e.clientX,
        y: e.clientY,
        camera: { ...this.camera },
      };
      if (!this.hand && !this.space) this.select(null, null);
    }
  }
  motion(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      this.zoomAt(
        (this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
          Math.max(1, this.pinch.distance),
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
      );
      return;
    }
    const d = this.drag;
    if (!d) return;
    if (d.type === "probe") { this.probe.move(e); return; }
    if (d.type === "tool") {
      this.editor.motion(this.point(e.clientX, e.clientY), e);
    } else if (d.type === "pan") {
      this.camera.x = d.camera.x - (e.clientX - d.x) / this.zoom;
      this.camera.y = d.camera.y - (e.clientY - d.y) / this.zoom;
    } else if (d.type === "box") {
      d.end = this.point(e.clientX, e.clientY);
    } else {
      const p = this.point(e.clientX, e.clientY);
      if (
        Math.hypot(e.clientX - d.origin.x, e.clientY - d.origin.y) < 4 &&
        !d.moved
      )
        return;
      d.moved = true;
      this.onMove(
        d,
        {
          x: (d.entity.x + p.x - d.start.x) / TILE,
          y: (d.entity.y + p.y - d.start.y) / TILE,
        },
        false,
      );
    }
    this.dirty = true;
  }
  cancelDrag() {
    const d = this.drag;
    if (d?.type === "move")
      this.onMove(
        d,
        { x: d.entity.x / TILE, y: d.entity.y / TILE },
        true,
        true,
      );
  }
  up(e, cancel = false) {
    if (!this.pointers.has(e.pointerId)) return;
    const tap = this.tapTarget;
    const double = !cancel && tap && !this.drag?.moved && this.pointers.size === 1 &&
      Math.hypot(e.clientX - tap.origin.x, e.clientY - tap.origin.y) < 4 &&
      this.doubleTap.tap(tap.row, { x: e.clientX, y: e.clientY }, performance.now(), e.pointerType);
    if (cancel || !tap || this.drag?.moved) this.doubleTap.clear();
    if (this.drag?.type === "probe") this.probe.up(this.drag.point, cancel);
    else if (this.drag?.type === "tool") this.editor.up(cancel);
    else if (cancel) this.cancelDrag();
    else if (this.drag?.type === "box") {
      const { start: a, end: b, previous } = this.drag;
      const keys = new Map(
        previous.map((p) => [require("./selection").key(p), p]),
      );
      for (const p of this.elements()) {
        const f = this.renderer.sprites.frame(
          require("../../public/assets/js/adventure/elements").frameName(p.e),
        );
        if (!f) continue;
        const r = artworkBounds(p.e, f);
        if (
          r.x <= Math.max(a.x, b.x) &&
          r.x + r.w >= Math.min(a.x, b.x) &&
          r.y <= Math.max(a.y, b.y) &&
          r.y + r.h >= Math.min(a.y, b.y)
        )
          keys.set(
            require("./selection").key(p),
            require("./selection").identifies(p),
          );
      }
      this.setSelection([...keys.values()]);
    } else if (this.drag?.type === "move" && this.drag.moved)
      this.onMove(this.drag, null, true);
    else if (this.drag?.toggleOnClick)
      this.select(this.drag.id, this.drag.layer, false, true);
    this.pointers.delete(e.pointerId);
    this.drag = null;
    this.pinch = null;
    this.tapTarget = null;
    if (double) {
      this.select(tap.row.e.id, tap.row.layer);
      this.onEditBody?.(this.selected);
    }
    this.dirty = true;
  }
  tick() {
    this.probe.tick(performance.now());
    // `active` existía para apagar el dibujado mientras se miraba el laboratorio de
    // experimentos. El laboratorio se borró con ellos, así que aquí solo queda tener mundo y
    // algo que repintar.
    if (this.world && this.dirty) {
      this.renderer.render(this.game, 0);
      this.overlay();
      this.dirty = false;
    }
    this.frame = requestAnimationFrame(() => this.tick());
  }
  /**
   * Un rótulo pegado a una caja, en coordenadas de mundo y al tamaño de la PANTALLA. Lo usan esta
   * capa y el editor de cuerpos (`body-editor`), que llega aquí por `this.view`: un rectángulo sin
   * nombre es justo lo que hizo preguntar «¿y este pequeño de abajo qué es?».
   */
  label(c, text, x, y, colour) {
    c.save();
    c.font = 11 / this.zoom + "px system-ui, sans-serif";
    c.textBaseline = "bottom";
    c.lineWidth = 3 / this.zoom;
    c.strokeStyle = "#0b1a22cc";
    c.strokeText(text, x, y - 3 / this.zoom);
    c.fillStyle = colour;
    c.fillText(text, x, y - 3 / this.zoom);
    c.restore();
  }
  overlay() {
    const c = this.renderer.ctx;
    c.save();
    c.setTransform(
      this.renderer.pixelScale,
      0,
      0,
      this.renderer.pixelScale,
      0,
      0,
    );
    c.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));
    c.lineWidth = 1 / this.zoom;
    if (this.grid && this.zoom >= 0.55) {
      c.strokeStyle = "#ffebb426";
      c.beginPath();
      for (let x = 0; x <= this.world.width * TILE; x += TILE) {
        c.moveTo(x, 0);
        c.lineTo(x, this.world.height * TILE);
      }
      for (let y = 0; y <= this.world.height * TILE; y += TILE) {
        c.moveTo(0, y);
        c.lineTo(this.world.width * TILE, y);
      }
      c.stroke();
    }
    /**
     * ⛔ UNA COSA, UN COLOR, UN SITIO QUE LA DIBUJA (21-sep-2026, dueño: «¿por qué tantos
     * rectángulos? solo necesito la colisión y la entrada»). Tenía razón y el problema era de
     * origen: el umbral se pintaba DOS veces —aquí sin relleno y otra vez en la capa de selección
     * con relleno—, así que un elemento seleccionado enseñaba dos marcos casi iguales encima del
     * mismo sitio; y sobre el que estabas editando se juntaban además el marco amarillo y su
     * cuerpo compilado. Cuatro dibujos para dos conceptos. El contrato, ahora, entero:
     *
     * - **Azul** = cuerpo que PARA. **Violeta** = entrada que DEJA PASAR. Un color por concepto,
     *   aquí y en el editor, esté seleccionado o no.
     * - Cada concepto se dibuja **en un solo sitio**: este bucle. La capa de selección ya no
     *   pinta umbrales.
     * - Del elemento que el editor tiene cogido no se dibuja su cuerpo —lo dibuja el editor, con
     *   tiradores—, y su umbral automático solo mientras no hayas dibujado una entrada propia.
     * - Se rotula lo que estás mirando: el elemento seleccionado o el que se edita. Rotular las
     *   siete puertas del bosque a la vez sería otra pared de texto.
     */
    const owned = (e) => this.editor?.enabled && this.editor.entity?.() === e;
    if (this.bodies)
      for (const { e } of [
        ...this.elements(),
        ...this.game.world.architecture.map((e) => ({ e })),
      ]) {
        const mine = owned(e),
          named = mine || this.selection.some((s) => s.e === e);
        if (e.dockAccess && !mine) {
          c.save(); c.translate(e.x, e.y); c.rotate((e.rotation || 0) * Math.PI / 180);
          for (const [box, color] of [[e.walkable, "#94e760"], [e.entrance, "#e59bff"]]) {
            c.fillStyle = color + "33"; c.strokeStyle = color;
            c.fillRect(...box.map(v => v * TILE)); c.strokeRect(...box.map(v => v * TILE));
          }
          c.restore();
          if (named) this.label(c, "Caminable · Embarcar", e.hitRect.x, e.hitRect.y, "#c5ff75");
        }
        if (!mine) {
          const cuerpos = collisionBodies(e).filter((part) => part.solid);
          cuerpos.forEach((body, index) => {
            const r = collisionBounds(body);
            c.fillStyle = "#69cbe933";
            c.strokeStyle = "#9de0f5cc";
            c.lineWidth = 1.5 / this.zoom;
            c.fillRect(r.x, r.y, r.w, r.h);
            c.strokeRect(r.x, r.y, r.w, r.h);
            // Misma regla que el editor: el número solo cuando de verdad hay varias.
            if (named)
              this.label(
                c,
                cuerpos.length > 1 ? "Colisión " + (index + 1) : "Colisión",
                r.x,
                r.y,
                "#9de0f5",
              );
          });
        }
        if (!Array.isArray(e.threshold) || (mine && this.editor.entrance)) continue;
        const [x, y, w, h] = e.threshold;
        c.fillStyle = "#e59bff33";
        c.strokeStyle = "#e59bff";
        c.lineWidth = 1.5 / this.zoom;
        c.fillRect(x * TILE, y * TILE, w * TILE, h * TILE);
        c.strokeRect(x * TILE, y * TILE, w * TILE, h * TILE);
        if (named)
          this.label(c, mine ? "Entrada automática" : "Entrada", x * TILE, y * TILE, "#e59bff");
        // El punto de llegada es cosa de la puerta, no del cuerpo: estorba mientras se edita.
        if (Array.isArray(e.arrival) && !mine) {
          c.fillStyle = "#e59bff";
          c.beginPath();
          c.arc(e.arrival[0] * TILE, e.arrival[1] * TILE, 3 / this.zoom, 0, 7);
          c.fill();
        }
      }
    /** Amarillo = «esto es lo que tienes elegido». Con el editor abierto sobra el marco: ya está
     *  enfocado y su caja es el asunto. Se queda el punto del ancla, que es el origen de los
     *  cuatro números del panel. */
    for (const selected of this.selection) {
      const e = selected.e;
      if (!owned(e)) {
        const f = this.renderer.sprites.frame(
            require("../../public/assets/js/adventure/elements").frameName(e),
          ),
          r = e.hitRect || (f ? artworkBounds(e, f) : { x: e.x - 12, y: e.y - 12, w: 24, h: 24 });
        c.strokeStyle = "#ffdf89";
        c.lineWidth = 2 / this.zoom;
        c.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      }
      c.fillStyle = "#ffdf89";
      c.beginPath();
      c.arc(e.x, e.y, 3 / this.zoom, 0, 7);
      c.fill();
    }
    if (this.drag?.type === "box") {
      const { start: a, end: b } = this.drag;
      c.fillStyle = "#ffdf8922";
      c.strokeStyle = "#ffdf89";
      c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    this.editor?.draw(c);
    this.probe.draw(c);
    if (document.getElementById("river-topology")?.checked)
      require("./river-overlay").drawRiverOverlay(
        c,
        this.world.data,
        this.zoom,
      );
    c.restore();
  }
}
module.exports = { MapViewport };
