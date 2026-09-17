"use strict";
const { TILE } = require("./geometry");
const {
  shapes,
  objectCost,
  polylineLength,
  validateConstruction,
  POLYLINE_MAX_POINTS,
  POLYLINE_MAX_LENGTH,
} = require("./construction-layout");
const { drawArtwork } = require("./entity-art");
const { operationId } = require("./material-account");
const fences = require("./fences");
const byId = (id) => document.getElementById(id);

/**
 * CONSTRUIR JUNTOS: una sola zona compartida, un solo sitio donde dejar algo.
 *
 * Solo el fantasma es especulativo; los cuerpos colocados vienen siempre de instantáneas que el
 * servidor ha confirmado. Ni descuentos optimistas ni sucesos inventados.
 *
 * ⛔ LA PANTALLA SE REHIZO EL 17-sep-2026 («la UI para esto debe ser potente y fácil de entender,
 * y en ningún orden en especial», dueño). Lo que cambia y por qué:
 *
 *  · **Lo que llevas se ve SIEMPRE**, arriba del todo. Antes había que deducirlo de qué botones
 *    estaban apagados, que es hacer un acertijo de un inventario.
 *  · **Ningún botón muerto.** Una pieza que todavía no te puedes permitir se elige igual, y el
 *    renglón dice QUÉ te falta. Un botón apagado no explica nada: solo se resiste.
 *  · **Las variantes son fotos**, una fila de baldosas, no un botón «Variante» que hay que pulsar
 *    tres veces para ver qué hay dentro.
 *  · **Dos acciones y punto**: Girar y Colocar (más Quitar cuando estás tocando algo tuyo). «Al
 *    saco» decía a dónde iba la pieza, no lo que hacía el botón.
 *  · **El claro se pinta** mientras construyes, así que dónde SE PUEDE es algo que se ve, no algo
 *    que se descubre a base de intentos.
 *  · **La cámara va al claro** al abrir, con el mismo viaje suave que cuando tocas el mapa.
 *  · **La pieza nueva aparece donde estaba la anterior**, que es donde estás mirando.
 */
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
    const ground = (e) => {
      const r = canvas.getBoundingClientRect(),
        g = this.game;
      return {
        x: g.camera.x + ((e.clientX - r.left) / r.width) * g.renderer.width,
        y: g.camera.y + ((e.clientY - r.top) / r.height) * g.renderer.height,
      };
    };
    canvas.addEventListener("pointermove", (e) => {
      if (
        !this.editing ||
        !this.ghost ||
        this.busy ||
        this.stroke ||
        this.drawing ||
        e.pointerType === "touch"
      )
        return;
      this.position(ground(e));
    });
    /**
     * ⛔ UNA VALLITA SE DIBUJA ARRASTRANDO EL DEDO, y por eso estos tres van en CAPTURA.
     *
     * El módulo de entrada escucha en el canvas en burbuja para andar y para mover el mapa, así
     * que un trazo se leería como un paseo o como un arrastre de cámara. Capturando primero y
     * parando la propagación, mientras se dibuja el mundo no se entera de nada, y en cuanto se
     * suelta todo vuelve a ser de quien era.
     */
    for (const [type, handle] of [
      [
        "pointerdown",
        (e) => {
          this.stroke = [ground(e)];
          canvas.setPointerCapture?.(e.pointerId);
        },
      ],
      ["pointermove", (e) => this.stroke && this.stroke.push(ground(e))],
      [
        "pointerup",
        (e) => {
          const raw = this.stroke;
          this.stroke = null;
          if (raw) this.trace(raw, ground(e));
        },
      ],
      ["pointercancel", () => (this.stroke = null)],
    ])
      canvas.addEventListener(
        type,
        (e) => {
          if (!this.drawing || this.busy) return;
          if (type !== "pointerdown" && !this.stroke) return;
          e.preventDefault();
          e.stopPropagation();
          handle(e);
        },
        true,
      );
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
  /** Se está dibujando un trazado: hay fantasma y su tipo es una polilínea. */
  get drawing() {
    return Boolean(
      this.editing &&
        this.ghost &&
        this.catalog.definitions[this.ghost.kind].shape === "polyline",
    );
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
  /**
   * De un objeto guardado a una entidad del mundo. Un trazado sale como la MISMA valla que dibuja
   * el Estudio (`fence: { points }`), así que el motor la pinta, la parte en postes y travesaños
   * y la hace sólida sin una sola línea nueva: es el mismo dato en los dos sitios.
   */
  entity(item) {
    const d = this.catalog.definitions[item.kind];
    const base = {
      id: `community-${item.id}`,
      community: item.id,
      x: item.x,
      y: item.y,
      rules: [],
      pushable: false,
      onInteract: () => this.inspect(item),
      capabilities: d.capabilities,
      lightRadius: d.lightRadius,
      slots: d.slots,
    };
    if (d.shape === "polyline")
      return {
        ...base,
        sprite: d.sprite,
        family: d.family,
        fence: { points: item.points },
      };
    const [sx, sy, sw, sh] = (() => {
      const b = require("./construction-layout").bounds(
        { ...item, x: 0, y: 0 },
        d,
      );
      return [b.x, b.y, b.w, b.h];
    })();
    return {
      ...base,
      sprite: this.sprite(item),
      scale: d.scale || 1,
      ...(d.solid === false ? {} : { solid: [sx, sy, sw, sh] }),
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
      this.ghost = { ...item, points: item.points && item.points.map((p) => [...p]) };
      this.palette();
      this.revalidate();
      this.paint();
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
      // La cámara se va al claro con el mismo viaje suave que cuando tocas el mapa: construir
      // empieza por VER dónde se puede.
      const [zx, zy, zw, zh] = this.catalog.zones[this.zone].editable;
      g.focusPoint = { x: (zx + zw / 2) * TILE, y: (zy + zh / 2) * TILE };
      g.cameraFollowing = true;
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
  /** Una baldosa con la foto de lo que vas a poner. Las vallas se dibujan solas, así que su
   *  baldosa la pinta el mismo código que pinta la valla: lo que ves es lo que sale. */
  tile(definition, variant) {
    const g = this.game;
    if (definition.shape === "polyline") {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 84;
      canvas.style.width = "48px";
      canvas.style.height = "42px";
      canvas.setAttribute("aria-hidden", "true");
      const c = canvas.getContext("2d");
      c.scale(2, 2);
      c.translate(5, 36);
      for (const part of fences.parts({
        x: 0,
        y: 0,
        fence: { points: [[0, 0], [2.3, 0]] },
      }))
        fences.drawPart(c, part);
      return canvas;
    }
    return g.renderer.sprites.icon(variant?.sprite || definition.sprite);
  }
  /** Lo que llevas encima de lo que aquí se gasta. Siempre, no solo cuando falta. */
  materials() {
    const g = this.game,
      root = byId("community-materials");
    root.replaceChildren();
    const used = new Set();
    for (const d of Object.values(this.catalog.definitions))
      for (const id of Object.keys(d.cost || d.costPerTile || {}))
        used.add(id);
    for (const id of used) {
      const item = document.createElement("span");
      const icon = g.renderer.sprites.icon(g.catalog.items[id]?.sprite);
      if (icon) item.append(icon);
      const n = document.createElement("strong");
      n.textContent = String(g.materials.account.inventory[id] || 0);
      item.append(n);
      item.title = g.text(g.catalog.items[id]?.name || id);
      root.append(item);
    }
  }
  palette() {
    const g = this.game,
      root = byId("home-palette");
    root.replaceChildren();
    this.materials();
    byId("community-zone").textContent = g.text(
      this.catalog.zones[this.zone].label,
    );
    for (const [kind, d] of Object.entries(this.catalog.definitions)) {
      const button = document.createElement("button");
      button.type = "button";
      const icon = this.tile(d, d.variants[0]);
      if (icon) button.append(icon);
      const label = document.createElement("small");
      label.textContent = g.text(d.label);
      button.append(label);
      const detail = document.createElement("small");
      detail.textContent = this.costLabel(d);
      button.append(detail);
      button.title = `${g.text(d.label)} — ${detail.textContent}`;
      button.setAttribute("aria-label", button.title);
      // ⛔ NUNCA APAGADO. El coste es la puerta, pero una baldosa apagada no dice cuál es la
      // llave: se elige igual y el renglón de abajo dice qué falta.
      button.setAttribute(
        "aria-pressed",
        String(this.ghost?.kind === kind && !this.original),
      );
      button.classList.toggle(
        "is-chosen",
        this.ghost?.kind === kind && !this.original,
      );
      button.onclick = () => this.select(kind);
      root.append(button);
    }
    this.variants();
  }
  /** «Palito ×4», o «Palito ×2 por celda» cuando se cobra por lo que mide. */
  costLabel(definition, object) {
    const g = this.game;
    const say = (cost) =>
      Object.entries(cost)
        .map(([id, n]) => `${g.text(g.catalog.items[id]?.name || id)} ×${n}`)
        .join(" · ");
    if (definition.shape !== "polyline") return say(definition.cost);
    if (object) return say(objectCost(object, definition));
    return `${say(definition.costPerTile)} ${g.text("communityPerTile")}`;
  }
  /** Las variantes, como fotos. Solo aparecen cuando de verdad hay entre qué elegir. */
  variants() {
    const root = byId("home-variants");
    root.replaceChildren();
    const d = this.ghost && this.catalog.definitions[this.ghost.kind];
    const options = d?.variants || [];
    root.hidden = !this.ghost || this.original || options.length < 2;
    if (root.hidden) return;
    for (const v of options) {
      const button = document.createElement("button");
      button.type = "button";
      const icon = this.tile(d, v);
      if (icon) button.append(icon);
      button.setAttribute("aria-pressed", String(this.ghost.variant === v.id));
      button.classList.toggle("is-chosen", this.ghost.variant === v.id);
      button.onclick = () => {
        this.ghost.variant = v.id;
        this.variants();
        this.paint();
      };
      root.append(button);
    }
  }
  /** La pieza nueva nace donde estaba la anterior, que es donde estás mirando. */
  select(kind) {
    const d = this.catalog.definitions[kind];
    const [zx, zy, zw, zh] = this.catalog.zones[this.zone].editable;
    const where = this.lastPlace || {
      x: Math.round(zx + zw / 2),
      y: Math.round(zy + zh / 2),
    };
    this.original = null;
    this.ghost = {
      kind,
      variant: d.variants[0].id,
      rotation: d.rotations[0],
      x: where.x,
      y: where.y,
      ...(d.shape === "polyline"
        ? { points: [[0, 0], [3, 0]] }
        : {}),
    };
    this.revalidate();
    this.palette();
    this.paint();
  }
  tap(point) {
    if (!this.editing) return false;
    if (this.ghost) this.position(point);
    return true;
  }
  position(point) {
    if (this.pending || !this.ghost) return;
    const x = Math.round((point.x / TILE) * 2) / 2,
      y = Math.round((point.y / TILE) * 2) / 2;
    if (this.ghost.x === x && this.ghost.y === y) return;
    Object.assign(this.ghost, { x, y });
    this.lastPlace = { x, y };
    this.revalidate();
    this.paint();
  }
  /**
   * De lo que ha trazado el dedo a los vértices que se guardan.
   *
   * Se muestrea a un tile, se recorta a lo que la vallita puede medir y se simplifica por
   * distancia perpendicular hasta que quepa en los vértices permitidos: lo que la persona hace es
   * arrastrar, y lo que se guarda es el MISMO dato que escribe el Estudio. Un toque seco no
   * dibuja nada y se trata como mover la valla entera, que es lo que parece que hace.
   */
  trace(raw, end) {
    if (!this.drawing || this.pending) return;
    const snap = (v) => Math.round(v * 2) / 2;
    const sampled = [];
    for (const p of [...raw, end]) {
      const q = [snap(p.x / TILE), snap(p.y / TILE)];
      const last = sampled.at(-1);
      if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) >= 1)
        sampled.push(q);
    }
    if (sampled.length < 2) {
      this.position(end);
      return;
    }
    while (polylineLength(sampled) > POLYLINE_MAX_LENGTH && sampled.length > 2)
      sampled.pop();
    let points = sampled;
    for (
      let tolerance = 0.5;
      points.length > POLYLINE_MAX_POINTS && tolerance <= 8;
      tolerance *= 1.6
    )
      points = simplifyPath(sampled, tolerance);
    points = points.slice(0, POLYLINE_MAX_POINTS);
    const [ox, oy] = points[0];
    this.ghost.x = ox;
    this.ghost.y = oy;
    this.ghost.points = points.map((p) => [p[0] - ox, p[1] - oy]);
    this.lastPlace = { x: ox, y: oy };
    this.revalidate();
    this.paint();
  }
  revalidate() {
    if (!this.ghost || !this.snapshot) return;
    const items = this.snapshot.objects.filter(
      (o) => o.id !== this.original?.id,
    );
    this.invalid = validateConstruction(
      [...items, this.ghost],
      this.zone,
      this.catalog,
    );
    this.cost = this.invalid
      ? null
      : objectCost(this.ghost, this.catalog.definitions[this.ghost.kind]);
  }
  /** Lo que te falta para esta pieza, o null si te llega. Mover lo tuyo no cuesta nada. */
  missing() {
    if (!this.ghost || this.original) return null;
    const inventory = this.game.materials.account.inventory,
      cost = objectCost(this.ghost, this.catalog.definitions[this.ghost.kind]);
    const short = Object.entries(cost)
      .map(([id, n]) => [id, n - (inventory[id] || 0)])
      .filter(([, n]) => n > 0);
    return short.length ? short : null;
  }
  rotate() {
    if (!this.ghost || this.pending || this.busy) return;
    const options = this.catalog.definitions[this.ghost.kind].rotations;
    this.ghost.rotation =
      options[(options.indexOf(this.ghost.rotation) + 1) % options.length];
    this.revalidate();
    this.paint();
  }
  cancel() {
    if (this.busy) return;
    this.editing = false;
    this.ghost = this.original = null;
    this.invalid = null;
    this.stroke = null;
    this.game.focusPoint = null;
    this.paint();
  }
  async commit(operation) {
    if (
      this.busy ||
      !this.ghost ||
      !this.snapshot ||
      (this.invalid && operation !== "remove") ||
      (operation !== "remove" && this.missing())
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
        ["id", "kind", "variant", "x", "y", "rotation", "points", "revision"]
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
      this.ghost = this.original = null;
      this.invalid = null;
      await this.refreshWorld();
      g.dirty = true;
      g.updateUI();
      g.save();
      g.audio.effect("found");
      // Se sigue dentro: colocar una cosa casi nunca es colocar una sola.
      if (this.editing) this.palette();
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
    if (!this.editing) return;
    const g = this.game;
    // ⛔ EL CLARO SE VE. Dónde se puede construir era algo que se descubría a base de intentos
    // rechazados; ahora es una alfombra en el suelo con su borde.
    const [zx, zy, zw, zh] = this.catalog.zones[this.zone].editable;
    ctx.save();
    ctx.fillStyle = "rgba(224,236,195,.16)";
    ctx.strokeStyle = "rgba(224,236,195,.55)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.fillRect(zx * TILE, zy * TILE, zw * TILE, zh * TILE);
    ctx.strokeRect(zx * TILE, zy * TILE, zw * TILE, zh * TILE);
    ctx.setLineDash([]);
    for (const r of this.catalog.zones[this.zone].protected) {
      ctx.fillStyle = "rgba(131,57,40,.18)";
      ctx.fillRect(r[0] * TILE, r[1] * TILE, r[2] * TILE, r[3] * TILE);
    }
    ctx.restore();
    if (!this.ghost) return;
    const d = this.catalog.definitions[this.ghost.kind];
    ctx.save();
    ctx.globalAlpha = 0.6;
    if (d.shape === "polyline")
      for (const part of fences.parts({
        x: this.ghost.x * TILE,
        y: this.ghost.y * TILE,
        fence: { points: this.ghost.points },
      }))
        fences.drawPart(ctx, part);
    else
      drawArtwork(
        ctx,
        g.renderer.sprites,
        {
          x: this.ghost.x * TILE,
          y: this.ghost.y * TILE,
          scale: d.scale || 1,
        },
        this.sprite(this.ghost),
      );
    ctx.globalAlpha = 1;
    ctx.strokeStyle = this.invalid ? "#eab291" : "#e0ecc3";
    ctx.fillStyle = this.invalid
      ? "rgba(131,57,40,.25)"
      : "rgba(152,193,111,.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash(this.invalid ? [3, 2] : []);
    for (const b of shapes(this.ghost, d)) {
      ctx.fillRect(b.x * TILE, b.y * TILE, b.w * TILE, b.h * TILE);
      ctx.strokeRect(b.x * TILE, b.y * TILE, b.w * TILE, b.h * TILE);
    }
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
    if (!this.editing) return;
    const d = this.ghost && this.catalog.definitions[this.ghost.kind];
    const short = this.missing();
    byId("home-save").disabled =
      this.busy || !this.ghost || !!this.invalid || !!short;
    byId("home-remove").hidden = !this.original;
    byId("home-remove").disabled = this.busy;
    byId("community-rotate").hidden = !d || d.rotations.length < 2;
    byId("community-rotate").disabled = this.busy || !!this.pending;
    byId("home-cancel").disabled = this.busy;
    this.materials();
    const reasons = {
      outside_zone: "communityOutside",
      protected_access: "communityAccess",
      objects_overlap: "communityOverlap",
      blocked_terrain: "communityTerrain",
      blocked_access: "communityAccess",
      too_long: "communityTooLong",
      invalid_points: "communityDraw",
    };
    const say = byId("community-reason");
    if (!this.ghost) say.textContent = g.text("communityChoose");
    else if (short)
      say.textContent = `${g.text("communityMissing")} ${short
        .map(
          ([id, n]) =>
            `${g.text(g.catalog.items[id]?.name || id)} ×${n}`,
        )
        .join(" · ")}`;
    else if (this.invalid)
      say.textContent = g.text(reasons[this.invalid] || "communityInvalid");
    else
      say.textContent = `${g.text("communityValid")}${
        d.shape === "polyline" ? ` · ${this.costLabel(d, this.ghost)}` : ""
      }`;
    byId("community-hint").hidden = !d || d.shape !== "polyline";
  }
}
/** Simplificación por distancia perpendicular (Douglas-Peucker). */
function simplifyPath(points, tolerance) {
  if (points.length <= 2) return points;
  const a = points[0],
    b = points.at(-1);
  let index = 0,
    worst = 0;
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    span = Math.hypot(dx, dy);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const d = span
      ? Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / span
      : Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= tolerance) return [a, b];
  return [
    ...simplifyPath(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplifyPath(points.slice(index), tolerance),
  ];
}
module.exports = { Community };
