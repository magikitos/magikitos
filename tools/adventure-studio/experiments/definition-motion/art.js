"use strict";
/** Density is texture metadata only. Logical frames, anchors and picking never scale. */
class StudyArt {
  constructor(signal) {
    this.signal = signal;
    this.images = new Map();
    this.pending = new Map();
    this.libraries = new Map();
    this.requested = new Set();
    this.drawCalls = 0;
    this.disposed = false;
  }
  async init() {
    const r = await fetch("/experiments/definition-motion/art/manifest.json", {
      signal: this.signal,
    });
    if (!r.ok) throw Error("No se pudo leer el catálogo de la prueba.");
    this.manifest = await r.json();
  }
  variant(name, profile) {
    return this.manifest.assets[name].variants[profile];
  }
  async prepare(profile, names) {
    await Promise.all(
      [...new Set(names)].map((name) => this.load(this.variant(name, profile))),
    );
  }
  async load(v) {
    if (this.images.has(v.image)) return;
    if (this.pending.has(v.image)) return this.pending.get(v.image);
    const task = (async () => {
      const r = await fetch("/experiments/definition-motion/art/" + v.image, {
        signal: this.signal,
      });
      if (!r.ok) throw Error("No se pudo cargar " + v.image);
      const bitmap = await createImageBitmap(await r.blob());
      if (this.disposed) {
        bitmap.close();
        return;
      }
      this.images.set(v.image, bitmap);
      this.requested.add(v.image);
    })();
    this.pending.set(v.image, task);
    try {
      await task;
    } finally {
      this.pending.delete(v.image);
    }
  }
  library(profile) {
    if (!this.libraries.has(profile))
      this.libraries.set(profile, {
        frame: (name) => this.manifest.assets[name]?.logical,
        draw: (c, name, x, y, width, height) =>
          this.draw(c, profile, name, x, y, width, height),
      });
    return this.libraries.get(profile);
  }
  draw(c, profile, name, x, y, width, height) {
    const a = this.manifest.assets[name],
      v = a?.variants[profile],
      image = v && this.images.get(v.image);
    if (!image) return false;
    c.imageSmoothingEnabled = false;
    this.drawCalls++;
    c.drawImage(image, x, y, width ?? a.logical.w, height ?? a.logical.h);
    return true;
  }
  // Bounded experimental cache: current comparison pair plus exact baseline.
  retain(profiles, names) {
    const keep = new Set();
    for (const p of profiles)
      for (const name of names) keep.add(this.variant(name, p).image);
    for (const [key, bitmap] of this.images)
      if (!keep.has(key)) {
        bitmap.close();
        this.images.delete(key);
      }
  }
  stats() {
    const all = new Map();
    for (const a of Object.values(this.manifest.assets))
      for (const v of Object.values(a.variants)) all.set(v.image, v);
    return {
      pngBytes: [...this.requested].reduce((n, k) => n + all.get(k).bytes, 0),
      rgbaBytes: [...this.images.keys()].reduce(
        (n, k) => n + all.get(k).rgbaBytes,
        0,
      ),
      loaded: this.images.size,
      requested: [...this.requested],
    };
  }
  dispose() {
    this.disposed = true;
    for (const image of this.images.values()) image.close();
    this.images.clear();
  }
}
module.exports = { StudyArt };
