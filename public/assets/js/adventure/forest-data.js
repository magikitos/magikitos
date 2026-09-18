"use strict";
const { TILE } = require("./geometry");
const characters = text => Array.from(text).length;
function serverTime(now) {
  if (!Number.isSafeInteger(now) || now <= 0) throw Error("invalid_server_time");
}
function bodyDto(data, catalog) {
  serverTime(data.now);
  const needs = {};
  for (const kind of ["pee", "poop"]) {
    const value = data.needs?.[kind], [min, max] = catalog.needs.hours[kind];
    if (!Number.isSafeInteger(value?.last) || value.last <= 0 || value.last > data.now ||
        !Number.isSafeInteger(value.due) || value.due < value.last + min * 3600000 ||
        value.due > value.last + max * 3600000) throw Error("invalid_body_state");
    needs[kind] = { last: value.last, due: value.due };
  }
  return needs;
}
/** Public DTOs are plain text, never dialogue templates, HTML, rules or executable entities. */
function noteDto(value, zone, scene, policy) {
  if (!value || !scene || !/^[a-f0-9]{32}$/.test(value.id) || value.zone !== zone ||
      !Number.isFinite(value.x) || value.x < 0 || value.x >= scene.width * TILE ||
      !Number.isFinite(value.y) || value.y < 0 || value.y >= scene.height * TILE ||
      !Number.isSafeInteger(value.createdAt) || value.createdAt <= 0 || !Number.isSafeInteger(value.expiresAt) ||
      value.expiresAt <= value.createdAt || value.expiresAt - value.createdAt > 86400000 ||
      (value.text !== null && (typeof value.text !== "string" || characters(value.text) > policy.maxCharacters)) ||
      !value.author || ["name", "handle"].some(key => value.author[key] !== null &&
        (typeof value.author[key] !== "string" || value.author[key].length > 256))) throw Error("invalid_forest_note");
  return { id: value.id, zone, x: value.x, y: value.y, text: value.text,
    createdAt: value.createdAt, expiresAt: value.expiresAt,
    author: { name: value.author.name, handle: value.author.handle } };
}
module.exports = { characters, bodyDto, noteDto, serverTime };
