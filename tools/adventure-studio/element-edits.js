"use strict";
/**
 * ⛔ EL CUERPO Y LA ENTRADA SON DEL ELEMENTO (21-sep-2026, decisión del dueño: «esos valores deben
 * ser relativos a ese elemento, en TOOODAS sus instancias, no solo la que estoy editando»).
 *
 * Se guardan en la VARIANTE de la familia —el dibujo concreto— y desde ahí valen para todas sus
 * copias, las que ya están puestas y las que se pongan mañana. Lo que este módulo valida y compara
 * es esa propuesta; escribirla en `data/aventura/element-families.json` es trabajo del agente que
 * revisa, porque el estudio no toca el juego.
 */
const { families } = require("./catalog");
const { validDockEntrance } = require("../../public/assets/js/adventure/dock-geometry");
const { FULL_SURFACE, validWalkable } = require("../../public/assets/js/adventure/bridge-geometry");
const {
  ENTRANCE_LIMITS,
  validEntrance,
  entranceReachable,
} = require("../../public/assets/js/adventure/portals");
/** Lo más grande que se admite a mano: doce casillas de desplazamiento y un cuerpo de 32. */
const BODY_LIMIT = 32,
  MIN_SIDE = 1 / 16,
  MAX_BOXES = 6;
const clone = (value) => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** La variante de una familia, o null si el nombre no existe. */
function variantOf(familyId, variantId) {
  return (
    families[familyId]?.variants.find((v) => v.id === variantId) || null
  );
}
/**
 * El cuerpo que tiene HOY ese elemento: el de su variante si lo trae, y si no el de la plantilla
 * de la familia, que es de donde lo heredan todas. Siempre como lista de cajas, que es la forma
 * con la que se dibuja y se edita.
 */
function bodyOf(familyId, variantId) {
  const family = families[familyId];
  if (!family) return null;
  // Con la variante todavía sin fijar («variada»), lo heredado es lo de la plantilla: es lo que
  // `makeElement` copia y lo que el compilador mezcla, así que es con lo que hay que comparar.
  const variant = variantOf(familyId, variantId) || {};
  const solids = variant.solids ||
    (family.template.solids ??
      (family.template.solid ? [family.template.solid] : null));
  const entrance = variant.entrance ?? family.template.entrance ?? null;
  return {
    ...(solids ? { solids: clone(solids) } : {}),
    ...(entrance ? { entrance: clone(entrance) } : {}),
    ...(family.access === "dock" ? { walkable: clone(variant.walkable || FULL_SURFACE) } : {}),
  };
}
function validBox(box) {
  return (
    Array.isArray(box) &&
    box.length === 4 &&
    box.every((v) => Number.isFinite(v) && Math.abs(v) <= BODY_LIMIT) &&
    box[2] >= MIN_SIDE &&
    box[3] >= MIN_SIDE
  );
}
/**
 * Solo lo que de verdad cambia frente al elemento de hoy, y solo de elementos que existen. Un
 * cuerpo vacío (`solids: []`) es una decisión legítima —un elemento que deja de estorbar— y se
 * conserva; lo que se descarta es lo que ya vale lo mismo que la fuente.
 */
