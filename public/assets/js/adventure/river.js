"use strict";
const { findPath } = require("./navigation");
const { TILE } = require("./geometry");
const { drawCurrentTraces } = require("./current-traces");
const { docks, dockAt, atDock, enteringDock } = require("./docks");
const { facing } = require("./characters");
const { riverBodies } = require("./river-life");
const { vesselLayers, definition: vesselDefinition } = require("./vessel-art");
const { playerPack } = require("./player-art");
const {
  canFloat,
  VesselMotion,
  yieldToRiverBodies,
} = require("./river-navigation");

/** Vessel physics and directional jetty crossings; input is shared with walking. */
class River {
  constructor(game) {
    this.game = game;
    this.motion = new VesselMotion();
    this.path = [];
    this.nextBump = 0;
  }
  get active() {
    return this.game.state.navigation?.mode === "boat";
  }
  pause() {
    this.path = [];
    this.dockTarget = null;
    this.motion.stop();
  }
  frame() {
    return this.layers()?.rower || null;
  }
  layers() {
    return this.active ? vesselLayers(this.game.player, this.motion.phase(this.game.reducedMotion)) : null;
  }
  tapFoot(point) {
    const g = this.game,
      dock = dockAt(g.world.data, point);
    if (!g.state.inventory.boat || !dock) return false;
    this.failedDock = null;
    if (
      !g.journey.start(g.world, g.player, {
        kind: "dock",
        dock,
        point: dock.dry,
      })
    )
      g.toast(g.text("blocked"));
    return true;
  }
  checkFoot(intent) {
    const g = this.game;
    if (
      this.active ||
      !g.state.inventory.boat ||
      g.transitioning ||
      g.cats.locked
    )
      return false;
    for (const dock of docks(g.world.data)) {
      if (this.failedDock === dock.id && !atDock(dock, g.player, "foot"))
        this.failedDock = null;
      if (
        this.failedDock !== dock.id &&
        enteringDock(dock, g.player, intent, "foot")
      ) {
        this.embark(dock);
        return true;
      }
    }
    return false;
  }
  async embark(dock) {
    this.game.telemetry?.milestone("river");
    const g = this.game;
    if (
      g.transitioning ||
      !g.state.inventory.boat ||
      !canFloat(g.world, dock.wet.x, dock.wet.y)
    )
      return;
    return this.changeMode(dock, "boat", dock.wet, dock.outward);
  }
  async changeMode(dock, mode, position, direction) {
    const g = this.game;
    this.lastFailure = null;
    g.transitioning = true;
    g.pauseMovement({ keepControls: true });
    try {
      if (mode === "boat") {
        const sprites = g.renderer.sprites;
        const packs = await sprites.prepare([], [playerPack("row", g.player),
          vesselDefinition.vessels[vesselDefinition.defaultVessel].pack]);
        sprites.activate(new Set([...sprites.pinned, ...packs]));
        packs.release?.();
      }
      if (g.live) await g.live.cross("dock", dock.id, g.state.scene, position, mode);
      this.setMode(dock, mode, position, direction);
    } catch (error) {
      this.lastFailure = error.code || error.message || "travel_failed";
      this.failedDock = dock.id;
      g.toast(g.text("travelError"));
    } finally {
      g.transitioning = false;
    }
  }
  setMode(dock, mode, position, direction) {
    const g = this.game;
    g.pauseMovement({ keepControls: true });
    Object.assign(g.player, position, {
      direction: facing(direction.x, direction.y),
    });
    g.state.navigation = {
      mode,
      direction: g.player.direction,
      landing: dock.id,
    };
    g.world.refresh(g.state);
    g.dirty = true;
    g.recenterCamera(true);
    g.updateUI();
    g.save();
  }
  /**
   * `callado` silencia el aviso de que no cabe la barca, para quien replantea el rumbo muchas
   * veces seguidas; un TOQUE avisa, que ahí la persona ha señalado un sitio concreto y merece
   * saber por qué no se va. Hoy no queda quien lo pida callado: el mando del dedo rema por
   * `directionIntent`, como las flechas, y no por destinos.
   */
  tap(point, callado = false) {
    const g = this.game,
      world = g.world;
    this.dockTarget = dockAt(world.data, point) || null;
    if (this.dockTarget) point = this.dockTarget.wet;
    if (!canFloat(world, point.x, point.y)) return;
    // Reuse the A* implementation with vessel geometry, never the dry-foot grid.
    /**
     * Lo que `findPath` necesita de un mundo son cuatro cosas: su tamaño, si una casilla admite al
     * que la va a ocupar, y si un tramo recto está libre. Aquí el que ocupa es la barca, así que
     * las dos respuestas salen del casco (`canFloat`) y no del pie.
     */
    const navigation = {
      width: world.width,
      height: world.height,
      cellCanStand: (x, y) =>
        canFloat(world, (x + 0.5) * TILE, (y + 0.5) * TILE),
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
    if (this.path.length && this.dockTarget) this.path.push({ ...point });
    if (
      !this.path.length &&
      !(this.dockTarget && atDock(this.dockTarget, g.player, "boat")) &&
      !callado
    )
      g.toast(g.text("riverNoRoute"));
  }
  /**
   * `time` es el MISMO reloj con el que el renderizador coloca a los vecinos del río, y por eso
   * viaja hasta aquí en vez de leerse de otro sitio: si el choque y el dibujo usaran dos relojes,
   * la barca rebotaría contra un sitio donde no hay nadie.
   */
  update(dt, time = 0) {
    const g = this.game;
    g.world.riverBodies = riverBodies(g.world.data, time);
    let intent = g.directionIntent();
    if (intent) {
      this.path = [];
      this.dockTarget = null;
    }
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
    if (
      !intent &&
      this.dockTarget &&
      Math.hypot(
        g.player.x - this.dockTarget.wet.x,
        g.player.y - this.dockTarget.wet.y,
      ) < 18
    )
      intent = { x: -this.dockTarget.outward.x, y: -this.dockTarget.outward.y };
    const landing = docks(g.world.data).find((d) =>
      enteringDock(d, g.player, intent, "boat"),
    );
    if (landing && this.disembark(landing)) return;
    g.walking = this.motion.step(g.world, g.player, intent, dt, g.boosted());
    g.state.navigation.direction = g.player.direction;
    // Chocar con un vecino se dice; chocar con una orilla no. Y se dice de vez en cuando: una
    // frase por cada roce sería un vecino gritando mientras remas pegado a él.
    // Lo que dice quien se lleva el golpe lo declara la PANTALLA en ese cuerpo, no el motor: así
    // un rincón del río puede tener a alguien con otra forma de quejarse sin tocar una línea de
    // código, que es lo mismo que vale para cualquier frase del bosque.
    // Quien te alcanza cuenta igual que aquel contra el que remas: el río es de todos en los dos
    // sentidos, y una barca parada tampoco se deja pisar.
    const bump =
      this.motion.takeBump() ||
      yieldToRiverBodies(g.world, g.player, dt, this.motion);
    if (bump?.bump && time >= this.nextBump) {
      this.nextBump = time + 6;
      const lines = g.lines(bump.bump);
      g.toast(lines[Math.floor(Math.random() * lines.length)]);
    }
    // Cruzar un borde es lo mismo remando que andando: una sola pieza (crossings.js).
    g.crossings.check("boat");
  }
  disembark(landing) {
    const g = this.game;
    if (
      !this.active ||
      !landing ||
      g.transitioning ||
      g.dialogue ||
      g.blocked()
    )
      return;
    const { x, y } = landing.dry;
    if (!g.world.canStand(x, y, g.player)) {
      g.toast(g.text("blocked"));
      return false;
    }
    this.changeMode(
      landing,
      "foot",
      { x, y },
      { x: -landing.outward.x, y: -landing.outward.y },
    );
    return true;
  }
  drawWater(ctx, time) {
    const g = this.game,
      data = g.world.data;
    if (!data.navigation) return;
    ctx.save();
    drawCurrentTraces(ctx, g.world, g.camera, g.renderer, time);
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
