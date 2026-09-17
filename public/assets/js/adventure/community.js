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
const { catalogGround } = require("./construction-ground");
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
/**
 * Por qué no se ha podido, en una sola tabla: lo que dice el juicio del cliente y lo que contesta
 * el servidor no se pisan, y tenerlos separados era garantizar que uno de los dos se quedaba sin
 * la frase el día que apareciera un motivo nuevo.
 */
const RAZONES = {
  outside_zone: "communityOutside",
  protected_access: "communityProtected",
  objects_overlap: "communityOverlap",
  blocked_terrain: "communityTerrain",
  blocked_access: "communityAccess",
  too_long: "communityTooLong",
  invalid_points: "communityDraw",
  wrong_surface: "communityTerrain",
  zone_full: "communityZoneFull",
  author_limit: "communityAuthorLimit",
  kind_limit: "communityKindLimit",
  materials_required: "communityNoMaterials",
  heritage_protected: "communityHeritage",
  foreign_edit_protected: "communityForeign",
  too_many: "communityTooFast",
  too_close: "communityTooClose",
  tool_required: "communityToolRequired",
};
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
     * ⛔ UNA VALLITA SE DIBUJA DEJANDO PULSADO Y ARRASTRANDO, y ese medio segundo de más no es
     * ceremonia: es lo único que salva el gesto de mover el mapa.
     *
     * El primer intento tomaba cualquier arrastre, y con la vallita elegida el mapa dejaba de
     * poder moverse — se vio a la primera en la prueba de teléfono, que aparta la cámara para
     * traer un hueco a la vista y se encontró trazando una valla de veintitrés celdas. Mantener
     * pulsado es además el gesto que la casa ya usa para grabar, así que no hay vocabulario
     * nuevo: un arrastre rápido mueve el mapa, un toque coloca la valla donde tocas, y quien
     * aguanta medio segundo se pone a dibujar.
     *
     * Van en CAPTURA porque el módulo de entrada escucha en burbuja: al arrancar el trazo se le
     * cancela el paneo que había empezado y se le esconde todo lo demás.
     */
    const HOLD_MS = 350,
      SLOP = 10;
    const soltarPresion = () => {
      if (this.press) clearTimeout(this.press.timer);
      this.press = null;
    };
    const empezarTrazo = () => {
      const p = this.press;
      soltarPresion();
      this.game.input?.map?.clear();
      canvas.setPointerCapture?.(p.id);
      this.stroke = [p.ground];
    };
    for (const [type, handle] of [
      [
        "pointerdown",
        (e) => {
          soltarPresion();
          this.press = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            ground: ground(e),
            timer: setTimeout(empezarTrazo, HOLD_MS),
          };
          // ⛔ EL `pointerdown` SE DEJA PASAR SIEMPRE. Todavía no se sabe si esto va a ser un
          // trazo, un paseo o un arrastre del mapa, y quedárselo aquí es quitarle al mundo el
          // suceso con el que empieza a panear: la cámara se quedaba clavada con la vallita en
          // la mano. Solo se le esconde lo que viene DESPUÉS, y solo si el trazo arranca.
          return false;
        },
      ],
      [
        "pointermove",
        (e) => {
          if (this.stroke) {
            this.stroke.push(ground(e));
            return true;
          }
          if (
            this.press &&
            Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) >
              SLOP
          )
            soltarPresion();
          return false;
        },
      ],
      [
        "pointerup",
        (e) => {
          soltarPresion();
          const raw = this.stroke;
          this.stroke = null;
          if (!raw) return false;
          this.trace(raw, ground(e));
          return true;
        },
      ],
      [
        "pointercancel",
        () => {
          soltarPresion();
          const drawing = Boolean(this.stroke);
          this.stroke = null;
          return drawing;
        },
      ],
    ])
      canvas.addEventListener(
        type,
        (e) => {
          if (!this.drawing || this.busy) {
            soltarPresion();
            this.stroke = null;
            return;
          }
          // Solo se le esconde el suceso al mundo cuando de verdad estamos trazando: lo demás
          // (mover el mapa, tocar para colocar) sigue siendo suyo.
          if (handle(e) !== false) {
            e.preventDefault();
            e.stopPropagation();
          }
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
  /**
   * ⛔ EL SUELO NO VIAJA DOS VECES. La máscara de dónde se puede estar de pie la hornea el mismo
   * paso que se la manda al servidor, y el navegador podría recibirla hecha… pero ya tiene la
   * pantalla cargada, que es de donde salió. Medido: son 73 KB de unos y ceros contra un mundo de
   * 105 KB, y el mundo va INCRUSTADO en la página y en los seis idiomas, o sea un 70% más de HTML
   * en cada carga para decir algo que el cliente sabe calcular. Se calcula una vez por pantalla y
   * se guarda; que las dos coincidan lo comprueba una prueba, no la buena fe.
   */
  ground() {
    const scene = this.catalog.zones[this.zone]?.scene;
    if (!scene) return null;
    this.grounds ||= new Map();
    if (!this.grounds.has(scene))
      this.grounds.set(scene, catalogGround(this.game.catalog, scene));
    return this.grounds.get(scene);
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
      value.objects.length >
        (this.catalog.zones[value.zone].maxObjects ??
          this.catalog.maxObjectsPerZone)
    )
      throw Error("invalid_community");
    for (const o of value.objects)
      if (
        !/^[a-f0-9]{32}$/.test(o.id) ||
        !this.catalog.definitions[o.kind] ||
        ![o.x, o.y, o.rotation, o.revision].every(Number.isFinite)
      )
        throw Error("invalid_community_object");
    // Si lo pintado cambia, las baldosas de esa pantalla ya no valen. Se compara la firma en vez
    // de tirarlas siempre: repintar un claro entero en cada entrada se nota.
    const firma = JSON.stringify(
      value.objects
        .filter((o) => this.catalog.definitions[o.kind].paint === "path")
        .map((o) => this.absolutePoints(o)),
    );
    this.painted ||= new Map();
    if (this.painted.get(value.zone) !== firma) {
      this.painted.set(value.zone, firma);
      this.game.renderer?.terrain?.invalidate(
        this.catalog.zones[value.zone].scene,
      );
    }
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
  /** Los puntos de un trazado en coordenadas del escenario, que es como los escribe el Estudio. */
  absolutePoints(item) {
    return item.points.map((p) => [item.x + p[0], item.y + p[1]]);
  }
  entity(item) {
    const d = this.catalog.definitions[item.kind];
    // Un caminito no se levanta: se pinta en el suelo con el mismo pincel que los del Estudio,
    // así que no tiene entidad ninguna. Lo recoge `sceneData` en su propia lista.
    if (d.paint === "path") return null;
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
    const objects = this.snapshots.get(zone)?.objects || [];
    return {
      ...data,
      entities: [
        ...data.entities,
        ...objects.map((o) => this.entity(o)).filter(Boolean),
      ],
      // ⛔ EN SU PROPIA LISTA, NO EN `paths`. La del escenario alimenta `pathDistance()`, y de ahí
      // salen la vegetación colocada por procedimiento y la máscara de terreno que el servidor
      // tiene bakeada: un caminito de alguien movería árboles y desharía esa máscara. Aquí solo
      // se pinta.
      communityPaths: objects
        .filter((o) => this.catalog.definitions[o.kind].paint === "path")
        .map((o) => this.absolutePoints(o)),
    };
  }
  sceneChanged() {
    this.activities.reset();
    this.cancel();
    this.paint();
  }
  /**
   * ⛔ AQUÍ SE ANUNCIABA EL RINCÓN AL LLEGAR, y con el bosque entero construible ese aviso pasó a
   * ser el nombre de la pantalla dicho dos veces: el motor ya lo canta al viajar. Una zona ya no
   * es un sitio al que se llega, es el suelo que pisas.
   */
  arrive() {}
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
      this.ghost = {
        ...item,
        points: item.points && item.points.map((p) => [...p]),
      };
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
        /**
         * ⛔ Y AQUÍ NO VALE UN AVISO FLOTANTE. Construir pide una partida conectada; si no la
         * hay, lo honesto es abrir la puerta que falta y decir por qué, no soltar una frase que
         * se va sola. Se distinguen los dos motivos porque la salida es distinta: sin sesión, la
         * puerta es la cuenta; con sesión y sin poder hablar con el bosque, no hay puerta que
         * abrir y lo único honesto es decir que se ha perdido la conexión.
         */
        if (!g.session.get()) g.self.explain("communityNeedsAccount");
        else g.toast(g.text("communitySyncNeeded"));
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
      // ⛔ AQUÍ LA CÁMARA VIAJABA AL CLARO, y ahora el claro es el bosque entero: llevarte a
      // ninguna parte sería quitarte de donde has decidido construir.
      this.palette();
    } catch (error) {
      if (error.status >= 400 && error.status < 500) {
        this.clearPending();
        if (error.details?.account) g.materials.accept(error.details.account);
      }
      if (!g.session.get()) g.self.explain("communityNeedsAccount");
      else g.toast(g.text("communityOffline"));
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  /** Una baldosa con la foto de lo que vas a poner. Las vallas se dibujan solas, así que su
   *  baldosa la pinta el mismo código que pinta la valla: lo que ves es lo que sale. */
  tile(definition, variant) {
    const g = this.game;
    if (definition.paint === "path") {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 84;
      canvas.style.width = "48px";
      canvas.style.height = "42px";
      canvas.setAttribute("aria-hidden", "true");
      const c = canvas.getContext("2d");
      c.fillStyle = "#6a8a4f";
      c.fillRect(0, 0, 96, 84);
      drawPathTrace(
        c,
        [
          [6, 74],
          [40, 44],
          [90, 26],
        ],
        1,
      );
      return canvas;
    }
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
        fence: {
          points: [
            [0, 0],
            [2.3, 0],
          ],
        },
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
      for (const id of Object.keys({
        ...(d.cost || {}),
        ...(d.costPerTile || {}),
        // Las semillas se gastan al sembrar hierba sobre un camino, así que cuentan como
        // material aunque su pieza no se ponga: si no, lo único que se gasta aquí sería lo
        // único que no se ve.
        ...(d.removeCost || {}),
      }))
        used.add(id);
    for (const id of used) {
      const item = document.createElement("span");
      const icon = g.renderer.sprites.icon(g.catalog.items[id]?.sprite);
      // ⛔ `icon()` escribe el tamaño del sprite EN LÍNEA, y un estilo en línea le gana a
      // cualquier clase: el cuenco de los gatos entraba aquí a su tamaño real y se comía la
      // cabecera. Se le quita la medida y manda la hoja, que es la que sabe que esta fila son
      // dieciocho píxeles y todos iguales.
      if (icon) {
        icon.style.width = icon.style.height = "";
        item.append(icon);
      }
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
    // El sitio lo dice la pantalla, no la zona: es el mismo nombre que el mundo anuncia al
    // llegar, así que construyes en un sitio con nombre y no en «la zona editable».
    byId("community-zone").textContent = g.text(
      g.world.data.label ||
        g.world.region(g.player.x / TILE, g.player.y / TILE),
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
    const tool = Object.keys(definition.requires?.items || {})
      .map((id) => g.text(g.catalog.items[id]?.name || id))
      .join(" · ");
    if (definition.shape !== "polyline") return say(definition.cost) || tool;
    const price = object
      ? say(objectCost(object, definition))
      : Object.keys(definition.costPerTile).length
        ? `${say(definition.costPerTile)} ${g.text("communityPerTile")}`
        : "";
    // Cavar cuesta trabajo y no material: lo que hay que tener es la herramienta, y eso es lo
    // que dice la baldosa en vez de un precio de cero que no significa nada.
    return price || tool;
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
    const g = this.game,
      d = this.catalog.definitions[kind];
    // Donde estabas poniendo cosas, y si es la primera, a tus pies: con la pantalla entera
    // construible, el centro del mapa casi nunca es donde estás mirando.
    const where = this.lastPlace || {
      x: Math.round((g.player.x / TILE) * 2) / 2,
      y: Math.round((g.player.y / TILE) * 2) / 2,
    };
    this.original = null;
    this.ghost = {
      // La pieza que estás colocando es la CANDIDATA, y las reglas que juzgan un permiso —lo
      // prohibido, no calcar un trazo— solo la miran a ella. Sin un nombre no habría a quién
      // mirar, y el id de verdad lo pone el servidor al guardarla.
      id: "nueva",
      kind,
      variant: d.variants[0].id,
      rotation: d.rotations[0],
      x: where.x,
      y: where.y,
      // Dos celdas: es el trazo más corto que la casa permite y cuesta exactamente lo que
      // costaba la vallita de antes, así que estrenar el trazado no encarece la primera valla
      // de nadie. Desde ahí se arrastra para hacerla tan larga como se quiera pagar.
      ...(d.shape === "polyline"
        ? {
            points: [
              [0, 0],
              [2, 0],
            ],
          }
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
      this.ground(),
      this.ghost.id,
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
  /**
   * La herramienta que te falta, o null. Una pala no se gasta y por eso no es un coste: es un
   * requisito, y se dice aparte para que el renglón no mienta diciendo que te faltan palas.
   */
  tool() {
    const d = this.ghost && this.catalog.definitions[this.ghost.kind];
    if (!d || this.original) return null;
    const inventory = this.game.materials.account.inventory;
    for (const [id, n] of Object.entries(d.requires?.items || {}))
      if ((inventory[id] || 0) < n) return id;
    return null;
  }
  /** Lo que cuesta quitar esto: sembrar hierba sobre un camino. Lo demás se recoge y no cuesta. */
  removeShort() {
    const d = this.original && this.catalog.definitions[this.original.kind];
    if (!d?.removeCost) return null;
    const inventory = this.game.materials.account.inventory;
    const short = Object.entries(d.removeCost)
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
          .filter((k) => k !== "id" || this.original)
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
      /**
       * ⛔ TODO MOTIVO QUE LA PERSONA VE TIENE SU FRASE. El único que estaba contado era el
       * patrimonio; el resto —un claro lleno, tu propio tope, algo que puso otra persona, ir
       * demasiado deprisa— caía en «algo ha cambiado, revisa el lugar», que no es lo que ha
       * pasado y encima manda a mirar donde no hay nada que mirar. El genérico se queda para lo
       * que de verdad es fontanería, que es cuando sí conviene reintentar.
       */
      g.toast(g.text(RAZONES[error.code] || "communityRetry"));
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
    // Un caminito nuevo es PINTURA, y el suelo se cachea por baldosas de escena: sin tirar las de
    // esta pantalla, el camino recién puesto no aparece hasta que la caché rota por su cuenta.
    g.renderer?.terrain?.invalidate(g.state.scene);
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
    /**
     * ⛔ SE PINTA LO PROHIBIDO, NO LO PERMITIDO. Antes el claro era una alfombra con su borde
     * porque construir fuera de él era imposible; ahora se construye en todo el bosque y pintar
     * lo permitido sería pintar la pantalla entera de verde. Lo que hace falta ver son los cuatro
     * sitios donde no se puede dejar nada: el merendero de los humanos, la barbacoa, los felpudos
     * de las casas y lo que cada vecino tiene alrededor.
     */
    ctx.save();
    ctx.fillStyle = "rgba(131,57,40,.16)";
    ctx.strokeStyle = "rgba(180,96,70,.45)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const r of this.catalog.zones[this.zone].protected) {
      ctx.fillRect(r[0] * TILE, r[1] * TILE, r[2] * TILE, r[3] * TILE);
      ctx.strokeRect(r[0] * TILE, r[1] * TILE, r[2] * TILE, r[3] * TILE);
    }
    ctx.restore();
    if (!this.ghost) return;
    const d = this.catalog.definitions[this.ghost.kind];
    ctx.save();
    ctx.globalAlpha = 0.6;
    if (d.paint === "path")
      drawPathTrace(
        ctx,
        this.absolutePoints(this.ghost).map((p) => [p[0] * TILE, p[1] * TILE]),
        0.9,
      );
    else if (d.shape === "polyline")
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
    const short = this.missing(),
      tool = this.tool(),
      removeShort = this.removeShort();
    byId("home-save").disabled =
      this.busy || !this.ghost || !!this.invalid || !!short || !!tool;
    byId("home-remove").hidden = !this.original;
    byId("home-remove").disabled = this.busy || !!removeShort;
    // Quitar un camino es SEMBRAR HIERBA, así que el botón lo dice: una pieza que se recoge y un
    // camino que se tapa no son el mismo gesto aunque compartan el mismo botón.
    if (this.original)
      byId("home-remove").textContent = g.text(
        this.catalog.definitions[this.original.kind].removeLabel ||
          "communityRemove",
      );
    byId("community-rotate").hidden = !d || d.rotations.length < 2;
    byId("community-rotate").disabled = this.busy || !!this.pending;
    byId("home-cancel").disabled = this.busy;
    this.materials();
    const say = byId("community-reason");
    if (!this.ghost) say.textContent = g.text("communityChoose");
    else if (tool)
      say.textContent = `${g.text("communityToolRequired")} ${g.text(
        g.catalog.items[tool]?.name || tool,
      )}`;
    else if (removeShort)
      say.textContent = `${g.text("communityMissing")} ${removeShort
        .map(([id, n]) => `${g.text(g.catalog.items[id]?.name || id)} ×${n}`)
        .join(" · ")}`;
    else if (short)
      say.textContent = `${g.text("communityMissing")} ${short
        .map(([id, n]) => `${g.text(g.catalog.items[id]?.name || id)} ×${n}`)
        .join(" · ")}`;
    else if (this.invalid)
      say.textContent = g.text(RAZONES[this.invalid] || "communityInvalid");
    else
      say.textContent = `${g.text("communityValid")}${
        d.shape === "polyline" ? ` · ${this.costLabel(d, this.ghost)}` : ""
      }`;
    byId("community-hint").hidden = !d || d.shape !== "polyline";
  }
}
/**
 * El trazo de tierra del fantasma, con los mismos tres ocres que el pincel del suelo
 * (`ground.js`): lo que se ve al colocarlo es lo que va a quedar pintado.
 */
function drawPathTrace(c, points, alpha) {
  if (points.length < 2) return;
  c.save();
  c.globalAlpha = alpha;
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const [width, color] of [
    [20, "#b2a16b"],
    [14, "#c3af7b"],
    [7, "#cebb88"],
  ]) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(points[0][0], points[0][1]);
    for (const p of points.slice(1)) c.lineTo(p[0], p[1]);
    c.stroke();
  }
  c.restore();
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
module.exports = { Community, RAZONES };
