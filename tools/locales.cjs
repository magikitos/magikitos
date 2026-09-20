"use strict";
/**
 * EL MOTOR ES GLOBAL, EL TEXTO ES DE CADA PANTALLA.
 *
 * Hasta el 17-sep-2026 el juego llevaba UN fichero de textos por idioma con las 335 claves
 * dentro, y la página lo incrustaba entero: para leer un cartel de la taberna te bajabas lo que
 * dice el río. Ahora hay dos capas y una sola regla para decidir dónde va cada clave:
 *
 *   core.json      lo que dice el MOTOR — menús, botones, avisos, nombres de los objetos del
 *                  saco, etiquetas del catálogo. Viaja incrustado en la página, siempre.
 *   packs/*.json   lo que dicen unas POCAS pantallas porque comparten una familia de
 *                  comportamientos (el muelle, la recolecta, las puertas y sus interiores).
 *   scenes/*.json  lo que dice ESA pantalla y solo esa.
 *
 * El artefacto que se publica NO tiene packs: para cada pantalla se compone un único fichero
 * `assets/locales/{idioma}/{escena}.json` con exactamente lo que esa pantalla necesita y que el
 * core no trae ya. Lo pide `SceneDirector.prepare()` al lado de sus sprites, así que un idioma
 * nuevo o una pantalla nueva no engordan ni un byte lo que se carga al entrar al bosque.
 *
 * ⛔ CADA CLAVE SE ESCRIBE CON SUS SEIS IDIOMAS JUNTOS (`{clave: {es, en, de, fr, it, pt}}`) y no
 * con seis ficheros paralelos. La paridad deja de ser algo que comprobar: una clave a la que le
 * falte un idioma no es un descuido que se despliega, es un fichero que no compone. Y al tocar
 * una frase se ven las seis de un vistazo, que es lo que evita que la gracia solo exista en
 * castellano.
 *
 * ⛔ Y NINGUNA CLAVE SE DEFINE DOS VECES. Si una frase la dicen dos pantallas, sube a un pack; si
 * la dice el motor, vive en el core y las pantallas no la repiten. Componer aborta si una clave
 * aparece en dos sitios, si una pantalla pide algo que nadie define, o si un pack o una pantalla
 * guardan una frase que ya no dice nadie. Lo que no se puede derivar —las claves que el motor
 * construye pegando trozos— está enumerado abajo y se comprueba igual.
 */
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
const dir = path.join(root, "data/aventura/locales");
const LANGS = Object.freeze(["es", "en", "de", "fr", "it", "pt"]);

/**
 * Claves que el motor arma pegando un trozo fijo a un dato, así que ningún barrido de literales
 * las encuentra. Se enumeran a mano PORQUE no son derivables, y se comprueban igual que el resto:
 * la lista es el contrato, no una excusa.
 */
