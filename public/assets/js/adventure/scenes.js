"use strict";
const { World, TILE, insideThreshold } = require("./model");
const { frameName } = require("./elements");
const { createNeighbors } = require("./neighbors");
const { canFloat } = require("./river-navigation");
/** Cuántas vecinas se tienen calientes a la vez. Ver `prewarm`: precargar es un favor, no una
 * excusa para reservar el bosque entero en memoria. */
const WARM_SCENES = 3;
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
  async prepare(id, position, state) {
    await this.game.community?.prepare(this.game.catalog.scenes[id]);
    const game = this.game,
      data =
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
    const neighbors = createNeighbors(world, game.config, game.cast);
    const sprites = new Set(["sack", "setin"]);
    if (data.interior?.background) sprites.add(data.interior.background);
    for (const bridge of data.bridges || []) sprites.add(bridge.sprite);
    for (const visitor of data.riverLife || [])
      for (const frame of visitor.frames) sprites.add(frame);
    for (const item of Object.values(game.catalog.items))
      sprites.add(item.sprite);
    if (shared)
      for (const kind of Object.values(game.catalog.construction.definitions))
        for (const variant of kind.variants) {
          sprites.add(variant.sprite);
          for (const name of Object.values(variant.views || {}))
            sprites.add(name);
        }
    for (const entity of [...world.entities, ...world.props]) {
      for (const attachment of entity.attachments || [])
        sprites.add(attachment.sprite);
      if (entity.seat?.sprite) sprites.add(entity.seat.sprite);
      if (entity.keepsakes?.sprite) sprites.add(entity.keepsakes.sprite);
      if (entity.sprite && entity.sprite !== "doorway")
        sprites.add(frameName(entity));
      for (const visual of entity.visuals || []) sprites.add(visual.sprite);
      if (typeof entity.portrait === "string") sprites.add(entity.portrait);
    }
    const actors = new Set([
      0,
      ...neighbors.map((n) => n.variant),
      ...(data.actors || []),
    ]);
    // Las frases de la pantalla van con sus sprites, no con el motor: se piden a la vez y la
    // llegada falla entera si falta cualquiera de las dos, que es lo que impide entrar a un
    // sitio donde los carteles dirían el nombre de su clave.
    const [packs, strings] = await Promise.all([
      game.renderer.sprites.prepare(sprites, [
        "actor-0-run",
        "actor-0-discover",
        "actor-0-needs",
        ...(state.navigation?.mode === "boat" ? ["actor-0-row"] : []),
        ...(world.entities.some((e) => e.pushable) ? ["actor-0-push"] : []),
        ...(data.assetPacks || []),
        ...(neighbors.some((n) => n.variant === 12) ? ["picnic-neighbor"] : []),
        ...(world.entities.some((e) => e.animal?.species === "cat")
          ? ["actor-0-carried"]
          : []),
        ...[...actors].map((v) => "actor-" + v),
      ]),
      game.sceneText.load(id),
    ]);
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
    if (!destination) throw new Error("Blocked scene arrival: " + id);
    this.cache.delete(id);
    this.cache.set(id, world);
    // Sitio para la pantalla en la que estás y las que se calientan: con el techo de cuatro que
    // había, un tramo de río se expulsaba a sí mismo y la precarga no servía de nada.
    while (this.cache.size > WARM_SCENES + 2)
      this.cache.delete(this.cache.keys().next().value);
    return { id, world, neighbors, position: { ...destination }, packs, strings };
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
    const wanted = this.neighbours(g.world.data)
      .filter((way) => way.id !== g.state.scene)
      .sort(
        (a, b) =>
          Math.hypot(a.x - g.player.x, a.y - g.player.y) -
          Math.hypot(b.x - g.player.x, b.y - g.player.y),
      )
      .slice(0, WARM_SCENES)
      .map((way) => way.id);
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
        if (g.state.scene === next) return;
        this.warm.set(next, prepared.packs);
        this.retainWarm();
      })
      .catch(() => {
        this.unreachable.add(next);
      })
      .finally(() => {
        this.warming.delete(next);
        g.renderer.sprites.prune();
      });
    this.warming.set(next, task);
  }
  enter(prepared, { keepControls = false } = {}) {
    const game = this.game;
    // Closes the previous scene's row and its heat map before the world changes
    // under it; the very first call happens before telemetry has begun and is a
    // no-op, which is what we want.
    game.telemetry?.enterScene(prepared.world?.data?.id);
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
      actor: true,
      walkDistance: 0,
    };
    game.state.scene = prepared.id;
    game.state.position = { ...prepared.position };
    game.guardian = null;
    game.world.actors = [game.player, ...game.neighbors];
    game.world.refresh(game.state);
    game.pauseMovement({ keepControls });
    game.contactLatch = null;
    // Only suppress a threshold occupied on arrival, until the player steps out.
    // A timer could miss an entire narrow doorway during its blind period.
    game.portalLatch = new Set(
      game.world.entities
        .filter((e) => !e.entryDirection && insideThreshold(e, game.player))
        .map((e) => e.id),
    );
    /**
     * ⛔ PRIMERO SE FIJA Y DESPUÉS SE RETIENE, Y EL ORDEN NO ES UN DETALLE. `activate()` vacía el
     * conjunto de calentadas de la biblioteca y poda; si se retiene ANTES, lo recién cargado de
     * esta pantalla no está ni fijado ni caliente y la poda se lo lleva — y entonces `activate`
     * apunta a paquetes que ya no existen y la pantalla se queda sin dibujos. Se veía como que
     * los clics no hacían nada: sin sprite no hay a quién acertarle.
     */
    game.renderer.sprites.activate(prepared.packs);
    // Entrar fija el arte de esta pantalla, así que sale de las calentadas; y lo que ayer no se
    // pudo preparar vuelve a tener una oportunidad desde aquí.
    this.warm.delete(prepared.id);
    this.unreachable.clear();
    this.retainWarm();
    game.cats?.enter();
    game.centerCamera(true);
    game.dirty = true;
    game.content?.sceneChanged(prepared.id);
    game.community?.sceneChanged();
  }
}
module.exports = { SceneDirector };
