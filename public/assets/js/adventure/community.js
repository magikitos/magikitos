"use strict";
const { fitIcon } = require("./sprites");
const { TILE } = require("./geometry");
const {
  shapes,
  objectCost,
  polylineReason,
  validateConstruction,
  POLYLINE_MIN_SEGMENT,
  POLYLINE_HALF,
} = require("./construction-layout");
const { drawArtwork } = require("./entity-art");
const { operationId } = require("./material-account");
const { catalogGround } = require("./construction-ground");
const { growthDeadline } = require("./construction-growth");
const { sendConstruction } = require("./construction-request");
const { CommunitySync } = require("./community-sync");
const { applyCommunityLayer } = require("./community-layer");
const fences = require("./fences");
const byId = (id) => document.getElementById(id);
/**
 * Lo que el imán de los trazados alcanza, en celdas. Ver `snap()`: es el hueco más grande por el
 * que un duende TODAVÍA no pasa, así que cerrarlo no le quita a nadie una puerta que sirviera.
 */
const MAGNET = 1;
/** Lo que dura el destello de «ahí no», en milisegundos. */
const REJECT_MS = 320;

/**
 * CONSTRUIR: el bosque entero es de todos, y esto es la puerta para dejar algo en él.
 *
 * Solo el fantasma es especulativo; los cuerpos colocados vienen siempre de instantáneas que el
 * servidor ha confirmado. Ni descuentos optimistas ni sucesos inventados.
 *
 * ⛔ LA PANTALLA SE REHIZO EL 18-sep-2026 (decisión del dueño: «pincho un objeto y todo es un
 * poco confuso… necesito que sea mucho más fluida, intuitiva y cómoda»). Lo que cambia y por qué:
 *
 *  · **Se entra por un icono de la barra de arriba**, junto al saco, igual en teléfono que en
 *    escritorio. Un botón suelto abajo a la izquierda era la única puerta del juego que no estaba
 *    donde están las demás, y en un teléfono caía justo donde vive el pulgar que mueve el mapa.
 *  · **El catálogo es una modal de la casa**, la misma que el saco y que «Yo»: mismo caparazón,
 *    misma rejilla (`.world-pick-grid`) y pantalla completa en el teléfono. Son la misma clase de
 *    pantalla —una cuadrícula de cosas entre las que eliges— y tenerlas con dos diseños distintos
 *    hacía que el juego pareciera dos juegos.
 *  · **Una baldosa por COSA, variantes incluidas.** Antes había que elegir la familia y luego el
 *    color en una segunda fila; ahora las diecisiete están a la vista y se elige de un toque, que
 *    es lo que ya se hacía con el elenco de duendes.
 *  · **Elegir CIERRA el catálogo.** Era el fallo de fondo: con el panel abierto ocupando media
 *    pantalla, «tócalo donde quieras» significaba tocar el panel. Ahora la pieza se te queda en la
 *    mano, el mapa entero es tuyo y abajo solo queda una barra fina.
 *  · **Se pone y se CONFIRMA.** Mueves la pieza hasta que te gusta y entonces pulsas Colocar; el
 *    renglón de la barra dice por qué no cabe cuando no cabe, así que no hay intentos a ciegas.
 *  · **Lo colocado se queda.** No se puede mover ni quitar lo que ya está — ni lo tuyo (decisión
 *    del dueño, 18-sep-2026: «lo que se pone se queda»). Tocar algo puesto cuenta quién lo dejó.
 *    ⛔ El servidor SIGUE sabiendo mover y quitar, y los datos conservan su `removeCost`/
 *    `removeLabel` (sembrar hierba sobre un caminito): el día que vuelva la retirada comunitaria
 *    es una pantalla, no una migración.
 *  · **Se pinta lo prohibido** mientras tienes algo en la mano, así que dónde NO se puede es algo
 *    que se ve, no algo que se descubre a base de intentos.
 *  · **La pieza se queda en la mano al colocar**, que poner una flor casi nunca es poner una sola.
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
    this.sync = new CommunitySync(this);
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
    byId("build-toggle").onclick = () => this.begin();
    byId("home-save").onclick = () => this.commit();
    byId("home-cancel").onclick = () => this.cancel();
    byId("community-rotate").onclick = () => this.rotate();
    byId("build-undo").onclick = () => this.undo();
    // Cerrar el catálogo sin elegir nada no deja a nadie con una barra vacía en la mano.
    byId("build-dialog").addEventListener("close", () => {
      if (!this.ghost) this.cancel();
    });
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
    /**
     * ⛔ ARRASTRAR MUEVE EL MAPA. SIEMPRE. Aquí vivió una máquina de dejar-pulsado-y-arrastrar
     * para trazar vallas, con su umbral de 350 ms, su holgura de diez píxeles, su captura de
     * puntero y sus cuatro escuchas en fase de captura peleándose con el módulo de entrada. Y el
     * cartel que la explicaba era mentira (18-sep-2026, el dueño: «eso lo que hace es mover el
     * mapa, y está bien que eso mueva el mapa»): con la valla en la mano, la mitad de los
     * arrastres acababan siendo un trazo que nadie había pedido.
     *
     * Lo único que escucha esto ahora es el movimiento del RATÓN, y solo para apuntar: el previo
     * sigue al cursor hasta que lo clavas. El dedo no tiene «encima» que valga, así que en un
     * teléfono el primer toque es el que apunta, por el mismo camino y sin una rama propia.
     */
    canvas.addEventListener("pointermove", (e) => {
      if (!this.editing || !this.ghost || this.busy || e.pointerType === "touch")
        return;
      this.aim(ground(e));
    });
    canvas.addEventListener("pointerleave", () => {
      if (!this.hover) return;
      this.hover = null;
      this.magnet = null;
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
    const identity = this.game.session.get();
    try {
      const snapshot = await this.game.api.request(
        "community",
        { zone },
        { auth: true, timeout: 3000 },
      );
      if (identity === this.game.session.get()) this.accept(snapshot);
    } catch (_) {
      if (identity === this.game.session.get()) this.unavailable = true;
    }
  }
  validate(value) {
    if (
      !value ||
      typeof value.zone !== "string" ||
      !Object.hasOwn(this.catalog.zones, value.zone) ||
      !Number.isSafeInteger(value.now) || value.now <= 0 ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      !Array.isArray(value.objects) ||
      value.objects.length >
        (this.catalog.zones[value.zone].maxObjects ??
          this.catalog.maxObjectsPerZone)
    )
      throw Error("invalid_community");
    const ids = new Set();
    for (const o of value.objects) {
      if (
        !o || typeof o !== "object" || Array.isArray(o) ||
        typeof o.id !== "string" || !/^[a-f0-9]{32}$/.test(o.id) ||
        ids.has(o.id) || typeof o.kind !== "string" || !Object.hasOwn(this.catalog.definitions, o.kind) ||
        ![o.x, o.y].every(Number.isFinite) ||
        !Number.isSafeInteger(o.revision) || o.revision < 1
      )
        throw Error("invalid_community_object");
      ids.add(o.id);
      const definition = this.catalog.definitions[o.kind];
      if (!definition.rotations.includes(o.rotation) || !definition.variants.some(v => v.id === o.variant) ||
          (definition.shape === "polyline" && polylineReason(o.points)))
        throw Error("invalid_community_object");
      growthDeadline(o, definition);
    }
  }
  accept(value) {
    this.validate(value);
    // HTTP responses can arrive out of order (own mutation, scene prewarm, live notice).
    // Never let an older snapshot resurrect a dismantled object or rewind a moved fence.
    if (value.revision < (this.snapshots.get(value.zone)?.revision ?? -1)) return false;
    this.game.serverClock.sync(value.now);
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
    return true;
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
      communityVersion: JSON.stringify([item.kind, item.variant, item.x, item.y, item.rotation, item.points, item.createdAt]),
      x: item.x,
      y: item.y,
      rules: [],
      pushable: false,
      onInteract: () => {
        const current = this.snapshot?.objects.find(o => o.id === item.id);
        if (current) this.inspect(current);
      },
      capabilities: d.capabilities,
      lightRadius: d.lightRadius,
      slots: d.slots,
      growsAt: growthDeadline(item, d),
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
    // ⛔ LO QUE SE PONE SE QUEDA (18-sep-2026, decisión del dueño). Tocar algo puesto —tuyo o de
    // otra persona— cuenta qué es y quién lo dejó, y nada más: no abre el editor ni lo levanta del
    // suelo. Que lo tuyo se pudiera coger otra vez convertía el bosque en un borrador, y una cosa
    // que cualquiera puede deshacer no es un sitio al que volver.
    this.game.openDialogue([
      `${this.game.text(this.catalog.definitions[item.kind].label)} · ${item.author?.name || item.author?.handle || this.game.text("communityEveryone")}`,
    ]);
  }
  async begin() {
    const g = this.game;
    if (g.live && !g.live.canWrite()) return;
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
        // ⛔ Y CON SESIÓN PERO SIN LA PARTIDA GUARDADA EN LA CUENTA, TAMBIÉN SE ABRE LA PUERTA
        // (19-sep-2026, el dueño: «no simplemente decirle "tienes que guardar tu cuenta", sino
        // mostrar el modal de Yo»). El aviso flotante decía «sincroniza» y se iba solo; el panel
        // tiene el botón que lo hace, y la línea de arriba dice cuál.
        g.self.explain(g.session.get() ? "communitySyncNeeded" : "communityNeedsAccount");
        return;
      }
      if (this.pending) {
        if (this.pending.owner !== g.materials.owner)
          throw Error("pending_identity");
        const result = await this.sendPending();
        this.accept(result);
        g.materials.accept(result.account);
        g.materials.reconcile();
        this.clearPending();
        await this.refreshWorld();
      }
      await this.prepare(g.catalog.scenes[g.state.scene]);
      if (this.unavailable || !this.snapshot) throw Error("offline");
      // ⛔ AQUÍ LA CÁMARA VIAJABA AL CLARO, y ahora el claro es el bosque entero: llevarte a
      // ninguna parte sería quitarte de donde has decidido construir.
      this.palette();
      const dialog = byId("build-dialog");
      if (!dialog.open) dialog.showModal();
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
    // ⛔ SOLO LO QUE LLEVAS, Y CON SU NOMBRE (19-sep-2026, el dueño: «un diseño un poco cutre»).
    // La fila enseñaba las siete bolsitas de semillas iguales a cero una detrás de otra: siete
    // dibujos idénticos que no decían nada. Lo que se lleva se dice con nombre y número; lo que
    // no se lleva lo dice cada baldosa en su precio, en rojo, que es donde se decide.
    const carried = [...used].filter((id) => (g.materials.account.inventory[id] || 0) > 0);
    if (!carried.length) {
      const empty = document.createElement("p");
      empty.textContent = g.text("communityNoMaterialsYet");
      root.append(empty);
      return;
    }
    for (const id of carried) {
      const item = document.createElement("span");
      const icon = g.renderer.sprites.icon(g.catalog.items[id]?.sprite);
      // ⛔ `icon()` escribe el tamaño del sprite EN LÍNEA, y un estilo en línea le gana a
      // cualquier clase: el cuenco de los gatos entraba aquí a su tamaño real y se comía la
      // cabecera. Se le quita la medida y manda la hoja, que es la que sabe que esta fila son
      // veinte píxeles y todos iguales.
      if (icon) {
        icon.style.width = icon.style.height = "";
        item.append(icon);
      }
      const name = document.createElement("span");
      name.textContent = g.text(g.catalog.items[id]?.name || id);
      item.append(name);
      const n = document.createElement("strong");
      n.textContent = "×" + (g.materials.account.inventory[id] || 0);
      item.append(n);
      root.append(item);
    }
  }
  /** Lo que te falta de una pieza suelta antes de tenerla en la mano: coste fijo y herramienta. */
  shortFor(definition) {
    const inventory = this.game.materials.account.inventory;
    for (const [id, n] of Object.entries(definition.cost || {}))
      if ((inventory[id] || 0) < n) return true;
    for (const [id, n] of Object.entries(definition.requires?.items || {}))
      if ((inventory[id] || 0) < n) return true;
    return false;
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
    for (const [kind, d] of Object.entries(this.catalog.definitions))
      for (const variant of d.variants) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "world-pick";
        // La foto en una caja del mismo tamaño para todas las baldosas (`fitIcon`): la valla se
        // dibuja a 96 y una maceta mide treinta; sin la caja, la rejilla bailaba.
        const box = document.createElement("span");
        box.className = "world-pick-icon";
        const icon = this.tile(d, variant);
        if (icon) box.append(fitIcon(icon, 56, 3));
        button.append(box);
        const label = document.createElement("small");
        label.className = "world-pick-name";
        label.textContent = g.text(d.label);
        button.append(label);
        // ⛔ Y EL NOMBRE DE LA VARIANTE CUANDO HAY MÁS DE UNA. Con las diecisiete a la vista, dos
        // baldosas que se llaman igual y cuestan lo mismo —el mismo banco dos veces— se leen como
        // un fallo: lo que las distingue es el dibujo, y el dibujo no se puede decir en voz alta.
        // El castellano del Estudio no vale aquí, que esto lo leen seis idiomas.
        if (d.variants.length > 1 && variant.label) {
          const which = document.createElement("small");
          which.className = "world-pick-variant";
          which.textContent = g.text(variant.label);
          button.append(which);
        }
        const detail = document.createElement("small");
        detail.className = "world-pick-cost";
        detail.textContent = this.costLabel(d);
        // Lo que no te llega, en el mismo rojo que la barra de colocar; la baldosa sigue viva.
        detail.classList.toggle("is-short", d.shape !== "polyline" && this.shortFor(d));
        button.append(detail);
        button.title =
          `${g.text(d.label)}${d.variants.length > 1 && variant.label ? " · " + g.text(variant.label) : ""} — ${detail.textContent}`;
        button.setAttribute("aria-label", button.title);
        // ⛔ NUNCA APAGADA. El coste es la puerta, pero una baldosa apagada no dice cuál es la
        // llave: se elige igual y la barra de abajo dice qué falta.
        const chosen = this.ghost?.kind === kind && this.ghost?.variant === variant.id;
        button.setAttribute("aria-pressed", String(chosen));
        button.onclick = () => this.select(kind, variant.id);
        root.append(button);
      }
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
  /**
   * Elegir una cosa: se CIERRA el catálogo y la pieza se te queda EN LA MANO, sin sitio todavía.
   *
   * ⛔ Cerrar no es cosmética, es el arreglo. Con el panel abierto ocupando media pantalla,
   * «tócalo donde quieras» significaba tocar el panel: se elegía la piscina, aparecía su
   * rectángulo y al pinchar no se movía a ninguna parte. Aquí el mapa vuelve a ser tuyo entero y
   * lo único que queda delante es la barra de abajo.
   *
   * ⛔ Y NO SE COLOCA POR DEFECTO (18-sep-2026, decisión del dueño). Nacía a los pies de quien la
   * elegía, así que la primera vez que la veías ya estaba puesta en un sitio que no habías
   * elegido tú. Ahora nace sin coordenadas: con el ratón aparece bajo el cursor y lo sigue, y con
   * el dedo aparece donde tocas. Un trazado nace además sin un solo poste.
   */
  select(kind, variant) {
    const d = this.catalog.definitions[kind];
    this.editing = true;
    this.hover = null;
    this.magnet = null;
    this.parked = false;
    this.ghost = {
      // La pieza que estás colocando es la CANDIDATA, y las reglas que juzgan un permiso —lo
      // prohibido, no calcar un trazo— solo la miran a ella. Sin un nombre no habría a quién
      // mirar, y el id de verdad lo pone el servidor al guardarla.
      id: "nueva",
      kind,
      variant: d.variants.some((v) => v.id === variant) ? variant : d.variants[0].id,
      rotation: d.rotations[0],
      x: null,
      y: null,
      ...(d.shape === "polyline" ? { points: [] } : {}),
    };
    this.invalid = null;
    byId("build-dialog").close();
    this.paint();
  }
  /** ¿La pieza tiene ya un sitio en el mundo? Un trazado lo tiene desde su primer poste. */
  get placed() {
    return Boolean(this.ghost) && this.ghost.x !== null;
  }
  /**
   * ¿Hay algo que CONFIRMAR? No es lo mismo que tener sitio: con el ratón encima del mapa el
   * previo se pinta bajo el cursor sin que hayas decidido nada, y dar por buena esa posición
   * sería colocar una cosa donde nadie ha pinchado — para siempre, que lo que se pone se queda.
   * Una pieza suelta hace falta clavarla; un trazado, que tenga dos postes.
   */
  get ready() {
    if (!this.placed) return false;
    return this.drawing ? this.ghost.points.length >= 2 : this.parked;
  }
  /**
   * ⛔ EL IMÁN: 1 CELDA, Y EL NÚMERO NO ES A OJO (18-sep-2026, decisión del dueño: «si el clic es
   * cerca de uno existente, se toma como nodo desde ese, sin espacio… ver la distancia bien para
   * poder hacer puertecitas sin que se pegue»).
   *
   * Cierra exactamente los huecos por los que no cabe un duende, y eso sale de la geometría que
   * ya hay: una valla se come `POLYLINE_HALF` a cada lado de su último poste y el duende mide
   * doce píxeles de ancho, así que un hueco de N celdas deja (N − 0,5) celdas de paso. Media
   * celda deja cero, una celda deja ocho píxeles —un duende no pasa—, y celda y media deja
   * dieciséis, que es el primer hueco por el que sí se pasa. Por eso el imán llega hasta UNA
   * celda: todo lo que cierra era un hueco inútil y el primero que te deja conservar es el
   * primero que sirve de puerta.
   *
   * Va en celdas del MUNDO y no en píxeles de pantalla: si fuera en pantalla, el zoom cambiaría
   * qué toques empalman, que es de las cosas que se sienten rotas sin que nadie sepa por qué.
   *
   * Y solo se pega a POSTES, no a cualquier punto de un trazo: la rejilla es de media celda y un
   * punto a mitad de tramo daría coordenadas que el propio validador rechaza (`invalid_points`).
   */
  snap(point) {
    const x = Math.round((point.x / TILE) * 2) / 2,
      y = Math.round((point.y / TILE) * 2) / 2;
    if (!this.drawing) return { x, y, post: null };
    let post = null,
      best = MAGNET;
    for (const p of this.posts()) {
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d > best) continue;
      best = d;
      post = p;
    }
    return post ? { x: post[0], y: post[1], post } : { x, y, post: null };
  }
  /** Los postes a los que este trazo se puede empalmar: los de su especie, y los suyos propios
   *  menos el último, que un tramo de longitud cero no existe. */
  posts() {
    const out = [];
    for (const o of this.snapshot?.objects || [])
      if (o.kind === this.ghost.kind && Array.isArray(o.points))
        out.push(...this.absolutePoints(o));
    if (this.placed)
      for (const p of this.ghost.points.slice(0, -1))
        out.push([this.ghost.x + p[0], this.ghost.y + p[1]]);
    return out;
  }
  /** Apuntar: lo que hace el ratón por encima del mapa. No coloca nada. */
  aim(point) {
    const aimed = this.snap(point);
    this.hover = aimed;
    this.magnet = aimed.post;
    // Una pieza suelta que todavía no has clavado SIGUE al cursor; un trazado enseña el tramo
    // que vendría, y para eso le basta con saber dónde está el dedo.
    if (!this.drawing && !this.parked) {
      this.ghost.x = aimed.x;
      this.ghost.y = aimed.y;
      this.revalidate();
    }
    this.paint();
  }
  tap(point) {
    if (!this.editing) return false;
    if (!this.ghost || this.busy) return true;
    const aimed = this.snap(point);
    this.hover = aimed;
    this.magnet = aimed.post;
    if (this.drawing) this.plant(aimed);
    else {
      this.ghost.x = aimed.x;
      this.ghost.y = aimed.y;
      this.parked = true;
      this.revalidate();
      if (this.invalid) this.reject();
    }
    this.paint();
    return true;
  }
  /**
   * Clavar un poste. Los trazados se hacen a toques, y cada toque es un poste: arrastrar sigue
   * siendo mover el mapa, así que los dos gestos no pueden pisarse.
   */
  plant(aimed) {
    if (this.pending) return;
    if (!this.placed) {
      this.ghost.x = aimed.x;
      this.ghost.y = aimed.y;
      this.ghost.points = [[0, 0]];
      return;
    }
    const last = this.ghost.points.at(-1),
      dx = aimed.x - this.ghost.x - last[0],
      dy = aimed.y - this.ghost.y - last[1];
    // Un toque casi encima del último poste es un dedo tembloroso, no un tramo: el validador lo
    // llamaría `invalid_points` y te dejaría con un trazo que no se puede ni guardar ni entender.
    if (Math.hypot(dx, dy) < POLYLINE_MIN_SEGMENT) return this.reject();
    const grown = [...this.ghost.points, [last[0] + dx, last[1] + dy]];
    // Lo estructural —cuántos postes caben y cuánto puede medir— se mira ANTES de añadirlo: un
    // poste que el trazo no puede llevar no enseña nada puesto, solo deja un lío que deshacer.
    if (polylineReason(grown)) return this.reject();
    this.ghost.points = grown;
    this.revalidate();
    if (this.invalid) this.reject();
  }
  /** Quitar el último poste. Con uno solo, el trazo vuelve a no tener sitio. */
  undo() {
    if (!this.drawing || !this.placed || this.busy || this.pending) return;
    const points = this.ghost.points.slice(0, -1);
    if (!points.length) {
      this.ghost.x = null;
      this.ghost.y = null;
      this.ghost.points = [];
      this.invalid = null;
    } else {
      this.ghost.points = points;
      this.revalidate();
    }
    this.paint();
  }
  /** Ahí no. Sin una palabra: la pieza destella en rojo y ya. */
  reject() {
    this.flash = performance.now();
  }

  revalidate() {
    if (!this.ghost || !this.snapshot) return;
    this.invalid = validateConstruction(
      [...this.snapshot.objects, this.ghost],
      this.zone,
      this.catalog,
      this.ground(),
      this.ghost.id,
      this.game.live?.objects.bounds() || [],
    );
    this.cost = this.invalid
      ? null
      : objectCost(this.ghost, this.catalog.definitions[this.ghost.kind]);
  }
  /** Lo que te falta para esta pieza, o null si te llega. */
  missing() {
    if (!this.ghost) return null;
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
    if (!d) return null;
    const inventory = this.game.materials.account.inventory;
    for (const [id, n] of Object.entries(d.requires?.items || {}))
      if ((inventory[id] || 0) < n) return id;
    return null;
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
    this.ghost = null;
    this.invalid = null;
    this.hover = null;
    this.magnet = null;
    this.parked = false;
    this.game.focusPoint = null;
    const dialog = byId("build-dialog");
    if (dialog.open) dialog.close();
    this.paint();
  }
  /** ⛔ Solo COLOCAR. Mover y quitar siguen existiendo en el servidor y en los datos, pero no
   *  tienen puerta: lo que se pone se queda (18-sep-2026, decisión del dueño). */
  async commit() {
    if (this.game.live && !this.game.live.canWrite()) return;
    if (this.busy || !this.ready || !this.snapshot || this.invalid || this.missing()) return;
    const g = this.game;
    // After the guards: a rejected commit is not a milestone.
    g.telemetry?.milestone("build");
    g.telemetry?.act("build");
    this.busy = true;
    this.paint();
    try {
      const object = Object.fromEntries(
        ["kind", "variant", "x", "y", "rotation", "points"]
          .filter((k) => this.ghost[k] !== undefined)
          .map((k) => [k, this.ghost[k]]),
      );
      const request = {
        operationId: operationId(),
        baseRevision: g.materials.account.revision,
        zone: this.zone,
        zoneRevision: this.snapshot.revision,
        operation: "place",
        object,
      };
      // Retain an exact request across transport failures, avoiding a second debit on retry.
      this.pending ||= { owner: g.materials.owner, request };
      const result = await this.sendPending();
      this.clearPending();
      this.accept(result);
      g.materials.accept(result.account);
      g.materials.reconcile();
      await this.refreshWorld();
      g.dirty = true;
      g.updateUI();
      g.save();
      g.audio.effect("found");
      // ⛔ LA PIEZA SE QUEDA EN LA MANO, PERO SIN SITIO: poner una flor casi nunca es poner una
      // sola, y volver al catálogo entre flor y flor son dos toques de más. Antes se quedaba
      // donde estaba y salía roja ella sola, porque lo que tenía debajo era lo que acababas de
      // poner. Ahora vuelve a estar por apuntar, igual que al elegirla.
      this.ghost = { ...this.ghost, x: null, y: null, ...(this.drawing ? { points: [] } : {}) };
      this.parked = false;
      this.invalid = null;
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
  sendPending() {
    const g = this.game, owner = this.pending.owner;
    const guard = () => {
      if (owner !== g.materials.owner) throw Error("pending_identity");
    };
    return sendConstruction(this.pending.request, {
      send: async (request) => {
        guard();
        const result = await g.api.request("community-build", request, { auth: true });
        guard();
        return result;
      },
      latest: async (zone) => {
        guard();
        const snapshot = await g.api.request("community", { zone }, { auth: true });
        guard();
        this.accept(snapshot);
        return snapshot;
      },
      remember: (request) => {
        guard();
        this.pending = { owner, request };
        localStorage.setItem("magikitos.adventure.build-pending", JSON.stringify(this.pending));
      },
    });
  }
  clearPending() {
    this.pending = null;
    localStorage.removeItem("magikitos.adventure.build-pending");
  }
  refreshWorld() {
    const g = this.game;
    applyCommunityLayer(g, this.sceneData(g.catalog.scenes[g.state.scene]));
    this.applied = { world: g.world, snapshot: this.snapshot };
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
    // El poste al que el imán va a pegarse, encendido ANTES de que sueltes: empalmar no puede ser
    // una sorpresa que descubres cuando ya está hecho.
    if (this.magnet) {
      ctx.save();
      ctx.strokeStyle = "#f0d48a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.magnet[0] * TILE, this.magnet[1] * TILE, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (this.drawing) this.drawTrace(ctx, d);
    else if (this.placed) this.drawPiece(ctx, d);
  }
  /** Cuánto queda del destello de «ahí no», de 1 a 0. */
  get rejected() {
    if (!this.flash) return 0;
    const left = 1 - (performance.now() - this.flash) / REJECT_MS;
    if (left <= 0) this.flash = 0;
    return Math.max(0, left);
  }
  /** El relleno y el borde de la huella: verde si cabe, y rojo de verdad mientras destella. */
  outline(ctx, boxes) {
    const flash = this.rejected;
    ctx.strokeStyle = flash ? "#ff8b6a" : this.invalid ? "#eab291" : "#e0ecc3";
    ctx.fillStyle = flash
      ? "rgba(190,48,32," + (0.2 + 0.4 * flash).toFixed(2) + ")"
      : this.invalid
        ? "rgba(131,57,40,.25)"
        : "rgba(152,193,111,.25)";
    ctx.lineWidth = flash ? 2 : 1;
    ctx.setLineDash(this.invalid && !flash ? [3, 2] : []);
    for (const b of boxes) {
      ctx.fillRect(b.x * TILE, b.y * TILE, b.w * TILE, b.h * TILE);
      ctx.strokeRect(b.x * TILE, b.y * TILE, b.w * TILE, b.h * TILE);
    }
  }
  drawPiece(ctx, d) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawArtwork(
      ctx,
      this.game.renderer.sprites,
      { x: this.ghost.x * TILE, y: this.ghost.y * TILE, scale: d.scale || 1 },
      this.sprite(this.ghost),
    );
    ctx.globalAlpha = 1;
    this.outline(ctx, shapes(this.ghost, d));
    ctx.restore();
  }
  /**
   * Un trazado a medio clavar: lo puesto va entero y el tramo que VENDRÍA va tenue, porque
   * todavía no es tuyo. Cada poste lleva su punto para que se vea dónde sigue la cosa.
   */
  drawTrace(ctx, d) {
    const puesto = this.placed ? this.absolutePoints(this.ghost) : [];
    const siguiente =
      this.hover && puesto.length
        ? [this.hover.x, this.hover.y]
        : null;
    ctx.save();
    if (puesto.length > 1) {
      ctx.globalAlpha = 0.6;
      this.paintTrace(ctx, d, puesto);
      ctx.globalAlpha = 1;
      this.outline(ctx, shapes(this.ghost, d));
    }
    if (siguiente) {
      ctx.globalAlpha = 0.28;
      this.paintTrace(ctx, d, [puesto.at(-1), siguiente]);
      ctx.globalAlpha = 1;
    }
    // Y si aún no hay ni un poste, lo que se enseña es dónde caería el primero.
    ctx.fillStyle = this.rejected ? "#ff8b6a" : "#f6efcf";
    ctx.strokeStyle = "#3d5233";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (const p of puesto.length ? puesto : this.hover ? [[this.hover.x, this.hover.y]] : []) {
      ctx.beginPath();
      ctx.arc(p[0] * TILE, p[1] * TILE, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  /** El dibujo de un trazado, con el pincel que le toque: tierra o postes y travesaños. */
  paintTrace(ctx, d, points) {
    if (d.paint === "path")
      return drawPathTrace(
        ctx,
        points.map((p) => [p[0] * TILE, p[1] * TILE]),
        0.9,
      );
    const [ox, oy] = points[0];
    for (const part of fences.parts({
      x: ox * TILE,
      y: oy * TILE,
      fence: { points: points.map((p) => [p[0] - ox, p[1] - oy]) },
    }))
      fences.drawPart(ctx, part);
  }
  /**
   * ⛔ ESTO CORRE EN CADA FOTOGRAMA (lo llama el bucle del juego), así que lo único que se
   * reconstruye es lo que ha cambiado: el dibujo de la pieza cuesta un canvas y se rehace solo
   * cuando cambias de pieza. Lo demás son asignaciones que el navegador descarta solas si valen
   * lo mismo.
   *
   * ⛔ Y NO HAY RENGLÓN DE MOTIVO (18-sep-2026, decisión del dueño: «si no deja, pues que salga
   * algo de feedback visual rojo y ya, sin texto»). Que ahí no cabe lo dice la pieza poniéndose
   * roja, que es donde estás mirando; lo que la barra dice es lo que CUESTA, y en rojo cuando no
   * te llega, que es la única pregunta que el mapa no puede contestar solo.
   */
  paint() {
    const g = this.game;
    if (!g.state) return;
    // El icono de construir vive con el saco y se retira por lo mismo que el resto del mando.
    byId("build-toggle").hidden =
      !this.zone ||
      g.live?.spectator ||
      g.river?.active ||
      g.dialogue ||
      g.hasOverlay() ||
      g.transitioning;
    byId("build-bar").hidden = !this.editing;
    if (!this.editing) return;
    const d = this.ghost && this.catalog.definitions[this.ghost.kind];
    const short = this.missing(),
      tool = this.tool();
    byId("home-save").disabled =
      this.busy || !this.ready || !!this.invalid || !!short || !!tool;
    byId("community-rotate").hidden = !d || d.rotations.length < 2;
    byId("community-rotate").disabled = this.busy || !!this.pending;
    byId("build-undo").hidden = !this.drawing || !this.placed;
    byId("build-undo").disabled = this.busy || !!this.pending;
    byId("home-cancel").disabled = this.busy;
    // Qué llevas en la mano, con su foto: la barra no dice «una pieza», dice CUÁL.
    // ⛔ Y SE LLAMA `shownPiece` Y NO `painted`: `painted` ya era la firma de los caminitos
    // pintados en el suelo, un Map que `accept()` consulta con `.get()`. Llamando igual a las dos
    // cosas, la primera pieza que entraba en la mano convertía el Map en una cadena y la
    // siguiente instantánea del servidor reventaba con un «no es una función» que salía por la
    // pantalla como «algo ha cambiado, revisa el lugar». Un colocado perfecto pareciendo un
    // rechazo del bosque.
    const firma = d ? this.ghost.kind + "/" + this.ghost.variant : "";
    if (firma !== this.shownPiece) {
      this.shownPiece = firma;
      const piece = byId("build-piece");
      piece.replaceChildren();
      if (d) {
        const icon = this.tile(d, d.variants.find((v) => v.id === this.ghost.variant));
        if (icon) piece.append(icon);
      }
    }
    const price = byId("build-price");
    price.textContent = d ? this.costLabel(d, this.ghost) : "";
    price.classList.toggle("is-short", Boolean(short || tool));
    // El cartel que enseña el gesto invisible, y solo hasta que clavas el primero: a partir de
    // ahí la cosa se explica sola, que ya se ve crecer.
    byId("community-hint").hidden = !this.drawing || this.placed;
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
module.exports = { Community, RAZONES };
