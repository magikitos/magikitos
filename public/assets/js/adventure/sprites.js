"use strict";
const { SpriteResidency } = require("./sprite-residency");
/** Independent native sprite packages. Prepared sets are leases: activate or release them. */
/** Reescala el tamaño CSS de un icono para que quepa en `box` sin pasar de `maxScale` aumentos. */
function fitIcon(canvas, box, maxScale = 3) {
  const w = parseFloat(canvas.style.width) || canvas.width,
    h = parseFloat(canvas.style.height) || canvas.height,
    scale = Math.min(maxScale, box / Math.max(1, w, h));
  canvas.style.width = Math.round(w * scale) + "px";
  canvas.style.height = Math.round(h * scale) + "px";
  return canvas;
}
class SpriteLibrary {
  constructor({ budget } = {}) {
    this.packs = new Map();
    this.pending = new Map();
    this.owners = new Map();
    this.pinned = new Set();
    this.warm = new Set();
    this.residency = new SpriteResidency(budget);
  }
  async initialize(url) {
    this.base = new URL(url, location.href);
    const manifest = await this.json(this.base);
    if (
      !manifest?.packs ||
      Array.isArray(manifest.packs) ||
      typeof manifest.packs !== "object"
    )
      throw new Error("Invalid sprite manifest");
    this.manifest = manifest;
    for (const [id, pack] of Object.entries(manifest.packs)) {
      if (!Number.isSafeInteger(pack.width) || pack.width < 1 ||
          !Number.isSafeInteger(pack.height) || pack.height < 1 ||
          !Number.isSafeInteger(pack.width * pack.height * 4) ||
          !Number.isSafeInteger(pack.bytes) || pack.bytes < 1 || !Array.isArray(pack.sprites))
        throw new Error("Invalid sprite package dimensions: " + id);
      for (const sprite of pack.sprites) {
        if (this.owners.has(sprite))
          throw new Error("Duplicate sprite: " + sprite);
        this.owners.set(sprite, id);
      }
    }
  }
  async json(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok)
      throw new Error("Sprite data unavailable: " + response.status);
    return response.json();
  }
  packageFor(name) {
    const id = this.owners.get(name);
    if (!id) throw new Error("Unregistered sprite: " + name);
    return id;
  }
  async prepare(names, extraPacks = []) {
    const ids = new Set(
      [...names].filter(Boolean).map((name) => this.packageFor(name)),
    );
    for (const id of extraPacks) ids.add(id);
    const release = this.residency.hold(ids);
    Object.defineProperty(ids, "release", { value: release });
    const results = await Promise.allSettled(
      [...ids].map((id) => this.load(id)),
    );
    const failed = results.find((result) => result.status === "rejected");
    if (failed) {
      release();
      this.prune();
      throw failed.reason;
    }
    return ids;
  }
  async load(id) {
    if (this.packs.has(id)) {
      const pack = this.packs.get(id);
      this.packs.delete(id);
      this.packs.set(id, pack);
      return;
    }
    if (this.pending.has(id)) return this.pending.get(id);
    const definition = this.manifest.packs[id];
    if (!definition) throw new Error("Unknown sprite package: " + id);
    const task = (async () => {
      const bytes = definition.width * definition.height * 4;
      this.residency.reserve(id, bytes, this);
      // Wait for both sides even on failure: a late-decoding image must not outlive its reservation.
      const results = await Promise.allSettled([
        this.json(new URL(definition.metadata, this.base)),
        this.loadImage(new URL(definition.image, this.base)),
      ]);
      const failure = results.find((result) => result.status === "rejected");
      if (failure) {
        if (results[1].status === "fulfilled") results[1].value.src = "";
        throw failure.reason;
      }
      const [metadata, image] = results.map((result) => result.value);
      try {
        if (
          metadata.width !== image.naturalWidth || metadata.width !== definition.width ||
          metadata.height !== image.naturalHeight || metadata.height !== definition.height
        )
          throw new Error("Sprite dimensions mismatch: " + id);
        for (const name of definition.sprites) {
          const f = metadata.frames[name];
          if (
            !f ||
            ![f.x, f.y, f.w, f.h, f.pixelRatio].every(Number.isInteger) ||
            f.x < 0 || f.y < 0 || f.w < 1 || f.h < 1 ||
            f.pixelRatio < 1 || f.pixelRatio > 3 ||
            f.x + f.w * f.pixelRatio > metadata.width ||
            f.y + f.h * f.pixelRatio > metadata.height
          )
            throw new Error("Invalid sprite frame: " + name);
        }
        this.packs.set(id, { image, frames: metadata.frames, bytes });
        this.residency.reservations.delete(id);
        this.residency.bytes += bytes;
      } catch (error) {
        image.src = "";
        throw error;
      }
    })();
    this.pending.set(id, task);
    try {
      await task;
    } finally {
      this.pending.delete(id);
      this.residency.reservations.delete(id);
    }
  }
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(
        () => finish(new Error("Sprite image timed out")),
        20000,
      );
      const finish = (error) => {
        clearTimeout(timer);
        image.onload = image.onerror = null;
        if (error) {
          image.src = "";
          reject(error);
        } else resolve(image);
      };
      image.onload = () => finish();
      image.onerror = () => finish(new Error("Sprite image unavailable"));
      image.src = url.href;
    });
  }
  activate(ids) {
    for (const id of ids)
      if (!this.packs.has(id)) throw new Error("Sprite package was not prepared: " + id);
    this.pinned = new Set(ids);
    this.warm.clear();
    for (const id of ids) {
      const pack = this.packs.get(id);
      this.packs.delete(id);
      this.packs.set(id, pack);
    }
    ids.release?.();
    this.prune();
  }
  retainWarm(ids) {
    this.warm = new Set(ids);
    this.prune();
  }
  prune() {
    this.residency.evict(this.residency.bytes + this.residency.reservedBytes - this.residency.limit, this);
  }
  frame(name) {
    return this.packs.get(this.owners.get(name))?.frames[name];
  }
  draw(context, name, x, y, width, height) {
    const f = this.frame(name);
    if (!f) return false;
    return this.drawRegion(context,name,0,0,f.w,f.h,x,y,width??f.w,height??f.h);
  }
  drawRegion(context, name, sx, sy, sw, sh, x, y, width, height) {
    const pack = this.packs.get(this.owners.get(name)),
      f = pack?.frames[name];
    if (!f) return false;
    context.imageSmoothingEnabled = false;
    context.drawImage(
      pack.image,
      f.x + sx * f.pixelRatio,
      f.y + sy * f.pixelRatio,
      sw * f.pixelRatio,
      sh * f.pixelRatio,
      x,
      y,
      width,
      height,
    );
    return true;
  }
  icon(name, { fullCanvas = false } = {}) {
    const f = this.frame(name);
    if (!f) return null;
    const [ix,iy,iw,ih] = fullCanvas ? [0, 0, f.w, f.h] : f.ink;
    const canvas = document.createElement("canvas");
    canvas.width = iw * f.pixelRatio;
    canvas.height = ih * f.pixelRatio;
    canvas.style.width = iw + "px";
    canvas.style.height = ih + "px";
    canvas.setAttribute("aria-hidden", "true");
    this.drawRegion(canvas.getContext("2d"), name, ix,iy,iw,ih,0,0,canvas.width,canvas.height);
    return canvas;
  }
  /**
   * Un icono que CABE en una caja de `box` píxeles CSS sin agrandarse más de `maxScale`: en una
   * rejilla de baldosas iguales, la seta no puede ser una mota y la botella no puede comerse la
   * baldosa, pero un sprite de doce píxeles estirado a sesenta tampoco es un dibujo, es bloques.
   */
  iconIn(name, box, maxScale = 3) {
    const canvas = this.icon(name);
    return canvas ? fitIcon(canvas, box, maxScale) : null;
  }
  portrait(context, name, width, height) {
    const f = this.frame(name);
    if (!f) return false;
    const [ix,iy,iw,ih] = f.ink, scale = Math.min(width/iw,height/ih);
    return this.drawRegion(context,name,ix,iy,iw,ih,(width-iw*scale)/2,(height-ih*scale)/2,iw*scale,ih*scale);
  }
  inspect() {
    return {
      loaded: [...this.packs.keys()],
      active: [...this.pinned],
      warm: [...this.warm],
      bytes: this.residency.bytes,
      reservedBytes: this.residency.reservedBytes,
      budget: this.residency.limit,
    };
  }
}
module.exports = { SpriteLibrary, fitIcon };
