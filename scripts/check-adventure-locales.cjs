"use strict";
/**
 * EL MOTOR NO PUEDE DEPENDER DE UNA PANTALLA, Y UNA PANTALLA NO PUEDE PEDIR LO QUE NADIE DICE.
 *
 * Desde que el texto viaja por pantalla (tools/locales.cjs) hay una forma nueva de romper el
 * juego sin que falle nada: una frase que el motor dice en cualquier sitio se cae dentro del
 * paquete de una escena y, a partir de ahí, en las otras dieciséis el botón enseña el nombre de
 * su clave. No da error, no sale en ningún log y solo se ve estando en la pantalla equivocada.
 *
 * Esto lo comprueba en las dos direcciones y encima EN NEGATIVO: rompe a propósito cada
 * invariante y exige que componer grite. Un comprobador que no se ha visto fallar es un
 * comprobador apagado.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const { execFileSync } = require("node:child_process");
const { composeLocales, sceneKeys, readUnits, pageKeys, LANGS } = require("../tools/locales.cjs");

const world = JSON.parse(
  execFileSync("php", ["-r", 'echo json_encode(require "data/aventura/world.php");'], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }),
);
const { core, scenes } = composeLocales(world);
const units = readUnits();

for (const lang of LANGS) assert(core[lang], "core sin " + lang);
assert.equal(Object.keys(scenes).length, Object.keys(world.scenes).length);

// 1. La página se monta con el core y nada más: un {{hueco}} que viviera en una pantalla dejaría
//    el HTML sin construir en el build, que es tarde pero visible; sin esto, sale en blanco.
for (const key of pageKeys())
  if (!["configuration", "languageOptions", "locale", "prefix"].includes(key))
    for (const lang of LANGS)
      assert(core[lang][key], "game.html pide {{" + key + "}} y el core no lo tiene (" + lang + ")");

// 2. Toda clave que el motor nombra a las claras tiene que estar en el core. Se leen las tres
//    formas en que el motor pide un texto; lo que pide por variable no se puede leer así y va
//    enumerado en tools/locales.cjs.
const js = fs
  .readdirSync("public/assets/js/adventure", { recursive: true })
  .filter((f) => f.endsWith(".js"))
  .map((f) => fs.readFileSync(path.join("public/assets/js/adventure", f), "utf8"))
  .join("\n");
const known = new Set([
  ...Object.keys(core.es),
  ...Object.values(scenes).flatMap((b) => Object.keys(b.es)),
]);
const asked = new Set();
for (const m of js.matchAll(/\b(?:text|lines)\(\s*["'`]([A-Za-z_][\w]*)["'`]\s*\)/g))
  asked.add(m[1]);
for (const m of js.matchAll(/\|\|\s*["'`]([A-Za-z_][\w]*)["'`]\s*[,)]/g)) asked.add(m[1]);
for (const m of js.matchAll(/\.s\.([A-Za-z_][\w]*)\b/g)) asked.add(m[1]);
let checked = 0;
for (const key of asked) {
  if (!known.has(key)) continue; // no es una clave de textos, es otra cadena cualquiera
  checked++;
  for (const lang of LANGS)
    assert(
      core[lang][key],
      "el motor pide «" + key + "» en cualquier pantalla, así que va en core.json",
    );
}
assert(checked > 20, "el barrido de literales no ha mirado nada: " + checked);

// 3. Lo que pide cada pantalla se resuelve con su paquete más el core, en los seis idiomas.
let frases = 0;
for (const [id, scene] of Object.entries(world.scenes))
  for (const key of sceneKeys(scene))
    for (const lang of LANGS) {
      assert(
        scenes[id][lang][key] ?? core[lang][key],
        id + "/" + lang + ": nadie dice «" + key + "»",
      );
      frases++;
    }

// 4. Nada se paga dos veces: el paquete de una pantalla no repite lo que el core ya lleva.
for (const [id, bundle] of Object.entries(scenes))
  for (const key of Object.keys(bundle.es))
    assert(!core.es[key], id + " repite «" + key + "», que ya viaja en el core");

// 5. Un pack es de varias pantallas por definición, y una pantalla no toca el fichero de otra.
for (const [name, unit] of Object.entries(units.packs))
  for (const key of Object.keys(unit)) {
    const clientes = Object.values(world.scenes).filter((s) => sceneKeys(s).has(key));
    assert(clientes.length > 1, "packs/" + name + ": «" + key + "» tiene un solo cliente");
  }

// 6. EN NEGATIVO. Si romper una regla no hace gritar a componer, la regla no existe.
const dir = "data/aventura/locales";
function rompe(file, mutate, esperado) {
  const original = fs.readFileSync(file, "utf8");
  try {
    fs.writeFileSync(file, JSON.stringify(mutate(JSON.parse(original)), null, 2));
    let grito = null;
    try {
      composeLocales(world);
    } catch (error) {
      grito = error.message;
    }
    assert(grito, "componer aceptó: " + esperado);
  } finally {
    fs.writeFileSync(file, original);
  }
}
rompe(
  path.join(dir, "scenes/overworld.json"),
  (u) => {
    delete u[Object.keys(u)[0]];
    return u;
  },
  "una pantalla sin una de sus frases",
);
rompe(
  path.join(dir, "scenes/overworld.json"),
  (u) => {
    const key = Object.keys(u)[0];
    delete u[key].de;
    return u;
  },
  "una frase sin alemán",
);
rompe(
  path.join(dir, "scenes/overworld.json"),
  (u) => ({ ...u, unaFraseQueNadieDice: Object.fromEntries(LANGS.map((l) => [l, "x"])) }),
  "una frase que ya no dice nadie",
);
rompe(
  path.join(dir, "scenes/tavern.json"),
  (u) => ({ ...u, blocked: Object.fromEntries(LANGS.map((l) => [l, "x"])) }),
  "una pantalla redefiniendo una clave del motor",
);
rompe(
  path.join(dir, "core.json"),
  (u) => {
    const key = Object.keys(u)[0];
    u[key].es = "";
    return u;
  },
  "una frase vacía",
);
// Y componer sigue funcionando después de los cinco destrozos.
composeLocales(world);

const pesoCore = Buffer.byteLength(JSON.stringify(core.es));
const pesoMayor = Math.max(
  ...Object.values(scenes).map((b) => Buffer.byteLength(JSON.stringify(b.es))),
);
console.log(
  "PASS textos por pantalla: " +
    Object.keys(core.es).length +
    " claves de motor (" +
    pesoCore +
    " B) + " +
    Object.keys(world.scenes).length +
    " paquetes (el mayor, " +
    pesoMayor +
    " B), " +
    frases +
    " resoluciones en seis idiomas, " +
    checked +
    " literales del motor en core y cinco destrozos que gritan.",
);
