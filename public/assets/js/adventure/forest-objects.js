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
  }
  bind(world) {
    if (this.world === world) return;
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
      const view = old?.view || { ...entity, x, y, liveHidden: false };
      const snap = !old || Math.hypot(x - view.x, y - view.y) > 32;
      const record = { x, y, revision, at: now, fromX: snap ? x : view.x, fromY: snap ? y : view.y, view };
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
  update() {
    const g = this.game, now = this.now();
    for (const r of this.records.values()) {
      const t = g.reducedMotion ? 1 : Math.min(1, Math.max(0, (now - r.at) / protocol.limits.objectTickMs));
      r.view.x = r.fromX + (r.x - r.fromX) * t; r.view.y = r.fromY + (r.y - r.fromY) * t;
    }
    const previous = this.holding, motion = g.movementIntent();
    this.holding = this.contact;
    if (!this.holding && previous && motion && direction(motion.x, motion.y) === previous.direction) {
      const entity = this.entities.get(previous.object);
      const deliberate = !g.journey.intent || g.journey.permitsPush(entity);
      if (entity && deliberate && this.canPush(entity) && this.touching(entity, previous.direction)) this.holding = previous;
    }
    if (g.dialogue || g.blocked() || g.river.active) this.holding = null;
    if (this.holding) g.player.pushing = { direction: this.holding.direction, moved: g.walking, waiting: !g.walking };
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
  visual(entity) { return entity.shared ? this.records.get(entity.id)?.view || entity : entity; }
  bounds() { return [...this.records.keys()].map(id => {
    const b = collisionBounds(this.entities.get(id)); return { x: b.x / TILE, y: b.y / TILE, w: b.w / TILE, h: b.h / TILE };
  }); }
}
module.exports = { ForestObjects };
