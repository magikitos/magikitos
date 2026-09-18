"use strict";
const { TILE } = require("./geometry");
const { active } = require("./rules");
const { follow } = require("./movement");
const { TravelPace } = require("./locomotion");
const { pushPath } = require("./movables");
const { portalPath } = require("./portals");
const { dockPath } = require("./docks");

const RETRY_SECONDS = 0.3;

/** A click owns an intention, not just disposable waypoints. No dialogue or UI
 * dispatch lives here: incidental bodies only cause a detour/wait. Keyboard
 * movement remains free to use the ordinary bump/push interactions. */
class Journey {
  constructor() {
    this.pace = new TravelPace();
    this.clear();
  }
  clear() {
    this.intent = null;
    this.path = [];
    this.retry = 0;
    this.replans = 0;
    this.pace.clear();
  }
  get target() {
    return this.intent?.entity || null;
  }
  /**
   * Dónde acaba este viaje, para que la cámara pueda mirar AL SITIO que acabas de señalar en vez
   * de al duende (ver `centerCamera`). El último nudo del camino es el destino exacto y no se
   * mueve según se anda, porque los que se van gastando son los de delante; mientras se replanea
   * el camino está vacío un instante y entonces vale la intención, que es lo mismo con menos
   * precisión.
   */
  get goal() {
    if (!this.intent) return null;
    return this.path.at(-1) || this.intent.point || this.intent.entity || null;
  }
  plan(world, actor) {
    const intent = this.intent;
    if (!intent || (intent.entity && !active(intent.entity, world.state)))
      return null;
    switch (intent.kind) {
      case "dock":
        return dockPath(world, actor, intent.dock);
      case "interact":
        return world.approach(actor, intent.entity, 6);
      case "portal":
        return portalPath(world, actor, intent.entity);
      case "push":
        return pushPath(world, actor, intent.entity);
      case "ground":
        return world.path(actor, intent.point);
      default:
        throw new Error("Unknown journey intention");
    }
  }
  start(world, actor, intent) {
    this.clear();
    this.intent = intent;
    let path = this.plan(world, actor);
    if (!path && intent.kind === "ground")
      path = world.approach(actor, intent.point, 2);
    if (!path?.length) {
      this.clear();
      return false;
    }
    // Resolve an inaccessible clicked pixel once, not to a different nearby
    // destination on every reroute. The marker and arrival stay consistent.
    if (intent.kind === "ground")
      this.intent = { kind: "ground", point: { ...path.at(-1) } };
    this.path = path;
    this.pace.begin(actor, path);
    return true;
  }
  replan(world, actor) {
    this.path = [];
    if (!this.intent || this.retry > 0) return;
    this.replans++;
    this.retry = RETRY_SECONDS;
    this.path = this.plan(world, actor) || [];
  }
  permitsPush(entity) {
    return this.intent?.kind === "push" && this.target === entity;
  }
  permitsPortal(entity) {
    return (
      !this.intent || (this.intent.kind === "portal" && this.target === entity)
    );
  }
  step(world, actor, dt, speed, { onStep, resolveCollision } = {}) {
    if (!this.intent || dt <= 0 || speed <= 0) return { moved: false };
    if (this.target && !active(this.target, world.state)) {
      this.clear();
      return { moved: false };
    }
    this.retry = Math.max(0, this.retry - dt);
    // Only the terminal leg of an explicit push may deliberately hit a body.
    const pushing = this.intent.kind === "push" && this.path.length === 1;
    const next = this.path[0];
    const lookahead =
      next &&
      Math.min(
        1,
        48 / Math.max(1, Math.hypot(next.x - actor.x, next.y - actor.y)),
      );
    const probe = next && {
      x: actor.x + (next.x - actor.x) * lookahead,
      y: actor.y + (next.y - actor.y) * lookahead,
    };
    if (
      !this.path.length ||
      (!pushing && !world.clearSegment(actor, probe, actor))
    )
      this.replan(world, actor);
    if (!this.path.length) return { moved: false };

    let hit = false;
    const end = this.path.at(-1);
    const moved = follow(
      world,
      actor,
      this.path,
      dt,
      speed,
      () => {
        hit = true;
      },
      onStep,
      {
        slide: false,
        resolveCollision: (entity, dx, dy) =>
          this.permitsPush(entity) ? resolveCollision?.(entity, dx, dy) : false,
      },
    );
    // A portal callback may have cancelled this journey mid-substep.
    if (!this.intent) return { moved };
    if (pushing && actor.pushing?.waiting) return { moved, waiting: true };
    if (
      hit ||
      (!moved && this.path.length) ||
      (!this.path.length && Math.hypot(actor.x - end.x, actor.y - end.y) > 0.01)
    ) {
      this.replan(world, actor);
      return { moved };
    }
    if (!this.path.length) {
      if (
        this.intent.kind === "interact" &&
        world.distanceTo(actor, this.target) >= TILE * 1.5
      ) {
        this.replan(world, actor);
        return { moved };
      }
      const arrived = this.intent.kind === "interact" ? this.target : null;
      this.clear();
      return { moved, arrived };
    }
    return { moved };
  }
}
module.exports = { Journey, RETRY_SECONDS };
