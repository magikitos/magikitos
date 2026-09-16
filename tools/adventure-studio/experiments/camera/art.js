import * as T from "three";
/** Reuse only published native packs. No originals, alpha scans or website requests. */
export class Art {
  constructor(signal) {
    this.signal = signal;
    this.packs = new Map();
    this.frames = new Map();
    this.bytes = 0;
    this.pending = new Map();
    this.prefix = "/experiments/camera/art/";
  }
  async json(url) {
    const r = await fetch(url, { signal: this.signal });
    if (!r.ok) throw Error("No se pudo leer el arte local");
    return r.json();
  }
  async initialize() {
    this.manifest = await this.json(this.prefix + "manifest.json");
  }
  async load(id) {
    if (this.packs.has(id)) return;
    if (this.pending.has(id)) return this.pending.get(id);
    const task = (async () => {
      const p = this.manifest.packs[id];
      const [meta, response] = await Promise.all([
        this.json(this.prefix + p.metadata),
        fetch(this.prefix + p.image, { signal: this.signal }),
      ]);
      if (!response.ok) throw Error("No se pudo cargar " + id);
      const bytes = await response.arrayBuffer();
      this.signal.throwIfAborted();
      const blob = new Blob([bytes], { type: "image/png" }),
        url = URL.createObjectURL(blob);
      const image = new Image();
      try {
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = url;
        });
        this.signal.throwIfAborted();
      } finally {
        URL.revokeObjectURL(url);
      }
      const texture = new T.Texture(image);
      texture.needsUpdate = true;
      texture.colorSpace = T.SRGBColorSpace;
      texture.magFilter = texture.minFilter = T.NearestFilter;
      texture.generateMipmaps = false;
      const material = new T.MeshBasicMaterial({
        map: texture,
        alphaTest: 0.5,
        side: T.DoubleSide,
        toneMapped: false,
      });
      this.packs.set(id, { texture, material });
      this.bytes += bytes.byteLength;
      for (const [name, frame] of Object.entries(meta.frames))
        this.frames.set(name, {
          ...frame,
          width: meta.width,
          height: meta.height,
          material,
        });
    })();
    this.pending.set(id, task);
    try {
      await task;
    } finally {
      this.pending.delete(id);
    }
  }
  async prepare(names) {
    const ids = new Set();
    for (const name of names) {
      const pair = Object.entries(this.manifest.packs).find(([, p]) =>
        p.sprites.includes(name),
      );
      if (!pair) throw Error("Sprite no disponible: " + name);
      ids.add(pair[0]);
    }
    await Promise.all([...ids].map((id) => this.load(id)));
  }
  create(name, height) {
    const mesh = new T.Mesh(
      new T.PlaneGeometry(1, 1),
      this.frames.get(name).material,
    );
    mesh.userData.height = height;
    this.pose(mesh, name);
    return mesh;
  }
  pose(mesh, name) {
    if (mesh.userData.frame === name) return;
    const f = this.frames.get(name);
    if (!f) return;
    mesh.userData.frame = name;
    mesh.material = f.material;
    const u = f.x / f.width,
      v = 1 - f.y / f.height,
      du = f.w / f.width,
      dv = f.h / f.height;
    const uv = mesh.geometry.attributes.uv;
    uv.setXY(0, u, v);
    uv.setXY(1, u + du, v);
    uv.setXY(2, u, v - dv);
    uv.setXY(3, u + du, v - dv);
    uv.needsUpdate = true;
    const scale = mesh.userData.height / (f.nativeSize?.[1] || f.h);
    const left = -f.anchor[0] * scale,
      right = (f.w - f.anchor[0]) * scale,
      bottom = (f.anchor[1] - f.h) * scale,
      top = f.anchor[1] * scale;
    const p = mesh.geometry.attributes.position;
    p.setXYZ(0, left, top, 0);
    p.setXYZ(1, right, top, 0);
    p.setXYZ(2, left, bottom, 0);
    p.setXYZ(3, right, bottom, 0);
    p.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }
  dispose() {
    for (const p of this.packs.values()) {
      p.texture.dispose();
      p.material.dispose();
    }
    this.packs.clear();
    this.frames.clear();
  }
}
