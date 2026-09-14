"use strict";
/** Independent native sprite packages. Scene loading is staged; active art is never evicted. */
class SpriteLibrary {
  constructor() {
    this.packs = new Map();
    this.pending = new Map();
    this.owners = new Map();
    this.pinned = new Set();
    this.warm = new Set();
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
    for (const [id, pack] of Object.entries(manifest.packs))
      for (const sprite of pack.sprites) {
        if (this.owners.has(sprite))
          throw new Error("Duplicate sprite: " + sprite);
        this.owners.set(sprite, id);
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
    const results = await Promise.allSettled(
      [...ids].map((id) => this.load(id)),
    );
    const failed = results.find((result) => result.status === "rejected");
    if (failed) {
      this.activate(this.pinned);
      throw failed.reason;
    }
    return ids;
  }
  async load(id) {
    if (this.packs.has(id)) return;
    if (this.pending.has(id)) return this.pending.get(id);
    const definition = this.manifest.packs[id];
    if (!definition) throw new Error("Unknown sprite package: " + id);
    const task = (async () => {
      const [metadata, image] = await Promise.all([
        this.json(new URL(definition.metadata, this.base)),
        this.loadImage(new URL(definition.image, this.base)),
      ]);
      if (
        metadata.width !== image.naturalWidth ||
        metadata.height !== image.naturalHeight
      )
        throw new Error("Sprite dimensions mismatch: " + id);
      for (const name of definition.sprites) {
        const f = metadata.frames[name];
        if (
          !f ||
          f.x < 0 ||
          f.y < 0 ||
          f.w < 1 ||
          f.h < 1 ||
          !Number.isInteger(f.pixelRatio) || f.pixelRatio < 1 || f.pixelRatio > 3 ||
          f.x + f.w * f.pixelRatio > metadata.width ||
          f.y + f.h * f.pixelRatio > metadata.height
        )
          throw new Error("Invalid sprite frame: " + name);
      }
      this.packs.set(id, { image, frames: metadata.frames });
    })();
    this.pending.set(id, task);
    try {
      await task;
    } finally {
      this.pending.delete(id);
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
    this.pinned = new Set(ids);
    this.warm.clear();
    for (const id of ids) {
      const pack = this.packs.get(id);
      this.packs.delete(id);
      this.packs.set(id, pack);
    }
    this.prune();
  }
  retainWarm(ids) {
    this.warm = new Set(ids);
    this.prune();
  }
  prune() {
    const keep = new Set([...this.pinned, ...this.warm]);
    for (const id of this.packs.keys()) {
      if (this.packs.size <= Math.max(12, keep.size + 2)) break;
      if (!keep.has(id)) this.packs.delete(id);
    }
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
  icon(name) {
    const f = this.frame(name);
    if (!f) return null;
    const [ix,iy,iw,ih] = f.ink;
    const canvas = document.createElement("canvas");
    canvas.width = iw * f.pixelRatio;
    canvas.height = ih * f.pixelRatio;
    canvas.style.width = iw + "px";
    canvas.style.height = ih + "px";
    canvas.setAttribute("aria-hidden", "true");
    this.drawRegion(canvas.getContext("2d"), name, ix,iy,iw,ih,0,0,canvas.width,canvas.height);
    return canvas;
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
    };
  }
}
module.exports = { SpriteLibrary };
