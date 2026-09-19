"use strict";
const { hash } = require("./geometry");

/** Stable author preference, collision-free local casting. Each zone gets distinct silhouettes first. */
class ZoneCasting {
  constructor(profiles, reserved = []) {
    this.profiles = profiles.filter((p) => !p.playableOnly);
    this.reserved = new Set(reserved);
    this.reservedFamilies = new Set(
      profiles.filter((p) => this.reserved.has(p.id)).map((p) => p.family),
    );
    this.zones = new Map();
  }
  choose(identity, zone) {
    const used = this.zones.get(zone) || {
      ids: new Set(),
      families: new Set(this.reservedFamilies),
    };
    this.zones.set(zone, used);
    const offset = hash(identity) % this.profiles.length;
    const ordered = this.profiles
      .slice(offset)
      .concat(this.profiles.slice(0, offset));
    const available = ordered.filter(
      (p) => !this.reserved.has(p.id) && !used.ids.has(p.id),
    );
    const profile = available.find((p) => !used.families.has(p.family));
    if (!profile) throw new Error("NPC repertoire exhausted in zone: " + zone);
    used.ids.add(profile.id);
    used.families.add(profile.family);
    return profile.id;
  }
}
module.exports = { ZoneCasting };
