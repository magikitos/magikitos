"use strict";
const { World, TILE } = require("./model");
const { createNeighbors } = require("./neighbors");
/** Prepares destinations and their art before any state or fare is committed. */
class SceneDirector {
  constructor(game) {
    this.game = game;
    this.cache = new Map();
  }
  async prepare(id, position, state) {
    const game = this.game,
      data = game.catalog.scenes[id];
    if (!data) throw new Error("Unknown scene: " + id);
    const cached = this.cache.get(id);
    const world = cached && cached !== game.world ? cached : new World(data);
    world.actors = [];
    world.refresh(state);
    const neighbors = createNeighbors(world, game.config, game.cast);
    const sprites = new Set(["sack", "setin"]);
    for (const bridge of data.bridges || []) sprites.add(bridge.sprite);
    for (const item of Object.values(game.catalog.items))
      sprites.add(item.sprite);
    for (const entity of [...world.entities, ...world.props]) {
      if (entity.sprite && entity.sprite !== "doorway")
        sprites.add(entity.sprite);
      for (const visual of entity.visuals || []) sprites.add(visual.sprite);
      if (typeof entity.portrait === "string") sprites.add(entity.portrait);
      for (const rule of entity.rules || [])
        for (const effect of rule.effects)
          if (effect.type === "travel" && effect.presentation)
            for (const name of game.catalog.transports[effect.presentation]
              .shoreSprites || [])
              sprites.add(name);
    }
    const actors = new Set([
      0,
      ...neighbors.map((n) => n.variant),
      ...(data.actors || []),
    ]);
    const packs = await game.renderer.sprites.prepare(sprites, [
      "actor-0-roll",
      "actor-0-needs",
      ...(data.assetPacks || []),
      ...[...actors].map((v) => "actor-" + v),
    ]);
    const destination = world.canStand(position?.x, position?.y)
      ? { ...position }
      : { x: data.spawn.x * TILE, y: data.spawn.y * TILE };
    if (!world.canStand(destination.x, destination.y))
      throw new Error("Blocked scene arrival: " + id);
    this.cache.delete(id);
    this.cache.set(id, world);
    if (this.cache.size > 4) this.cache.delete(this.cache.keys().next().value);
    return { id, world, neighbors, position: destination, packs };
  }
  enter(prepared) {
    const game = this.game;
    game.world = prepared.world;
    game.neighbors = prepared.neighbors;
    game.player = {
      ...prepared.position,
      direction: "down",
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
    game.portalCooldown = 0.65;
    game.renderer.sprites.activate(prepared.packs);
    game.centerCamera(true);
    game.dirty = true;
  }
}
module.exports = { SceneDirector };
