"use strict";
/** A reviewable map proposal: placements, explicit variants, palette additions and safe removals. */
const {
  capabilities,
  validScale,
} = require("../../public/assets/js/adventure/entity-art");
const {
  familyOf,
  makeElement,
  families,
} = require("./catalog");
/** El identificador de la familia de un elemento: la clave con la que se guarda su cuerpo. */
const familyIdOf = (e) =>
  Object.keys(families).find((id) => families[id] === familyOf(e)) || null;
const { validatePaths } = require("./path-edits");
const {
  doorGeometry,
  validEntrance,
} = require("../../public/assets/js/adventure/portals");
const FIELDS = [
  "x",
  "y",
  "scale",
  "rotation",
  "flip",
  "solid",
  "artVariant",
  "fence",
  "entrance",
];
const clone = (value) => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/**
 * ⛔ UNA COLOCACIÓN NO REPITE EL CUERPO DE SU ELEMENTO (21-sep-2026). El cuerpo y la entrada viven
 * en la familia y desde ahí valen para todas las copias; si cada copia se los volviera a escribir,
 * editar el elemento no cambiaría nada, porque la copia ganaría. Solo se anota lo que de verdad se
 * aparta de lo heredado, que es para lo que existe una colocación.
 */
function inheritedBody(e) {
  const id = familyIdOf(e);
  return id ? require("./element-edits").bodyOf(id, e.artVariant) : null;
}
function placement(e) {
  const inherited = inheritedBody(e);
  return {
    x: e.x,
    y: e.y,
    scale: e.scale ?? 1,
    rotation: e.rotation || 0,
    flip: !!e.flip,
    ...(e.fence ? { fence: clone(e.fence) } : {}),
    ...(e.solid && !same([e.solid], inherited?.solids)
      ? { solid: [...e.solid] }
      : {}),
    ...(e.entrance && !same(e.entrance, inherited?.entrance)
      ? { entrance: [...e.entrance] }
      : {}),
    ...(familyOf(e)
      ? {
          artVariant:
            e.artVariant || familyOf(e).defaults?.[e.sprite] || "auto",
        }
      : {}),
  };
}
function sourceEntities(snapshot, scene, layer) {
  return layer === "entities"
    ? snapshot.world.scenes[scene]?.entities
    : snapshot.scenery[scene];
}
function removable(snapshot, scene, layer, id) {
  const e = sourceEntities(snapshot, scene, layer)?.find((e) => e.id === id);
  return (
    !!e &&
    !e.portal &&
    !e.threshold &&
    !e.actor &&
    !e.neighbor &&
    !e.interactAs &&
    !e.rules?.length &&
    !e.when &&
    !e.activeWhen &&
    !snapshot.world.scenes[scene].entities.some((row) => row.interactAs === id)
  );
}
function validatePlacement(scene, source, value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !FIELDS.includes(k))
  )
    throw Error("Elemento o propiedad desconocida");
  const recorded = placement(source),
    next = { ...recorded, ...value },
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
    !validScale(source, next.scale) ||
    !cap.rotations.includes(next.rotation) ||
    typeof next.flip !== "boolean" ||
    (!cap.mirror && next.flip !== !!source.flip)
  )
    throw Error("Transformación no admitida por el arte");
  // Se compara con lo que la colocación ANOTA, no con lo que el elemento hereda: una colocación
  // sin `solid` es una que se conforma con el cuerpo de su elemento, no una que lo borra.
  if (JSON.stringify(next.solid) !== JSON.stringify(recorded.solid)) {
    if (
      !source.solid ||
      source.portal ||
      source.threshold ||
      source.actor ||
      !Array.isArray(next.solid) ||
      next.solid.length !== 4 ||
      next.solid.some((v) => !Number.isFinite(v) || Math.abs(v) > 32) ||
      next.solid[2] < 1 / 16 ||
      next.solid[3] < 1 / 16
    )
      throw Error("Colisión no admitida; puertas y actores están protegidos");
  }
  /**
   * ⛔ LA ENTRADA DE UNA PUERTA SE DIBUJA A MANO (20-sep-2026, decisión del dueño). `entrance` es la
   * franja que abre la puerta, [dx, dy, ancho, alto] en casillas relativas al pie; sin ella el
   * compilador la deriva del pie como siempre. Solo las puertas la tienen —una escalera deriva su
   * rellano de su cuerpo— y va con los mismos límites que exige el compilador (`portals.js`).
   */
  if (JSON.stringify(next.entrance) !== JSON.stringify(recorded.entrance)) {
    if (!source.portal || source.portal === "stairs")
      throw Error("Solo las puertas tienen entrada; las escaleras derivan su rellano");
    if (next.entrance !== undefined) {
      if (!validEntrance(next.entrance))
        throw Error(
          "Entrada fuera de rango: hasta 12 casillas del pie, de ¼ a 2 casillas de ancho y de 1 a 8 píxeles de alto",
        );
      next.entrance = next.entrance.map((v) => Math.round(v * 16) / 16);
    }
  }
  if (next.entrance === undefined) delete next.entrance;
  if (next.artVariant !== undefined) {
    const family = familyOf(source);
    if (
      !family ||
      (next.artVariant === "auto" && family.randomVariants === false) ||
      (next.artVariant !== "auto" &&
        !family.variants.some((v) => v.id === next.artVariant))
    )
      throw Error("Variante desconocida para esta familia");
  }
  next.x = Math.round(next.x * 1000) / 1000;
  next.y = Math.round(next.y * 1000) / 1000;
  if (source.fence && !next.fence)
    throw Error("Una valla conectada necesita su trazado");
  if (next.fence) {
    if (!source.fence || next.solid)
      throw Error("El trazado solo pertenece a una valla conectada");
    next.fence =
      require("../../public/assets/js/adventure/fences").validateFence(
        next.fence,
        scene,
        next.x,
        next.y,
      );
  }
  return next;
}
function validateAdded(snapshot, sceneId, input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).length > 500
  )
    throw Error("Galería añadida inválida");
  const scene = snapshot.world.scenes[sceneId],
    result = {};
  for (const [id, value] of Object.entries(input)) {
    if (
      !/^studio-[a-z0-9-]{6,64}$/.test(id) ||
      scene.entities.some((e) => e.id === id) ||
      snapshot.scenery[sceneId].some((e) => e.id === id)
    )
      throw Error("Identificador añadido inválido");
    if (
      !value ||
      Object.keys(value).some((k) => !["family", ...FIELDS].includes(k)) ||
      families[value.family]?.placeable === false
    )
      throw Error("Elemento de galería desconocido");
    if (scene.indoor && families[value.family]?.category === "Casitas")
      throw Error(
        "Las casas se colocan en el exterior, no dentro de otro refugio",
      );
    const source = makeElement(
      value.family,
      id,
      value.x,
      value.y,
      value.artVariant || "auto",
    );
    const fields = { ...value };
    delete fields.family;
    result[id] = {
      family: value.family,
      ...validatePlacement(scene, source, fields),
    };
  }
  return result;
}
function validateChanges(snapshot, changes) {
  if (!changes || Array.isArray(changes) || typeof changes !== "object")
    throw Error("Versión del estudio inválida");
  const clean = {};
  for (const [sceneId, groups] of Object.entries(changes)) {
    const scene = snapshot.world.scenes[sceneId];
    if (
      !scene ||
      !groups ||
      Object.keys(groups).some(
        (k) =>
          !["entities", "scenery", "paths", "added", "removed"].includes(k),
      )
    )
      throw Error("Escena o capa desconocida");
    const out = { entities: {}, scenery: {} };
    for (const layer of ["entities", "scenery"]) {
      const table = groups[layer] || {};
      if (typeof table !== "object" || Array.isArray(table))
        throw Error("Capa inválida");
      for (const [id, value] of Object.entries(table)) {
        const source = sourceEntities(snapshot, sceneId, layer).find(
          (e) => e.id === id,
        );
        if (!source) throw Error("Elemento o propiedad desconocida");
        const next = validatePlacement(scene, source, value);
        if (JSON.stringify(next) !== JSON.stringify(placement(source)))
          out[layer][id] = next;
      }
    }
    if (groups.added) {
      const added = validateAdded(snapshot, sceneId, groups.added);
      if (Object.keys(added).length) out.added = added;
    }
    if (groups.removed) {
      if (!Array.isArray(groups.removed) || groups.removed.length > 1500)
        throw Error("Lista de retiradas inválida");
      const seen = new Set(),
        removed = [];
      for (const row of groups.removed) {
        if (
          !row ||
          Object.keys(row).some((k) => !["id", "layer"].includes(k)) ||
          !["entities", "scenery"].includes(row.layer) ||
          !removable(snapshot, sceneId, row.layer, row.id)
        )
          throw Error(
            "No se puede retirar un objeto funcional desde la galería",
          );
        const key = row.layer + "/" + row.id;
        if (seen.has(key)) continue;
        seen.add(key);
        removed.push({ id: row.id, layer: row.layer });
        delete out[row.layer][row.id];
      }
      if (removed.length) out.removed = removed;
    }
    if (Object.hasOwn(groups, "paths")) {
      const paths = validatePaths(scene, groups.paths);
      if (JSON.stringify(paths) !== JSON.stringify(scene.paths))
        out.paths = paths;
    }
    if (
      Object.keys(out.entities).length ||
      Object.keys(out.scenery).length ||
      out.added ||
      out.removed ||
      Object.hasOwn(out, "paths")
    )
      clean[sceneId] = out;
  }
  return clean;
}
/**
 * La escena tal y como se vería con la propuesta puesta: colocaciones, altas, bajas, caminos y
 * —desde el 21-sep-2026— el cuerpo y la entrada que el estudio propone para cada ELEMENTO, que
 * valen para todas sus copias y por eso se aplican aquí y no en cada una.
 */
