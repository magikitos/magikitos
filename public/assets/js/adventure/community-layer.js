"use strict";
const { actorBounds, collisionBounds, overlaps } = require("./geometry");

/** Authoritative furniture is a layer, not a new scene. Leave cats, procedural scenery,
 * shared props, paths and animations alive; invalidate only references that actually changed. */
function applyCommunityLayer(game, data) {
  const world = game.world;
  if (world.data.id !== data.id) return;
  const previous = new Map(world.entities.filter(e => e.community).map(e => [e.id, e]));
  const added = [], current = new Map();
  for (const definition of data.entities.filter(e => e.community)) {
    const old = previous.get(definition.id);
    if (old?.communityVersion === definition.communityVersion) {
      previous.delete(old.id); current.set(old.id, old);
    } else {
      const entity = world.createEntity(definition);
      added.push(entity); current.set(entity.id, entity);
    }
  }
  const removed = new Set(previous.values());
  world.replaceEntities(removed, added);
  world.data = { ...world.data, entities: data.entities, communityPaths: data.communityPaths };
  game.life.reconcile(new Set(previous.keys()), world);
  const target = game.journey.target;
  if (removed.has(target)) {
    const replacement = current.get(target.id);
    if (replacement) {
      game.journey.intent.entity = replacement;
      game.journey.replan(world, game.player);
    } else game.journey.clear();
  }
  // A remote build can occupy a local NPC's feet. Move only bodies caught by NEW solids,
  // not everyone who happens to be in an authored doorway, on water or in a cat animation.
  const sources = new Set(added);
  const newBounds = world.colliders.filter(e => sources.has(e.collisionSource || e)).map(collisionBounds);
  for (const actor of [game.player, ...game.neighbors]) {
    if (actor === game.player && (game.river.active || game.cats.locked)) continue;
    if (!newBounds.some(r => overlaps(r, actorBounds(actor.x, actor.y)))) continue;
    let point;
    for (let radius = 8; radius <= 192 && !point; radius += 8)
      for (let i = 0; i < 16 && !point; i++) {
        const x = actor.x + Math.cos(i * Math.PI / 8) * radius;
        const y = actor.y + Math.sin(i * Math.PI / 8) * radius;
        if (world.canStand(x, y, actor)) point = { x, y };
      }
    if (point) Object.assign(actor, point);
  }
}
module.exports = { applyCommunityLayer };
