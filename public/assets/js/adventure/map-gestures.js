"use strict";
const { clampCamera } = require("./camera");
const DRAG_SLOP = 8; // CSS pixels, equally comfortable for mouse, pen and touch.
/**
 * Cuánto hay que dejar el dedo quieto para que sea GUIAR y no un toque que todavía no ha
 * terminado. Un toque humano dura menos de 120 ms; quien toca despacio no pierde nada, porque
 * levantar sin haber movido el dedo sigue siendo un toque (ver `up`).
 */
const HOLD_MS = 180;
/**
 * Cada cuánto se replanea el destino mientras se guía, en píxeles de MUNDO. Un camino por
 * fotograma serían sesenta búsquedas por segundo para mover la meta cuatro píxeles; con esto el
 * destino se refresca cuando de verdad ha cambiado de sitio y el rumbo se sigue viendo pegado al
 * dedo, porque entre replaneos el duende ya va hacia allí.
 */
const LEAD_STEP = 14;
/**
 * El dedo ENCIMA del duende es «quieto». Se mide contra el cuerpo y no contra los pies, porque
 * ahí es donde la gente pone el dedo, y con histéresis: se para a menos de REST y no vuelve a
 * arrancar hasta REST_RELEASE, que si no un dedo en el límite haría parpadear la marcha.
 */
const REST = 14;
const REST_RELEASE = 20;
const BODY_LIFT = 8;
const point = (event) => ({ x: event.clientX, y: event.clientY });
const now = () => performance.now();

/**
 * ⛔ MANTENER ES GUIAR, TOCAR ES IR, Y LA CÁMARA SE MUEVE CON DOS DEDOS (19-sep-2026, decisión del
 * dueño). Un toque ordena un viaje CON interacción: lo que señalas, se usa. Un dedo mantenido, o
 * uno que se desplaza, ordena un viaje SIN ella hacia el punto del mundo que hay bajo el dedo, y
 * como la cámara se queda pegada al duende, ese punto avanza con él y no lo alcanza mientras no
 * sueltes: es el teclado sin teclado, con toda la pantalla de mando y el propio duende de centro.
 * Cerca anda y lejos corre, que la marcha la decide la distancia del camino y no un botón. Soltar
 * no frena: el viaje termina en el último punto donde estaba el dedo.
 *
 * Mirar alrededor sin dar órdenes es cosa de DOS dedos —que ya hacían el zoom y ahora también
 * desplazan, como cualquier mapa— o del botón derecho o central del ratón. Y mientras se
 * construye, un solo dedo sigue moviendo el mapa, porque construyendo no se dan órdenes de andar.
 *
 * Esto sustituye al «arrastrar el mapa lleva al duende al centro» del mismo día, que tenía un
 * tope estructural: cada gesto movía media pantalla como mucho y al llegar la cámara te
 * recentraba, así que había que volver a arrastrar. El dueño: «no permite navegación continua».
 */
