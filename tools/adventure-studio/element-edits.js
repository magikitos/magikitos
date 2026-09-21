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
const {
  ENTRANCE_LIMITS,
  validEntrance,
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
      if (Object.keys(edit).some((k) => !["solids", "entrance"].includes(k)))
        throw Error("Campo desconocido en " + familyId + "/" + variantId);
      const next = {};
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
      if (Object.hasOwn(edit, "entrance") && edit.entrance !== null) {
        if (!validEntrance(edit.entrance))
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
      const base = bodyOf(familyId, variantId);
      if (
        !same(next.solids, base.solids) ||
        !same(next.entrance, base.entrance)
      )
        (out[familyId] ||= {})[variantId] = next;
    }
  }
  return out;
}
/** Qué elemento cambia, qué tenía, qué tendría y dónde se escribe. Solo propuesta. */
function elementDiff(elements = {}) {
  return Object.entries(validateElements(elements)).flatMap(
    ([familyId, variants]) =>
      Object.entries(variants).map(([variantId, after]) => ({
        file: "data/aventura/element-families.json",
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
  return edit ? { ...base, ...edit } : base;
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
