"use strict";
const profiles = require("../../../../data/aventura/residents.json");
const { playerVariant } = require("./player-art");
const seated = new Set(profiles.filter(p => p.gender === "F").map(p => p.id));

/** Presentation only: every sheet has the same poses; the need stays pee. */
function reliefPose(kind, actor) {
  return kind === "pee" && seated.has(playerVariant(actor)) ? "poop" : kind;
}
function reliefFrame(actor, kind, phase) {
  return `person-${playerVariant(actor)}-${reliefPose(kind, actor)}-${phase}`;
}
function reliefOffset(kind, actor) {
  return [reliefPose(kind, actor) === "poop" ? -7 : 20, 3];
}
module.exports = { reliefPose, reliefFrame, reliefOffset };
