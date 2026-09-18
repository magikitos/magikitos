"use strict";
/**
 * Fullscreen owns the complete document, never just the canvas. Enter-only UI.
 *
 * ⛔ Y SE HABLA CON LAS DOS APIS, NO SOLO CON LA ESTÁNDAR. Mirando únicamente
 * `document.fullscreenEnabled` el botón se ESCONDE en cualquier navegador que solo traiga la
 * versión con prefijo —Safari de iPad antiguo, WebViews de Android— aunque ahí funcione
 * perfectamente. El dueño lo describió como «a veces no me da el permiso»: no era el permiso, era
 * que en ese aparato el botón no llegaba a existir. Se resuelve con un adaptador de cuatro
 * líneas, no con una rama por dispositivo.
 *
 * Lo que NO se puede arreglar con código: en el iPhone la API de pantalla completa no existe para
 * un elemento, solo para un vídeo. Ahí el botón no aparece a propósito, y es lo honesto: el juego
 * ya ocupa el viewport entero. Un botón que no puede cumplir es peor que ningún botón.
 */
/** La misma capacidad con cualquiera de los dos nombres. Recibe el documento para poder
 *  preguntarle a uno de mentira: es la única forma de probar un navegador que no tienes. */
function screenApi(doc = typeof document === "undefined" ? null : document) {
  return {
    enabled: () => Boolean(doc && (doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled)),
    element: () => (doc ? doc.fullscreenElement || doc.webkitFullscreenElement || null : null),
    request: (node, options) =>
      node.requestFullscreen
        ? node.requestFullscreen(options)
        : node.webkitRequestFullscreen
          ? Promise.resolve(node.webkitRequestFullscreen())
          : null,
    events: ["fullscreenchange", "webkitfullscreenchange"],
  };
}
class Fullscreen {
  constructor(game, screen = screenApi()) {
    this.game = game;
    this.screen = screen;
    this.button = document.getElementById("world-fullscreen");
    this.native = window.MagikitosPlatform?.native === true;
    const root = document.documentElement;
    this.supported =
      this.native ||
      Boolean(
        screen.enabled() &&
          (root.requestFullscreen || root.webkitRequestFullscreen),
      );
    this.button.addEventListener("click", () => {
      // ⛔ NADA ASÍNCRONO ANTES DE PEDIRLA. El gesto de la persona se gasta en el primer `await`,
      // y a partir de ahí el navegador rechaza la petición sin decir por qué. Desbloquear el
      // audio devuelve una promesa que aquí NO se espera a propósito.
      game.unlockAudio();
      this.enter();
    });
    for (const event of screen.events)
      document.addEventListener(event, () => this.paint());
    this.paint();
  }
  paint() {
    this.button.hidden =
      !this.supported ||
      this.native ||
      Boolean(this.screen.element()) ||
      !this.game.entry?.entered;
  }
  enter() {
    if (this.native)
      return Promise.resolve(window.MagikitosPlatform.immerse()).catch(
        () => false,
      );
    if (!this.supported || this.screen.element())
      return Promise.resolve(false);
    const asked = this.screen.request(document.documentElement, {
      navigationUI: "hide",
    });
    if (!asked) return this.refuse("no hay API de pantalla completa en este navegador");
    return Promise.resolve(asked)
      .then(() => {
        this.paint();
        return true;
      })
      .catch((error) => this.refuse(error?.message || "el navegador la ha rechazado"));
  }
  /** Se le dice a la persona lo mismo de siempre, y al diagnóstico POR QUÉ. Sin el motivo, un
   *  fallo de pantalla completa es imposible de perseguir: no deja rastro en ninguna parte. */
  refuse(reason) {
    console.warn("Adventure fullscreen:", reason);
    this.game.toast(this.game.text("fullscreenUnavailable"));
    this.paint();
    return Promise.resolve(false);
  }
}
module.exports = { Fullscreen, screenApi };
