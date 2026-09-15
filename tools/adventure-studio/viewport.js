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
      grid: false,
      bodies: false,
      hand: false,
      dirty: true,
    });
    this.renderer = new Renderer(canvas, viewport);
    this.renderer.terrain.limit = 128;
    this.pointers = new Map();
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
      voyage: { active: false },
    };
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
    await this.renderer.sprites.prepare([], packs);
    this.renderer.sprites.activate(new Set(packs));
  }
  setScene(data, fit = false) {
    const groundKey = JSON.stringify({
      ...data,
      entities: undefined,
      scenery: undefined,
    });
    if (groundKey !== this.groundKey) this.renderer.terrain.chunks.clear();
    this.groundKey = groundKey;
    this.world = new World(data);
    this.game.world = this.world;
    this.selected = null;
    if (fit) this.fit();
    this.dirty = true;
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
    return [
      ...this.world.props.map((e) => ({ e, layer: "scenery" })),
      ...this.world.entities.map((e) => ({ e, layer: "entities" })),
    ].sort((a, b) => a.e.y - b.e.y);
  }
  hit(point) {
    return this.elements()
      .reverse()
      .find(({ e }) => {
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
  select(id, layer, center = false) {
    this.selected =
      this.elements().find((p) => p.e.id === id && p.layer === layer) || null;
    if (center && this.selected) {
      this.camera.x = this.selected.e.x - this.renderer.width / 2;
      this.camera.y = this.selected.e.y - this.renderer.height / 2;
    }
    this.dirty = true;
    this.onSelect(this.selected);
  }
  down(e) {
    if (!this.world || e.button > 1) return;
    e.preventDefault();
    this.canvas.focus();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
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
    if (this.editor?.enabled && !this.hand && !this.space && e.button === 0) {
      this.drag = { type: "tool" };
      this.editor.down(point, e);
      return;
    }
    const hit =
      !this.hand && !this.space && e.button === 0 ? this.hit(point) : null;
    if (hit) {
      this.select(hit.e.id, hit.layer);
      this.drag = {
        type: "move",
        id: hit.e.id,
        layer: hit.layer,
        start: point,
        entity: { x: hit.e.x, y: hit.e.y },
        origin: { x: e.clientX, y: e.clientY },
        moved: false,
      };
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
    if (d.type === "tool") {
      this.editor.motion(this.point(e.clientX, e.clientY), e);
    } else if (d.type === "pan") {
      this.camera.x = d.camera.x - (e.clientX - d.x) / this.zoom;
      this.camera.y = d.camera.y - (e.clientY - d.y) / this.zoom;
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
    if (this.drag?.type === "tool") this.editor.up(cancel);
    else if (cancel) this.cancelDrag();
    else if (this.drag?.type === "move" && this.drag.moved)
      this.onMove(this.drag, null, true);
    this.pointers.delete(e.pointerId);
    this.drag = null;
    this.pinch = null;
    this.dirty = true;
  }
  tick() {
    if (this.active !== false && this.world && this.dirty) {
      this.renderer.render(this.game, 0);
      this.overlay();
      this.dirty = false;
    }
    this.frame = requestAnimationFrame(() => this.tick());
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
    if (this.bodies)
      for (const { e } of [
        ...this.elements(),
        ...this.world.architecture.map((e) => ({ e })),
      ]) {
        for (const body of collisionBodies(e).filter((part) => part.solid)) {
          const r = collisionBounds(body);
          c.fillStyle = "#69cbe933";
          c.strokeStyle = "#9de0f5cc";
          c.fillRect(r.x, r.y, r.w, r.h);
          c.strokeRect(r.x, r.y, r.w, r.h);
        }
        if (e.threshold) {
          const [x, y, w, h] = e.threshold;
          c.strokeStyle = "#87e5ff";
          c.strokeRect(x * TILE, y * TILE, w * TILE, h * TILE);
        }
      }
    if (this.selected) {
      const e = this.selected.e,
        f = this.renderer.sprites.frame(
          require("../../public/assets/js/adventure/elements").frameName(e),
        ),
        r = f
          ? artworkBounds(e, f)
          : { x: e.x - 12, y: e.y - 12, w: 24, h: 24 };
      c.strokeStyle = "#ffdf89";
      c.lineWidth = 2 / this.zoom;
      c.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      c.fillStyle = "#ffdf89";
      c.beginPath();
      c.arc(e.x, e.y, 3 / this.zoom, 0, 7);
      c.fill();
    }
    this.editor?.draw(c);
    c.restore();
  }
}
module.exports = { MapViewport };
