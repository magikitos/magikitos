"use strict";
const {
  World,
  TILE,
  clamp,
  random,
} = require("../../../../public/assets/js/adventure/model");
const { Terrain } = require("../../../../public/assets/js/adventure/terrain");
const { drawRipples } = require("../../../../public/assets/js/adventure/water");
const {
  SpriteLibrary,
} = require("../../../../public/assets/js/adventure/sprites");
const {
  drawArtwork,
  artworkBounds,
} = require("../../../../public/assets/js/adventure/entity-art");
const {
  characterFrame,
} = require("../../../../public/assets/js/adventure/characters");
const {
  move,
  follow,
} = require("../../../../public/assets/js/adventure/movement");
const {
  RollMotion,
  DoublePress,
} = require("./archived-locomotion");
const {
  frameCamera,
  chunkRange,
} = require("../../../../public/assets/js/adventure/scene-frame");
const { makeScene, PRESETS, STOPS } = require("./scene");
const { Controls } = require("./controls");
/** Experimental composition of shared game primitives; no Adventure boot, API, account or storage. */
class ForestRuntime {
  constructor(canvas, viewport, onChange, onNotice) {
    Object.assign(this, {
      canvas,
      viewport,
      onChange,
      onNotice,
      terrain: new Terrain(),
      art: new SpriteLibrary(),
      actors: new SpriteLibrary(),
      camera: { x: 0, y: 0 },
      zoom: 1.75,
      preset: "tiny",
      path: [],
      roll: new RollMotion(),
      double: new DoublePress(),
      active: false,
      ready: false,
      followCamera: true,
    });
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.controls = new Controls(canvas, {
      tap: (x, y) => this.tap(x, y),
      pan: (x, y) => this.pan(x, y),
      zoom: (factor, x, y) => this.zoomAt(factor, x, y),
      cancelPath: () => {
        this.path = [];
        this.followCamera = true;
      },
      roll: () => this.startRoll(),
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(viewport);
  }
  async initialize() {
    this.art = new SpriteLibrary();
    this.actors = new SpriteLibrary();
    await Promise.all([
      this.art.initialize("/experiments/forest-scale/manifest.json"),
      this.actors.initialize("/assets/aventura/manifest.json"),
    ]);
    await Promise.all([
      this.art.prepare([], ["habitats", "nature"]),
      this.actors.prepare(
        [],
        ["actor-0", "actor-2", "actor-3", "actor-0-roll"],
      ),
    ]);
    this.art.activate(new Set(["habitats", "nature"]));
    this.actors.activate(
      new Set(["actor-0", "actor-2", "actor-3", "actor-0-roll"]),
    );
    this.setPreset("tiny");
    this.ready = true;
    this.resize();
    this.onChange();
  }
  setPreset(id) {
    const old = this.player;
    this.preset = id;
    this.world = new World(makeScene(id));
    this.terrain.chunks.clear();
    this.path = [];
    this.roll.stop();
    const wanted =
      old && this.world.canStand(old.x, old.y)
        ? old
        : { x: 35 * TILE, y: 47 * TILE };
    this.player = {
      ...wanted,
      direction: old?.direction || "down",
      actor: true,
      walkDistance: 0,
    };
    this.residents = [
      {
        x: 44 * TILE,
        y: 32 * TILE,
        variant: 2,
        direction: "down",
        actor: true,
      },
      {
        x: 69 * TILE,
        y: 56 * TILE,
        variant: 3,
        direction: "left",
        actor: true,
      },
    ];
    this.world.actors = [this.player, ...this.residents];
    this.followCamera = true;
    const rand = random(9823);
    this.leaves = Array.from({ length: 120 }, () => ({
      x: 40 + rand() * (this.world.width * TILE - 80),
      y: 40 + rand() * (this.world.height * TILE - 80),
      turn: rand() * 6.28,
      length: 5 + rand() * 12,
      tone: Math.floor(rand() * 3),
    })).filter(
      (p) =>
        !this.world.waterAt(p.x / TILE, p.y / TILE) &&
        this.world.pathDistance(p.x / TILE, p.y / TILE) > 1.5,
    );
    this.resize();
    this.center(true);
    this.onChange();
  }
  resize() {
    const r = this.viewport.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const min = this.world
      ? Math.max(
          r.width / (this.world.width * TILE),
          r.height / (this.world.height * TILE),
          0.55,
        )
      : 0.55;
    this.zoom = clamp(this.zoom, min, Math.max(2.5, min));
    this.width = r.width / this.zoom;
    this.height = r.height / this.zoom;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.pixelScale = this.canvas.width / this.width;
    this.ctx.imageSmoothingEnabled = false;
    if (this.world) this.camera = frameCamera(this.camera, this.world, this);
  }
  center(immediate = false, dt = 0.1) {
    if (!this.player || !this.width) return;
    const target = {
        x: this.player.x - this.width / 2,
        y: this.player.y - this.height * 0.58,
      },
      k = immediate ? 1 : 1 - Math.exp(-dt * 7);
    this.camera = frameCamera(
      {
        x: this.camera.x + (target.x - this.camera.x) * k,
        y: this.camera.y + (target.y - this.camera.y) * k,
      },
      this.world,
      this,
    );
  }
  zoomAt(factor, x, y) {
    if (!this.ready) return;
    const r = this.canvas.getBoundingClientRect();
    x ??= r.x + r.width / 2;
    y ??= r.y + r.height / 2;
    const world = this.point(x, y);
    this.zoom *= factor;
    this.resize();
    this.camera = frameCamera(
      {
        x: world.x - (x - r.x) / this.zoom,
        y: world.y - (y - r.y) / this.zoom,
      },
      this.world,
      this,
    );
    this.followCamera = false;
    this.onChange();
  }
  pan(x, y) {
    this.path = [];
    this.followCamera = false;
    this.camera = frameCamera(
      { x: this.camera.x - x / this.zoom, y: this.camera.y - y / this.zoom },
      this.world,
      this,
    );
  }
  point(x, y) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: this.camera.x + (x - r.x) / this.zoom,
      y: this.camera.y + (y - r.y) / this.zoom,
    };
  }
  artEntity(entity, frame) {
    return {
      ...entity,
      scale: ((entity.scale ?? 1) * (frame.designSize ?? frame.w)) / frame.w,
    };
  }
  tap(x, y) {
    if (!this.ready) return;
    const target = this.point(x, y);
    const hit = [...this.world.entities].reverse().find((e) => {
      const f = this.art.frame(e.sprite);
      if (!f) return false;
      const b = artworkBounds(this.artEntity(e, f), f);
      return (
        target.x >= b.x &&
        target.x <= b.x + b.w &&
        target.y >= b.y &&
        target.y <= b.y + b.h
      );
    });
    this.path =
      this.world.path(this.player, target) ||
      this.world.approach(this.player, target, 4) ||
      [];
    if (hit) {
      const stop = STOPS.find((s) => s.focus === hit.id);
      if (stop) this.onNotice(stop.subtitle);
      else
        this.onNotice(
          "Esto es una prueba de escala: puedes curiosear alrededor, pero aún no hay interiores ni misiones.",
        );
    }
    this.followCamera = true;
    if (this.double.press(x, y, performance.now(), "pointer")) this.startRoll();
  }
  startRoll() {
    if (!this.ready || this.roll.current) return;
    const dir = this.controls.direction(),
      next = this.path[0];
    const x = dir.x || dir.y ? dir.x : next ? next.x - this.player.x : 0,
      y = dir.x || dir.y ? dir.y : next ? next.y - this.player.y : 0;
    if (this.roll.start(x, y)) {
      this.path = [];
      this.followCamera = true;
    }
  }
  visit(id) {
    const stop = STOPS.find((s) => s.id === id);
    if (!stop || !this.ready) return;
    this.player.x = stop.position[0] * TILE;
    this.player.y = stop.position[1] * TILE;
    this.path = [];
    this.roll.stop();
    this.controls.clear();
    this.followCamera = true;
    this.center(true);
    this.onNotice(stop.subtitle);
    this.onChange();
  }
  setActive(active) {
    this.active = active;
    this.controls.clear();
    cancelAnimationFrame(this.frame);
    this.lastTime = 0;
    if (active) {
      this.resize();
      this.frame = requestAnimationFrame((t) => this.tick(t));
    }
  }
  tick(ms) {
    if (!this.active) return;
    if (this.ready && !document.hidden) {
      const dt = Math.min(
        0.04,
        this.lastTime ? (ms - this.lastTime) / 1000 : 0,
      );
      this.lastTime = ms;
      const d = this.controls.direction();
      this.walking = false;
      if (this.roll.current)
        this.walking = this.roll.step(
          this.world,
          this.player,
          dt,
          () => {},
        ).moved;
      else if (d.x || d.y) {
        this.walking = move(
          this.world,
          this.player,
          (d.x * 72 * dt) / Math.hypot(d.x, d.y),
          (d.y * 72 * dt) / Math.hypot(d.x, d.y),
        );
        this.followCamera = true;
      } else this.walking = follow(this.world, this.player, this.path, dt, 72);
      if (this.followCamera) this.center(false, dt);
      this.render(this.reduced ? 0 : ms / 1000);
    }
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
  render(time) {
    const c = this.ctx,
      view = { ...this.camera, width: this.width, height: this.height },
      range = chunkRange(this.world, view),
      px = this.pixelScale;
    c.setTransform(px, 0, 0, px, 0, 0);
    c.fillStyle = "#405d40";
    c.fillRect(0, 0, this.width, this.height);
    c.save();
    c.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));
    this.terrain.beginFrame(this.world, view);
    for (let y = range.top; y <= range.bottom; y++)
      for (let x = range.left; x <= range.right; x++) {
        const left = Math.round((x * 256 - Math.round(this.camera.x)) * px),
          top = Math.round((y * 256 - Math.round(this.camera.y)) * px);
        const right = Math.round(
            ((x + 1) * 256 - Math.round(this.camera.x)) * px,
          ),
          bottom = Math.round(((y + 1) * 256 - Math.round(this.camera.y)) * px);
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(
          this.terrain.chunk(this.world, x, y),
          left,
          top,
          right - left,
          bottom - top,
        );
        c.restore();
      }
    drawRipples(c, this.world, view, time);
    this.drawLeafLitter(c);
    const list = [
      ...this.world.entities,
      ...this.residents.map((e) => ({
        ...e,
        sprite: characterFrame(e.variant, e, false),
        character: true,
      })),
      {
        ...this.player,
        sprite:
          this.roll.frame() || characterFrame(0, this.player, this.walking),
        character: true,
      },
    ].sort((a, b) => a.y - b.y);
    for (const e of list) {
      const library = e.character ? this.actors : this.art,
        f = library.frame(e.sprite);
      if (!f) continue;
      const drawing = e.character ? e : this.artEntity(e, f);
      const b = artworkBounds(drawing, f);
      if (
        b.x + b.w < view.x ||
        b.x > view.x + view.width ||
        b.y + b.h < view.y ||
        b.y > view.y + view.height
      )
        continue;
      drawArtwork(c, library, drawing, e.sprite);
    }
    // Sparse ambient motes; no NPC simulation, server calls or heartbeat.
    for (let i = 0; i < 8; i++) {
      const x = 220 + i * 121 + Math.sin(time * 0.35 + i) * 12,
        y = 480 + Math.cos(i * 2.1) * 250 + Math.cos(time * 0.28 + i) * 9;
      c.fillStyle =
        "rgba(238,225,144," + (0.25 + Math.sin(time + i) * 0.12) + ")";
      c.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    c.restore();
  }
  drawLeafLitter(c) {
    for (const leaf of this.leaves) {
      if (
        leaf.x < this.camera.x - 20 ||
        leaf.x > this.camera.x + this.width + 20 ||
        leaf.y < this.camera.y - 20 ||
        leaf.y > this.camera.y + this.height + 20
      )
        continue;
      c.save();
      c.translate(Math.round(leaf.x), Math.round(leaf.y));
      c.rotate(leaf.turn);
      c.fillStyle = ["#9e8b50", "#809753", "#94754d"][leaf.tone];
      c.beginPath();
      c.moveTo(-leaf.length, 0);
      c.quadraticCurveTo(0, -leaf.length * 0.45, leaf.length, 0);
      c.quadraticCurveTo(0, leaf.length * 0.5, -leaf.length, 0);
      c.fill();
      c.strokeStyle = "#657344";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-leaf.length, 0);
      c.lineTo(leaf.length, 0);
      c.stroke();
      c.restore();
    }
  }
  inspect() {
    return {
      ready: this.ready,
      active: this.active,
      preset: this.preset,
      player: { ...this.player },
      camera: { ...this.camera },
      view: { width: this.width, height: this.height },
      zoom: this.zoom,
      pathLength: this.path.length,
      world: { width: this.world?.width, height: this.world?.height },
      entities: this.world?.data.entities.map((e) => ({
        id: e.id,
        sprite: e.sprite,
        scale: e.scale,
      })),
      assets: this.art.inspect(),
      terrainBuilds: this.terrain.buildCount,
    };
  }
  destroy() {
    this.setActive(false);
    this.controls.destroy();
    this.observer.disconnect();
  }
}
module.exports = { ForestRuntime, PRESETS, STOPS };
