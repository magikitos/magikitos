"use strict";
const { clampCamera } = require("./camera");
const DRAG_SLOP = 8; // CSS pixels, equally comfortable for mouse, pen and touch.
/**
 * El mando invisible, en píxeles de PANTALLA y no de mundo: la sensación en el pulgar no puede
 * cambiar con el zoom. Más cerca del origen que STICK_DEAD no hay dirección; en el borde
 * (STICK_RUN) se corre, y para volver a andar hay que recogerse hasta STICK_WALK, que sin
 * histéresis un pulgar en el límite haría parpadear la marcha.
 */
const STICK_DEAD = 10;
const STICK_RUN = 100;
const STICK_WALK = 80;
const point = (event) => ({ x: event.clientX, y: event.clientY });

/**
 * ⛔ EL MANDO ES UN JOYSTICK INVISIBLE QUE NACE DONDE APOYAS EL DEDO (19-sep-2026, decisión del
 * dueño, tras probar en producción el guiado hacia el punto bajo el dedo: «con nada que me alejo
 * ya se pone a correr» y «para ir arriba el dedo tiene que estar muy arriba»). Apoyas el dedo en
 * cualquier sitio, lo mueves un poco y el duende va en esa dirección, como una flecha del
 * teclado: el vector entra por `directionIntent` y comparte con las teclas colisiones, empujes,
 * charlas al chocar, costuras y remo. Soltar para, como soltar una tecla. Un toque sigue siendo
 * ir e interactuar.
 *
 * ⛔ Y EL ORIGEN SIGUE AL DEDO. El joystick que se centra donde tocas y obliga a LEVANTAR para
 * recentrar es el que la gente odia (lo describía el hilo que trajo el dueño: arrastran el dedo
 * por toda la pantalla y nunca lo sueltan). Aquí, pasado el radio, el origen se arrastra detrás:
 * ir a la izquierda y volver hacia la derecha se nota al instante sin levantar. No hay nada que
 * explicar; la única regla es mover el dedo hacia donde quieres ir.
 *
 * Mirar alrededor son DOS dedos —que ya hacían zoom y también desplazan, como cualquier mapa— o
 * el botón derecho o central del ratón. Construyendo, un dedo mueve el mapa, que ahí no se anda.
 * Nada de esto dibuja DOM: el aro de aprendizaje lo pinta el renderizador con `stickView`, y solo
 * hasta que quien juega ya sabe andar.
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
    /** null mientras un solo dedo no ha decidido nada; luego "stick", "pan" o "pinch". */
    this.mode = null;
    this.suppressed = false;
    this.stick = null;
    this.pinch = null;
    this.canvas.classList.remove("is-panning");
  }
  /** El dedo es el mando del duende. */
  get steering() {
    return this.mode === "stick";
  }
  /** En el borde del mando se corre; es lo que `boosted` lee junto a la barra espaciadora. */
  get running() {
    return Boolean(this.stick?.running);
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
    if (button !== 0 && !([1, 2].includes(button) && !this.points.size)) return;
    event.preventDefault();
    const p = point(event);
    this.points.set(event.pointerId, { ...p, origin: p, button });
    this.canvas.setPointerCapture(event.pointerId);
    if (button !== 0) {
      this.suppressed = true;
      this.beginPan();
      return;
    }
    if (this.points.size === 2) {
      // Llega el segundo dedo: sea lo que fuera el primero, ahora es un gesto de cámara. El mando
      // se suelta, así que el duende se para: te has detenido a mirar.
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
      this.stick = null;
    }
  }
  beginPan() {
    this.mode = "pan";
    this.stick = null;
  }
  /** El mando nace donde se apoyó el dedo, no donde está ahora: la holgura ya es dirección. */
  beginStick(p) {
    const g = this.game;
    this.mode = "stick";
    this.stick = { origin: { ...p.origin }, finger: { x: p.x, y: p.y }, running: false };
    // Igual que pulsar una flecha: el viaje tocado se cancela, la cámara es del duende.
    g.cancelPath();
    g.cameraFollowing = true;
    g.focusPoint = null;
    g.unlockAudio?.();
    this.canvas.focus?.({ preventScroll: true });
  }
  /**
   * ⛔ EL ORIGEN SIGUE AL DEDO pasado el radio: el dedo nunca se sale del mando, así que volver
   * hacia atrás es cambiar de rumbo al instante, sin levantar. La marcha lleva histéresis.
   */
  steer(p) {
    const s = this.stick;
    s.finger = { x: p.x, y: p.y };
    let dx = p.x - s.origin.x,
      dy = p.y - s.origin.y,
      len = Math.hypot(dx, dy);
    if (len > STICK_RUN) {
      s.origin = { x: p.x - (dx / len) * STICK_RUN, y: p.y - (dy / len) * STICK_RUN };
      len = STICK_RUN;
    }
    if (len >= STICK_RUN - 0.5) s.running = true;
    else if (len < STICK_WALK) s.running = false;
  }
  /** Hacia dónde empuja el dedo, o null si no hay mando o está en la zona muerta. */
  intent() {
    const s = this.stick;
    if (!s) return null;
    const dx = s.finger.x - s.origin.x,
      dy = s.finger.y - s.origin.y,
      len = Math.hypot(dx, dy);
    return len < STICK_DEAD ? null : { x: dx / len, y: dy / len };
  }
  /**
   * El mando tal y como se ve, en unidades de la VISTA (píxeles de mundo sin cámara), para que el
   * renderizador pinte el aro de aprendizaje encima del mundo. `unit` es lo que mide un píxel de
   * pantalla ahí, para que los trazos tengan el mismo grosor a cualquier zoom.
   */
  stickView() {
    const s = this.stick;
    if (!s) return null;
    const r = this.game.renderer,
      rect = this.canvas.getBoundingClientRect(),
      k = r.width / rect.width,
      at = (q) => ({ x: (q.x - rect.left) * k, y: (q.y - rect.top) * k });
    return {
      origin: at(s.origin),
      knob: at(s.finger),
      radius: STICK_RUN * k,
      dead: STICK_DEAD * k,
      unit: k,
      running: s.running,
    };
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
    // ⛔ CRUZAR NO SUELTA EL DEDO. Mientras la pantalla cambia debajo, la cámara no se toca; el
    // mando sí se sigue leyendo, que al otro lado `directionIntent` lo encuentra donde estaba.
    if (this.game.transitioning && this.mode !== "stick") return;
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
      else this.beginStick(previous);
    }
    // Moverse pasada la holgura ya no es un toque: soltar aquí no interactúa con nada.
    if (moved) this.suppressed = true;
    event.preventDefault();
    if (this.mode === "pan") this.panBy(p.x - previous.x, p.y - previous.y);
    else if (this.mode === "stick") this.steer(p);
  }
  up(event, cancel = false) {
    const p = this.points.get(event.pointerId);
    if (!p) return false;
    if (!cancel) this.move(event);
    // Levantar sin haber movido el dedo es un toque, dure lo que dure la pulsación.
    const tap = !cancel && !this.suppressed && p.button === 0 && this.allowed();
    this.points.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    if (this.points.size) {
      // El dedo que queda tras un pellizco sigue siendo de la cámara: ni toca ni manda.
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
module.exports = { MapGestures, DRAG_SLOP, STICK_DEAD, STICK_RUN, STICK_WALK };
