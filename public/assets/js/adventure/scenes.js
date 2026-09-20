"use strict";
const { World, TILE, insideThreshold } = require("./model");
const { frameName } = require("./elements");
const { createNeighbors } = require("./neighbors");
const { canFloat } = require("./river-navigation");
const { SpriteBudgetError } = require("./sprite-residency");
const { playerPack } = require("./player-art");
const { definition: vesselDefinition } = require("./vessel-art");
const { clampCamera } = require("./camera");
const { layoutScenes, seamsOf, frameOf, scenesIntersecting } = require("./world-layout");
/** Cuántas vecinas se tienen calientes a la vez. Ver `prewarm`: precargar es un favor, no una
 * excusa para reservar el bosque entero en memoria. Cuatro y no tres desde el mundo continuo:
 * en una esquina del plano la cámara puede enseñar tres pantallas a la vez además de la tuya. */
const WARM_SCENES = 4;
/** Cuánto margen alrededor de la vista cuenta como «a punto de verse» para la precarga, en píxeles de mundo. */
const VIEW_MARGIN = 192;
/**
 * ⛔ QUÉ HOJAS DEL PROTAGONISTA HACEN FALTA AQUÍ SE DECIDE UNA VEZ.
 *
 * Lo pregunta quien entra a una pantalla y quien se cambia de duende sin salir de ella, y las dos
 * respuestas tienen que ser la misma lista: con dos copias, cambiarse de cara dejaría fijado un
 * juego de hojas y sin fijar otro, y el duende nuevo se sentaría a hacer sus cosas con la pose de
 * andar. El actor se pasa aparte para poder preguntar también por el duende ANTERIOR, que es lo
 * que permite soltar sus hojas en vez de acumularlas.
 */
