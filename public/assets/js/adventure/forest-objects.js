"use strict";
const { collisionBounds, actorBounds, TILE } = require("./geometry");
const { protocol } = require("./forest-connection");
const vector = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
const direction = (x, y) => Math.abs(x) > Math.abs(y) ? (x > 0 ? "right" : "left") : (y > 0 ? "down" : "up");

/** Current-scene communal bodies. Physics uses the latest server position immediately;
 * only their rendered copies interpolate. Never predicts a push or writes a personal save. */
class ForestObjects {
  constructor(game, now = () => performance.now()) {
    this.game = game; this.now = now; this.scene = null; this.world = null;
    this.records = new Map(); this.entities = new Map(); this.lastPacket = -Infinity;
    this.contact = null; this.holding = null; this.sent = null;
    this.pushView = null; this.playerView = null;
  }
  bind(world) {
    if (this.world === world) return;
    this.pushView = null; this.playerView = null;
    if (this.scene !== world.data.id) {
      this.records.clear(); this.lastPacket = -Infinity; this.holding = null;
    }
    this.world = world; this.scene = world.data.id;
    this.entities = this.prepare(world);
    for (const [id, entity] of this.entities) {
      const record = this.records.get(id);
      if (record) {
        record.view = { ...entity }; record.fromX = record.x; record.fromY = record.y;
      }
    }
  }
  prepare(world) {
    const entities = new Map(world.entities.filter(e => e.shared === true).map(e => [e.id, e]));
    for (const [id, entity] of entities) {
      const record = world.data.id === this.scene ? this.records.get(id) : null;
      entity.liveHidden = !record; world.setBody(entity, Boolean(record));
      if (record) world.relocate(entity, record.x, record.y);
    }
    return entities;
  }
  begin(world) { this.bind(world); this.contact = null; }
  reconnect() {
    // A crashed process can legitimately resume its last committed (older) revision.
    this.lastPacket = -Infinity;
    for (const record of this.records.values()) record.revision = -1;
    this.holding = null; this.sent = null;
    this.pushView = null; this.playerView = null;
  }
  snapshot(packet) {
    const world = this.game.world;
    if (packet.scene !== world.data.id || !Number.isSafeInteger(packet.now) || !Array.isArray(packet.objects)) return false;
    this.bind(world);
    if (packet.now < this.lastPacket || packet.objects.length > this.entities.size) return false;
    const seen = new Set();
    for (const row of packet.objects) {
      if (!Array.isArray(row) || row.length !== 4) return false;
      const [id, x, y, revision] = row, prior = this.records.get(id);
      if (!this.entities.has(id) || seen.has(id) || !Number.isFinite(x) || x < 0 || x >= world.width * TILE ||
          !Number.isFinite(y) || y < 0 || y >= world.height * TILE || !Number.isSafeInteger(revision) || revision < 0 ||
          (prior && (revision < prior.revision || (revision === prior.revision && (x !== prior.x || y !== prior.y))))) return false;
      seen.add(id);
    }
    const now = this.now(); this.lastPacket = packet.now;
    for (const [id] of this.records) if (!seen.has(id)) {
      const entity = this.entities.get(id);
      entity.liveHidden = true; world.setBody(entity, false); this.records.delete(id);
    }
    for (const [id, x, y, revision] of packet.objects) {
      const entity = this.entities.get(id), old = this.records.get(id);
      if (old?.revision === revision) continue;
      // Finish the elapsed part of the old segment before replacing it. Its last painted
      // position is up to one frame behind; restarting there freezes every packet frame.
      if (old) this.interpolate(old, now);
      const view = old?.view || { ...entity, x, y, liveHidden: false };
      const snap = !old || Math.hypot(x - view.x, y - view.y) > 32;
      const base = this.game.live?.role === "spectator" ? protocol.limits.spectatorSnapshotMs : protocol.limits.objectTickMs;
      const gap = old ? now - old.at : base;
      // Follow the received cadence, including delayed packets. An idle object sends nothing,
      // so a long silence starts a fresh segment instead of making the next push crawl.
      const duration = old && gap <= Math.max(base, old.duration) * 3
        ? Math.min(base * 3, Math.max(base, gap, old.duration * 0.8 + gap * 0.2)) : base;
      const record = { x, y, revision, at: now, duration, fromX: snap ? x : view.x, fromY: snap ? y : view.y, view };
      this.records.set(id, record);
      world.relocate(entity, x, y); entity.liveHidden = false; world.setBody(entity, true);
    }
    return true;
  }
  canPush(entity) {
    const live = this.game.live;
    return Boolean(live?.connection.ready && live.role === "player" && entity.shared && !entity.liveHidden && this.entities.get(entity.id) === entity);
  }
  touching(entity, heading) {
    const body = collisionBounds(entity), feet = actorBounds(this.game.player.x, this.game.player.y), [dx, dy] = vector[heading];
    const along = dx ? "x" : "y", across = dx ? "y" : "x", size = dx ? "w" : "h", other = dx ? "h" : "w";
    const gap = (dx || dy) > 0 ? body[along] - feet[along] - feet[size] : feet[along] - body[along] - body[size];
    return gap >= -1 && gap <= protocol.limits.pushContactPixels && feet[across] < body[across] + body[other] && feet[across] + feet[other] > body[across];
  }
  push(entity, dx, dy) {
    if (!this.canPush(entity) || (!dx && !dy)) return false;
    const heading = direction(dx, dy);
    if (!this.touching(entity, heading)) return false;
    this.contact = { scene: this.scene, object: entity.id, direction: heading };
    this.game.player.pushing = { direction: heading, moved: false, waiting: true };
    return { x: 0, y: 0 }; // Waiting is not speculative object/player movement.
  }
  interpolate(r, now) {
    // Moving furniture is essential travel, also with reduced motion. Never extrapolate
    // past a confirmed position when packets stop arriving.
    const t = Math.min(1, Math.max(0, (now - r.at) / r.duration));
    const x = r.fromX + (r.x - r.fromX) * t, y = r.fromY + (r.y - r.fromY) * t;
    r.moving = Math.hypot(x - r.view.x, y - r.view.y) > 0.001 ||
      (t < 1 && Math.hypot(r.x - r.fromX, r.y - r.fromY) > 0.001);
    r.view.x = x; r.view.y = y;
  }
  update() {
    const g = this.game, now = this.now();
    for (const r of this.records.values()) this.interpolate(r, now);
    const previous = this.holding, motion = g.movementIntent();
    this.holding = this.contact;
    if (!this.holding && previous && motion && direction(motion.x, motion.y) === previous.direction) {
      const entity = this.entities.get(previous.object);
      const deliberate = !g.journey.intent || g.journey.permitsPush(entity);
      if (entity && deliberate && this.canPush(entity) && this.touching(entity, previous.direction)) this.holding = previous;
    }
    if (g.dialogue || g.blocked() || g.river.active) this.holding = null;
    if (this.holding) g.player.pushing = { direction: this.holding.direction,
      moved: g.walking || this.records.get(this.holding.object)?.moving, waiting: !g.walking };
    this.updatePlayerView(now);
  }
  updatePlayerView(now) {
    const player = this.game.player, previous = this.playerView;
    let offsetX = 0, offsetY = 0, anchored = false;
    const holding = this.holding, record = holding && this.records.get(holding.object);
    if (!record && !previous?.offsetX && !previous?.offsetY) {
      this.pushView = null; this.playerView = null;
      return;
    }
    if (record) {
      const axis = vector[holding.direction][0] ? "x" : "y";
      if (this.pushView?.object !== holding.object || this.pushView.direction !== holding.direction)
        this.pushView = { ...holding, offset: player[axis] +
          (axis === "x" ? previous?.offsetX || 0 : previous?.offsetY || 0) - record.view[axis] };
      // The body still catches up with confirmed physics in short steps. Draw the hands and
      // furniture together so those steps do not shake the player or the following camera.
      const offset = record.view[axis] + this.pushView.offset - player[axis];
      if (Math.abs(offset) <= protocol.limits.pushContactPixels) {
        if (axis === "x") offsetX = offset;
        else offsetY = offset;
        anchored = true;
      }
    }
    if (!anchored) {
      this.pushView = null;
      // Releasing/changing direction eases out the small drawing offset, never the real body.
      const decay = Math.exp(-Math.max(0, now - (previous?.at ?? now)) / protocol.limits.objectTickMs);
      offsetX = (previous?.offsetX || 0) * decay;
      offsetY = (previous?.offsetY || 0) * decay;
      if (Math.abs(offsetX) < 0.001) offsetX = 0;
      if (Math.abs(offsetY) < 0.001) offsetY = 0;
    }
    this.playerView = { at: now, offsetX, offsetY };
  }
  transmit() {
    const live = this.game.live, desired = this.holding;
    if (desired && live.connection.ready && live.role === "player") {
      live.connection.send({ type: "empujo", ...desired }); this.sent = desired.scene;
    } else if (this.sent) {
      live.connection.send({ type: "empujo", scene: this.sent, object: null, direction: null }); this.sent = null;
    }
  }
  stop() { this.holding = null; this.contact = null; this.transmit(); }
  visualPlayer() {
    const player = this.game.player;
    if (!this.playerView) return player;
    return { ...player, x: player.x + (this.playerView?.offsetX || 0), y: player.y + (this.playerView?.offsetY || 0) };
  }
  visual(entity) { return entity.shared ? this.records.get(entity.id)?.view || entity : entity; }
  bounds() { return [...this.records.keys()].map(id => {
    const b = collisionBounds(this.entities.get(id)); return { x: b.x / TILE, y: b.y / TILE, w: b.w / TILE, h: b.h / TILE };
  }); }
}
module.exports = { ForestObjects };
