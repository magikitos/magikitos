"use strict";
const { TILE, distance } = require("./geometry");
/** Local scene theatre, not multiplayer presence and never a reputation signal.
 * Three residents, at most one route search per half second, reserved activity
 * slots. Furniture supplies capabilities; residents do not know prefab names. */
class AmbientActivities {
  constructor(game) {
    this.game = game;
    this.reset();
  }
  reset() {
    for (const n of this.game.neighbors || []) {
      if (n.activity) n.path = [];
      delete n.activity;
      delete n.activitySprite;
    }
    this.clock = 0;
    this.cursor = 0;
    this.reserved = new Map();
  }
  reconcile(changedIds) {
    for (const n of this.game.neighbors || []) {
      const activity = n.activity;
      if (!activity || !changedIds.has(activity.key.slice(0, activity.key.lastIndexOf(":")))) continue;
      this.reserved.delete(activity.key);
      n.path = [];
      delete n.activity;
      delete n.activitySprite;
    }
  }
  update(dt) {
    const g = this.game;
    if (!g.community.zone || g.community.editing) return;
    this.clock -= dt;
    if (this.clock > 0) return;
    this.clock = 0.5;
    const count = Math.max(0, 3 - Math.floor((g.live?.people.list.length || 0) / 3));
    const residents = g.neighbors.slice(0, count);
    for (const n of g.neighbors.slice(count)) {
      if (!n.activity) continue;
      this.reserved.delete(n.activity.key);
      n.path = [];
      delete n.activity;
      delete n.activitySprite;
    }
    if (!residents.length) return;
    const n = residents[this.cursor++ % residents.length];
    if (n === g.journey.target) return;
    if (n.activity) {
      if (n.path.length) return;
      if (distance(n, n.activity.point) > 12 || n.activity.until < Date.now()) {
        this.reserved.delete(n.activity.key);
        delete n.activity;
        delete n.activitySprite;
        n.pause = 2;
        return;
      }
      n.direction = n.activity.direction;
      n.pause = 3;
      n.moving = false;
      const sit = `person-${n.variant}-${n.direction}-sit-2`;
      if (n.activity.capability === "sit" && g.renderer.sprites.frame(sit))
        n.activitySprite = sit;
      return;
    }
    if (n.path.length || n.rand() > 0.4) return;
    const choices = g.world.entities.filter(
      (e) =>
        e.community &&
        e.slots?.length &&
        e.capabilities?.some((c) => ["sit", "socialize", "garden"].includes(c)),
    );
    if (!choices.length) return;
    const e = choices[Math.floor(n.rand() * choices.length)],
      i = Math.floor(n.rand() * e.slots.length),
      key = `${e.id}:${i}`;
    if (this.reserved.has(key)) return;
    const [x, y, direction] = e.slots[i],
      point = { x: e.x + x * TILE, y: e.y + y * TILE };
    if (!g.world.canStand(point.x, point.y, n)) return;
    const path = g.world.path(n, point);
    if (!path?.length) return;
    this.reserved.set(key, n.id);
    n.path = path;
    n.activity = {
      key,
      point,
      direction,
      capability: e.capabilities[0],
      until: Date.now() + 25000 + n.rand() * 25000,
    };
  }
}
module.exports = { AmbientActivities };
