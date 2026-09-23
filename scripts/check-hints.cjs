"use strict";
/**
 * Las pistas de los vecinos (`catalog.hints`, `catalog.hintCarriers`, ver game.hint()): cada paso
 * nombra marcas y objetos que existen, cada pista y cada frase que la lleva está en los seis
 * idiomas, una partida en blanco oye la primera pista y una partida terminada oye la última.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { matches } = require("../public/assets/js/adventure/rules");
const catalog = JSON.parse(fs.readFileSync("data/aventura/catalog.json"));
const core = JSON.parse(fs.readFileSync("data/aventura/locales/core.json"));
const scenes = ["scenes", "packs"].flatMap((dir) =>
  fs.readdirSync("data/aventura/locales/" + dir).map((f) =>
    JSON.parse(fs.readFileSync(`data/aventura/locales/${dir}/${f}`))));
const LANGS = ["es", "en", "de", "fr", "it", "pt"];
const find = (key) => core[key] || scenes.find((s) => s[key])?.[key];
assert(catalog.hints.length > 3 && catalog.hintCarriers.length > 3);
for (const step of catalog.hints) {
  const text = core[step.key];
  assert(text, "Hint text in core: " + step.key);
  for (const l of LANGS) assert(text[l] && [].concat(text[l]).every(Boolean), `${step.key} in ${l}`);
  for (const flag of Object.keys(step.when.flags || {})) assert(catalog.flags.includes(flag), "Flag exists: " + flag);
  for (const item of Object.keys({ ...step.when.items, ...step.when.maxItems }))
    assert(catalog.items[item], "Item exists: " + item);
}
assert.deepEqual(catalog.hints.at(-1).when, {}, "The last hint always applies, so nobody runs out");
for (const key of catalog.hintCarriers) {
  const text = find(key);
  assert(text, "Carrier line exists: " + key);
  for (const l of LANGS) assert(text[l], `${key} in ${l}`);
}
const pick = (state) => catalog.hints.find((h) => matches(state, h.when)).key;
assert.equal(pick({ flags: {}, inventory: {} }), catalog.hints[0].key, "A blank journey hears the first step");
const done = { flags: Object.fromEntries(catalog.flags.map((f) => [f, true])), inventory: { mushroom: 9, twig: 1, bottle: 1 } };
assert.equal(pick(done), "hintFree", "A finished journey hears the open ending");
console.log(`PASS hints: ${catalog.hints.length} steps, ${catalog.hintCarriers.length} carriers, six languages.`);
