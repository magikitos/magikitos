"use strict";
const { StudyArt } = require("../definition-motion/art");
const { groundScene } = require("../definition-motion/scene");
const { World } = require("../../../../public/assets/js/adventure/model");
const { Terrain } = require("../../../../public/assets/js/adventure/terrain");
const BASE = "/experiments/duende-cast/art/";
const ENVIRONMENT = [
  "human-house",
  "giant-fern",
  "flowers-daisy-gold",
  "giant-bolete",
  "person-0-down",
];
/** Static comparison. No animation loop, game controller, persistence or game-side state. */
class CastPreview {
  constructor(canvas, manifest, signal) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.manifest = manifest;
    this.signal = signal;
    this.art = new StudyArt(signal);
    this.images = new Map();
    this.world = new World(groundScene());
    this.terrain = new Terrain();
    this.design = "ascua";
    this.zoom = 3;
    this.light = "day";
    this.active = false;
    this.drawCount = 0;
    this.disposed = false;
    this.resize = new ResizeObserver(() => {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width !== this.width || rect.height !== this.height) this.draw();
    });
    this.resize.observe(canvas.parentElement);
  }
  async init() {
    await this.art.init();
    await this.art.prepare("2-area", ENVIRONMENT);
    await Promise.all(
      Object.entries(this.manifest.designs).flatMap(([id, design]) =>
        Object.entries(design.roles).map(async ([role, asset]) => {
          const v = asset.variants.sprite;
          const response = await fetch(BASE + v.image, { signal: this.signal });
          if (!response.ok) throw new Error("No se pudo cargar " + v.image);
          const bitmap = await createImageBitmap(await response.blob());
          if (this.disposed) bitmap.close();
          else this.images.set(id + "/" + role, bitmap);
        }),
      ),
    );
    if (this.disposed) return;
    this.ready = true;
    this.draw();
  }
  draw() {
    if (!this.ready || !this.active || this.disposed) return;
    this.canvas.parentElement.style.setProperty("--zoom", this.zoom);
    let rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2),
      c = this.ctx,
      z = this.zoom;
    const narrow = rect.width < z * 220;
    this.canvas.parentElement.classList.toggle("two-rows", narrow);
    rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#77885b";
    c.fillRect(0, 0, rect.width, rect.height);
    c.save();
    c.translate(rect.width / 2, rect.height / 2 + 14);
    c.scale(z, z);
    c.translate(-360, -430);
    c.imageSmoothingEnabled = false;
    const viewW = rect.width / z,
      viewH = rect.height / z;
    for (
      let cy = Math.max(0, Math.floor((430 - viewH / 2 - 30) / 256));
      cy <= Math.min(2, Math.floor((430 + viewH / 2) / 256));
      cy++
    )
      for (
        let cx = Math.max(0, Math.floor((360 - viewW / 2) / 256));
        cx <= Math.min(3, Math.floor((360 + viewW / 2) / 256));
        cx++
      )
        c.drawImage(this.terrain.chunk(this.world, cx, cy), cx * 256, cy * 256);
    const props = [
      ["human-house", 458, 400],
      ["giant-fern", 287, 412],
      ["flowers-daisy-gold", 443, 502],
      ["giant-bolete", 278, 498],
    ];
    const cast = narrow
      ? [
          ["Actual", null, 338, 414],
          ["Propuesta", "hero", 382, 414],
          ["Vecina", "neighbor-a", 339, 478],
          ["Vecino", "neighbor-b", 381, 478],
        ]
      : [
          ["Actual", null, 285, 448],
          ["Propuesta", "hero", 342, 448],
          ["Vecina", "neighbor-a", 401, 448],
          ["Vecino", "neighbor-b", 454, 450],
        ];
    const nodes = props
      .map(([name, x, y]) => ({ name, x, y }))
      .concat(cast.map(([label, role, x, y]) => ({ label, role, x, y })))
      .sort((a, b) => a.y - b.y);
    this.actorBounds = [];
    for (const n of nodes) {
      if (n.name) {
        const f = this.art.manifest.assets[n.name].logical;
        this.art.draw(
          c,
          "2-area",
          n.name,
          n.x - f.anchor[0],
          n.y - f.anchor[1],
        );
        continue;
      }
      c.fillStyle = "rgba(28,42,20,.2)";
      c.beginPath();
      c.ellipse(n.x, n.y - 1, 8, 3, 0, 0, Math.PI * 2);
      c.fill();
      c.save();
      const actor = n.role
        ? {
            w: this.images.get(this.design + "/" + n.role).width / 2,
            h: 40,
            anchor: [this.images.get(this.design + "/" + n.role).width / 4, 40],
          }
        : this.art.manifest.assets["person-0-down"].logical;
      this.actorBounds.push({
        label: n.label,
        left: rect.width / 2 + (n.x - actor.anchor[0] - 360) * z,
        top: rect.height / 2 + 14 + (n.y - actor.anchor[1] - 430) * z,
        width: actor.w * z,
        height: actor.h * z,
      });
      if (this.silhouette) c.filter = "brightness(0)";
      if (n.role) {
        const im = this.images.get(this.design + "/" + n.role);
        c.drawImage(im, n.x - im.width / 4, n.y - 40, im.width / 2, 40);
      } else {
        const f = this.art.manifest.assets["person-0-down"].logical;
        this.art.draw(
          c,
          "2-area",
          "person-0-down",
          n.x - f.anchor[0],
          n.y - f.anchor[1],
        );
      }
      c.restore();
    }
    c.restore();
    if (this.light === "dusk") {
      c.fillStyle = "rgba(18,29,67,.4)";
      c.fillRect(0, 0, rect.width, rect.height);
    }
    c.font = "600 11px system-ui";
    c.textAlign = "center";
    for (const [label, role, x, y] of cast) {
      const px = rect.width / 2 + (x - 360) * z,
        py = rect.height / 2 + 14 + (y - 430) * z + 17;
      const title =
        role === "hero"
          ? this.design.charAt(0).toUpperCase() + this.design.slice(1)
          : label;
      const w = c.measureText(title).width + 14;
      c.fillStyle = "rgba(18,31,23,.85)";
      c.fillRect(px - w / 2, py - 11, w, 17);
      c.fillStyle = role === "hero" ? "#f3d995" : "#e4e9d5";
      c.fillText(title, px, py + 1);
    }
    this.drawCount++;
  }
  inspect() {
    const r = this.canvas.getBoundingClientRect();
    return {
      ready: !!this.ready,
      active: this.active,
      drawCount: this.drawCount,
      loaded: this.images.size,
      environment: this.art.manifest ? this.art.stats() : null,
      raf: 0,
      width: r.width,
      height: r.height,
      actorBounds: this.actorBounds,
    };
  }
  dispose() {
    this.disposed = true;
    this.active = false;
    this.resize.disconnect();
    this.art.dispose();
    for (const im of this.images.values()) im.close();
    this.images.clear();
    this.terrain.chunks.clear();
    this.canvas.width = this.canvas.height = 1;
  }
}
module.exports = { CastPreview };
