"use strict";
const { TILE, collisionBounds, distance, random, hash } = require("./geometry");
const { facing, DIRECTIONS } = require("./characters");
const { follow } = require("./movement");
const { active } = require("./rules");
const CARRY_DISTANCE = 880; // Five times the original 176px setback.
const CARRY_SPEED = 91;
// Walking home at patrol speed would take ~30s from a 880px drop, so the cat
// would still be wandering the wrong side of the map long after the joke landed.
const RETURN_SPEED = 76;
const PATROL_SPEED = 34;

/** Slab intersection, including a ray that starts inside cover. */
function crosses(a, b, rect) {
  let near = 0,
    far = 1;
  for (const [axis, size] of [
    ["x", "w"],
    ["y", "h"],
  ]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 0.00001) {
      if (a[axis] < rect[axis] || a[axis] > rect[axis] + rect[size])
        return false;
      continue;
    }
    const one = (rect[axis] - a[axis]) / delta,
      two = (rect[axis] + rect[size] - a[axis]) / delta;
    near = Math.max(near, Math.min(one, two));
    far = Math.min(far, Math.max(one, two));
    if (near > far) return false;
  }
  return far > 0 && near < 1;
}
function canSee(cat, target, blockers) {
  const dx = target.x - cat.x,
    dy = target.y - cat.y,
    d = Math.hypot(dx, dy);
  if (d > cat.range || d < 0.01) return d < 0.01;
  const angle = (DIRECTIONS.indexOf(cat.direction) * Math.PI) / 4;
  if (d > 16 && (dx * Math.cos(angle) + dy * Math.sin(angle)) / d < 0.52)
    return false;
  return !blockers.some((body) => crosses(cat, target, collisionBounds(body)));
}

/** Fixed amount of route work at capture, never an unbounded search for a drop. */
function safeDrop(world, cat, randomValue = Math.random) {
  const start = randomValue() * Math.PI * 2;
  for (let i = 0; i < 32; i++) {
    const a = start + i * 2.39996,
      radius = CARRY_DISTANCE + (i % 4) * 120;
    const p = {
      x: cat.x + Math.cos(a) * radius,
      y: cat.y + Math.sin(a) * radius,
    };
    if (
      !world.canStand(p.x, p.y) ||
      world.entities.some(
        (e) => e.threshold && Math.hypot(p.x - e.x, p.y - e.y) < 48,
      )
    )
      continue;
    const path = world.path(cat, p);
    if (path?.length && distance(cat, path.at(-1)) >= CARRY_DISTANCE)
      return path;
  }
  return null;
}

/** Local, bounded animal encounters. No economy writes, timers or per-frame network.
 * Art availability is checked before activating the encounter. Reload starts at the
 * last safe foot position with a grace period; carrying is deliberately not persisted. */
