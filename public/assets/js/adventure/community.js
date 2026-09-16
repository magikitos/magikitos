"use strict";
const { TILE } = require("./geometry");
const { bounds, validateConstruction } = require("./construction-layout");
const { drawArtwork } = require("./entity-art");
const { operationId } = require("./material-account");
const byId = (id) => document.getElementById(id);
/** One shared zone snapshot. Only the ghost is speculative; placed bodies always
 * come from acknowledged server snapshots. No optimistic deductions or fake NPC events. */
class Community {
  constructor(game) {
    this.game = game;
    this.catalog = game.catalog.construction;
    this.snapshots = new Map();
    this.editing = false;
    this.busy = false;
    this.activities = new (require("./ambient-activities").AmbientActivities)(
      game,
    );
    try {
      this.pending = JSON.parse(
        localStorage.getItem("magikitos.adventure.build-pending"),
      );
    } catch (_) {}
    byId("home-edit").onclick = () => this.begin();
    byId("home-save").onclick = () => this.commit();
    byId("home-cancel").onclick = () => this.cancel();
    byId("home-remove").onclick = () => this.commit("remove");
    byId("home-variant").onclick = () => this.variant();
    byId("community-rotate").onclick = () => this.rotate();
    document.addEventListener(
      "keydown",
      (e) => {
        if (this.editing && e.key === "Escape") {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.cancel();
        }
      },
      true,
    );
    const canvas = byId("world-canvas");
    canvas.addEventListener("pointermove", (e) => {
      if (
        !this.editing ||
        !this.ghost ||
        this.busy ||
        e.pointerType === "touch"
      )
        return;
      const r = canvas.getBoundingClientRect(),
        g = this.game;
      this.position({
        x: g.camera.x + ((e.clientX - r.left) / r.width) * g.renderer.width,
        y: g.camera.y + ((e.clientY - r.top) / r.height) * g.renderer.height,
      });
    });
  }
  get zone() {
    return (
      Object.keys(this.catalog.zones).find(
        (id) => this.catalog.zones[id].scene === this.game.state.scene,
      ) || null
    );
  }
  get snapshot() {
    return this.snapshots.get(this.zone);
  }
  async prepare(data) {
    const zone = Object.keys(this.catalog.zones).find(
      (id) => this.catalog.zones[id].scene === data?.id,
    );
    if (!zone) return;
    try {
      const snapshot = await this.game.api.request(
        "community",
        { zone },
        { auth: true, timeout: 3000 },
      );
      this.accept(snapshot);
    } catch (_) {
      this.unavailable = true;
    }
  }
  accept(value) {
    if (
      !value ||
      !this.catalog.zones[value.zone] ||
      !Number.isInteger(value.revision) ||
      !Array.isArray(value.objects) ||
      value.objects.length > this.catalog.maxObjectsPerZone
    )
      throw Error("invalid_community");
    for (const o of value.objects)
      if (
        !/^[a-f0-9]{32}$/.test(o.id) ||
        !this.catalog.definitions[o.kind] ||
        ![o.x, o.y, o.rotation, o.revision].every(Number.isFinite)
      )
        throw Error("invalid_community_object");
    this.snapshots.set(value.zone, value);
    this.unavailable = false;
  }
  sprite(item) {
    const d = this.catalog.definitions[item.kind],
      v = d.variants.find((v) => v.id === item.variant);
    return v?.views?.[item.rotation] || v?.sprite;
  }
  entity(item) {
    const d = this.catalog.definitions[item.kind],
      b = bounds({ ...item, x: 0, y: 0 }, d);
    return {
      id: `community-${item.id}`,
      community: item.id,
      sprite: this.sprite(item),
      x: item.x,
      y: item.y,
      scale: d.scale || 1,
      ...(d.solid === false ? {} : { solid: [b.x, b.y, b.w, b.h] }),
      rules: [],
      pushable: false,
      onInteract: () => this.inspect(item),
      capabilities: d.capabilities,
      lightRadius: d.lightRadius,
      slots: d.slots,
    };
  }
  sceneData(data) {
    const zone = Object.keys(this.catalog.zones).find(
      (id) => this.catalog.zones[id].scene === data?.id,
    );
    if (!zone) return data;
    return {
      ...data,
      entities: [
        ...data.entities,
        ...(this.snapshots.get(zone)?.objects || []).map((o) => this.entity(o)),
      ],
    };
  }
  sceneChanged() {
    this.activities.reset();
    this.cancel();
    this.paint();
  }
  arrive() {
    if (this.zone)
      this.game.toast(this.game.text(this.catalog.zones[this.zone].label));
  }
  async inspect(item) {
    if (
      this.catalog.definitions[item.kind].capabilities?.length &&
      this.game.session.get()
    )
      this.game.api
        .request("community-use", { id: item.id }, { auth: true })
        .catch(() => {});
    if (item.mine && !item.heritage) {
      await this.begin();
      if (!this.editing) return;
      this.original = item;
      this.ghost = { ...item };
      this.position({ x: item.x * TILE, y: item.y * TILE });
    } else
      this.game.openDialogue([
        `${this.game.text(this.catalog.definitions[item.kind].label)} · ${item.author?.name || item.author?.handle || this.game.text("communityEveryone")}`,
      ]);
  }
  async begin() {
    const g = this.game;
    if (!this.zone || g.river.active || this.busy) return;
    this.busy = true;
    g.pauseMovement();
    g.closeDialogue();
    g.closeContent();
    try {
      if (!(await g.materials.ready())) {
        g.toast(g.text("communitySyncNeeded"));
        return;
      }
      if (this.pending) {
        if (this.pending.owner !== g.materials.owner)
          throw Error("pending_identity");
        const result = await g.api.request(
          "community-build",
          this.pending.request,
          { auth: true },
        );
        this.accept(result);
        g.materials.accept(result.account);
        g.materials.reconcile();
        this.clearPending();
        await this.refreshWorld();
      }
      await this.prepare(g.catalog.scenes[g.state.scene]);
      if (this.unavailable || !this.snapshot) throw Error("offline");
      this.editing = true;
      this.ghost = null;
      this.original = null;
      this.palette();
    } catch (error) {
      if (error.status >= 400 && error.status < 500) {
        this.clearPending();
        if (error.details?.account) g.materials.accept(error.details.account);
      }
      g.toast(g.text("communityOffline"));
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  palette() {
    const root = byId("home-palette");
    root.replaceChildren();
    const g = this.game,
      a = g.materials.account;
    for (const [kind, d] of Object.entries(this.catalog.definitions)) {
      const button = document.createElement("button");
      button.type = "button";
      const cost = Object.entries(d.cost)
        .map(([id, n]) => `${g.text(g.catalog.items[id]?.name || id)} ×${n}`)
        .join(" · ");
      const known = a.knowledge.includes(d.knowledge),
        affordable = Object.entries(d.cost).every(
          ([id, n]) => (a.inventory[id] || 0) >= n,
        );
      const icon = g.renderer.sprites.icon(d.variants[0].sprite);
      if (icon) button.append(icon);
      const label = document.createElement("small");
      label.textContent = g.text(d.label);
      button.append(label);
      const detail = document.createElement("small");
      detail.textContent = known ? cost : g.text("communityLearn");
      button.append(detail);
      button.title = `${g.text(d.label)} — ${known ? cost : g.text("communityLearn")}`;
      button.setAttribute("aria-label", button.title);
      button.disabled = !known || !affordable;
      button.onclick = () => {
        this.original = null;
        this.ghost = {
          kind,
          variant: d.variants[0].id,
          rotation: 0,
          x: 0,
          y: 0,
        };
        const [x, y, w, h] = this.catalog.zones[this.zone].editable;
        this.position({ x: (x + w / 2) * TILE, y: (y + h / 2) * TILE });
      };
      root.append(button);
    }
  }
  tap(point) {
    if (!this.editing) return false;
    if (this.ghost) this.position(point);
    return true;
  }
  position(point) {
    if (this.pending) return;
    const x = Math.round((point.x / TILE) * 2) / 2,
      y = Math.round((point.y / TILE) * 2) / 2;
    if (
      this.ghost.x === x &&
      this.ghost.y === y &&
      this.lastRotation === this.ghost.rotation &&
      this.lastKind === this.ghost.kind
    )
      return;
    Object.assign(this.ghost, { x, y });
    this.lastRotation = this.ghost.rotation;
    this.lastKind = this.ghost.kind;
    const items = this.snapshot.objects.filter(
      (o) => o.id !== this.original?.id,
    );
    this.invalid = validateConstruction(
      [...items, this.ghost],
      this.zone,
      this.catalog,
    );
    this.paint();
  }
  rotate() {
    if (!this.ghost || this.pending || this.busy) return;
    const options = this.catalog.definitions[this.ghost.kind].rotations;
    this.ghost.rotation =
      options[(options.indexOf(this.ghost.rotation) + 1) % options.length];
    this.position({ x: this.ghost.x * TILE, y: this.ghost.y * TILE });
  }
  variant() {
    if (!this.ghost || this.original || this.pending || this.busy) return;
    const variants = this.catalog.definitions[this.ghost.kind].variants;
    this.ghost.variant =
      variants[
        (variants.findIndex((v) => v.id === this.ghost.variant) + 1) %
          variants.length
      ].id;
    this.paint();
  }
  cancel() {
    if (this.busy) return;
    this.editing = false;
    this.ghost = this.original = null;
    this.invalid = null;
    this.paint();
  }
  async commit(operation) {
    if (
      this.busy ||
      !this.ghost ||
      !this.snapshot ||
      (this.invalid && operation !== "remove")
    )
      return;
    const g = this.game;
    // After the guards: a rejected commit is not a milestone.
    g.telemetry?.milestone("build");
    g.telemetry?.act("build");
    this.busy = true;
    this.paint();
    try {
      const object = Object.fromEntries(
        ["id", "kind", "variant", "x", "y", "rotation", "revision"]
          .filter((k) => this.ghost[k] !== undefined)
          .map((k) => [k, this.ghost[k]]),
      );
      const request = {
        operationId: operationId(),
        baseRevision: g.materials.account.revision,
        zone: this.zone,
        zoneRevision: this.snapshot.revision,
        operation: operation || (this.original ? "move" : "place"),
        object,
      };
      // Retain an exact request across transport failures, avoiding a second debit on retry.
      this.pending ||= { owner: g.materials.owner, request };
      localStorage.setItem(
        "magikitos.adventure.build-pending",
        JSON.stringify(this.pending),
      );
      const result = await g.api.request(
        "community-build",
        this.pending.request,
        { auth: true },
      );
      this.clearPending();
      this.accept(result);
      g.materials.accept(result.account);
      g.materials.reconcile();
      this.editing = false;
      this.ghost = this.original = null;
      await this.refreshWorld();
      g.dirty = true;
      g.updateUI();
      g.save();
      g.audio.effect("found");
    } catch (error) {
      if (error.status >= 400 && error.status < 500) {
        this.clearPending();
        if (error.details?.account) g.materials.accept(error.details.account);
        await this.prepare(g.catalog.scenes[g.state.scene]);
        await this.refreshWorld();
      }
      g.toast(
        g.text(
          error.code === "heritage_protected"
            ? "communityHeritage"
            : "communityRetry",
        ),
      );
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  clearPending() {
    this.pending = null;
    localStorage.removeItem("magikitos.adventure.build-pending");
  }
  async refreshWorld() {
    const g = this.game,
      { World } = require("./model");
    g.world = new World(this.sceneData(g.catalog.scenes[g.state.scene]));
    g.world.actors = [g.player, ...g.neighbors];
    g.world.refresh(g.state);
    g.renderer.world = g.world;
    for (const actor of [g.player, ...g.neighbors])
      if (!g.world.canStand(actor.x, actor.y, actor)) {
        let p;
        for (let r = 8; r <= 192 && !p; r += 8)
          for (let i = 0; i < 16 && !p; i++) {
            const x = actor.x + Math.cos((i * Math.PI) / 8) * r,
              y = actor.y + Math.sin((i * Math.PI) / 8) * r;
            if (g.world.canStand(x, y, actor)) p = { x, y };
          }
        if (p) Object.assign(actor, p);
      }
    g.cats.enter();
    this.activities.reset();
  }
  draw(ctx) {
    if (!this.editing || !this.ghost) return;
    const g = this.game,
      d = this.catalog.definitions[this.ghost.kind],
      b = bounds(this.ghost, d);
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawArtwork(
      ctx,
      g.renderer.sprites,
      { x: this.ghost.x * TILE, y: this.ghost.y * TILE, scale: d.scale || 1 },
      this.sprite(this.ghost),
    );
    ctx.globalAlpha = 1;
    ctx.strokeStyle = this.invalid ? "#eab291" : "#e0ecc3";
    ctx.fillStyle = this.invalid
      ? "rgba(131,57,40,.25)"
      : "rgba(152,193,111,.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash(this.invalid ? [3, 2] : []);
    ctx.fillRect(b.x * TILE, b.y * TILE, b.w * TILE, b.h * TILE);
    ctx.strokeRect(b.x * TILE, b.y * TILE, b.w * TILE, b.h * TILE);
    ctx.restore();
  }
  paint() {
    const g = this.game;
    if (!g.state) return;
    byId("home-controls").hidden =
      !this.zone ||
      this.editing ||
      g.river?.active ||
      g.dialogue ||
      g.hasOverlay() ||
      g.transitioning;
    byId("home-editor").hidden = !this.editing;
    byId("home-save").disabled = this.busy || !this.ghost || !!this.invalid;
    byId("home-remove").hidden = !this.original;
    byId("home-remove").disabled = this.busy;
    byId("home-variant").disabled =
      this.busy || !!this.pending || !this.ghost || !!this.original;
    byId("community-rotate").disabled =
      this.busy ||
      !!this.pending ||
      !this.ghost ||
      this.catalog.definitions[this.ghost.kind].rotations.length < 2;
    byId("home-cancel").disabled = this.busy;
    const reasons = {
      outside_zone: "communityOutside",
      protected_access: "communityAccess",
      objects_overlap: "communityOverlap",
      blocked_terrain: "communityTerrain",
      blocked_access: "communityAccess",
    };
    byId("community-reason").textContent = this.ghost
      ? g.text(
          this.invalid
            ? reasons[this.invalid] || "communityInvalid"
            : "communityValid",
        )
      : g.text("communityChoose");
  }
}
module.exports = { Community };
