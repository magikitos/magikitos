"use strict";
const protocol = require("../../../../docs/forest-protocol.json");

/** Revision notices are hints; authenticated HTTP owns the snapshot. One in-flight request,
 * coalesced latest revisions and retries with a capped backoff, with no per-frame fetches or idle polling. */
class CommunitySync {
  constructor(community, now = () => performance.now()) {
    this.community = community; this.now = now;
    this.reset();
  }
  reset(identityChanged = false) {
    this.epoch = (this.epoch || 0) + 1;
    this.abort?.abort(); this.abort = null;
    this.notices = new Map(); this.pending = null; this.loading = false;
    this.next = 0; this.failures = 0;
    // A zone revision describes the world, not the viewer-specific `mine` fields.
    // A different account must fetch even when the world revision has not changed.
    if (identityChanged) {
      this.community.snapshots.clear();
      // Reads also work without the daemon; do not wait for a socket notice to replace
      // viewer-specific ownership after sign-in/out in the currently visible scene.
      if (this.community.zone) this.notices.set(this.community.zone, 0);
    }
  }
  notice(packet) {
    const c = this.community;
    if (!packet || typeof packet.zone !== "string" || typeof packet.scene !== "string" ||
        !Object.hasOwn(c.catalog.zones, packet.zone) || c.catalog.zones[packet.zone].scene !== packet.scene ||
        !Number.isSafeInteger(packet.revision) || packet.revision < 0) return false;
    this.notices.set(packet.zone, Math.max(packet.revision, this.notices.get(packet.zone) ?? -1));
    return true;
  }
  update() {
    const c = this.community, g = c.game;
    if (g.transitioning || c.busy) return;
    if (this.pending) {
      const { snapshot, identity } = this.pending;
      this.pending = null;
      if (identity === g.session.get()) c.accept(snapshot);
    }
    if (c.snapshot && (c.applied?.world !== g.world || c.applied?.snapshot !== c.snapshot)) {
      c.refreshWorld();
      if (c.editing) { c.revalidate(); c.paint(); }
    }
    const zone = c.zone, wanted = this.notices.get(zone);
    if (wanted === undefined || (c.snapshot?.revision ?? -1) >= wanted) {
      if (zone) this.notices.delete(zone);
      return;
    }
    if (this.loading || this.now() < this.next || !g.session.get()) return;
    const epoch = this.epoch, identity = g.session.get();
    this.loading = true;
    this.next = this.now() + protocol.limits.zoneSnapshotMs;
    const abort = this.abort = new AbortController();
    g.api.request("community", { zone }, { auth: true, timeout: 3000, signal: abort.signal })
      .then(snapshot => {
        if (epoch !== this.epoch || identity !== g.session.get()) return;
        if (snapshot?.zone !== zone) throw Error("invalid_community_zone");
        c.validate(snapshot);
        this.pending = { snapshot, identity };
        this.failures = 0;
      }).catch(() => {
        if (epoch !== this.epoch) return;
        this.next = this.now() + Math.min(15000, 1000 * 2 ** Math.min(this.failures++, 4));
      }).finally(() => {
        if (epoch === this.epoch) { this.loading = false; this.abort = null; }
      });
  }
}
module.exports = { CommunitySync };
