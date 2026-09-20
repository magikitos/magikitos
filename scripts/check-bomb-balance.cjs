"use strict";
/**
 * ⛔ LA ECONOMÍA DEL ALMACÉN, EN SETAS (docs/AUTOMANTENIMIENTO.md §5 y decisión del dueño, 19-sep-2026):
 * la gravilla, la bombita y la tenaza salen SOLO del constructor, se pagan en setas y nunca en
 * setines (los setines son reputación); la bombita cuesta más que la tenaza (poner caro, desactivar
 * barato); un saco es lo que dice `gravilla.bundle`; los tres objetos tienen su tope; y las setas
 * rebrotan a las ocho horas. Falla el día que alguien añada un trueque en setines o rompa la
 * asimetría.
 */
const assert = require("node:assert/strict"), fs = require("node:fs");
const world = JSON.parse(fs.readFileSync(".local/build/world.json", "utf8"));
const items = world.items;
for (const id of ["bomba", "desactivador"]) {
  assert(items[id], "Existe el objeto " + id);
  assert.equal(items[id].max, 1, id + ": tope uno por cuenta");
  assert.equal(items[id].reusable, false, id + ": se gasta al usarse");
  assert.equal(items[id].usable, true, id + ": se lleva en la mano");
  assert(items[id].sprite, id + ": tiene icono en el saco");
}
assert.equal(items.gravilla.bundle, 10, "Un saco de gravilla son diez celdas");
assert(items.gravilla.max >= items.gravilla.bundle * 3, "En el saco caben varios sacos de gravilla");
assert.deepEqual(world.construction.definitions["forest-path"].costPerTile, { gravilla: 1 }, "El camino se paga con una gravilla por celda");
assert.equal(world.scenes.overworld.entities.find((e) => e.id === "bank-mushrooms")?.harvest?.renewMs ?? world.scenes.overworld.entities.find((e) => e.harvest && e.rules?.some((r) => r.effects.some((f) => f.item === "mushroom")))?.harvest?.renewMs, 8 * 3600000, "Las setas rebrotan a las ocho horas");

const grants = { bomba: [], desactivador: [], gravilla: [] };
for (const [scene, data] of Object.entries(world.scenes))
  for (const e of data.entities || [])
    for (const rule of e.rules || [])
      for (const f of rule.effects || []) {
        assert(!["reward", "spend"].includes(f.type) || !JSON.stringify(rule).match(/bomba|desactivador|gravilla/), `${scene}/${e.id}: nada del almacén se paga con setines`);
        if (f.type === "item" && f.amount > 0 && grants[f.item]) {
          const paid = (rule.effects || []).find((g) => g.type === "item" && g.item === "mushroom" && g.amount < 0);
          assert(paid || f.item === "gravilla", `${scene}/${e.id}: ${f.item} se paga con setas`);
          grants[f.item].push({ scene, entity: e.id, mushrooms: paid ? -paid.amount : 0, amount: f.amount, rule });
        }
      }
assert.equal(grants.bomba.length, 1, "Una sola forma de conseguir bombita: el constructor " + JSON.stringify(grants.bomba.map((g) => g.entity)));
assert.equal(grants.desactivador.length, 1, "Una sola forma de conseguir tenaza: el constructor");
assert.equal(grants.bomba[0].entity, "warehouse-keeper");
assert.equal(grants.desactivador[0].entity, "warehouse-keeper");
assert(grants.bomba[0].mushrooms > grants.desactivador[0].mushrooms, "Poner cuesta más que desactivar: " + JSON.stringify([grants.bomba[0].mushrooms, grants.desactivador[0].mushrooms]));
assert.equal(grants.bomba[0].rule.when?.maxItems?.bomba, 0, "La bombita solo se compra sin bombita en el saco");
assert.equal(grants.desactivador[0].rule.when?.maxItems?.desactivador, 0, "La tenaza solo se compra sin tenaza en el saco");
for (const g of grants.gravilla) {
  assert.equal(g.amount, items.gravilla.bundle, `${g.entity}: un saco es un saco`);
  assert(g.rule.when?.maxItems?.gravilla <= items.gravilla.max - items.gravilla.bundle, `${g.entity}: no se vende lo que no cabe`);
  assert.equal(g.mushrooms, 5, `${g.entity}: la gravilla cuesta cinco setas, siempre`);
  assert(!g.rule.effects.some((f) => f.type === "timer"), `${g.entity}: la gravilla no va con reloj`);
}
// ⛔ LOS SACOS NO SE REGALAN (20-sep-2026, decisión del dueño: «esa idea es una estupidez»). Una
// sola forma de conseguir gravilla, y es cambiando setas con Cebolino.
assert.equal(grants.gravilla.length, 1, "La gravilla solo se consigue cambiando setas");
assert.equal(grants.gravilla[0].entity, "warehouse-keeper");
assert(!Object.hasOwn(world.timers, "gravelDaily"), "No queda ningún reloj de regalo de gravilla");
console.log("PASS bomb balance: bombita " + grants.bomba[0].mushrooms + " setas, tenaza " + grants.desactivador[0].mushrooms + " setas, saco de " + items.gravilla.bundle + " por 5 setas y nada regalado, setas a 8 h, cero setines.");
