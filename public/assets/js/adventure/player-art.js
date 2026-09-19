"use strict";
const definition = require("../../../../data/aventura/player-art.json");
function playerVariant(actor) {
  return actor?.variant ?? definition.defaultVariant;
}
function playerPack(action, actor) {
  return `actor-${playerVariant(actor)}${action ? "-" + action : ""}`;
}
/**
 * ⛔ QUIÉN SE PUEDE SER LO DICE EL MUNDO COMPILADO, NO ESTE FICHERO DE AUTORÍA.
 *
 * `player-art.json` solo lleva lo que alguien escribe a mano: el duende con el que empieza quien
 * llega y el remo medido de cada uno. El elenco OFRECIDO lo deriva `data/aventura/world.php` de lo
 * que hay horneado de verdad, así que crece solo el día que entra el arte y jamás ofrece un duende
 * a medio dibujar. Preguntárselo al JSON sería preguntar por una lista que ya no existe.
 */
function castOffered(catalog) {
  return catalog.playerArt.enabledVariants;
}
/** El duende elegido si sigue existiendo, y si no, el de la casa. Un número guardado en otro
 * aparato —o de una release en la que esa hoja estaba— no puede dejar a nadie sin cuerpo. */
function castVariant(catalog, chosen) {
  return castOffered(catalog).includes(chosen)
    ? chosen
    : catalog.playerArt.defaultVariant;
}
/** El retrato del selector, que vive en su propio paquete pequeño. Ver prepare-cast-portraits. */
function castPortrait(variant) {
  return "cast-" + variant;
}
module.exports = {
  ...definition,
  playerVariant,
  playerPack,
  castOffered,
  castVariant,
  castPortrait,
};
