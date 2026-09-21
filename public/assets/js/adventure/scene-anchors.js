"use strict";
/** Resolve stationary scene attachments once, identically in the game and the Studio. */
function resolveSceneAnchors(scene) {
  if (!scene.night?.anchor && !scene.gatherings?.some(g => g.anchor)) return scene;
  const entities = new Map(scene.entities.map(e => [e.id, e]));
  const position = anchor => {
    const e = entities.get(anchor);
    if (!e || !Number.isFinite(e.x) || !Number.isFinite(e.y))
      throw Error("Missing scene anchor: " + scene.id + "/" + anchor);
    return { x: e.x, y: e.y };
  };
  let night = scene.night;
  if (night?.anchor) {
    const { x, y } = position(night.anchor);
    night = { ...night, x, y, fire: [x, y] };
  }
  return {
    ...scene,
    ...(night ? { night } : {}),
    ...(scene.gatherings ? { gatherings: scene.gatherings.map(g =>
      g.anchor ? { ...g, ...position(g.anchor) } : g) } : {}),
  };
}
module.exports = { resolveSceneAnchors };
