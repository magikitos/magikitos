"use strict";
const { protocol } = require("./forest-connection");
const { characterFrame } = require("./characters");
const { VesselMotion } = require("./river-navigation");
const { vesselLayers } = require("./vessel-art");
const INTERPOLATION_MS = protocol.limits.playerSnapshotMs;

/** Render-only peers. Never inserted into personal NPCs, save data, inventory or collision. */
class ForestPeople {
  constructor(now = () => performance.now()) { this.now = now; this.clear(); }
  clear() { this.scene = null; this.people = new Map(); this.list = []; }
  snapshot(packet, scene, bounds) {
    if (packet.scene !== scene || !Array.isArray(packet.people) || packet.people.length > protocol.limits.players) return false;
    const rows = packet.people;
    if (!rows.every(p => Array.isArray(p) && p.length === 7 && /^[a-f0-9]{24}$/.test(p[0]) &&
        Number.isFinite(p[1]) && p[1] >= 0 && p[1] < bounds.width && Number.isFinite(p[2]) && p[2] >= 0 && p[2] < bounds.height &&
        Number.isInteger(p[3]) && protocol.directions[p[3]] && Number.isInteger(p[4]) && protocol.poses[p[4]] &&
        Number.isSafeInteger(p[5]) && p[5] >= 0 && p[5] <= 9999 && [0, 1].includes(p[6])) ||
        new Set(rows.map(p => p[0])).size !== rows.length) return false;
    if (this.scene !== scene) this.clear();
    this.scene = scene;
    const now = this.now(), keep = new Set();
    for (const [id, x, y, direction, pose, variant, mode] of rows) {
      keep.add(id);
      let peer = this.people.get(id);
      if (!peer) {
        peer = { id: "live-" + id, x, y, walkDistance: 0, poseAt: now, vessel: new VesselMotion(), rules: [] };
        this.people.set(id, peer);
      }
      if (peer.pose !== protocol.poses[pose]) peer.poseAt = now;
      Object.assign(peer, { fromX: peer.x, fromY: peer.y, toX: x, toY: y, at: now,
        direction: protocol.directions[direction], pose: protocol.poses[pose], variant, mode });
    }
    for (const id of this.people.keys()) if (!keep.has(id)) this.people.delete(id);
    this.list = [...this.people.values()];
    return true;
  }
  update(reducedMotion = false) {
    const now = this.now();
    for (const p of this.list) {
      const t = Math.min(1, Math.max(0, (now - p.at) / INTERPOLATION_MS));
      const x = p.fromX + (p.toX - p.fromX) * t, y = p.fromY + (p.toY - p.fromY) * t;
      p.walkDistance += Math.hypot(p.x - x, p.y - y); p.x = x; p.y = y;
      const elapsed = (now - p.poseAt) / 1000, phase = reducedMotion ? 0 : Math.floor(elapsed * 5) % 4;
      const base = `person-${p.variant}`, heading = `${base}-${p.direction}`;
      p.vesselArt = null;
      if (p.mode === 1) {
        p.vessel.rowing = p.pose === "row"; p.vessel.stroke = elapsed;
        p.vesselArt = vesselLayers(p, p.vessel.phase(reducedMotion));
        p.sprite = p.vesselArt.rower;
      } else if (["pee", "poop", "discover"].includes(p.pose)) p.sprite = `${base}-${p.pose}-${phase}`;
      else if (["run", "push", "work", "carried"].includes(p.pose))
        p.sprite = `${heading}-${p.pose}-${p.pose === "carried" ? phase % 2 : phase}`;
      else p.sprite = characterFrame(p.variant, p, p.pose === "walk" && !reducedMotion);
    }
    return this.list;
  }
}
module.exports = { ForestPeople };
