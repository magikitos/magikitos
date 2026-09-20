"use strict";
/**
 * Arranca un Studio aislado para una prueba de navegador: un puerto propio, un directorio de
 * trabajo temporal (nunca el del dueño) y la espera a que anuncie su dirección. Un arranque frío
 * prepara su atlas de autoría, por eso el margen es largo: es preparación de arte, no tiempo de
 * carga del juego. Lo comparten todas las suites del Studio.
 */
const cp = require("node:child_process");
function startStudio({ port, temp, timeoutMs = 120000 }) {
  const studio = cp.spawn(process.execPath, ["tools/adventure-studio/server.cjs"], {
    env: { ...process.env, STUDIO_PORT: String(port), STUDIO_DATA_DIR: temp },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  // Lo que ha dicho el servidor, para quien falle A MITAD de la prueba y no en el arranque: sin
  // esto, un Studio que se muere deja un error de Playwright a secas y nada que leer.
  studio.log = () => output;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      // ⛔ Y SE MATA AL IRSE. El puerto es fijo: un arranque que expira sin matar al hijo deja un
      // Studio vivo que hace expirar también la siguiente pasada, y se persigue un fantasma.
      studio.kill();
      reject(Error("Studio startup timeout: " + output));
    }, timeoutMs);
    studio.stdout.on("data", (b) => {
      output += b;
      if (output.includes("Magikitos Studio:")) {
        clearTimeout(timer);
        resolve(studio);
      }
    });
    studio.stderr.on("data", (b) => (output += b));
    studio.once("exit", (code) => {
      clearTimeout(timer);
      reject(Error("Studio exited " + code + ": " + output));
    });
  });
}
module.exports = { startStudio };
