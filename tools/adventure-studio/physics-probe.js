"use strict";
const { ProbeWorld, previewBody } = require("./probe-world");
const { TILE, FOOTPRINT, inRect } = require("../../public/assets/js/adventure/geometry");
const { dockPoint } = require("../../public/assets/js/adventure/dock-geometry");
const { DRAG_SLOP, steerStick, stickIntent } = require("../../public/assets/js/adventure/direction-stick");
const $ = id => document.getElementById(id);
const DIRECTIONS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
class PhysicsProbe {
  constructor(view) {
    this.view = view;
    this.enabled = false;
    this.keys = new Set();
    $("probe-toggle").onclick = () => this.enable(!this.enabled);
    $("probe-place").onclick = () => { this.placing = !this.placing; this.paint(); };
    // Focusing an inspector input cannot leave the avatar walking into a wall.
    document.addEventListener("focusin", () => this.keys.clear());
    window.addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.clear(); });
  }
  enable(on) {
    if (on && !this.view.world) return;
    this.enabled = on;
    this.clear();
    this.view.space = false;
    if (on) {
      this.view.hand = false;
      $("hand").setAttribute("aria-pressed", "false");
      this.refreshWorld();
      if (!this.placed) this.spawn();
      if (this.view.zoom < 1.5) {
        const zoom = 1.5, actor = this.sim.actor;
        this.view.restoreView({ zoom, camera: {
          x: actor.x - this.view.viewport.clientWidth / zoom / 2,
          y: actor.y - this.view.viewport.clientHeight / zoom / 2,
        } });
      }
      this.center();
    }
    this.view.game.hidePlayer = !on;
    this.view.bodies ||= on;
    $("bodies").checked = this.view.bodies;
    this.view.dirty = true;
    this.paint();
  }
  clear() { this.keys.clear(); this.sim?.clear(); this.placing = false; this.pointer = this.stick = null; }
  down(event) {
    this.pointer = { x: event.clientX, y: event.clientY };
    this.stick = null;
  }
  move(event) {
    if (!this.pointer || this.placing) return;
    const point = { x: event.clientX, y: event.clientY };
    if (!this.stick && Math.hypot(point.x - this.pointer.x, point.y - this.pointer.y) >= DRAG_SLOP) {
      this.stick = { origin: { ...this.pointer }, finger: point };
      this.sim.journey.clear();
    }
    if (this.stick) steerStick(this.stick, point);
  }
  up(point, cancel) {
    if (!cancel && !this.stick) this.click(point);
    this.pointer = this.stick = null;
  }
  refreshWorld() {
    if (!this.enabled || !this.view.world) return;
    const editor = this.view.editor;
    this.invalid = !!(editor?.enabled && editor.unreachable);
    let data = this.view.world.data;
    if (editor?.enabled && editor.body && !this.invalid) data = previewBody(data, editor.scope, editor.body());
    const key = JSON.stringify(data);
    if (this.worldKey === key) { this.paint(); return; }
    const changedScene = this.scene !== data.id;
    this.scene = data.id;
    this.worldKey = key;
    if (this.sim) this.sim.reset(data);
    else this.sim = new ProbeWorld(data);
    this.view.game.player = this.sim.actor;
    if (changedScene) { this.placed = false; this.spawn(); }
    this.paint();
  }
  spawn() {
    const selected = this.view.selection[0]?.e;
    const start = selected?.dockGeometry ? { x: selected.dockGeometry.land[0] * TILE, y: selected.dockGeometry.land[1] * TILE }
      : selected?.arrival ? { x: selected.arrival[0] * TILE, y: selected.arrival[1] * TILE }
      : selected || { x: this.view.camera.x + this.view.renderer.width / 2, y: this.view.camera.y + this.view.renderer.height / 2 };
    for (let radius = 0; radius < 320; radius += 8)
      for (let i = 0, n = Math.max(1, Math.ceil(radius)); i < n; i++) {
        const p = { x: start.x + Math.cos(i / n * Math.PI * 2) * radius, y: start.y + Math.sin(i / n * Math.PI * 2) * radius };
        if (this.sim.world.canStand(p.x, p.y, this.sim.actor)) { this.sim.place(p); this.placed = true; return; }
      }
    this.placing = true;
  }
  click(point) {
    if (this.placing) { this.sim.place(point); this.placed = true; this.placing = false; this.center(); }
    else this.sim.travel(point);
    this.view.dirty = true;
    this.paint();
  }
  key(event, down = true) {
    if (!down) { this.keys.delete(event.code); return false; }
    if (!this.enabled || event.metaKey || event.ctrlKey || event.altKey) return false;
    if (event.code === "Escape") { this.enable(false); return true; }
    if (DIRECTIONS[event.code] || event.code === "Space") { this.keys.add(event.code); return true; }
    // A test walk must not move/delete the selected authoring object.
    return ["Backspace", "Delete"].includes(event.code);
  }
  center() {
    const { actor } = this.sim, { camera, renderer } = this.view;
    camera.x = actor.x - renderer.width / 2;
    camera.y = actor.y - renderer.height / 2;
  }
  tick(now) {
    const dt = Math.min(0.05, Math.max(0, (now - (this.lastTime ?? now)) / 1000));
    this.lastTime = now;
    if (!this.enabled || !this.sim) return;
    const intent = { x: 0, y: 0 };
    for (const key of this.keys) { const dir = DIRECTIONS[key]; if (dir) { intent.x += dir[0]; intent.y += dir[1]; } }
    if (!intent.x && !intent.y) Object.assign(intent, stickIntent(this.stick));
    const previous = this.feedback, wasWalking = this.view.game.walking, wasRunning = this.view.game.running;
    this.sim.step(this.invalid ? 0 : dt, intent, this.keys.has("Space"),
      { width: this.view.viewport.clientWidth, height: this.view.viewport.clientHeight });
    this.view.game.walking = this.sim.walking;
    this.view.game.running = this.sim.running;
    this.feedback = this.invalid ? "Corrige la zona roja antes de probarla."
      : this.sim.trigger ? (this.sim.trigger.kind === "dock" ? "Embarcar" : "Entrada activada") + " · " + this.sim.trigger.id
      : this.sim.contact ? "Colisión · " + (this.sim.contact.id || "cuerpo")
      : this.sim.terrainBlocked ? "Límite caminable · no hay suelo para apoyar los pies"
      : !this.sim.valid ? "Fuera del suelo caminable · recoloca el duende"
      : "Caminable · flechas/WASD, arrastra para andar o toca un destino";
    if (this.sim.moved || previous !== this.feedback || this.sim.walking ||
      wasWalking !== this.sim.walking || wasRunning !== this.sim.running) this.view.dirty = true;
    if (this.sim.moved) {
      this.center();
    }
    if (previous !== this.feedback) this.paint();
  }
  paint() {
    $("probe-toggle").setAttribute("aria-pressed", String(this.enabled));
    $("probe-toggle").textContent = this.enabled ? "Volver a editar" : "Probar con duende";
    $("probe-place").hidden = !this.enabled;
    $("probe-place").setAttribute("aria-pressed", String(!!this.placing));
    $("probe-status").hidden = !this.enabled;
    $("probe-status").textContent = this.placing ? "Toca el mapa para colocar el duende de prueba" : this.feedback || "Prueba local: no guarda partida ni cambia de escena";
    this.view.canvas.setAttribute("aria-label", this.enabled
      ? "Prueba del duende: flechas o arrastrar para andar, un toque para viajar; Escape vuelve a editar."
      : "Selecciona y arrastra un elemento. Usa las flechas para ajustes finos.");
  }
  draw(c) {
    if (!this.enabled || !this.sim || !this.placed) return;
    const { actor, contactRect, trigger, world } = this.sim;
    const paint = (r, color) => {
      c.fillStyle = color + "33"; c.strokeStyle = color; c.lineWidth = 3 / this.view.zoom;
      c.fillRect(...r); c.strokeRect(...r);
    };
    // The rectangle that is actually under the feet lights up, not only its inspector button.
    for (const bridge of world.data.bridges || []) {
      const r = require("../../public/assets/js/adventure/bridge-geometry").bridgeWalkable(bridge);
      if (inRect(actor.x / TILE, actor.y / TILE, r))
        paint(r.map(v => v * TILE), this.sim.terrainBlocked ? "#ff6060" : "#b4ff65");
    }
    if (contactRect) paint([contactRect.x, contactRect.y, contactRect.w, contactRect.h], "#ff6060");
    if (trigger?.rect) paint(trigger.rect, "#ffd75c");
    if (trigger?.dock) {
      const d = trigger.dock, [x, y, w, h] = d.boarding, p = dockPoint(d, x, y);
      c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(d.outward.y, d.outward.x));
      paint([0, 0, w, h], "#ffd75c"); c.restore();
    }
    paint([actor.x - FOOTPRINT.halfWidth, actor.y - FOOTPRINT.halfHeight,
      FOOTPRINT.halfWidth * 2, FOOTPRINT.halfHeight * 2], this.sim.valid && !this.sim.terrainBlocked ? "#b4ff65" : "#ff6060");
  }
  inspect() {
    return { enabled: this.enabled, actor: this.sim && { ...this.sim.actor }, feedback: this.feedback,
      contact: this.sim?.contact?.id || null, trigger: this.sim?.trigger?.id || null,
      valid: this.sim?.valid, terrainBlocked: !!this.sim?.terrainBlocked };
  }
}
module.exports = { PhysicsProbe };
