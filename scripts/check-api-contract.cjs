"use strict";
/**
 * ⛔ LO QUE EL JUEGO LLAMA TIENE QUE ESTAR EN SU LISTA BLANCA (21-sep-2026).
 *
 * `WorldApi.request` rechaza con `unknown_endpoint` cualquier punto que no esté en `METHODS`, y lo
 * hace ANTES de tocar la red. `community.maintain()` pasa el nombre del punto en una VARIABLE, así
 * que cuando la bombita y la tenaza se escribieron sin añadirlas a la lista no lo notó nadie:
 * ni el compilador, ni una prueba, ni el servidor —que las tenía implementadas y documentadas—.
 * Toda la partida de mantenimiento estaba muerta en el navegador y el jugador solo veía «vuelve a
 * intentarlo», siempre, porque el fallo llega sin `status` y cae en la rama de reintento.
 *
 * Esta prueba cierra el círculo por los dos lados: cada punto que el motor NOMBRA en su código
 * tiene que estar en la lista, y cada punto de la lista tiene que existir en el contrato público
 * con el mismo método. No hace red: compara ficheros del repositorio.
 */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { METHODS } = require("../public/assets/js/adventure/api");
const openapi = require("../docs/world-api.openapi.json");

const contract = new Map(
  Object.entries(openapi.paths).map(([route, operations]) => [
    route.replace(/^\//, ""),
    new Set(Object.keys(operations).map((m) => m.toUpperCase())),
  ]),
);
/**
 * La puerta de la cuenta de la web (`identity`, `csrf`, `vote`…) vive en el otro contrato a
 * propósito: ya tiene su Turnstile, sus límites y su cerrojo de cinco intentos, y el juego la
 * llama en vez de duplicar esa superficie. No está en el OpenAPI del mundo y no debe estarlo.
 */
const WEBSITE_DOOR = new Set(["identity", "csrf", "vote", "guardian", "guardian-thread"]);
/**
 * La telemetría NO pasa por `WorldApi`: se manda con `sendBeacon` para que salga aunque la
 * pestaña se esté cerrando, y `sendBeacon` no admite ni cabeceras ni el envoltorio de la clase.
 * Por eso construye su URL a mano (`telemetry.js`) y por eso no está —ni tiene que estar— en la
 * lista blanca. Se declara aquí para que la excepción se lea, no para que se olvide.
 */
const DIRECT = new Set(["telemetry"]);

// 1. Lo que la lista promete existe de verdad, y con el mismo verbo.
const missing = [];
for (const [endpoint, method] of Object.entries(METHODS)) {
  if (WEBSITE_DOOR.has(endpoint)) continue;
  const verbs = contract.get(endpoint);
  if (!verbs) missing.push(endpoint + ": no está en el contrato público");
  else if (!verbs.has(method))
    missing.push(endpoint + ": el contrato dice " + [...verbs].join("/") + " y la lista " + method);
}
assert.deepEqual(missing, [], "Puntos de la lista blanca que el servidor no ofrece");

// 2. Y lo que el motor nombra está en la lista. Se leen los literales del código, que es
//    justamente lo que un `maintain(endpoint)` con variable esconde de cualquier otra revisión.
const engine = path.resolve(__dirname, "../public/assets/js/adventure");
const sources = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith(".js")) sources.push(file);
  }
})(engine);
const named = new Map();
for (const file of sources) {
  const text = fs.readFileSync(file, "utf8");
  for (const [route] of contract) {
    // El nombre entre comillas, solo, que es como se escribe al llamar.
    if (new RegExp('["\'`]' + route.replace(/[-/]/g, "\\$&") + '["\'`]').test(text))
      named.set(route, (named.get(route) || []).concat(path.basename(file)));
  }
}
const unlisted = [...named.keys()].filter(
  (route) => !Object.hasOwn(METHODS, route) && !DIRECT.has(route),
);
assert.deepEqual(
  unlisted,
  [],
  "El motor nombra puntos que su lista blanca rechazaría: " +
    unlisted.map((r) => r + " (" + named.get(r).join(", ") + ")").join("; "),
);

// 3. Y los dos que el fallo dejó fuera, por su nombre, para que no vuelvan a caerse en silencio.
for (const endpoint of ["community-build", "community-use", "community-mine", "community-defuse"])
  assert.equal(METHODS[endpoint], "POST", "El mantenimiento de la comunidad viaja: " + endpoint);

console.log(
  "PASS contrato de la API: " +
    Object.keys(METHODS).length +
    " puntos en la lista blanca, " +
    contract.size +
    " en el contrato público, " +
    named.size +
    " nombrados por el motor; ninguno se queda fuera.",
);
