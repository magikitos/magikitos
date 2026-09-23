"use strict";
const { compileWorld } = require("../tools/world.cjs");
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const {
  World,
  TILE,
  FOOTPRINT,
} = require("../public/assets/js/adventure/model");
const { DIRECTIONS } = require("../public/assets/js/adventure/characters");
/* ⛔ AQUÍ SE PROBABA LA VOLTERETA DEL EXPERIMENTO ARCHIVADO, y el experimento se borró entero el
   17-sep-2026 (decisión del dueño: fuera todos los laboratorios archivados). Lo que sigue
   importando no es cómo rodaba aquel prototipo sino que la voltereta NO ha vuelto al juego, y eso
   se comprueba sin él. */
assert(
  !require("../public/assets/js/adventure/locomotion").RollMotion,
  "Rolling is not a production ability",
);
const { cleanWallet } = require("../public/assets/js/adventure/economy");
const { dialogueText } = require("../public/assets/js/adventure/dialogue");
const catalog = compileWorld(process.cwd());
const manifest = JSON.parse(
  fs.readFileSync("public/assets/aventura/manifest.json"),
);
const sprites = new Set(
  Object.values(manifest.packs).flatMap((p) => p.sprites),
);
/* ⛔ AQUÍ VIVÍAN LA VOLTERETA Y LA DOBLE PULSACIÓN, y las dos se han ido con el laboratorio
   archivado que las implementaba (17-sep-2026). Ninguna de las dos es una habilidad del juego:
   `locomotion.js` no exporta la voltereta —lo sigue comprobando la línea de arriba— y no hay un
   solo consumidor de la doble pulsación en el motor. Probar el prototipo de un experimento
   borrado es probar código que ya no existe. */

/* ⛔ EL TALLER YA NO CRECE, Y POR ESO SU PUERTA SE COMPRUEBA CONTRA LA ESCENA Y NADA MÁS
   (17-sep-2026). Aquí se llamaba a `furnishWorkshop()`, que estiraba la habitación para que
   cupiera un banco por figura del catálogo de la tienda y recolocaba la salida; sin tienda no hay
   nada que estirar y el fichero de escena es la única verdad. Lo que se comprueba sigue siendo lo
   mismo: que el umbral de la puerta cuadra con la geometría direccional compartida, o sea que
   salir de un interior no depende de a mano. */
const workshop = catalog.scenes.workshop;
const workshopExit = workshop.entities.find((e) => e.id === "exit");
assert.equal(
  workshopExit.threshold[1] + workshopExit.threshold[3],
  workshop.height - 2 - FOOTPRINT.halfHeight / TILE,
  "The workshop door uses shared directional door geometry",
);
const wallet = { balance: 0, claimed: { picnic: true } };
assert.deepEqual(
  cleanWallet(wallet, catalog),
  wallet,
  "Validation never invents money",
);
assert.deepEqual(cleanWallet(cleanWallet(wallet, catalog), catalog), wallet);
assert.equal(cleanWallet({ balance: 5, claimed: {} }, catalog).balance, 5);
// El mundo ya no escribe precios dentro de una frase, así que lo que se comprueba es que la
// máquina sigue sabiendo ponerlos —vuelven el día que el dueño quiera— y que un token que nadie
// declara se queda tal cual en vez de desaparecer, que es lo que delataría una frase a medias.
assert.equal(dialogueText(":reward", catalog), ":reward");
assert.equal(
  dialogueText("por :reward setines y :price monedas", {
    economy: { fares: { wish: 3 }, rewards: { picnic: { amount: 10 } } },
    dialogueTokens: { reward: { reward: "picnic" }, price: { fare: "wish" } },
  }),
  "por 10 setines y 3 monedas",
);
for (const scene of Object.values(catalog.scenes))
  for (const boat of scene.entities.filter(
    (e) => e.interactAs && e.sprite === "bottle-boat",
  )) {
    const dock = scene.entities.find((e) => e.id === boat.interactAs);
    assert(dock.landing && !dock.actions.some((a) => a.id === "board"));
  }