class MapGestures {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.points = new Map();
    this.reset();
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
  reset() {
    /** null mientras un solo dedo no ha decidido nada; luego "guide", "pan" o "pinch". */
    this.mode = null;
    this.suppressed = false;
    this.led = null;
    this.resting = false;
    this.heading = null;
    this.scene = null;
    this.pinch = null;
    this.canvas.classList.remove("is-panning");
  }
  /** El dedo manda al duende. */
  get guiding() {
    return this.mode === "guide";
  }
  /** La cámara es del gesto: un paneo, o un pellizco que además se ha desplazado. */
  get dragging() {
    return this.mode === "pan" || (this.mode === "pinch" && Boolean(this.pinch?.panned));
  }
  /** Construyendo no se dan órdenes de andar: ahí un dedo mueve el mapa, como siempre. */
  exploring() {
    return Boolean(this.game.community?.editing);
  }
  /** Hay mundo bajo el dedo, aunque esté cambiando: un gesto sobrevive a cruzar de pantalla. */
  held() {
    const g = this.game;
    return (
      g.ready &&
      !g.dialogue &&
      !g.hasOverlay() &&
      document.getElementById("world-content").hidden
    );
  }
  allowed() {
    return this.held() && !this.game.transitioning;
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
    // Siguiendo al duende, el zoom se clava sobre él. Si la cámara es tuya —o está VIAJANDO hacia
    // un sitio tocado, que `centerCamera` no clava— lo que hay bajo los dedos se queda bajo los dedos.
    if (!g.cameraFollowing || g.cameraGoal?.())
      g.camera = clampCamera(
        { x: focus.x - u * r.width, y: focus.y - v * r.height },
        g.world,
        r,
      );
    g.centerCamera(true);
  }
  /** Un punto de la pantalla, en coordenadas del mundo y con la cámara de AHORA. */
  worldPoint(p) {
    const r = this.game.renderer,
      rect = this.canvas.getBoundingClientRect(),
      camera = this.game.camera;
    return {
      x: camera.x + ((p.x - rect.left) / rect.width) * r.width,
      y: camera.y + ((p.y - rect.top) / rect.height) * r.height,
    };
  }
  /**
   * Desplaza la cámara lo que se ha movido el dedo en pantalla, en píxeles de mundo. La cámara
   * pasa a ser del gesto en el PRIMER desplazamiento real, no al apoyar: un botón derecho que no
   * se mueve, o el dedo que queda tras un pellizco quieto, no sueltan al duende ni sacan el disco.
   */
  panBy(dx, dy) {
    const g = this.game,
      r = g.renderer,
      rect = this.canvas.getBoundingClientRect();
    if (g.cameraFollowing) {
      g.cameraFollowing = false;
      this.canvas.classList.add("is-panning");
    }
    g.camera = clampCamera(
      {
        x: g.camera.x - (dx * r.width) / rect.width,
        y: g.camera.y - (dy * r.height) / rect.height,
      },
      g.world,
      r,
    );
    g.centerCamera();
  }
  down(event) {
    if (!this.allowed() || this.points.size >= 2) return;
    const button = event.button;
    // El botón derecho o central del ratón mueve la cámara; un segundo puntero solo puede ser un dedo.
    if (button !== 0 && (button === undefined || ![1, 2].includes(button) || this.points.size))
      return;
    event.preventDefault();
    const p = point(event);
    this.points.set(event.pointerId, { ...p, origin: p, at: now(), button });
    this.canvas.setPointerCapture(event.pointerId);
    if (button !== 0) {
      this.suppressed = true;
      this.beginPan();
      return;
    }
    if (this.points.size === 2) {
      // Llega el segundo dedo: sea lo que fuera el primero, ahora es un gesto de cámara. Un viaje
      // que ya estuviera guiado termina solo en su último punto, que es lo que hace soltar.
      this.suppressed = true;
      const [a, b] = this.points.values();
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        ratio: this.game.renderer.viewZoom,
        mid,
        origin: mid,
        panned: false,
      };
      this.mode = "pinch";
      this.led = this.heading = null;
    }
  }
  beginPan() {
    this.mode = "pan";
    this.led = this.heading = null;
  }
  beginGuide() {
    const g = this.game;
    this.mode = "guide";
    this.led = null;
    this.resting = false;
    this.scene = g.world?.data?.id;
    // Se conservan las teclas: guiar con una flecha pulsada no es soltarla. El viaje anterior sí
    // se corta, que el primer `guide` planta el nuevo en el mismo fotograma.
    g.pauseMovement({ keepPointerGesture: true, keepControls: true });
    g.cameraFollowing = true;
    g.focusPoint = null;
    g.unlockAudio?.();
    this.canvas.focus?.({ preventScroll: true });
  }
  move(event) {
    const previous = this.points.get(event.pointerId);
    if (!previous) return;
    if (!this.held()) {
      this.clear();
      return;
    }
    const p = point(event);
    this.points.set(event.pointerId, { ...previous, ...p });
    // ⛔ CRUZAR NO SUELTA EL DEDO. Mientras la pantalla cambia debajo, el gesto se guarda y no se
    // aplica: al otro lado, `update` sigue guiando con la cámara nueva y el mismo dedo.
    if (this.game.transitioning) return;
    if (this.points.size === 2) {
      event.preventDefault();
      const [a, b] = this.points.values();
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // El pellizco quieto hace zoom sobre el duende como siempre; si además los dedos viajan, la
      // cámara pasa a ser suya, como en cualquier mapa.
      if (
        !this.pinch.panned &&
        Math.hypot(mid.x - this.pinch.origin.x, mid.y - this.pinch.origin.y) >= DRAG_SLOP
      )
        this.pinch.panned = true;
      if (this.pinch.panned) this.panBy(mid.x - this.pinch.mid.x, mid.y - this.pinch.mid.y);
      this.pinch.mid = mid;
      this.zoom(
        (this.pinch.ratio * Math.hypot(a.x - b.x, a.y - b.y)) /
          Math.max(1, this.pinch.distance),
        mid,
      );
      return;
    }
    const moved =
      Math.hypot(p.x - previous.origin.x, p.y - previous.origin.y) >= DRAG_SLOP;
    if (!this.mode) {
      if (!moved) return;
      if (this.exploring()) this.beginPan();
      else this.beginGuide();
    }
    // Moverse pasada la holgura ya no es un toque, ni siquiera guiando: soltar aquí no interactúa.
    if (moved) this.suppressed = true;
    event.preventDefault();
    if (this.mode === "pan") this.panBy(p.x - previous.x, p.y - previous.y);
    else if (this.mode === "guide") this.guide();
  }
  /**
   * Un fotograma del gesto, desde el bucle del juego y no desde un temporizador: aquí un dedo
   * quieto pasa a guiar cuando lleva HOLD_MS puesto, y el guiado se recalcula aunque el dedo no se
   * mueva, porque la cámara sigue al duende y el punto del mundo bajo el dedo avanza con ella.
   */
  update(time = now()) {
    if (this.points.size !== 1 || this.mode === "pan" || this.mode === "pinch") return;
    const [p] = this.points.values();
    if (!this.mode) {
      if (p.button !== 0 || this.exploring() || time - p.at < HOLD_MS || !this.allowed()) return;
      this.beginGuide();
    }
    this.guide();
  }
  /** El vector del duende al dedo mientras se guía, para que la cámara se adelante un poco. */
  guideVector() {
    return this.mode === "guide" ? this.heading : null;
  }
  guide() {
    const g = this.game;
    if (!this.allowed()) return; // A medio cruzar se espera; el dedo sigue puesto.
    const [p] = this.points.values();
    const scene = g.world?.data?.id;
    if (scene !== this.scene) {
      // El mundo entero ha cambiado bajo el dedo: lo guiado antes ya no significa nada aquí.
      this.scene = scene;
      this.led = null;
      this.resting = false;
    }
    const target = this.worldPoint(p);
    const body = { x: g.player.x, y: g.player.y - BODY_LIFT };
    const gap = Math.hypot(target.x - body.x, target.y - body.y);
    if (gap < (this.resting ? REST_RELEASE : REST)) {
      if (!this.resting) {
        this.resting = true;
        this.led = null;
        g.pauseMovement({ keepPointerGesture: true, keepControls: true });
      }
      this.heading = null;
      return;
    }
    this.resting = false;
    this.heading = { x: target.x - body.x, y: target.y - body.y };
    if (
      this.led &&
      Math.hypot(target.x - this.led.x, target.y - this.led.y) < LEAD_STEP
    )
      return;
    this.led = target;
    g.leadTo(target);
  }
  up(event, cancel = false) {
    const p = this.points.get(event.pointerId);
    if (!p) return false;
    if (!cancel) this.move(event);
    // Levantar sin haber movido el dedo es un toque aunque se haya estado guiando: el duende ya
    // iba hacia ahí y ahora, además, usa lo que señalabas.
    const tap = !cancel && !this.suppressed && p.button === 0 && this.allowed();
    this.points.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    if (this.points.size) {
      // El dedo que queda tras un pellizco sigue siendo de la cámara: ni toca ni guía.
      for (const q of this.points.values()) q.origin = { x: q.x, y: q.y };
      this.pinch = null;
      this.suppressed = true;
      this.beginPan();
    } else this.clear();
    return tap;
  }
  clear() {
    const ids = [...this.points.keys()];
    this.points.clear();
    this.reset();
    for (const id of ids)
      if (this.canvas.hasPointerCapture(id))
        this.canvas.releasePointerCapture(id);
  }
}
module.exports = { MapGestures, HOLD_MS, DRAG_SLOP, LEAD_STEP, REST };
