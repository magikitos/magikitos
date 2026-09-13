"use strict";
const { capabilities } = require("../../public/assets/js/adventure/entity-art");
const FIELDS = ["x", "y", "scale", "rotation", "flip"];
const clone = (value) => JSON.parse(JSON.stringify(value));
function placement(entity) {
  return {
    x: entity.x,
    y: entity.y,
    scale: entity.scale ?? 1,
    rotation: entity.rotation || 0,
    flip: !!entity.flip,
  };
}
function validateChanges(snapshot, changes) {
  if (!changes || Array.isArray(changes) || typeof changes !== "object")
    throw Error("Borrador inválido");
  const clean = {};
  for (const [sceneId, groups] of Object.entries(changes)) {
    const scene = snapshot.world.scenes[sceneId];
    if (
      !scene ||
      !groups ||
      Object.keys(groups).some((k) => !["entities", "scenery"].includes(k))
    )
      throw Error("Escena o capa desconocida");
    const out = { entities: {}, scenery: {} };
    for (const group of ["entities", "scenery"]) {
      const table = groups[group] || {};
      if (typeof table !== "object" || Array.isArray(table))
        throw Error("Capa inválida");
      const sources =
        group === "entities" ? scene.entities : snapshot.scenery[sceneId];
      for (const [id, value] of Object.entries(table)) {
        const source = sources.find((e) => e.id === id);
        if (
          !source ||
          !value ||
          Object.keys(value).some((k) => !FIELDS.includes(k))
        )
          throw Error("Elemento o propiedad desconocida");
        const next = { ...placement(source), ...value },
          cap = capabilities(source);
        if (
          !Number.isFinite(next.x) ||
          !Number.isFinite(next.y) ||
          next.x < 0 ||
          next.y < 0 ||
          next.x >= scene.width ||
          next.y >= scene.height
        )
          throw Error("Fuera del escenario");
        if (
          !cap.scales.includes(next.scale) ||
          !cap.rotations.includes(next.rotation) ||
          typeof next.flip !== "boolean" ||
          (!cap.mirror && next.flip !== !!source.flip)
        )
          throw Error("Transformación no admitida por el arte");
        next.x = Math.round(next.x * 1000) / 1000;
        next.y = Math.round(next.y * 1000) / 1000;
        if (JSON.stringify(next) !== JSON.stringify(placement(source)))
          out[group][id] = next;
      }
    }
    if (Object.keys(out.entities).length || Object.keys(out.scenery).length)
      clean[sceneId] = out;
  }
  return clean;
}
function renderScene(snapshot, sceneId, changes = {}) {
  const scene = clone(snapshot.world.scenes[sceneId]),
    edits = changes[sceneId] || {};
  scene.entities = scene.entities.map((e) => ({
    ...e,
    ...edits.entities?.[e.id],
  }));
  scene.scenery = clone(snapshot.scenery[sceneId]).map((e) => ({
    ...e,
    ...edits.scenery?.[e.id],
  }));
  return scene;
}
function proposedScene(snapshot, sceneId, changes) {
  const raw = clone(snapshot.sources[sceneId].data),
    edits = changes[sceneId];
  raw.entities = raw.entities.map((e) => {
    const next = edits.entities[e.id];
    if (!next) return e;
    const updated = { ...e, ...next };
    if (updated.scale === 1) delete updated.scale;
    if (updated.rotation === 0) delete updated.rotation;
    if (!updated.flip) delete updated.flip;
    return updated;
  });
  raw.scenery = renderScene(snapshot, sceneId, changes).scenery;
  return raw;
}
function diff(snapshot, changes) {
  changes = validateChanges(snapshot, changes);
  return Object.entries(changes).map(([sceneId, groups]) => ({
    scene: sceneId,
    file: "data/aventura/scenes/" + sceneId + ".json",
    sourceHash: snapshot.sources[sceneId].hash,
    placements: Object.entries(groups).flatMap(([layer, edits]) =>
      Object.entries(edits).map(([id, after]) => {
        const source = (
          layer === "entities"
            ? snapshot.world.scenes[sceneId].entities
            : snapshot.scenery[sceneId]
        ).find((e) => e.id === id);
        return {
          layer,
          id,
          sprite: source.sprite,
          before: placement(source),
          after,
        };
      }),
    ),
    proposedScene: proposedScene(snapshot, sceneId, changes),
  }));
}
module.exports = { FIELDS, placement, validateChanges, renderScene, diff };
