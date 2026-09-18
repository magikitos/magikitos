"use strict";
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { execFileSync } = require("node:child_process");

/**
 * ⛔ LO QUE EL COMPILADOR DEL MUNDO NECESITA SE ENUMERA UNA VEZ.
 *
 * Tres comprobaciones copian los datos a un directorio aislado para proponerle al compilador algo
 * que NO está en el árbol de verdad —una recogida sin registrar, una casa movida, una hoja de arte
 * retirada— y comprobar que grita. Con la lista escrita tres veces, el día que `world.php` lee una
 * entrada más se rompen dos de las tres y el informe habla de recogidas o de puertas, que es donde
 * no está el fallo. Pasó el 18-sep-2026 al derivar el elenco jugable.
 *
 * Y no se copia `data/aventura` entero a propósito: ahí dentro están los MASTERS de arte (cientos
 * de megas de PNG), y un banco de pruebas que tarda medio minuto en copiar dibujos es un banco de
 * pruebas que alguien deja de correr.
 */
const NEEDS = [
  ["data/aventura/world.php"],
  ["data/aventura/catalog.json"],
  ["data/aventura/player-art.json"],
  ["data/aventura/residents.json"],
  ["data/aventura/elements.json"],
  ["data/aventura/construction.json"],
  ["data/aventura/resource-nodes.json"],
  ["data/aventura/scene-instances.json"],
  ["data/aventura/scenes"],
  ["data/aventura/behaviors"],
  ["data/aventura/art/residents/actions/catalog.json"],
  ["public/assets/aventura/manifest.json"],
  ["src/adventure-geometry.php"],
];

/** Una copia aislada del mundo en un directorio temporal. El árbol de trabajo no se toca nunca. */
function isolateWorld(prefix = "magikitos-world-") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const [item] of NEEDS) {
    const destination = path.join(root, item);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(item, destination, { recursive: true });
  }
  return root;
}

/** Compila el mundo de un árbol cualquiera, el de verdad o uno aislado. */
function compileWorld(root) {
  return JSON.parse(
    execFileSync(
      "php",
      [
        "-r",
        "echo json_encode(require $argv[1], JSON_THROW_ON_ERROR);",
        path.join(root, "data/aventura/world.php"),
      ],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
}
module.exports = { isolateWorld, compileWorld };
