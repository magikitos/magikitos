"use strict";
const { protocol } = require("./forest-connection");
const { advanceGait, characterFrame, runFrame } = require("./characters");
const { VesselMotion } = require("./river-navigation");
const { vesselLayers } = require("./vessel-art");
const { reliefFrame } = require("./relief-art");
/**
 * How long a peer takes to glide to its newest position: the MEASURED gap between snapshots, not
 * a constant. A fixed 100 ms made a spectator (one snapshot every 2.5 s) see everybody sprint
 * for a tenth of a second and freeze for the rest, and any late packet stopped a player dead
 * before it jumped. Arriving just as the next snapshot lands keeps the motion continuous.
 */
const MIN_WINDOW_MS = protocol.limits.playerSnapshotMs,
  MAX_WINDOW_MS = protocol.limits.spectatorSnapshotMs * 1.2;

/**
 * Render-only peers. Never inserted into personal NPCs, save data, inventory or collision.
 *
 * ⛔ EL DUENDE DE UN EXTRAÑO SE PASA POR EL ELENCO DE ESTA RELEASE ANTES DE DIBUJARLO.
 *
 * Durante un despliegue conviven dos versiones: tu navegador tiene el arte de la de ayer y por el
 * socket puede llegar alguien con un duende que solo existe en la de hoy. Pedirle ese paquete al
 * almacén revienta —es un sprite que este manifiesto no registra— y lo hace dentro del bucle de
 * pintado, o sea que un desconocido tumbaría el bosque entero de quien no ha recargado. Se le
 * pone el duende de la casa: sigue estando, en su sitio y con su nombre, y solo cambia la cara.
 */
class ForestPeople {
  constructor(cast = (variant) => variant, now = () => performance.now()) {
    this.cast = cast;
    this.now = now;
    this.clear();
  }
  clear() {
    this.scene = null; this.people = new Map(); this.list = [];
    this.lastSnapshotAt = null; this.window = MIN_WINDOW_MS;
  }
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
    if (this.lastSnapshotAt !== null) {
      const gap = Math.min(MAX_WINDOW_MS, Math.max(MIN_WINDOW_MS, now - this.lastSnapshotAt));
      // Quick to slow down (a late packet), gentle to speed up (one early packet is not a trend).
      this.window = gap > this.window ? gap : this.window * 0.8 + gap * 0.2;
    }
    this.lastSnapshotAt = now;
    for (const [id, x, y, direction, pose, variant, mode] of rows) {
      keep.add(id);
      let peer = this.people.get(id);
      if (!peer) {
        peer = { id: "live-" + id, x, y, walkDistance: 0, poseAt: now, vessel: new VesselMotion(), rules: [] };
        this.people.set(id, peer);
      }
      if (peer.pose !== protocol.poses[pose]) peer.poseAt = now;
      Object.assign(peer, { fromX: peer.x, fromY: peer.y, toX: x, toY: y, at: now,
        direction: protocol.directions[direction], pose: protocol.poses[pose],
        variant: this.cast(variant), mode });
    }
    for (const id of this.people.keys()) if (!keep.has(id)) this.people.delete(id);
    this.list = [...this.people.values()];
    return true;
  }
  update(reducedMotion = false) {
    const now = this.now();
    for (const p of this.list) {
      const t = Math.min(1, Math.max(0, (now - p.at) / this.window));
      const x = p.fromX + (p.toX - p.fromX) * t, y = p.fromY + (p.toY - p.fromY) * t;
      const distance = Math.hypot(p.x - x, p.y - y);
      p.walkDistance += distance; p.x = x; p.y = y;
      const walking = p.mode === 0 && ["walk", "run"].includes(p.pose);
      if (walking) advanceGait(p, distance, p.pose);
      // A render on the exact snapshot boundary has zero delta. Hold its leg
      // rather than flashing idle between packets; stop when packets go stale.
      const moving = walking && !reducedMotion && (distance > 0.001 ||
        (now - p.at < this.window * 2 && Math.hypot(p.toX - p.fromX, p.toY - p.fromY) > 0.001));
      const elapsed = (now - p.poseAt) / 1000, phase = reducedMotion ? 0 : Math.floor(elapsed * 5) % 4;
      const base = `person-${p.variant}`, heading = `${base}-${p.direction}`;
      p.vesselArt = null;
      if (p.mode === 1) {
        p.vessel.rowing = p.pose === "row"; p.vessel.stroke = elapsed;
        p.vesselArt = vesselLayers(p, p.vessel.phase(reducedMotion));
        p.sprite = p.vesselArt.rower;
      } else if (["pee", "poop"].includes(p.pose)) p.sprite = reliefFrame(p, p.pose, phase);
      else if (p.pose === "discover") p.sprite = `${base}-${p.pose}-${phase}`;
      else if (p.pose === "run") p.sprite = runFrame(p, moving) || characterFrame(p.variant, p, false);
      else if (["push", "work", "carried"].includes(p.pose))
        p.sprite = `${heading}-${p.pose}-${p.pose === "carried" ? phase % 2 : phase}`;
      else p.sprite = characterFrame(p.variant, p, moving);
    }
    return this.list;
  }
}
module.exports = { ForestPeople };
