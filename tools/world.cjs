"use strict";
const path = require("node:path"),
  fs = require("node:fs"),
  { execFileSync } = require("node:child_process");
/**
 * Compila el mundo (`data/aventura/world.php`) de un árbol cualquiera —el de verdad, una copia
 * aislada de las pruebas o el del Studio— y devuelve el catálogo. Es la ÚNICA forma de hacerlo: el
 * build, el Studio y las pruebas la comparten, así que el intérprete (`STUDIO_PHP`), el tope de
 * salida y el fallo estricto del JSON se deciden una vez.
 */
function compileWorld(root = process.cwd()) {
  const world = JSON.parse(
    execFileSync(
      process.env.STUDIO_PHP || "php",
      ["-r", "echo json_encode(require $argv[1], JSON_THROW_ON_ERROR);", path.join(root, "data/aventura/world.php")],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
  const families = JSON.parse(fs.readFileSync(path.join(root, "data/aventura/elements.json"))).families;
  return require("./harvest-yields.cjs").resolveHarvestYields(world,
    require("../public/assets/js/adventure/element-appearance").appearanceFor(families));
}
module.exports = { compileWorld };