class CatEncounters {
  constructor(game) {
    this.game = game;
    this.reset();
  }
  reset() {
    this.actors = [];
    this.carrier = null;
    this.grace = 5;
    this.safePosition = null;
  }
  enter() {
    this.reset();
    const g = this.game;
    this.blockers = [...g.world.colliders].filter(
      (e) => e.visionBlocker || e.pushable || e.wall,
    );
    this.actors = g.world.entities
      // Keep dormant definitions: a story flag may bring another cat into this scene.
      .filter((e) => e.animal?.species === "cat")
      .slice(0, 8)
      .map((def) => ({
        ...def,
        ...def.animal,
        variant: /^cat-([^-]+)-/.exec(def.artSprite || def.sprite)[1],
        home: { x: def.x, y: def.y },
        direction: def.animal.direction || "down",
        range: (def.animal.range || 7) * TILE,
        phase: "idle",
        elapsed: 0,
        wait: 1,
        think: 0,
        path: [],
        routeIndex: 0,
        walkDistance: 0,
        moving: false,
        routeRetry: 0,
        rand: random(hash(def.id)),
      }))
      .filter(
        (cat) =>
          g.world.canStand(cat.x, cat.y) &&
          g.renderer.sprites.frame(`cat-${cat.variant}-down-0`) &&
          g.renderer.sprites.frame("person-0-down-carried-0"),
      );
  }
  get locked() {
    return Boolean(this.carrier);
  }
  change(cat, phase) {
    cat.phase = phase;
    cat.elapsed = 0;
    cat.path = [];
    cat.think = 0;
    cat.routeRetry = 0;
  }
  withoutPassenger(work) {
    const world = this.game.world,
      actors = world.actors;
    world.actors = actors.filter((a) => a !== this.game.player);
    try {
      return work();
    } finally {
      world.actors = actors;
    }
  }
  dropPoint(cat) {
    const world = this.game.world;
    // Put the passenger on dry ground away from the homeward route. The cat
    // itself never teleports, and neither body starts inside the other.
    const away = Math.atan2(cat.y - cat.home.y, cat.x - cat.home.x);
    return this.withoutPassenger(() => {
      for (const radius of [26, 34, 44])
        for (let i = 0; i < 8; i++) {
          const angle =
            away + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 4;
          const p = {
            x: cat.x + Math.cos(angle) * radius,
            y: cat.y + Math.sin(angle) * radius,
          };
          if (world.canStand(p.x, p.y) && world.clearSegment(cat, p, cat))
            return p;
        }
      return this.safePosition;
    });
  }
  release(cat) {
    const g = this.game;
    if (this.carrier === cat) {
      const drop = this.dropPoint(cat);
      if (drop) Object.assign(g.player, drop);
      this.carrier = null;
      this.safePosition = null;
      g.pauseMovement();
      g.dirty = true;
      g.save();
      g.toast(g.text("catReleased"));
    }
    this.grace = 7;
    // No pursuit while returning, even after the passenger's grace expires.
    this.change(cat, "homeward");
    cat.direction = facing(
      cat.home.x - cat.x,
      cat.home.y - cat.y,
      cat.direction,
    );
  }
  capture(cat) {
    if (this.carrier || this.grace) return;
    const g = this.game;
    const path = safeDrop(g.world, cat, cat.rand);
    if (!path) {
      this.grace = 3;
      this.change(cat, "return");
      return;
    }
    this.safePosition = { x: g.player.x, y: g.player.y };
    g.closeContent();
    g.closeDialogue();
    g.pauseMovement();
    this.carrier = cat;
    this.change(cat, "pickup");
    cat.carryPath = path;
    cat.carryTarget = { ...path.at(-1) };
    cat.carryDeadline =
      path.reduce(
        (total, p, i) => total + distance(i ? path[i - 1] : cat, p),
        0,
      ) /
        CARRY_SPEED +
      5;
    cat.carryRetries = 0;
    g.cameraFollowing = true;
    g.toast(g.text("catCaught"));
  }
  update(dt) {
    const g = this.game;
    if (this.colliderSet !== g.world.colliders) {
      this.colliderSet = g.world.colliders;
      this.blockers = g.world.colliders.filter(
        (e) => e.visionBlocker || e.pushable || e.wall,
      );
    }
    if (g.transitioning || g.dialogue || g.hasOverlay() || g.community?.editing)
      return;
    this.grace = Math.max(0, this.grace - dt);
    for (const cat of this.actors) {
      if (!active(cat, g.state)) {
        if (this.carrier === cat) this.release(cat);
        continue;
      }
      cat.elapsed += dt;
      cat.think -= dt;
      cat.routeRetry -= dt;
      cat.moving = false;
      if (this.carrier === cat) {
        if (cat.phase === "pickup" && cat.elapsed >= 0.42) {
          this.change(cat, "carry");
          cat.path = cat.carryPath;
        } else if (cat.phase === "carry") {
          // The carried player is not an obstacle to the carrier.
          this.withoutPassenger(() => {
            cat.moving = follow(g.world, cat, cat.path, dt, CARRY_SPEED);
            if (
              !cat.moving &&
              distance(cat, cat.carryTarget) > 2 &&
              cat.carryRetries < 2
            ) {
              cat.carryRetries++;
              cat.path = g.world.path(cat, cat.carryTarget) || [];
              cat.moving = follow(g.world, cat, cat.path, dt, CARRY_SPEED);
            }
          });
          Object.assign(g.player, {
            x: cat.x,
            y: cat.y,
            direction: cat.direction,
          });
          g.walking = cat.moving;
          if (
            !cat.path.length ||
            (!cat.moving && cat.elapsed > 0.5) ||
            cat.elapsed > cat.carryDeadline
          )
            this.change(cat, "drop");
        } else if (cat.phase === "drop" && cat.elapsed > 0.4) this.release(cat);
        continue;
      }
      if (cat.think <= 0) {
        cat.think = 0.18;
        const seen =
          !g.river.active &&
          !this.carrier &&
          !this.grace &&
          canSee(cat, g.player, this.blockers);
        if (seen && ["idle", "patrol", "return"].includes(cat.phase))
          this.change(cat, "notice");
        else if (!seen && ["notice", "chase"].includes(cat.phase))
          this.change(cat, "return");
        if (cat.phase === "chase")
          cat.path = g.world.approach(cat, g.player, 2) || [];
      }
      if (cat.phase === "notice") {
        cat.direction = facing(g.player.x - cat.x, g.player.y - cat.y);
        if (cat.elapsed >= 0.85) this.change(cat, "chase");
      } else if (cat.phase === "chase") {
        if (distance(cat, g.player) < 26) this.capture(cat);
        else {
          cat.moving = follow(g.world, cat, cat.path, dt, 104);
          if (cat.elapsed > 10) this.change(cat, "return");
        }
      } else if (cat.phase === "homeward") {
        if (cat.path.length)
          cat.moving = follow(g.world, cat, cat.path, dt, RETURN_SPEED);
        if (distance(cat, cat.home) < TILE * 2) {
          // Home again: curious as ever.
          this.change(cat, "idle");
          cat.wait = 1 + cat.rand();
        } else if (!cat.path.length && cat.routeRetry <= 0) {
          // Use the SAME live obstacles for planning and movement. Ignoring the
          // player just in A* repeatedly planned a route through their body.
          cat.path = g.world.approach(cat, cat.home, 2) || [];
          cat.routeRetry = cat.path.length ? 0.4 : 1.2;
        }
      } else {
        if (!cat.path.length) {
          cat.wait -= dt;
          if (cat.wait <= 0) {
            const p = cat.patrol?.[cat.routeIndex++ % cat.patrol.length];
            const target =
              cat.phase === "return" || !p
                ? cat.home
                : { x: p[0] * TILE, y: p[1] * TILE };
            cat.path = g.world.path(cat, target) || [];
            cat.phase = "patrol";
            cat.wait = 1.5 + cat.rand() * 2;
          }
        } else cat.moving = follow(g.world, cat, cat.path, dt, PATROL_SPEED);
      }
    }
  }
  frame(cat) {
    const row = ["pickup", "drop"].includes(cat.phase)
      ? 4
      : cat.moving
        ? `walk-${Math.floor(cat.walkDistance / 9) % 4}`
        : 0;
    return `cat-${cat.variant}-${cat.direction}-${row}`;
  }
  renderables() {
    return this.actors
      .filter((c) => active(c, this.game.state))
      .map((cat) => ({
        ...cat,
        sprite: this.frame(cat),
        artSprite: this.frame(cat),
        cat: true,
        rules: [],
      }));
  }
  carried() {
    const cat = this.carrier;
    if (!cat) return null;
    const anchors = {
      down: [0, -20],
      "down-right": [18, -24],
      right: [20, -27],
      "up-right": [15, -40],
      up: [0, -53],
      "up-left": [-13, -40],
      left: [-18, -26],
      "down-left": [-12, -25],
    };
    const [x, y] = anchors[cat.direction];
    return {
      x: cat.x + x * (cat.scale || 1),
      y: cat.y + y * (cat.scale || 1),
      depth: cat.y + (cat.direction.startsWith("up") ? -0.1 : 0.1),
      sprite: `person-0-${cat.direction}-carried-${Math.floor(cat.elapsed * 3) % 2}`,
      rules: [],
    };
  }
  drawWarning(ctx, entity) {
    if (entity.phase !== "notice") return;
    ctx.fillStyle = "#fff4bd";
    ctx.strokeStyle = "#514633";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y - 66, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#51351f";
    ctx.fillRect(entity.x - 1, entity.y - 71, 2, 6);
    ctx.fillRect(entity.x - 1, entity.y - 63, 2, 2);
  }
}
module.exports = { crosses, canSee, safeDrop, CatEncounters };
