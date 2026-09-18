"use strict";
const definition = require("../../../../data/aventura/player-art.json");
function playerVariant(actor) {
  return actor?.variant ?? definition.defaultVariant;
}
function playerPack(action, actor) {
  return `actor-${playerVariant(actor)}${action ? "-" + action : ""}`;
}
module.exports = { ...definition, playerVariant, playerPack };
