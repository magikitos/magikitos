"use strict";
const { StudyArt } = require("./art");
const { drawMotion, enabled } = require("./motion");
const { ENTITIES, STOPS, DETAIL, groundScene } = require("./scene");
const { Controls } = require("../forest-scale/controls");
const { World } = require("../../../../public/assets/js/adventure/model");
const { Terrain } = require("../../../../public/assets/js/adventure/terrain");
const {
  clips,
} = require("../../../../public/assets/js/adventure/ambient-actors");
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
class DefinitionStudy {
  constructor(canvas, report) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.report = report;
    this.abort = new AbortController();
    this.art = new StudyArt(this.abort.signal);
    Object.assign(this, {
      profile: "2-area",
      shownProfile: "2-area",
      view: "detail",
      subject: "picnic-knife",
      mode: "selective",
      compare: true,
      wipe: 50,
      playing: !matchMedia("(prefers-reduced-motion: reduce)").matches,
      fps: 24,
      time: 0,
      zoom: 4,
      sceneZoom: 2,
      center: { x: 362, y: 335 },
      ready: false,
      disposed: false,
      dirty: true,
      renderCount: 0,
      serial: 0,
      cpu: [],
      intervals: [],
      lastDraw: 0,
      lastReal: 0,
      lastReport: 0,
    });
    this.controls = new Controls(canvas, {
      tap: () => {},
      pan: (x, y) => this.pan(x, y),
      zoom: (f) => this.setZoom(this.zoom * f),
      cancelPath: () => this.invalidate(),
      roll: () => this.play(!this.playing),
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
      "change",
      (e) => {
        if (e.matches) this.play(false);
      },
      { signal: this.abort.signal },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        this.controls.clear();
        this.lastReal = 0;
        if (document.hidden) {
          cancelAnimationFrame(this.raf);
          this.raf = null;
        } else this.invalidate();
      },
      { signal: this.abort.signal },
    );
  }
  async init() {
    await this.art.init();
    this.world = new World(groundScene());
    this.terrain = new Terrain();
    await this.prepare();
    if (!this.disposed) {
      this.ready = true;
      this.resize();
      this.report(this.inspect());
    }
  }
  names() {
    const names =
      this.view === "scene"
        ? ENTITIES.map((e) => e.sprite)
        : [this.subject, "person-0-down"];
    for (const n of [...names])
      if (clips[n]) names.push(...clips[n].steps.map(([f]) => f));
    return [...new Set(names)];
  }
  async prepare() {
    const serial = ++this.serial,
      profile = this.profile,
      names = this.names();
    this.pending = true;
    this.report({ pending: true });
    try {
      await Promise.all([
        this.art.prepare("1-nearest", names),
        this.art.prepare(profile, names),
      ]);
      if (this.disposed) return;
      if (serial !== this.serial) {
        if (!this.pending && this.loadedNames)
          this.art.retain(["1-nearest", this.shownProfile], this.loadedNames);
        return;
      }
      this.shownProfile = profile;
      this.loadedNames = names;
      this.pending = false;
      this.error = null;
      this.resetMetrics();
      this.art.retain(["1-nearest", profile], names);
      this.invalidate();
      this.report(this.inspect());
    } catch (e) {
      if (!this.disposed && serial === this.serial && e.name !== "AbortError") {
        this.pending = false;
        this.error = e.message;
        this.report(this.inspect());
      }
    }
  }
  async setProfile(id) {
    if (!this.art.manifest.profiles.some((p) => p.id === id)) return;
    this.profile = id;
    await this.prepare();
  }
  async setView(view) {
    if (!["detail", "scene"].includes(view) || view === this.view) return;
    if (this.view === "scene") this.sceneZoom = this.zoom;
    this.view = view;
    this.zoom = view === "scene" ? this.sceneZoom : 4;
    this.prepare();
    this.resize();
  }
  async setSubject(name) {
    if (!DETAIL.includes(name)) return;
    this.subject = name;
    await this.prepare();
    this.invalidate();
  }
  setMotion(mode) {
    if (!["still", "selective", "all"].includes(mode)) return;
    this.mode = mode;
    this.lastReal = 0;
    this.resetMetrics();
    this.invalidate();
  }
  play(playing) {
    this.playing = playing;
    this.lastReal = 0;
    this.resetMetrics();
    this.invalidate();
  }
  scrub(time) {
    this.time = clamp(
      Number(time),
      0,
      Math.max(30, Math.ceil(this.time / 30) * 30),
    );
    this.play(false);
  }
  resetMetrics() {
    this.cpu = [];
    this.intervals = [];
    this.lastDraw = 0;
    this.nextDraw = 0;
  }
  setZoom(zoom) {
    this.zoom = clamp(
      zoom,
      this.view === "scene" ? 0.7 : 1,
      this.view === "scene" ? 4 : 8,
    );
    this.boundCamera();
    this.invalidate();
  }
  reset() {
    if (this.view === "scene") {
      this.center = { x: 362, y: 335 };
      this.zoom = 2;
    } else this.zoom = 4;
    this.resize();
  }
  stop(id) {
    if (!STOPS[id]) return;
    const [x, y] = STOPS[id].center;
    this.center = { x, y };
    if (this.view !== "scene") {
      this.sceneZoom = 2;
      this.setView("scene");
    } else {
      this.zoom = 2;
      this.resize();
    }
  }
  pan(x, y) {
    if (this.view !== "scene") return;
    this.center.x -= x / this.zoom;
    this.center.y -= y / this.zoom;
    this.boundCamera();
    this.invalidate();
  }
  boundCamera() {
    if (this.view !== "scene" || !this.width) return;
    this.zoom = Math.max(this.zoom, this.width / 1024, this.height / 768);
    this.center.x = clamp(
      this.center.x,
      this.width / this.zoom / 2,
      1024 - this.width / this.zoom / 2,
    );
    this.center.y = clamp(
      this.center.y,
      this.height / this.zoom / 2,
      768 - this.height / this.zoom / 2,
    );
  }
  resize() {
    if (this.disposed) return;
    const r = this.canvas.parentElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.width = r.width;
    this.height = r.height;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.boundCamera();
    this.invalidate();
  }
  invalidate() {
    this.dirty = true;
    if (!this.raf && !this.disposed && !document.hidden)
      this.raf = requestAnimationFrame((ms) => this.tick(ms));
  }
  tick(ms) {
    this.raf = null;
    if (this.disposed || document.hidden) return;
    const motion =
      this.view === "scene" ||
      enabled(
        {
          id: "detail",
          motion: this.art.manifest?.assets[this.subject]?.motion,
        },
        this.mode,
        true,
      );
    const running = this.playing && this.mode !== "still" && motion;
    if (this.lastReal && running)
      this.time += Math.min((ms - this.lastReal) / 1000, 0.2);
    this.lastReal = ms;
    if (this.ready && (this.dirty || (running && ms >= (this.nextDraw || 0)))) {
      if (this.lastDraw && running) {
        this.intervals.push(ms - this.lastDraw);
        if (this.intervals.length > 120) this.intervals.shift();
      }
      const step = 1000 / this.fps;
      this.nextDraw = this.dirty
        ? ms + step
        : (this.nextDraw || ms) +
          step *
            Math.max(1, Math.floor((ms - (this.nextDraw || ms)) / step) + 1);
      this.lastDraw = ms;
      const start = performance.now();
      this.render();
      this.cpu.push(performance.now() - start);
      if (this.cpu.length > 120) this.cpu.shift();
      this.dirty = false;
      this.renderCount++;
      if (!running || ms - this.lastReport > 400) {
        this.lastReport = ms;
        this.report(this.inspect());
      }
    }
    const d = this.controls.direction();
    if (this.view === "scene" && (d.x || d.y)) {
      this.center.x += d.x * 2;
      this.center.y += d.y * 2;
      this.boundCamera();
      this.dirty = true;
    }
    if (running || this.dirty)
      this.raf = requestAnimationFrame((t) => this.tick(t));
  }
  render() {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#708c53";
    c.fillRect(0, 0, this.width, this.height);
    this.art.drawCalls = 0;
    this.activeCount = 0;
    if (this.view === "detail") this.detail(c);
    else if (this.compare) {
      const split = (this.width * this.wipe) / 100;
      c.save();
      c.beginPath();
      c.rect(0, 0, split, this.height);
      c.clip();
      this.scene(c, "1-nearest");
      c.restore();
      c.save();
      c.beginPath();
      c.rect(split, 0, this.width - split, this.height);
      c.clip();
      this.scene(c, this.shownProfile);
      c.restore();
    } else this.scene(c, this.shownProfile);
  }
  detail(c) {
    const stacked = this.detailStack(),
      panes = this.compare ? 2 : 1;
    const a = this.art.manifest.assets[this.subject],
      f = a.logical;
    for (let i = 0; i < panes; i++) {
      const x = !stacked ? (this.width * i) / panes : 0,
        y = stacked ? (this.height * i) / panes : 0;
      const w = stacked ? this.width : this.width / panes,
        h = stacked ? this.height / panes : this.height;
      c.save();
      c.beginPath();
      c.rect(x, y, w, h);
      c.clip();
      c.fillStyle = "#71895a";
      c.fillRect(x, y, w, h);
      const hero = this.art.manifest.assets["person-0-down"].logical;
      const pairWidth = f.w + hero.w + 18,
        pairHeight = Math.max(f.h, hero.h);
      const safeScale = Math.min(
        this.zoom,
        (w - 32) / pairWidth,
        Math.max(20, h - 60) / pairHeight,
      );
      const ox = x + w / 2,
        oy = y + (h + 36) / 2;
      c.save();
      c.translate(ox, oy);
      c.scale(safeScale, safeScale);
      const e = {
        id: "detail-" + this.subject,
        sprite: this.subject,
        x: -pairWidth / 2 + hero.w + 18 + f.anchor[0],
        y: pairHeight / 2 - f.h + f.anchor[1],
        motion: a.motion,
      };
      const profile = this.compare && i === 0 ? "1-nearest" : this.shownProfile;
      drawMotion(c, this.art, profile, e, this.time, this.mode, true);
      this.art.draw(
        c,
        "1-nearest",
        "person-0-down",
        -pairWidth / 2,
        pairHeight / 2 - hero.h,
        hero.w,
        hero.h,
      );
      c.restore();
      c.restore();
    }
    this.activeCount = enabled(
      { id: "detail", motion: a.motion },
      this.mode,
      true,
    )
      ? 1
      : 0;
  }
  scene(c, profile) {
    const width = this.width / this.zoom,
      height = this.height / this.zoom;
    const cam = {
      x: this.center.x - width / 2,
      y: this.center.y - height / 2,
      width,
      height,
    };
    c.save();
    c.scale(this.zoom, this.zoom);
    c.translate(-cam.x, -cam.y);
    this.terrain.beginFrame(this.world, cam);
    for (
      let cy = Math.max(0, Math.floor(cam.y / 256));
      cy <= Math.min(2, Math.floor((cam.y + height) / 256));
      cy++
    )
      for (
        let cx = Math.max(0, Math.floor(cam.x / 256));
        cx <= Math.min(3, Math.floor((cam.x + width) / 256));
        cx++
      )
        c.drawImage(this.terrain.chunk(this.world, cx, cy), cx * 256, cy * 256);
    let active = 0;
    for (const e of [...ENTITIES].sort(
      (a, b) => (a.depth ?? a.y) - (b.depth ?? b.y),
    )) {
      const f = this.art.manifest.assets[e.sprite].logical;
      if (
        e.x + f.w < cam.x ||
        e.x - f.w > cam.x + width ||
        e.y < cam.y ||
        e.y - f.h > cam.y + height
      )
        continue;
      if (drawMotion(c, this.art, profile, e, this.time, this.mode)) active++;
    }
    this.activeCount = active;
    c.restore();
  }
  inspect() {
    const asset = this.art.manifest?.assets[this.subject];
    const names = this.ready ? this.names() : [];
    const budget = (profile) => {
      const unique = new Map();
      for (const n of names) {
        const v = this.art.variant(n, profile);
        unique.set(v.image, v);
      }
      return {
        pngBytes: [...unique.values()].reduce((s, v) => s + v.bytes, 0),
        rgbaBytes: [...unique.values()].reduce((s, v) => s + v.rgbaBytes, 0),
      };
    };
    const sorted = [...this.cpu].sort((a, b) => a - b);
    return {
      ready: this.ready,
      disposed: this.disposed,
      pending: this.pending,
      error: this.error,
      profile: this.profile,
      shownProfile: this.shownProfile,
      view: this.view,
      subject: this.subject,
      mode: this.mode,
      playing: this.playing,
      time: this.time,
      zoom: this.zoom,
      fps: this.fps,
      compare: this.compare,
      wipe: this.wipe,
      center: { ...this.center },
      width: this.width,
      height: this.height,
      detailStack: this.detailStack(),
      renderCount: this.renderCount,
      active: this.activeCount || 0,
      total:
        this.view === "detail"
          ? 1
          : ENTITIES.filter((e) => e.motion !== "reference").length,
      calls: this.art.drawCalls,
      cpu95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      measuredFps:
        this.playing &&
        this.mode !== "still" &&
        this.activeCount &&
        this.intervals.length
          ? 1000 /
            (this.intervals.reduce((s, v) => s + v, 0) / this.intervals.length)
          : 0,
      baseline: this.ready ? budget("1-nearest") : null,
      candidate: this.ready ? budget(this.shownProfile) : null,
      assets: this.ready ? this.art.stats() : null,
      logical: asset?.logical,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    cancelAnimationFrame(this.raf);
    this.raf = null;
    this.controls.destroy();
    this.resizeObserver.disconnect();
    this.art.dispose();
    this.terrain?.chunks.clear();
    this.canvas.width = this.canvas.height = 1;
  }
  detailStack() {
    return this.width < 640 && this.height > this.width * 0.55;
  }
}
module.exports = { DefinitionStudy };
