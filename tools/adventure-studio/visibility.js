"use strict";
const { families, familyOf } = require("./catalog");
const trees = new Set([families["forest-tree"], families["canopy-tree"]]);
// Families cover authored/generated trees and all their variants. A tree-shaped
// home, a stump, bushes, ferns and flowers are not trees in this editing filter.
const isTree = (entity) => {
  const family = familyOf(entity);
  return trees.has(family) || family?.tree === true;
};

/** A render-only view: the authoring world, its scene data and collisions stay intact. */
function visibleWorld(world, hideTrees) {
  if (!hideTrees) return world;
  const visible = (rows) => rows.filter((e) => !isTree(e));
  return Object.assign(Object.create(world), {
    props: visible(world.props),
    entities: visible(world.entities),
    architecture: visible(world.architecture),
  });
}

module.exports = { isTree, visibleWorld };