function renderScene(snapshot, sceneId, changes = {}, elements = {}) {
  const scene = clone(snapshot.world.scenes[sceneId]),
    edits = changes[sceneId] || {};
  const elementBody = (e) => {
    const family = familyOf(e);
    const edit = family && elements[familyIdOf(e)]?.[e.artVariant];
    if (!edit) return null;
    return {
      ...(edit.solids ? { solids: clone(edit.solids) } : {}),
      ...(Object.hasOwn(edit, "entrance")
        ? { entrance: clone(edit.entrance) }
        : {}),
    };
  };
  const keep = (e, layer) =>
    !edits.removed?.some((r) => r.layer === layer && r.id === e.id);
  if (Object.hasOwn(edits, "paths")) scene.paths = clone(edits.paths);
  scene.entities = scene.entities
    .filter((e) => keep(e, "entities"))
    .map((e) => {
      const edit = edits.entities?.[e.id],
        body = elementBody(e);
      if (!edit && !body) return e;
      const merged = { ...e, ...edit, ...body };
      // Una colocación es completa: sin `entrance` en ella, la puerta vuelve a derivarse.
      if (edit && !Object.hasOwn(edit, "entrance") && !body?.entrance)
        delete merged.entrance;
      if (body?.solids) delete merged.solid;
      // La vista previa enseña el umbral y la llegada que escribirá el compilador para el pie y la
      // entrada de AHORA, no los de la escena compilada antes de mover la casa.
      if (merged.portal) {
        try {
          Object.assign(merged, doorGeometry(scene, merged));
        } catch {
          /* la validación ya rechazó la entrada; se conserva la geometría compilada */
        }
      }
      return merged;
    });
  for (const [id, value] of Object.entries(edits.added || {}))
    scene.entities.push({
      ...makeElement(value.family, id, value.x, value.y, value.artVariant),
      ...value,
    });
  scene.scenery = clone(snapshot.scenery[sceneId])
    .filter((e) => keep(e, "scenery"))
    .map((e) => ({ ...e, ...edits.scenery?.[e.id], ...elementBody(e) }));
  return scene;
}
function proposedScene(snapshot, sceneId, changes) {
  const raw = clone(snapshot.sources[sceneId].data),
    edits = changes[sceneId];
  raw.entities = raw.entities
    .filter(
      (e) =>
        !edits.removed?.some((r) => r.layer === "entities" && r.id === e.id),
    )
    .map((e) => {
      const next = edits.entities?.[e.id];
      if (!next) return e;
      const source = snapshot.world.scenes[sceneId].entities.find(
          (row) => row.id === e.id,
        ),
        updated = { ...e },
        before = placement(source);
      for (const field of FIELDS)
        if (JSON.stringify(next[field]) !== JSON.stringify(before[field]))
          updated[field] = next[field];
      if (updated.scale === 1) delete updated.scale;
      if (updated.rotation === 0) delete updated.rotation;
      if (!updated.flip) delete updated.flip;
      return updated;
    });
  for (const [id, value] of Object.entries(edits.added || {}))
    raw.entities.push({
      ...makeElement(value.family, id, value.x, value.y, value.artVariant),
      ...value,
    });
  if (Object.hasOwn(edits, "paths")) raw.paths = clone(edits.paths);
  raw.scenery = renderScene(snapshot, sceneId, changes).scenery.map((e) => {
    delete e.artSprite;
    delete e.homePosition;
    return e;
  });
  return raw;
}
function diff(snapshot, changes) {
  changes = validateChanges(snapshot, changes);
  return Object.entries(changes).map(([sceneId, groups]) => ({
    scene: sceneId,
    file: "data/aventura/scenes/" + sceneId + ".json",
    sourceHash: snapshot.sources[sceneId].hash,
    ...(Object.hasOwn(groups, "paths")
      ? {
          paths: {
            before: clone(snapshot.world.scenes[sceneId].paths),
            after: clone(groups.paths),
          },
        }
      : {}),
    placements: ["entities", "scenery"].flatMap((layer) =>
      Object.entries(groups[layer] || {}).map(([id, after]) => {
        const source = sourceEntities(snapshot, sceneId, layer).find(
          (e) => e.id === id,
        );
        return {
          layer,
          id,
          sprite: source.sprite,
          before: placement(source),
          after,
        };
      }),
    ),
    ...(groups.added ? { added: clone(groups.added) } : {}),
    ...(groups.removed ? { removed: clone(groups.removed) } : {}),
    proposedScene: proposedScene(snapshot, sceneId, changes),
  }));
}
module.exports = {
  FIELDS,
  familyIdOf,
  placement,
  validateChanges,
  renderScene,
  diff,
  removable,
};