const BUILT = Object.freeze({
  // game.js: `enter_` / `invite_` + el `content` de una reunión (gatherings de la escena).
  gathering: (content) => ["enter_" + content, "invite_" + content],
  // site.js/activities.js: text(group), donde group es una sala de contenido del catálogo.
  room: (key) => [key],
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Un fichero de textos, validado: seis idiomas por clave, ni uno de menos. */
function readUnit(file, label) {
  if (!fs.existsSync(file)) return {};
  const raw = readJson(file);
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error(label + ": " + key + " no lleva sus idiomas");
    const langs = Object.keys(value).sort();
    if (langs.join(",") !== [...LANGS].sort().join(","))
      throw Error(
        label + ": " + key + " tiene [" + langs.join(",") + "] y hacen falta los seis",
      );
    for (const lang of LANGS) {
      const text = value[lang];
      const ok = Array.isArray(text)
        ? text.length > 0 && text.every((t) => typeof t === "string" && t.trim())
        : typeof text === "string" && text.trim();
      if (!ok) throw Error(label + ": " + key + "." + lang + " está vacío");
    }
  }
  return raw;
}

function readUnits() {
  const packs = {},
    scenes = {};
  for (const file of fs.readdirSync(path.join(dir, "packs")).sort())
    packs[path.basename(file, ".json")] = readUnit(
      path.join(dir, "packs", file),
      "packs/" + file,
    );
  for (const file of fs.readdirSync(path.join(dir, "scenes")).sort())
    scenes[path.basename(file, ".json")] = readUnit(
      path.join(dir, "scenes", file),
      "scenes/" + file,
    );
  return { core: readUnit(path.join(dir, "core.json"), "core.json"), packs, scenes };
}

/**
 * Lo que una pantalla tiene que poder decir. Sale de la escena ya compuesta (`world.php`), así
 * que una escena nueva trae sus claves sin tocar esta función: lo que se lee son los sitios donde
 * el motor busca un texto, no una lista de pantallas.
 */
function sceneKeys(scene) {
  const keys = new Set();
  const add = (key) => {
    if (typeof key === "string" && key) keys.add(key);
  };
  // Al llegar se anuncia el rótulo de la pantalla y, si no lo tiene, el nombre del trozo de mapa
  // donde caes —y dentro de una casa, el de la propia pantalla—. Eso es exactamente lo que
  // pregunta `game.js` al viajar, así que es lo que hay que poder decir: sin esto la llegada
  // enseña el slug pelado y no falla nada en ninguna parte. Le pasaba a cuatro sitios el
  // 17-sep-2026 («house», «tavern», «lake» y «picnic»).
  add(scene.label);
  if (!scene.label) {
    add(scene.indoor ? scene.id : "forest");
    for (const region of scene.regions || []) add(region.id);
  }
  for (const entity of scene.entities || []) {
    add(entity.label);
    for (const action of entity.actions || []) add(action.label);
    for (const rule of entity.rules || [])
      for (const effect of rule.effects || [])
        if (effect.type === "dialogue") add(effect.key);
    add(entity.resource?.empty);
    add(entity.dialogue);
  }
  for (const neighbor of scene.neighbors || []) {
    add(neighbor.dialogue);
    add(neighbor.bump);
  }
  // Quien navega el río se queja con su propia frase: la declara el cuerpo, no el motor.
  for (const visitor of scene.riverLife || []) add(visitor.bump);
  for (const gathering of scene.gatherings || [])
    if (gathering.content) for (const key of BUILT.gathering(gathering.content)) add(key);
  return keys;
}

/**
 * Compone lo que se publica. Devuelve el core por idioma y, por escena, solo lo que el core no
 * trae ya — de ahí que una escena sin frases propias pese literalmente `{}`.
 */
function composeLocales(world) {
  const { core, packs, scenes } = readUnits();
  const owner = new Map();
  const claim = (key, where) => {
    if (owner.has(key))
      throw Error("Clave repetida: " + key + " en " + owner.get(key) + " y en " + where);
    owner.set(key, where);
  };
  for (const key of Object.keys(core)) claim(key, "core");
  for (const [name, unit] of Object.entries(packs))
    for (const key of Object.keys(unit)) claim(key, "packs/" + name);
  for (const [id, unit] of Object.entries(scenes))
    for (const key of Object.keys(unit)) claim(key, "scenes/" + id);

  const used = new Set();
  const bundles = {};
  for (const [id, scene] of Object.entries(world.scenes)) {
    const bundle = Object.fromEntries(LANGS.map((lang) => [lang, {}]));
    for (const key of sceneKeys(scene)) {
      const where = owner.get(key);
      if (!where) throw Error("La escena " + id + " pide «" + key + "» y no lo dice nadie");
      used.add(key);
      // El core viaja siempre incrustado: repetirlo en el paquete de la pantalla sería pagar
      // dos veces por la misma frase.
      if (where === "core") continue;
      if (where.startsWith("scenes/") && where !== "scenes/" + id)
        throw Error(
          "La escena " + id + " pide «" + key + "», que vive en " + where + "; súbelo a un pack",
        );
      const source = where.startsWith("packs/")
        ? packs[where.slice(6)]
        : scenes[where.slice(7)];
      for (const lang of LANGS) bundle[lang][key] = source[key][lang];
    }
    bundles[id] = bundle;
  }
  for (const [name, unit] of Object.entries(packs))
    for (const key of Object.keys(unit))
      if (!used.has(key)) throw Error("packs/" + name + ": nadie dice «" + key + "»");
  for (const [id, unit] of Object.entries(scenes)) {
    if (!world.scenes[id]) throw Error("scenes/" + id + ".json no es ninguna pantalla");
    for (const key of Object.keys(unit))
      if (!used.has(key)) throw Error("scenes/" + id + ": nadie dice «" + key + "»");
  }
  // Un pack con una sola clienta no es un pack: es una frase de esa pantalla en el sitio
  // equivocado, y el día que se edite nadie sabrá a quién afecta.
  for (const [name, unit] of Object.entries(packs))
    for (const key of Object.keys(unit)) {
      const clientes = Object.entries(world.scenes).filter(([, s]) => sceneKeys(s).has(key));
      if (clientes.length < 2)
        throw Error(
          "packs/" + name + ": «" + key + "» solo lo dice " +
            (clientes[0]?.[0] || "nadie") + "; bájalo a su pantalla",
        );
    }

  const byLang = Object.fromEntries(
    LANGS.map((lang) => [
      lang,
      Object.fromEntries(Object.entries(core).map(([key, value]) => [key, value[lang]])),
    ]),
  );
  return { core: byLang, scenes: bundles };
}

/** Las claves que la página interpola ({{clave}}) tienen que estar en el core, o no hay página. */
function pageKeys() {
  const html = fs.readFileSync(path.join(root, "public/game.html"), "utf8");
  return [...html.matchAll(/{{(\w+)}}/g)].map((m) => m[1]);
}

module.exports = { LANGS, composeLocales, sceneKeys, readUnits, pageKeys };