function validateElements(elements = {}) {
  if (!elements || Array.isArray(elements) || typeof elements !== "object")
    throw Error("Cuerpos de elemento inválidos");
  const out = {};
  for (const [familyId, variants] of Object.entries(elements)) {
    if (!families[familyId]) throw Error("Familia desconocida: " + familyId);
    if (!variants || Array.isArray(variants) || typeof variants !== "object")
      throw Error("Variantes inválidas: " + familyId);
    for (const [variantId, edit] of Object.entries(variants)) {
      if (!variantOf(familyId, variantId))
        throw Error("Variante desconocida: " + familyId + "/" + variantId);
      if (!edit || typeof edit !== "object" || Array.isArray(edit))
        throw Error("Cuerpo inválido: " + familyId + "/" + variantId);
      if (Object.keys(edit).some((k) => !["solids", "entrance", "walkable"].includes(k)))
        throw Error("Campo desconocido en " + familyId + "/" + variantId);
      const next = {};
      if (Object.hasOwn(edit, "walkable")) {
        if (families[familyId].access !== "dock" || !validWalkable(edit.walkable))
          throw Error("Superficie caminable fuera del dibujo: " + familyId + "/" + variantId);
        next.walkable = [...edit.walkable];
      }
      if (Object.hasOwn(edit, "solids")) {
        const solids = edit.solids;
        if (
          !Array.isArray(solids) ||
          solids.length > MAX_BOXES ||
          !solids.every(validBox)
        )
          throw Error("Cuerpo fuera de límites: " + familyId + "/" + variantId);
        next.solids = solids.map((box) => box.map(Number));
      }
      if (Object.hasOwn(edit, "entrance")) {
        // `null` es quitar la entrada dibujada y volver a la automática, y se conserva como tal.
        if (edit.entrance === null) next.entrance = null;
        else {
          if (!(families[familyId].access === "dock" ? validDockEntrance : validEntrance)(edit.entrance))
            throw Error(
              "Entrada fuera de límites (" +
                ENTRANCE_LIMITS.offset +
                " casillas): " +
                familyId +
                "/" +
                variantId,
            );
          next.entrance = edit.entrance.map(Number);
        }
      }
      /**
       * ⛔ Y QUE SE PUEDA PISAR. Una franja dentro del cuerpo —o pegada a él sin dejar la media
       * huella libre— no la alcanza nadie: el umbral prueba el PUNTO del duende y ese punto no
       * entra en un sólido. La puerta se quedaría cerrada para siempre sin que nada avisara.
       */
      if (families[familyId].access === "dock" && (!next.entrance || next.solids?.length))
        throw Error("El muelle necesita un acceso, no cajas de colisión");
      if (next.entrance && families[familyId].access !== "dock" && !entranceReachable(next.entrance, next.solids))
        throw Error(
          "La entrada queda dentro del cuerpo y no se puede pisar: " + familyId + "/" + variantId,
        );
      const base = bodyOf(familyId, variantId);
      if (
        !same(next.solids, base.solids) ||
        !same(next.entrance, base.entrance) ||
        (Object.hasOwn(next, "walkable") && !same(next.walkable, base.walkable))
      )
        (out[familyId] ||= {})[variantId] = next;
    }
  }
  return out;
}
/**
 * Dónde se escribe el cuerpo de un elemento. Las familias autoradas a mano llevan sus variantes en
 * `element-families.json`; las 39 del kit del bosque no las tienen ahí —las genera
 * `build-woodland-kit.cjs` desde el manifiesto de arte— y su sitio es `elements.json`, que ese
 * generador ya respeta para la física. Decirlo por elemento evita que alguien aplique la propuesta
 * en un fichero donde esa variante no existe.
 */
const blueprint = require("../../data/aventura/element-families.json").families;
const fileFor = (familyId, variantId) =>
  (blueprint[familyId]?.variants || []).some((v) => v.id === variantId)
    ? "data/aventura/element-families.json"
    : "data/aventura/elements.json";
/** Qué elemento cambia, qué tenía, qué tendría y dónde se escribe. Solo propuesta. */
function elementDiff(elements = {}) {
  return Object.entries(validateElements(elements)).flatMap(
    ([familyId, variants]) =>
      Object.entries(variants).map(([variantId, after]) => ({
        file: fileFor(familyId, variantId),
        family: familyId,
        familyLabel: families[familyId].label,
        variant: variantId,
        variantLabel:
          variantOf(familyId, variantId).label || variantId,
        sprite: variantOf(familyId, variantId).sprite,
        before: bodyOf(familyId, variantId),
        after,
      })),
  );
}
/** El cuerpo con la propuesta encima, que es lo que el mapa del estudio tiene que enseñar. */
function proposedBody(familyId, variantId, elements = {}) {
  const base = bodyOf(familyId, variantId);
  if (!base) return null;
  const edit = elements?.[familyId]?.[variantId];
  if (!edit) return base;
  const merged = { ...base, ...edit };
  // Una entrada quitada se dibuja quitada, no con la que había.
  if (merged.entrance === null) delete merged.entrance;
  return merged;
}
module.exports = {
  BODY_LIMIT,
  MIN_SIDE,
  MAX_BOXES,
  bodyOf,
  proposedBody,
  validateElements,
  elementDiff,
};
