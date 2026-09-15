"use strict";
const { TILE } = require("./geometry");
const { findPath } = require("./navigation");
const {
  canFloat,
  VesselMotion,
  nearestLanding,
  riverExit,
  currentAt,
} = require("./river-navigation");
const byId = (id) => document.getElementById(id);

/** Playable navigation owns its controls/physics. Quest rules only request boarding. */
class River {
  constructor(game) {
    this.game = game;
    this.motion = new VesselMotion();
    this.path = [];
    this.pad = new Map();
    this.landing = null;
    for (const button of document.querySelectorAll("[data-river-key]")) {
      const release = (event) => {
        const key = this.pad.get(event.pointerId);
        if (key) game.keys.delete(key);
        this.pad.delete(event.pointerId);
      };
      button.addEventListener("pointerdown", (event) => {
        if (!this.active || game.dialogue || game.blocked()) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.pad.set(event.pointerId, button.dataset.riverKey);
        game.keys.add(button.dataset.riverKey);
        this.path = [];
        game.unlockAudio();
      });
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
        button.addEventListener(name, release);
    }
    byId("river-land").addEventListener("click", () => this.disembark());
  }
  get active() {
    return this.game.state.navigation?.mode === "boat";
  }
  pause() {
    this.path = [];
    this.motion.stop();
    this.pad.clear();
  }
  frame() {
    return this.active
      ? this.motion.frame(this.game.player.direction, this.game.reducedMotion)
      : null;
  }
  async prepareBoard(entity, state) {
    const landing = this.game.world.data.navigation?.landings.find(
      (l) => l.id === entity.landing,
    );
    if (!landing || !state.inventory.boat)
      throw new Error("Invalid boarding point");
    state.navigation = {
      mode: "boat",
      direction: "right",
      landing: landing.id,
    };
    return this.game.scenes.prepare(
      this.game.state.scene,
      { x: landing.water[0] * TILE, y: landing.water[1] * TILE },
      state,
    );
  }
  tap(point) {
    const g = this.game,
      world = g.world;
    if (!canFloat(world, point.x, point.y)) return;
    // Reuse the A* implementation with vessel geometry, never the dry-foot grid.
    const navigation = {
      width: world.width,
      height: world.height,
      blocked: new Uint8Array(world.width * world.height),
      walkable: (x, y) =>
        x >= 0 && y >= 0 && x < world.width && y < world.height,
      canStand: (x, y) => canFloat(world, x, y),
      clearSegment: (a, b) => {
        const steps = Math.max(
          1,
          Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 4),
        );
        for (let i = 0; i <= steps; i++)
          if (
            !canFloat(
              world,
              a.x + ((b.x - a.x) * i) / steps,
              a.y + ((b.y - a.y) * i) / steps,
            )
          )
            return false;
        return true;
      },
    };
    this.path = findPath(navigation, g.player, point) || [];
    if (!this.path.length) g.toast(g.text("riverNoRoute"));
  }
  update(dt) {
    const g = this.game;
    let intent = g.keyboardIntent();
    if (intent) this.path = [];
    while (
      this.path.length &&
      Math.hypot(this.path[0].x - g.player.x, this.path[0].y - g.player.y) < 9
    )
      this.path.shift();
    if (!intent && this.path.length)
      intent = {
        x: this.path[0].x - g.player.x,
        y: this.path[0].y - g.player.y,
      };
    g.walking = this.motion.step(g.world, g.player, intent, dt);
    g.state.navigation.direction = g.player.direction;
    const exit = riverExit(g.world.data, g.player);
    if (!exit) this.failedExit = null;
    if (exit && exit.id !== this.failedExit) this.travel(exit);
    this.paint();
  }
  async travel(exit) {
    const g = this.game;
    exit = g.homestead?.resolveExit?.(exit) || exit;
    if (g.transitioning) return;
    g.transitioning = true;
    g.pauseMovement();
    try {
      const state = {
        ...g.state,
        navigation: {
          ...g.state.navigation,
          mode: "boat",
          direction: exit.direction,
        },
      };
      const prepared = await g.scenes.prepare(
        exit.scene,
        { x: exit.position[0] * TILE, y: exit.position[1] * TILE },
        state,
      );
      g.state = state;
      g.scenes.enter(prepared);
      g.toast(g.text(g.world.data.label || "riverDock"));
      g.save();
    } catch (error) {
      console.error("River arrival:", error);
      // Keep the vessel and belongings in the original reach; retry after moving away.
      this.failedExit = exit.id;
      g.toast(g.text("travelError"));
    } finally {
      g.transitioning = false;
      this.paint();
    }
  }
  disembark() {
    const g = this.game,
      landing = nearestLanding(g.world.data, g.player);
    if (
      !this.active ||
      !landing ||
      g.transitioning ||
      g.dialogue ||
      g.blocked()
    )
      return;
    const [x, y] = landing.land.map((n) => n * TILE);
    if (!g.world.canStand(x, y, g.player)) {
      g.toast(g.text("blocked"));
      return;
    }
    g.pauseMovement();
    g.player.x = x;
    g.player.y = y;
    g.player.direction = "up";
    g.state.navigation = { mode: "foot", direction: "up", landing: landing.id };
    g.world.refresh(g.state);
    g.dirty = true;
    g.recenterCamera(true);
    g.updateUI();
    g.save();
    g.homestead?.arrive();
  }
  paint() {
    const g = this.game;
    const hidden = !this.active || Boolean(g.dialogue) || g.blocked();
    byId("river-controls").hidden = hidden;
    this.landing = this.active ? nearestLanding(g.world.data, g.player) : null;
    byId("river-land").hidden = hidden || !this.landing;
  }
  drawWater(ctx, time) {
    const g = this.game,
      data = g.world.data;
    if (!data.navigation) return;
    ctx.save();
    ctx.strokeStyle = "rgba(220,241,206,.24)";
    ctx.lineWidth = 1;
    // A few moving strokes reveal the current direction, not a HUD meter.
    for (const current of data.navigation.currents || []) {
      const [cx, cy, rx, ry] = current.area;
      for (let i = 0; i < 10; i++) {
        const age = (time * 0.1 + i * 0.137) % 1;
        const x =
          (cx + Math.sin(i * 3.7) * rx * 0.65) * TILE +
          current.vector[0] * age * 0.2;
        const y = (cy + (age * 2 - 1) * ry * 0.7) * TILE;
        if (
          x < g.camera.x ||
          y < g.camera.y ||
          x > g.camera.x + g.renderer.width ||
          y > g.camera.y + g.renderer.height ||
          !g.world.waterAt(x / TILE, y / TILE)
        )
          continue;
        const flow = currentAt(data, x, y),
          length = Math.hypot(flow.x, flow.y);
        if (length < 4) continue;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (flow.x / length) * 7, y + (flow.y / length) * 7);
        ctx.stroke();
      }
    }
    if (this.active && g.walking) {
      ctx.strokeStyle = "rgba(227,243,214,.35)";
      ctx.beginPath();
      ctx.ellipse(
        g.player.x,
        g.player.y + 8,
        23 + Math.sin(time * 3),
        9,
        0,
        0,
        Math.PI,
      );
      ctx.stroke();
    }
    ctx.restore();
  }
}
module.exports = { River };