assert.equal(
  catalog.scenes.overworld.entities.find((e) => e.id === "home-two").sprite,
  "home-mushroom-canela",
);
assert.equal(
  catalog.scenes.overworld.entities.find((e) => e.id === "fisher-door").sprite,
  "home-pot-terracotta",
);
/**
 * ⛔ UN BOTÓN DE PANTALLA COMPLETA QUE NO APARECE SE PARECE MUCHO A UN PERMISO DENEGADO.
 *
 * Mirando solo `document.fullscreenEnabled`, el botón se esconde en cualquier navegador que traiga
 * únicamente la API con prefijo, donde funciona perfectamente. No hay forma de tener aquí ese
 * aparato, así que se le pregunta a un documento de mentira: es lo único que prueba de verdad un
 * navegador que no tienes delante.
 */
{
  const { screenApi } = require("../public/assets/js/adventure/fullscreen");
  const conPrefijo = { webkitFullscreenEnabled: true, webkitFullscreenElement: null };
  const moderno = { fullscreenEnabled: true, fullscreenElement: null };
  const sinNada = {};

  assert.equal(screenApi(moderno).enabled(), true, "Standard API counts");
  assert.equal(screenApi(conPrefijo).enabled(), true, "⛔ A prefixed-only browser counts too");
  assert.equal(screenApi(sinNada).enabled(), false, "No API is no button");
  assert.equal(screenApi(null).enabled(), false, "Nor is an absent document");

  // Y se pide con el nombre que exista, sin ramas por dispositivo.
  let usado = null;
  screenApi(moderno).request({ requestFullscreen: () => { usado = "estándar"; return Promise.resolve(); } }, {});
  assert.equal(usado, "estándar");
  screenApi(conPrefijo).request({ webkitRequestFullscreen: () => { usado = "prefijado"; } }, {});
  assert.equal(usado, "prefijado", "The prefixed request is used when it is the only one");
  assert.equal(
    screenApi(sinNada).request({}, {}),
    null,
    "Nothing to ask with is a refusal, not a crash",
  );
  // Un documento ya en pantalla completa se reconoce con los dos nombres.
  assert(screenApi({ webkitFullscreenElement: {} }).element(), "Prefixed element is recognised");

  // ⛔ En un iPhone no hay API de elemento con ningún nombre: la salida es la pantalla de inicio.
  const { appleHandheld, standalone } = require("../public/assets/js/adventure/fullscreen");
  const chromeIos = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130.0" };
  assert.equal(appleHandheld(chromeIos), true, "Chrome on iPhone is WebKit: no element fullscreen");
  assert.equal(appleHandheld({ userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0)" }), false, "An iPad has the API");
  const media = (on) => (q) => ({ matches: on && q.includes("fullscreen") });
  assert.equal(standalone({ navigator: {}, matchMedia: media(true) }), true, "Opened installed");
  assert.equal(standalone({ navigator: { standalone: true }, matchMedia: media(false) }), true, "Legacy Safari flag");
  assert.equal(standalone({ navigator: {}, matchMedia: media(false) }), false, "In a browser tab");
}
// ⛔ «Continuar con Google» salía siempre en «algo ha fallado»: la página de Google no es de la web
// y el filtro de direcciones del API la rechazaba. Se acepta por nombre, y solo esa.
{
  const { googleConsentUrl } = require("../public/assets/js/adventure/account");
  assert(googleConsentUrl("https://accounts.google.com/o/oauth2/v2/auth?client_id=x"), "Google's consent page is accepted");
  for (const bad of ["http://accounts.google.com/o", "https://accounts.google.com.evil.example/o", "https://evil.example/?accounts.google.com",
    "https://user:pw@accounts.google.com/o", "javascript:alert(1)", "", null])
    assert.equal(googleConsentUrl(bad), null, "Not Google's consent page: " + bad);
}
console.log(
  "PASS: rolling stays out of the game, reachable doors, wallet validation, boat landings and fullscreen across both APIs.",
);
