"use strict";
const { World, TILE, insideThreshold } = require("./model");
const { frameName } = require("./elements");
const { createNeighbors } = require("./neighbors");
const { canFloat } = require("./river-navigation");
/** Prepares destinations and their art before any state is committed. */
class SceneDirector {
  constructor(game) {
    this.game = game;
    this.cache = new Map();
    this.warming = new Map();
    this.nextWarm = 0;
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
    const packs = await game.renderer.sprites.prepare(sprites, [
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
    ]);
    const valid =
      state.navigation?.mode === "boat"
        ? (x, y) => canFloat(world, x, y)
        : (x, y) => world.canStand(x, y);
    const destination = valid(position?.x, position?.y)
      ? { ...position }
      : { x: data.spawn.x * TILE, y: data.spawn.y * TILE };
    if (!valid(destination.x, destination.y))
      throw new Error("Blocked scene arrival: " + id);
    this.cache.delete(id);
    this.cache.set(id, world);
    if (this.cache.size > 4) this.cache.delete(this.cache.keys().next().value);
    return { id, world, neighbors, position: destination, packs };
  }
  /** Nearby doors warm only their destination; the current scene stays visible and playable. */
  prewarm(time) {
    const g = this.game;
    if (
      time < this.nextWarm ||
      !g.walking ||
      g.transitioning ||
      g.dialogue ||
      g.blocked() ||
      (typeof navigator !== "undefined" &&
        (navigator.connection?.saveData ||
          /(^|-)2g$/.test(navigator.connection?.effectiveType || "")))
    )
      return;
    this.nextWarm = time + 600;
    const intent = g.movementIntent();
    const door = g.world.entities.find(
      (e) =>
        e.threshold &&
        intent &&
        (e.x - g.player.x) * intent.x + (e.y - g.player.y) * intent.y > 0 &&
        Math.hypot(e.x - g.player.x, e.y - g.player.y) < TILE * 7,
    );
    const travel = door?.rules
      .flatMap((r) => r.effects)
      .find((e) => e.type === "travel");
    if (
      !travel ||
      this.warming.has(travel.scene) ||
      this.cache.has(travel.scene)
    )
      return;
    const task = this.prepare(travel.scene, null, g.state)
      .then((prepared) => {
        if (g.state.scene !== travel.scene)
          g.renderer.sprites.retainWarm(prepared.packs);
      })
      .catch(() => null)
      .finally(() => {
        this.warming.delete(travel.scene);
        g.renderer.sprites.prune();
      });
    this.warming.set(travel.scene, task);
  }
  enter(prepared) {
    const game = this.game;
    game.cameraFollowing = true;
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
    game.pauseMovement();
    game.contactLatch = null;
    // Only suppress a threshold occupied on arrival, until the player steps out.
    // A timer could miss an entire narrow doorway during its blind period.
    game.portalLatch = new Set(
      game.world.entities
        .filter((e) => !e.entryDirection && insideThreshold(e, game.player))
        .map((e) => e.id),
    );
    game.renderer.sprites.activate(prepared.packs);
    game.cats?.enter();
    game.centerCamera(true);
    game.dirty = true;
    game.content?.sceneChanged(prepared.id);
    game.community?.sceneChanged();
  }
}
module.exports = { SceneDirector };