function playerPacks(game, world, state, actor = game.player) {
  return [
    playerPack("run", actor),
    playerPack("discover", actor),
    playerPack("needs", actor),
    // Involuntary actions must be ready before a cat or a movable is touched.
    ...(world.entities.some((e) => e.animal?.species === "cat") ? [playerPack("carried", actor)] : []),
    ...(world.entities.some((e) => e.pushable) ? [playerPack("push", actor)] : []),
    ...(state.navigation?.mode === "boat" ? [playerPack("row", actor)] : []),
    playerPack(null, actor),
  ];
}
/** Prepares destinations and their art before any state is committed. */
class SceneDirector {
  constructor(game) {
    this.game = game;
    this.cache = new Map();
    this.warming = new Map();
    // Lo que ya está caliente y lo que no se pudo calentar. El segundo se olvida al cambiar de
    // pantalla: una escena puede pasar de imposible a posible en cuanto tienes la barca, y sin
    // olvidarlo se quedaría fría para siempre.
    this.warm = new Map();
    this.unreachable = new Set();
    this.nextWarm = 0;
    // El plano del bosque exterior, sacado de las salidas (ver `world-layout.js`), y los
    // residentes de cada pantalla en memoria: los de las vecinas siguen viviendo al otro lado
    // de la costura mientras se les ve.
    this.layout = layoutScenes(game.catalog.scenes, game.catalog.start);
    this.residents = new Map();
    // El plano en píxeles, para pintar el hueco entre pantallas continuando el borde más cercano
    // (`paintVoid`): cada pantalla con su esquina y su tamaño, y la caja de todas.
    const b = this.layout.bounds;
    this.plane = {
      scenes: [...this.layout.offsets].map(([id, o]) => {
        const data = game.catalog.scenes[id];
        return { id, data, x: o.x * TILE, y: o.y * TILE, w: data.width * TILE, h: data.height * TILE };
      }),
      bounds: Number.isFinite(b.x0)
        ? { x: b.x0 * TILE, y: b.y0 * TILE, w: (b.x1 - b.x0) * TILE, h: (b.y1 - b.y0) * TILE }
        : null,
    };
  }
  /**
   * ⛔ ENLAZA LAS PANTALLAS QUE ESTÁN EN MEMORIA POR SUS COSTURAS (mundo continuo). Cada mundo
   * cacheado recibe sus vecinas cacheadas con el desplazamiento del plano, y el marco hasta donde
   * puede mirar la cámara. Se llama cada vez que la caché cambia, así que enlazar es idempotente
   * y nunca deja una costura apuntando a un mundo expulsado.
   */
  link() {
    const scenes = this.game.catalog.scenes;
    for (const [id, world] of this.cache) {
      world.link(
        seamsOf(scenes, this.layout.offsets, id)
          .filter((seam) => this.cache.has(seam.scene))
          .map((seam) => ({ ...seam, world: this.cache.get(seam.scene) })),
      );
      world.frame = frameOf(this.layout, id);
      // Dónde cae esta pantalla en el plano, en píxeles: la hierba se pinta con esa referencia
      // para que su manchado no se parta en la costura (`paintGround`).
      const offset = this.layout.offsets.get(id);
      world.origin = offset ? { x: offset.x * TILE, y: offset.y * TILE } : null;
    }
  }
  /**
   * Las pantallas que tocan esta y POR DÓNDE se va a cada una. Son las dos formas de salir que
   * existen: una puerta (un efecto `travel`) y un borde del mapa (`navigation.exits`). Sale de
   * los datos, así que una pantalla nueva entra en la precarga sin tocar una línea de aquí.
   *
   * La salida más cercana de cada destino es lo que ordena la precarga: el bosque tiene ocho
   * puertas y calentarlas todas sería tener el arte de medio mundo en memoria por si acaso.
   */
  neighbours(data) {
    const ways = new Map();
    const note = (scene, x, y) => {
      if (scene && !ways.has(scene)) ways.set(scene, { id: scene, x, y });
    };
    for (const entity of data.entities || [])
      for (const rule of entity.rules || [])
        for (const effect of rule.effects || [])
          if (effect.type === "travel") note(effect.scene, entity.x, entity.y);
    for (const exit of data.navigation?.exits || [])
      note(
        exit.scene,
        (exit.area[0] + exit.area[2] / 2) * TILE,
        (exit.area[1] + exit.area[3] / 2) * TILE,
      );
    return [...ways.values()];
  }
  /** Los sprites de todas las vecinas calientes a la vez; retainWarm sustituye, no suma. */
  retainWarm() {
    const keep = new Set();
    for (const packs of this.warm.values()) for (const id of packs) keep.add(id);
    this.game.renderer.sprites.retainWarm(keep);
  }
  /**
   * `seam` es para quien llega por una costura del mundo continuo: la instantánea de lo construido
   * en esa pantalla ya se pidió al calentarla, así que no se vuelve a esperar a la red para cruzar
   * —se refresca por detrás—. Esperarla congelaba al duende en el borde lo que tardara la petición,
   * que es justo el corte que el plano quiere borrar. Sin instantánea previa se espera, como siempre.
   */
  async prepare(id, position, state, { seam = false } = {}) {
    const game = this.game;
    if (seam && game.community?.hasSnapshot(id)) game.community.prepare(game.catalog.scenes[id]);
    else await game.community?.prepare(game.catalog.scenes[id]);
    const data =
      game.community?.sceneData(game.catalog.scenes[id]) ||
      game.catalog.scenes[id];
    if (!data) throw new Error("Unknown scene: " + id);
    const shared = Object.values(game.catalog.construction.zones).some(
      (z) => z.scene === id,
    );
    const cached = shared ? null : this.cache.get(id);
    const world = cached && cached !== game.world ? cached : new World(data);
    world.actors = [];
    world.refresh(state);
    game.live?.objects.prepare(world);
    // Los residentes viven en su pantalla aunque no sea la tuya: al otro lado de la costura se
    // les ve pasear y te paran igual, y si ya estaban en memoria SIGUEN donde estaban (20-sep-2026):
    // rehacerlos al cruzar los devolvía de golpe a su sitio de partida, un salto a la vista de
    // quien acaba de verlos pasear desde el otro lado. Al ENTRAR, `enter` les suma el duende.
    const neighbors = this.residents.get(id) || createNeighbors(world, game.config, game.cast);
    world.actors = neighbors;
    this.residents.set(id, neighbors);
    const sprites = new Set(["sack", "setin"]);
    const addStatic = (name) => {
      if (name && !name.startsWith("person-")) sprites.add(name);
    };
    if (data.interior?.background) sprites.add(data.interior.background);
    if (data.interior?.artwork) sprites.add(data.interior.artwork);
    for (const bridge of data.bridges || []) sprites.add(bridge.sprite);
    for (const visitor of data.riverLife || [])
      for (const frame of visitor.frames) sprites.add(frame);
    // Un objeto puede existir sin estampa: la pala se encuentra, se usa y se lee en el saco por su
    // nombre mientras nadie la haya dibujado. Lo que no puede es meter un hueco en la lista de
    // sprites que se piden, que es pedirle al almacén un nombre que no existe.
    for (const item of Object.values(game.catalog.items))
      if (item.sprite) sprites.add(item.sprite);
    // Lo que se puede construir necesita su arte antes de abrir la caja. Lo que se PINTA en el
    // suelo —los caminitos— no tiene sprite ninguno: se dibuja con el mismo pincel que el resto
    // del terreno, así que aquí no pide nada.
    if (shared) sprites.add("poop-message");
    if (shared)
      for (const kind of Object.values(game.catalog.construction.definitions))
        for (const variant of kind.variants) {
          if (variant.sprite) sprites.add(variant.sprite);
          for (const name of Object.values(variant.views || {}))
            sprites.add(name);
        }
    for (const entity of [...world.entities, ...world.props]) {
      for (const attachment of entity.attachments || [])
        sprites.add(attachment.sprite);
      if (entity.seat?.sprite) sprites.add(entity.seat.sprite);
      if (entity.keepsakes?.sprite) sprites.add(entity.keepsakes.sprite);
      if (entity.sprite && entity.sprite !== "doorway")
        addStatic(frameName(entity));
      for (const visual of entity.visuals || []) addStatic(visual.sprite);
      if (typeof entity.portrait === "string") addStatic(entity.portrait);
    }
    // Las frases de la pantalla van con sus sprites, no con el motor: se piden a la vez y la
    // llegada falla entera si falta cualquiera de las dos, que es lo que impide entrar a un
    // sitio donde los carteles dirían el nombre de su clave.
    const resources = await Promise.allSettled([
      game.renderer.sprites.prepare(sprites, [
        ...playerPacks(game, world, state),
        ...(state.navigation?.mode === "boat"
          ? [vesselDefinition.vessels[vesselDefinition.defaultVessel].pack]
          : []),
        ...(data.assetPacks || []),
      ]),
      game.sceneText.load(id),
    ]);
    const failure = resources.find((result) => result.status === "rejected");
    if (failure) {
      if (resources[0].status === "fulfilled") resources[0].value.release?.();
      throw failure.reason;
    }
    const [packs, strings] = resources.map((result) => result.value);
    const valid =
      state.navigation?.mode === "boat"
        ? (x, y) => canFloat(world, x, y)
        : (x, y) => world.canStand(x, y);
    // Se puede proponer más de un punto de llegada y se coge el primero que valga: el río manda
    // el sitio que conserva por dónde ibas y, detrás, el escrito en los datos. El sitio de
    // aparición de la escena cierra la lista y es lo que había antes cuando solo llega uno.
    const offered = Array.isArray(position) ? position : position ? [position] : [];
    const destination = [
      ...offered,
      { x: data.spawn.x * TILE, y: data.spawn.y * TILE },
    ].find((point) => valid(point?.x, point?.y));
    if (!destination) {
      packs.release?.();
      throw new Error("Blocked scene arrival: " + id);
    }
    this.cache.delete(id);
    this.cache.set(id, world);
    // Sitio para la pantalla en la que estás y las que se calientan: con el techo de cuatro que
    // había, un tramo de río se expulsaba a sí mismo y la precarga no servía de nada.
    while (this.cache.size > WARM_SCENES + 2) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
      this.residents.delete(oldest);
    }
    this.link();
    return { id, world, neighbors, position: { ...destination }, packs, strings };
  }
  /**
   * ⛔ CAMBIAR DE DUENDE NO ES CAMBIAR DE PANTALLA: SE FIJAN SUS HOJAS Y YA.
   *
   * Volver a entrar a la pantalla para repintar un cuerpo sería pagar la llegada entera —mundo,
   * vecinos, cámara, gatos— por un cambio de ropa. Aquí solo se sustituyen las hojas del
   * protagonista dentro del juego fijado: entran las del duende nuevo y SALEN las del anterior,
   * que si no, probar cinco caras seguidas dejaría cinco elencos clavados en memoria sin que
   * nada los pudiera expulsar.
   */
  async rewear(previous) {
    const game = this.game,
      sprites = game.renderer.sprites;
    // `previous` puede ser null —nadie había elegido— y entonces se estaba llevando el duende de
    // la casa: `playerPack` lo resuelve igual, así que sus hojas se sueltan como cualquier otra.
    const stale = new Set(
      playerPacks(game, game.world, game.state, { variant: previous }),
    );
    const packs = await sprites.prepare([], playerPacks(game, game.world, game.state));
    sprites.activate(
      new Set([...[...sprites.pinned].filter((id) => !stale.has(id)), ...packs]),
    );
    packs.release?.();
  }
  /**
   * ⛔ TODAS LAS PANTALLAS QUE TOCAN ESTA, SIEMPRE (17-sep-2026, decisión del dueño).
   *
   * Antes solo se calentaba la PUERTA que te pillaba de frente a menos de siete tiles, y solo
   * mientras caminabas: los tramos de río no se calentaban nunca —se cruzan remando y su salida
   * no es una puerta— así que cada recodo del río era una descarga en caliente con el bosque
   * parado. Ahora se calienta cualquier vecina declarada en los datos, de una en una, con el
   * mundo quieto, y el cambio de pantalla se queda en lo que tarda en pintarse.
   *
   * Una a la vez y con su descanso a propósito: precargar es un favor, y un favor que come
   * fotogramas deja de serlo. Lo que ya está caliente no se vuelve a pedir, y lo que no se pudo
   * preparar (una orilla a la que hoy no llegas porque aún no tienes barca) se aparta hasta que
   * cambies de pantalla, en vez de reintentarse cada medio segundo para siempre.
   */
  prewarm(time) {
    const g = this.game;
    if (
      time < this.nextWarm ||
      !g.ready ||
      g.transitioning ||
      g.dialogue ||
      g.blocked() ||
      (typeof navigator !== "undefined" &&
        (navigator.connection?.saveData ||
          /(^|-)2g$/.test(navigator.connection?.effectiveType || "")))
    )
      return;
    this.nextWarm = time + 600;
    /**
     * ⛔ LAS MÁS CERCANAS, Y UN TECHO. Calentar TODO lo que toca es fácil de escribir y caro de
     * usar: el bosque tiene ocho puertas y cada pantalla cuesta megas de textura, así que con
     * todas dentro un teléfono acaba con el arte de medio mundo en memoria por si acaso. Se
     * calientan las WARM_SCENES más próximas por donde se sale hacia ellas, que son justo las
     * que estás a punto de cruzar, y lo demás espera a que te acerques.
     */
    /**
     * ⛔ Y PRIMERO LO QUE LA CÁMARA ESTÁ A PUNTO DE ENSEÑAR (mundo continuo). Con dos dedos se
     * puede mirar hasta el otro extremo del bosque, y lo que entra en la vista tiene que estar
     * pintado antes de que llegue: las pantallas del plano que tocan la vista con su margen van
     * delante, ordenadas por lo cerca que están de ella; detrás, las vecinas por las que se sale,
     * ordenadas por la distancia del duende a su salida. El techo es el mismo para todas.
     */
    const view = { ...g.camera, width: g.renderer.width, height: g.renderer.height };
    const byView = scenesIntersecting(g.catalog.scenes, this.layout.offsets, g.state.scene, view, VIEW_MARGIN);
    const byExit = this.neighbours(g.world.data)
      .filter((way) => way.id !== g.state.scene)
      .sort(
        (a, b) =>
          Math.hypot(a.x - g.player.x, a.y - g.player.y) -
          Math.hypot(b.x - g.player.x, b.y - g.player.y),
      )
      .map((way) => way.id);
    const wanted = [...new Set([...byView, ...byExit])].slice(0, WARM_SCENES);
    // Lo que deja de ser vecina deja de estar caliente: si no, cruzar el bosque entero acabaría
    // reteniendo el arte de todas las pantallas que has pisado.
    let dropped = false;
    for (const id of [...this.warm.keys()])
      if (!wanted.includes(id)) {
        this.warm.delete(id);
        dropped = true;
      }
    if (dropped) this.retainWarm();
    const next = wanted.find(
      (id) => !this.warm.has(id) && !this.warming.has(id) && !this.unreachable.has(id),
    );
    if (!next) return;
    const task = this.prepare(next, null, g.state)
      .then((prepared) => {
        try {
          if (g.state.scene === next) return;
          this.warm.set(next, prepared.packs);
          this.retainWarm();
        } finally { prepared.packs.release?.(); }
      })
      .catch((error) => {
        if (error instanceof SpriteBudgetError) this.nextWarm = time + 3000;
        else this.unreachable.add(next);
      })
      .finally(() => {
        this.warming.delete(next);
        g.renderer.sprites.prune();
      });
    this.warming.set(next, task);
  }
  /**
   * `keepPointerGesture` es para quien llega CON EL DEDO PUESTO: cruzar un borde arrastrando el
   * mapa es un solo gesto que atraviesa dos pantallas, y soltarlo aquí dejaba a quien cruza parado
   * al otro lado sin haber levantado el dedo. Por una puerta o al cargar no hay gesto que guardar.
   */
  enter(prepared, { keepControls = false, keepPointerGesture = false, camera = null } = {}) {
    const game = this.game;
    // A prepared set is leased until entry, so concurrent prewarming cannot evict it.
    game.renderer.sprites.activate(prepared.packs);
    // Closes the previous scene's row and its heat map before the world changes
    // under it; the very first call happens before telemetry has begun and is a
    // no-op, which is what we want.
    game.telemetry?.enterScene(prepared.world?.data?.id);
    // La pantalla que dejas sigue en memoria como vecina: se queda con sus residentes y sin el
    // duende ni los cuerpos de la presencia, que son de la pantalla que pisas.
    if (game.world && game.world !== prepared.world)
      game.world.actors = this.residents.get(game.world.data?.id) || [];
    game.cameraFollowing = true;
    // Lo que dice esta pantalla, antes de que se pinte nada de ella.
    game.sceneStrings = prepared.strings || {};
    game.world = prepared.world;
    game.renderer.world = game.world;
    game.renderer.resize();
    game.neighbors = prepared.neighbors;
    game.player = {
      ...prepared.position,
      direction: game.state.navigation?.direction || "down",
      // ⛔ El cuerpo se rehace en cada llegada, así que el duende tiene que venir con él: sin esta
      // línea, cruzar una puerta te devolvía al duende de la casa y elegir no servía de nada.
      variant: game.avatar,
      actor: true,
      walkDistance: 0,
    };
    game.state.scene = prepared.id;
    game.state.position = { ...prepared.position };
    game.guardian = null;
    game.world.actors = [game.player, ...game.neighbors];
    game.world.refresh(game.state);
    game.live?.objects.bind(game.world);
    game.pauseMovement({ keepControls, keepPointerGesture });
    game.contactLatch = null;
    // Only suppress a threshold occupied on arrival, until the player steps out.
    // A timer could miss an entire narrow doorway during its blind period.
    game.portalLatch = new Set(
      game.world.entities
        .filter((e) => !e.entryDirection && insideThreshold(e, game.player))
        .map((e) => e.id),
    );
    // ⛔ LA PANTALLA QUE DEJAS SIGUE CALIENTE EN EL ACTO (20-sep-2026). Sus hojas dejaban de
    // estar fijadas al activar las nuevas y no estaban en `warm` —era la activa, no una vecina—,
    // así que durante los ~600 ms hasta que la precarga la volvía a pedir eran lo primero que el
    // presupuesto expulsaba: sus árboles desaparecían al cruzar y reaparecían al rato. Aquí pasa
    // de activa a caliente sin hueco; la precarga la soltará si deja de tocar la vista.
    const previous = this.active;
    if (previous && previous.id !== prepared.id) this.warm.set(previous.id, previous.packs);
    this.active = { id: prepared.id, packs: new Set(prepared.packs) };
    // Entrar fija el arte de esta pantalla, así que sale de las calentadas; y lo que ayer no se
    // pudo preparar vuelve a tener una oportunidad desde aquí.
    this.warm.delete(prepared.id);
    this.unreachable.clear();
    this.retainWarm();
    this.link();
    game.cats?.enter();
    // ⛔ POR UNA COSTURA LA CÁMARA NO SALTA (mundo continuo): quien cruza trae la cámara ya
    // traducida a estas coordenadas y aquí solo se acota; por una puerta o al cargar se clava
    // sobre el duende, como siempre.
    if (camera) {
      game.camera = clampCamera(camera, game.world, game.renderer);
      game.centerCamera();
    } else game.centerCamera(true);
    game.dirty = true;
    game.content?.sceneChanged(prepared.id);
    game.community?.sceneChanged();
  }
}
module.exports = { SceneDirector, playerPacks };
