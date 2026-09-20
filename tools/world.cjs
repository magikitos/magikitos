"use strict";
const path = require("node:path"),
  { execFileSync } = require("node:child_process");
/**
 * Compila el mundo (`data/aventura/world.php`) de un árbol cualquiera —el de verdad, una copia
 * aislada de las pruebas o el del Studio— y devuelve el catálogo. Es la ÚNICA forma de hacerlo: el
 * build, el Studio y las pruebas la comparten, así que el intérprete (`STUDIO_PHP`), el tope de
 * salida y el fallo estricto del JSON se deciden una vez.
 */
function compileWorld(root = process.cwd()) {
  return JSON.parse(
    execFileSync(
      process.env.STUDIO_PHP || "php",
      ["-r", "echo json_encode(require $argv[1], JSON_THROW_ON_ERROR);", path.join(root, "data/aventura/world.php")],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
}
module.exports = { compileWorld };
