"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { World, TILE } = require("../../public/assets/js/adventure/model");
const {
  resolveAppearance,
} = require("../../public/assets/js/adventure/elements");
const { readUnits } = require("../locales.cjs");
const { compileWorld } = require("../world.cjs");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

/**
 * ⛔ EL STUDIO NO TIENE SU PROPIA LISTA DE NOMBRES DE PANTALLA, PORQUE UNA LISTA A MANO CADUCA.
 *
 * La tuvo, dentro de `app.js`, y caducó como caduca todo lo que se escribe dos veces: nombraba
 * tres escenas que ya no existen (`human-house`, `home-mushroom-canela`, `home-pot-terracotta`) y
 * le faltaban las seis que nacieron después, así que el río, el seto, la seta y la maceta salían
 * con su SLUG en el selector. El nombre de una pantalla ya existe y es el que el juego ANUNCIA al
 * llegar: se resuelve igual que en `sceneKeys()` —el rótulo de la escena y, si no lo tiene, el
 * nombre del trozo de mapa— y se lee en castellano de los mismos ficheros de texto. Así una
 * pantalla nueva llega al Studio con su nombre puesto sin tocar una línea de aquí.
 */
function sceneNames(world) {
  const { core, packs, scenes } = readUnits();
  const shared = { ...core };
  for (const pack of Object.values(packs)) Object.assign(shared, pack);
  const out = {};
  for (const [id, scene] of Object.entries(world.scenes)) {
    const key = scene.label || (scene.indoor ? id : "forest");
    const entry = scenes[id]?.[key] || shared[key];
    const text = entry?.es;
    out[id] = typeof text === "string" && text ? text : id;
  }
  return out;
}
function snapshot(root) {
  const dir = path.join(root, "data/aventura"),
    sources = {};
  const world = compileWorld(root);
  // Edit each authored template once; guest instances and moored vessels are derived data.
  const instances = JSON.parse(
    fs.readFileSync(path.join(dir, "scene-instances.json")),
  );
  for (const id of Object.keys(instances)) delete world.scenes[id];
  for (const scene of Object.values(world.scenes))
    scene.entities = scene.entities
      .filter((e) => !e.generated)
      .map((e) => resolveAppearance(e, scene.id));
  const scenery = {};
  for (const [id, scene] of Object.entries(world.scenes)) {
    const text = fs.readFileSync(
      path.join(dir, "scenes", id + ".json"),
      "utf8",
    );
    sources[id] = { data: JSON.parse(text), hash: hash(text) };
    scenery[id] = new World(scene).props.map((e) => ({
      ...e,
      x: e.x / TILE,
      y: e.y / TILE,
      ...(e.id.startsWith("tree-")
        ? { solid: e.solid || [-0.5, -0.5, 1, 1] }
        : {}),
    }));
  }
  const manifest = fs.readFileSync(
    path.join(root, "public/assets/aventura/manifest.json"),
    "utf8",
  );
  const sprites = {};
  for (const file of fs
    .readdirSync(path.join(dir, "assets"))
    .filter((f) => f.endsWith(".json"))) {
    const source = fs.readFileSync(path.join(dir, "assets", file), "utf8"),
      pack = JSON.parse(source);
    for (const [name, definition] of Object.entries(pack.frames || {})) {
      if (name.startsWith("person-") && !/^person-1\d\d-down$/.test(name))
        continue;
      sprites[name] = {
        file: "data/aventura/assets/" + file,
        sourceHash: hash(source),
        definition,
      };
    }
  }
  const baseHash = hash(JSON.stringify({ world, sources, manifest, sprites }));
  return {
    baseHash,
    createdAt: new Date().toISOString(),
    world,
    // Fuera del mundo a propósito: `proposedScene` clona la escena para escribirla, y un nombre
    // de interfaz no tiene nada que hacer dentro de un fichero del juego.
    nombres: sceneNames(world),
    sources,
    scenery,
    sprites,
  };
}
module.exports = { snapshot, hash };
