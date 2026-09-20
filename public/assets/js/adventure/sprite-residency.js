"use strict";
// Decoded RGBA, not PNG transfer size. Terrain canvases have their own separate budget.
const SPRITE_BUDGET = 96 * 1024 * 1024;
class SpriteBudgetError extends Error {}

/** Admission before decoding, bounded in-flight reservations, and proximity-aware eviction. */
class SpriteResidency {
  constructor(limit = SPRITE_BUDGET) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid sprite budget");
    this.limit = limit;
    this.bytes = 0;
    this.reservations = new Map();
    this.holds = new Map();
    this.focus = new Map();
  }
  get reservedBytes() {
    let bytes = 0;
    for (const value of this.reservations.values()) bytes += value;
    return bytes;
  }
  hold(ids) {
    const held = new Set(ids);
    for (const id of held) this.holds.set(id, (this.holds.get(id) || 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      for (const id of held) {
        const count = this.holds.get(id) - 1;
        if (count) this.holds.set(id, count);
        else this.holds.delete(id);
      }
    };
  }
  reserve(id, bytes, library) {
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > this.limit)
      throw new SpriteBudgetError("Sprite exceeds decoded budget: " + id);
    const missing = this.bytes + this.reservedBytes + bytes - this.limit;
    if (missing > 0) this.evict(missing, library);
    if (this.bytes + this.reservedBytes + bytes > this.limit)
      throw new SpriteBudgetError("Sprite working set exceeds decoded budget: " + id);
    this.reservations.set(id, bytes);
  }
  evict(bytes, library) {
    const rank = (id) => this.focus.has(id) ? 2 : library.warm.has(id) ? 1 : 0;
    const candidates = [...library.packs.keys()]
      .filter((id) => !library.pinned.has(id) && !this.holds.has(id))
      .sort((a, b) => rank(a) - rank(b) ||
        (rank(a) === 2 ? this.focus.get(b) - this.focus.get(a) : 0));
    for (const id of candidates) {
      if (bytes <= 0) break;
      const pack = library.packs.get(id);
      library.packs.delete(id);
      bytes -= pack.bytes;
      this.bytes -= pack.bytes;
      // Release the decoded bitmap even if the browser keeps the HTTP response cached.
      if (typeof pack.image.close === "function") pack.image.close();
      else pack.image.src = "";
    }
  }
}
module.exports = { SpriteResidency, SpriteBudgetError };
