"use strict";
const { TILE } = require("./geometry");
const { validateLayout, placementBounds } = require("./homestead-layout");
const { RiverNeighbors } = require("./river-neighbors");
const KEY = "magikitos.adventure.home";
const byId = (id) => document.getElementById(id);
const clone = (v) => JSON.parse(JSON.stringify(v));

/** One owner layout, two reusable spaces. Visitors get a frozen, validated public snapshot. */
class Homestead {
  constructor(game) {
    this.game = game;
    this.catalog = game.catalog.homesteads;
    this.riverNeighbors = new RiverNeighbors(this);
    this.layout = clone(this.catalog.initial);
    this.visiting = null;
    this.editing = false;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved) this.layout = validateLayout(saved, this.catalog);
    } catch (_) {}
    byId("home-edit").addEventListener("click", () => this.begin());
    byId("home-save").addEventListener("click", () => this.commit());
    byId("home-cancel").addEventListener("click", () => this.cancel());
    byId("home-remove").addEventListener("click", () => this.remove());
    byId("home-variant").addEventListener("click", () => this.variant());
    byId("home-neighbors").addEventListener("click", () => this.neighbors());
    byId("home-return").addEventListener("click", () => this.returnToRiver());
    const canvas = byId("world-canvas");
    canvas.addEventListener("pointerdown", (e) => this.pointerDown(e), true);
    canvas.addEventListener("pointermove", (e) => this.pointerMove(e), true);
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      canvas.addEventListener(event, (e) => this.pointerUp(e), true);
    document.addEventListener(
      "keydown",
      (e) => {
        if (
          !this.editing ||
          !["Escape", "Delete", "Backspace"].includes(e.key) ||
          e.target.closest("input,textarea,select")
        )
          return;
        e.preventDefault();
        e.stopImmediatePropagation();
        e.key === "Escape" ? this.cancel() : this.remove();
      },
      true,
    );
  }
  get space() {
    return /^(home|guest)-garden$/.test(this.game.state.scene)
      ? "garden"
      : /^(home|guest)-room$/.test(this.game.state.scene)
        ? "room"
        : null;
  }
  setLayout(layout) {
    this.layout = validateLayout(layout, this.catalog);
    try {
      localStorage.setItem(KEY, JSON.stringify(this.layout));
    } catch (_) {
      this.game.toast(this.game.text("unsaved"));
    }
  }
  entity(item) {
    const kind = this.catalog.stock[item.kind];
    return {
      id: "furniture-" + item.id,
      homeObject: item.id,
      family: item.kind,
      artVariant: item.variant,
      sprite: kind.variants.find((v) => v.id === item.variant).sprite,
      x: item.x,
      y: item.y,
      scale: kind.scale,
      solid: kind.solid,
      pushable: false,
      rules: [],
    };
  }
  sceneData(data) {
    if (!data) return null;
    data = this.riverNeighbors.sceneData(data);
    const space = data.id.endsWith("-garden")
      ? "garden"
      : data.id.endsWith("-room")
        ? "room"
        : null;
    if (!space || !/^(home|guest)-/.test(data.id)) return data;
    const layout = data.id.startsWith("guest-")
      ? this.visiting?.parcel
      : this.editing
        ? this.draft
        : this.layout;
    return {
      ...data,
      entities: [
        ...data.entities,
        ...(layout?.objects || [])
          .filter((i) => i.space === space)
          .map((i) => this.entity(i)),
      ],
    };
  }
  sceneChanged() {
    if (!this.game.state.scene.startsWith("guest-")) this.visiting = null;
    this.editing = false;
    this.drag = null;
    this.paint();
  }
  arrive() {
    if (this.game.state.scene !== "home-garden" || this.game.state.home) return;
    this.game.state.home = true;
    this.game.dirty = true;
    this.game.openDialogue(this.game.lines("homeArrival"));
    this.game.save();
    this.paint();
  }
  begin() {
    const g = this.game;
    if (!this.space || this.visiting || g.river.active || g.transitioning)
      return;
    g.closeDialogue();
    g.closeContent();
    g.pauseMovement();
    this.editing = true;
    this.draft = clone(this.layout);
    this.selected = null;
    this.kind = null;
    this.palette();
    this.paint();
  }
  async redraw() {
    const g = this.game;
    const { World } = require("./model");
    g.world = new World(this.sceneData(g.catalog.scenes[g.state.scene]));
    g.world.actors = [g.player, ...g.neighbors];
    g.world.refresh(g.state);
    g.renderer.world = g.world;
    if (!g.world.canStand(g.player.x, g.player.y, g.player)) {
      g.player.x = g.world.data.spawn.x * TILE;
      g.player.y = g.world.data.spawn.y * TILE;
    }
  }
  async commit() {
    if (!this.editing) return;
    this.setLayout(this.draft);
    this.editing = false;
    this.selected = null;
    this.kind = null;
    await this.redraw();
    this.game.state.home = true;
    this.game.dirty = true;
    this.game.save();
    this.paint();
    if (!this.game.cloud.owner) await this.game.cloud.connect(true);
    await this.game.cloud.flush();
  }
  cancel() {
    if (!this.editing) return;
    this.editing = false;
    this.drag = null;
    this.selected = null;
    this.kind = null;
    this.redraw();
    this.paint();
  }
  palette() {
    const list = byId("home-palette");
    list.replaceChildren();
    for (const [id, kind] of Object.entries(this.catalog.stock)) {
      if (!kind.spaces.includes(this.space)) continue;
      const count = this.draft.objects.filter((o) => o.kind === id).length;
      const button = document.createElement("button");
      button.type = "button";
      button.title = this.game.text(kind.label);
      button.setAttribute("aria-label", button.title);
      button.disabled = count >= kind.count;
      const icon = this.game.renderer.sprites.icon(kind.variants[0].sprite);
      if (icon) {
        icon.style.width = "44px";
        icon.style.height = "42px";
        button.append(icon);
      }
      const label = document.createElement("small");
      label.textContent = `${count}/${kind.count}`;
      button.append(label);
      button.addEventListener("click", () => {
        this.kind = id;
        this.selected = null;
        this.preview = null;
        this.paint();
      });
      list.append(button);
    }
  }
  tap(point) {
    if (!this.editing) return false;
    if (this.kind) {
      const definition = this.catalog.stock[this.kind];
      const item = {
        id: "o-" + crypto.randomUUID().slice(0, 12),
        kind: this.kind,
        variant: definition.variants[0].id,
        space: this.space,
        ...this.snap(point),
      };
      const next = { objects: [...this.draft.objects, item] };
      if (this.accept(next)) {
        this.selected = item.id;
        this.kind = null;
      }
    } else if (this.selected) this.moveSelected(point);
    this.paint();
    return true;
  }
  snap(point) {
    const grid = this.catalog.grid;
    return {
      x: Math.round(point.x / TILE / grid) * grid,
      y: Math.round(point.y / TILE / grid) * grid,
    };
  }
  accept(next, quiet = false) {
    if (JSON.stringify(next) === JSON.stringify(this.draft)) return true;
    try {
      this.draft = validateLayout(next, this.catalog);
      this.redraw();
      if (!quiet) this.palette();
      return true;
    } catch (_) {
      if (!quiet) this.game.toast(this.game.text("homeBlocked"));
      return false;
    }
  }
  moveSelected(point, quiet = false) {
    return this.accept(
      {
        objects: this.draft.objects.map((o) =>
          o.id === this.selected ? { ...o, ...this.snap(point) } : o,
        ),
      },
      quiet,
    );
  }
  remove() {
    if (!this.editing || !this.selected) return;
    this.accept({
      objects: this.draft.objects.filter((o) => o.id !== this.selected),
    });
    this.selected = null;
    this.paint();
  }
  variant() {
    if (!this.editing || !this.selected) return;
    const next = clone(this.draft),
      item = next.objects.find((o) => o.id === this.selected),
      variants = this.catalog.stock[item.kind].variants;
    item.variant =
      variants[
        (variants.findIndex((v) => v.id === item.variant) + 1) % variants.length
      ].id;
    this.accept(next);
  }
  point(event) {
    const r = byId("world-canvas").getBoundingClientRect(),
      g = this.game;
    return {
      x: ((event.clientX - r.left) / r.width) * g.renderer.width + g.camera.x,
      y: ((event.clientY - r.top) / r.height) * g.renderer.height + g.camera.y,
    };
  }
  pointerDown(event) {
    if (!this.editing || event.button !== 0 || !event.isPrimary) return;
    const g = this.game,
      point = this.point(event);
    const entity = [...g.world.entities]
      .reverse()
      .find((e) => e.homeObject && g.renderer.hit(e, point, g.state));
    if (!entity) return; // Empty ground still pans/zooms through the shared map gestures.
    event.preventDefault();
    event.stopImmediatePropagation();
    g.input.map.clear();
    byId("world-canvas").setPointerCapture(event.pointerId);
    this.selected = entity.homeObject;
    this.kind = null;
    this.drag = {
      pointerId: event.pointerId,
      dx: point.x - entity.x,
      dy: point.y - entity.y,
    };
    this.paint();
  }
  pointerMove(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const p = this.point(event);
    this.moveSelected({ x: p.x - this.drag.dx, y: p.y - this.drag.dy }, true);
  }
  pointerUp(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.drag = null;
  }
  draw(ctx) {
    if (!this.editing) return;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(245,223,146,.5)";
    const area = this.catalog.spaces[this.space];
    for (const [x, y, w, h] of area.protected) {
      ctx.fillStyle = "rgba(139,102,69,.10)";
      ctx.fillRect(x * TILE, y * TILE, w * TILE, h * TILE);
    }
    const selected = this.draft.objects.find((o) => o.id === this.selected);
    if (selected) {
      const b = placementBounds(selected, this.catalog);
      ctx.strokeStyle = "#fff0bd";
      ctx.strokeRect(
        b.x * TILE - 2,
        b.y * TILE - 2,
        b.w * TILE + 4,
        b.h * TILE + 4,
      );
    }
    ctx.restore();
  }
  async neighbors(cursor = null) {
    const modal = byId("home-neighbors-dialog"),
      list = byId("home-neighbors-list");
    if (!modal.open) {
      this.game.pauseMovement();
      modal.showModal();
    }
    list.replaceChildren();
    try {
      const data = await this.game.api.request("parcels", { cursor });
      if (!Array.isArray(data.items) || data.items.length > 8)
        throw new Error("invalid_parcels");
      for (const item of data.items) {
        if (
          !/^[a-f0-9]{32}$/.test(item.id) ||
          item.id === this.game.cloud.meta.id
        )
          continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "world-primary";
        button.textContent = String(
          item.owner?.name || item.owner?.handle || "Magikito",
        ).slice(0, 120);
        button.addEventListener("click", () => this.visit(item.id));
        list.append(button);
      }
      if (data.nextCursor && /^[a-f0-9]{32}$/.test(data.nextCursor)) {
        const next = document.createElement("button");
        next.textContent = this.game.text("next");
        next.addEventListener("click", () => this.neighbors(data.nextCursor));
        list.append(next);
      }
      if (!list.childNodes.length)
        list.textContent = this.game.text("homeNoNeighbors");
    } catch (_) {
      list.textContent = this.game.text("cloudError");
    }
  }
  async visit(id, returnTo = null) {
    const g = this.game;
    if (g.transitioning) return;
    const previous = this.visiting;
    g.transitioning = true;
    try {
      const data = await g.api.request("parcel", { id });
      const parcel = validateLayout(data.plot?.parcel, this.catalog);
      g.save();
      this.visiting = {
        id,
        parcel,
        returnTo: returnTo || this.visiting?.returnTo || null,
      };
      const state = {
        ...g.state,
        navigation: { mode: "foot", direction: "up" },
      };
      g.scenes.cache.clear();
      const prepared = await g.scenes.prepare(
        "guest-garden",
        { x: 24 * TILE, y: 34 * TILE },
        state,
      );
      g.state = state;
      g.scenes.enter(prepared);
      byId("home-neighbors-dialog").close();
      g.state.visited = [...new Set([...(g.state.visited || []), id])].slice(
        -32,
      );
    } catch (_) {
      this.visiting = previous;
      g.toast(g.text("cloudError"));
    } finally {
      g.transitioning = false;
      this.paint();
    }
  }
  returnToRiver() {
    return this.game.river.travel(
      this.visiting?.returnTo ||
        this.game.catalog.scenes["home-garden"].navigation.exits[0],
    );
  }
  resolveExit(exit) {
    return (exit.visitReturn && this.visiting?.returnTo) || exit;
  }
  paint() {
    const g = this.game,
      available =
        Boolean(this.space) &&
        !g.river?.active &&
        !g.dialogue &&
        !g.hasOverlay() &&
        !g.transitioning;
    byId("home-controls").hidden = !available || this.editing;
    byId("home-editor").hidden = !this.editing;
    byId("home-edit").hidden = Boolean(this.visiting);
    byId("home-return").hidden = !this.visiting;
    byId("home-neighbors").hidden = Boolean(this.visiting);
    byId("home-remove").disabled = !this.selected;
    byId("home-variant").disabled = !this.selected;
  }
}
module.exports = { Homestead };
