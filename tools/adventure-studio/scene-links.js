"use strict";

/** Studio shortcuts come from real exits/doors, never from a second map of the forest. */
function sceneLinks(scenes, id) {
  const current = scenes[id];
  if (!current) return [];
  const links = new Map();
  const add = (scene, kind, direction = null) => {
    if (scene !== id && Object.hasOwn(scenes, scene) && !links.has(scene))
      links.set(scene, { scene, kind, direction });
  };
  for (const exit of current.navigation?.exits || [])
    add(exit.scene, "edge", exit.direction);
  for (const entity of current.entities || []) {
    if (!entity.portal) continue;
    for (const rule of entity.rules || [])
      for (const effect of rule.effects || [])
        if (effect.type === "travel") add(effect.scene, "door");
  }
  return [...links.values()];
}

module.exports = { sceneLinks };
