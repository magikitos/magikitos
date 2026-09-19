"use strict";
/**
 * ⛔ TANTAS PRUEBAS DAN BOMBITA COMO TENAZA (AUTOMANTENIMIENTO.md §5): se cuentan las recompensas
 * de los dos objetos en todas las escenas y tienen que ser iguales, al menos una, y en pantallas
 * distintas. Es barato, y es lo único que impide que el equilibrio se rompa el día que alguien
 * añada una prueba. También vigila el tope: uno de cada, consumibles, y la regla que los da solo
 * entra con el saco vacío de ese objeto.
 */
const assert = require("node:assert/strict"), fs = require("node:fs");
const world = JSON.parse(fs.readFileSync(".local/build/world.json", "utf8"));
for (const id of ["bomba", "desactivador"]) {
  const item = world.items[id];
  assert(item, "Existe el objeto " + id);
  assert.equal(item.max, 1, id + ": tope uno por cuenta");
  assert.equal(item.reusable, false, id + ": se gasta al usarse");
  assert.equal(item.usable, true, id + ": se lleva en la mano");
  assert(item.sprite, id + ": tiene icono en el saco");
}
const grants = { bomba: [], desactivador: [] };
for (const [scene, data] of Object.entries(world.scenes))
  for (const e of data.entities || [])
    for (const rule of e.rules || [])
      for (const f of rule.effects || [])
        if (f.type === "item" && f.amount > 0 && grants[f.item]) {
          grants[f.item].push({ scene, entity: e.id });
          assert.equal(rule.when?.maxItems?.[f.item], 0, `${scene}/${e.id}: la regla que da ${f.item} solo entra sin ${f.item} en el saco`);
          assert(Object.keys(rule.when?.items || {}).length, `${scene}/${e.id}: conseguir ${f.item} cuesta algo`);
        }
assert(grants.bomba.length >= 1, "Hay al menos una prueba que da bombita");
assert.equal(grants.bomba.length, grants.desactivador.length, "Bombitas y tenazas se consiguen en el mismo número de sitios " + JSON.stringify(grants));
const scenesB = new Set(grants.bomba.map((g) => g.scene)), scenesD = new Set(grants.desactivador.map((g) => g.scene));
assert([...scenesB].every((s) => !scenesD.has(s)), "La bombita y la tenaza se consiguen en pantallas distintas " + JSON.stringify(grants));
console.log("PASS bomb balance: " + grants.bomba.length + " prueba(s) de bombita y " + grants.desactivador.length + " de tenaza, en pantallas distintas, tope uno y consumibles.");
