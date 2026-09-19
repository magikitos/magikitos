"use strict";
const { clampCamera } = require("./camera");
const { TILE, clamp } = require("./geometry");
const DRAG_SLOP = 8; // CSS pixels, equally comfortable for mouse, pen and touch.
/**
 * Cada cuánto se replanea el destino mientras el dedo arrastra, en píxeles de MUNDO. Un camino
 * por fotograma serían sesenta búsquedas por segundo para mover la meta cuatro píxeles; con esto
 * el destino se refresca cuando de verdad ha cambiado de sitio y el rumbo se sigue viendo pegado
 * al dedo, porque entre replaneos el duende ya va hacia allí.
 */
const LEAD_STEP = 14;
const point = (event) => ({ x: event.clientX, y: event.clientY });

/**
 * A gesture is either a tap, a drag or a pinch. Un toque ordena un viaje CON interacción —lo que
 * señalas, se usa—; un arrastre ordena un viaje sin ella, hacia el centro de lo que miras. Un
 * pellizco no ordena nada.
 */
class MapGestures {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.points = new Map();
    this.suppressed = false;
    canvas.addEventListener(
      "wheel",
      (event) => {
        if (event.ctrlKey) return; // Trackpad pinch is routed once by the root listener.
        event.preventDefault();
        const delta =
          event.deltaY *
          (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1);
        this.zoom(
          game.renderer.viewZoom *
            Math.exp(-Math.max(-180, Math.min(180, delta)) * 0.002),
          point(event),
        );
      },
      { passive: false },
    );
    // A trackpad pinch is a ctrl-wheel even above the dialogue. Never zoom the DOM.
    document.addEventListener(
      "wheel",
      (event) => {
        if (!event.ctrlKey) return;
        event.preventDefault();
        this.zoom(
          game.renderer.viewZoom *
            Math.exp(-Math.max(-180, Math.min(180, event.deltaY)) * 0.002),
          point(event),
        );
      },
      { passive: false },
    );
    // Safari's native gesture events supplement Pointer Events, never double-apply a pinch.
    canvas.addEventListener(
      "gesturestart",
      (event) => {
        event.preventDefault();
        this.nativeRatio = game.renderer.viewZoom;
      },
      { passive: false },
    );
    document.addEventListener(
      "gesturechange",
      (event) => {
        event.preventDefault();
        if (
          this.points.size < 2 &&
          this.nativeRatio &&
          Number.isFinite(event.scale)
        )
          this.zoom(this.nativeRatio * event.scale, point(event));
      },
      { passive: false },
    );
    document.addEventListener("gestureend", () => {
      this.nativeRatio = null;
    });
  }
  allowed() {
    const g = this.game;
    return (
      g.ready &&
      !g.transitioning &&
      !g.dialogue &&
      !g.hasOverlay() &&
      document.getElementById("world-content").hidden
    );
  }
  zoom(ratio, anchor) {
    if (!this.game.ready || this.game.transitioning || this.game.hasOverlay())
      return;
    const g = this.game,
      r = g.renderer,
      rect = this.canvas.getBoundingClientRect();
    const u = Number.isFinite(anchor.x)
      ? Math.max(0, Math.min(1, (anchor.x - rect.left) / rect.width))
      : 0.5;
    const v = Number.isFinite(anchor.y)
      ? Math.max(0, Math.min(1, (anchor.y - rect.top) / rect.height))
      : 0.5;
    const focus = { x: g.camera.x + u * r.width, y: g.camera.y + v * r.height };
    r.requestedZoom = ratio;
    r.resize();
    if (!g.cameraFollowing)
      g.camera = clampCamera(
        { x: focus.x - u * r.width, y: focus.y - v * r.height },
        g.world,
        r,
      );
    g.centerCamera(true);
  }
  down(event) {
    if (!this.allowed() || event.button !== 0 || this.points.size >= 2) return;
    event.preventDefault();
    const p = point(event);
    this.points.set(event.pointerId, { ...p, origin: p });
    this.canvas.setPointerCapture(event.pointerId);
    if (this.points.size === 2) {
      this.suppressed = true;
      this.game.pauseMovement({ keepPointerGesture: true });
      const [a, b] = this.points.values();
      this.pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        ratio: this.game.renderer.viewZoom,
      };
    }
  }
  move(event) {
    const previous = this.points.get(event.pointerId);
    if (!previous) return;
    if (!this.allowed()) {
      this.clear();
      return;
    }
    const p = point(event);
    this.points.set(event.pointerId, { ...p, origin: previous.origin });
    if (this.points.size === 2) {
      event.preventDefault();
      const [a, b] = this.points.values();
      this.zoom(
        (this.pinch.ratio * Math.hypot(a.x - b.x, a.y - b.y)) /
          Math.max(1, this.pinch.distance),
        { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      );
      return;
    }
    if (
      !this.dragging &&
      Math.hypot(p.x - previous.origin.x, p.y - previous.origin.y) < DRAG_SLOP
    )
      return;
    event.preventDefault();
    if (!this.dragging) {
      // Se conservan las teclas: arrastrar el mapa con una flecha pulsada no es soltarla.
      this.game.pauseMovement({ keepPointerGesture: true, keepControls: true });
      this.game.cameraFollowing = false;
      this.suppressed = this.dragging = true;
      this.led = this.aim = this.push = null;
      this.canvas.classList.add("is-panning");
    }
    const r = this.game.renderer,
      rect = this.canvas.getBoundingClientRect();
    const dx = ((p.x - previous.x) * r.width) / rect.width,
      dy = ((p.y - previous.y) * r.height) / rect.height;
    this.game.camera = clampCamera(
      { x: this.game.camera.x - dx, y: this.game.camera.y - dy },
      this.game.world,
      r,
    );
    this.game.centerCamera();
    this.aimBy(-dx, -dy);
    this.lead();
  }
  /**
   * ⛔ EL DESTINO SIGUE AL DEDO AUNQUE LA CÁMARA YA NO PUEDA, y sin esto no se cambiaría de
   * pantalla con un dedo en todo el bosque. La cámara se para en el borde del mapa, así que desde
   * medio ancho de pantalla antes del final el CENTRO ya no puede acercarse más — y las costuras
   * entre pantallas viven justo ahí, pegadas al borde. Lo que se empuja es el destino: contra el
   * borde la vista se queda quieta y el duende sigue avanzando hasta cruzar.
   *
   * Mientras la cámara no topa, el destino y el centro son EL MISMO PUNTO, porque los dos llevan
   * el mismo desplazamiento. Solo se separan donde el mapa se acaba.
   */
  aimBy(dx, dy) {
    const g = this.game,
      escena = g.world?.data?.id,
      ancho = g.world.width * TILE,
      alto = g.world.height * TILE,
      previo = this.push || { x: 0, y: 0 };
    if (!this.aim || this.aimScene !== escena) {
      /**
       * ⛔ CRUZAR NO CAMBIA EL RUMBO. El mundo entero cambia bajo el dedo, así que el destino se
       * replanta; pero plantarlo en el centro pelado dejaba parado a quien cruza, porque al
       * llegar la cámara te centra A TI y entonces el centro ERES TÚ. Se planta media pantalla
       * por delante, en la dirección que el dedo venía empujando: el gesto es el mismo gesto y
       * sigue significando lo mismo al otro lado. Al EMPEZAR un arrastre no hay empuje todavía,
       * así que ahí el destino es el centro exacto y no da ningún salto.
       */
      const centro = g.viewCentre(),
        largo = Math.max(g.renderer.width, g.renderer.height) / 2,
        n = Math.hypot(previo.x, previo.y);
      this.aim = n
        ? {
            x: clamp(centro.x + (previo.x / n) * largo, 0, ancho),
            y: clamp(centro.y + (previo.y / n) * largo, 0, alto),
          }
        : centro;
      this.aimScene = escena;
      this.led = null;
    } else
      this.aim = {
        x: clamp(this.aim.x + dx, 0, ancho),
        y: clamp(this.aim.y + dy, 0, alto),
      };
    this.push = { x: previo.x + dx, y: previo.y + dy };
  }
  /**
   * ⛔ EL MAPA ES EL MANDO: lo que miras es a donde vas (19-sep-2026, decisión del dueño). Mover
   * la cámara deja de ser solo mirar y pasa a ser CONDUCIR — el duende camina al centro de lo que
   * tienes delante, corriendo si lo has dejado lejos y andando si lo has movido poquito, porque la
   * marcha la decide la distancia del camino y no un botón.
   *
   * Y no se suelta al levantar el dedo: el destino es el último centro, así que se sigue llegando
   * solo. Eso es lo que convierte un gesto sostenido en una orden, y lo que permitió borrar el
   * joystick, su turbo y toda la detección de pantalla táctil.
   */
  lead() {
    // Resincroniza si el mundo ha cambiado bajo el dedo; con la misma escena no hace nada.
    this.aimBy(0, 0);
    const centre = this.aim;
    if (this.led && Math.hypot(centre.x - this.led.x, centre.y - this.led.y) < LEAD_STEP)
      return;
    this.led = centre;
    this.game.leadTo(centre);
  }
  up(event, cancel = false) {
    if (!this.points.has(event.pointerId)) return false;
    if (!cancel) this.move(event);
    const tap = !cancel && !this.suppressed && this.allowed();
    this.points.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    // Lifting the first finger of a pinch must never turn the second one into a tap.
    for (const p of this.points.values()) p.origin = { x: p.x, y: p.y };
    if (!this.points.size) this.clear();
    return tap;
  }
  clear() {
    const ids = [...this.points.keys()];
    this.points.clear();
    this.dragging = this.suppressed = false;
    this.led = this.aim = this.aimScene = this.push = null;
    this.pinch = null;
    this.canvas.classList.remove("is-panning");
    for (const id of ids)
      if (this.canvas.hasPointerCapture(id))
        this.canvas.releasePointerCapture(id);
  }
}
module.exports = { MapGestures };
