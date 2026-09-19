"use strict";
const { clampCamera } = require("./camera");
const DRAG_SLOP = 8; // CSS pixels, equally comfortable for mouse, pen and touch.
/**
 * El mando invisible, en píxeles de PANTALLA y no de mundo: la sensación en el pulgar no puede
 * cambiar con el zoom. Más cerca del origen que STICK_DEAD no hay dirección; STICK_RADIUS es el
 * aro, y pasado el aro el origen se arrastra detrás del dedo. La distancia NO es la marcha.
 */
const STICK_DEAD = 10;
const STICK_RADIUS = 100;
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
 * ⛔ CON EL DEDO SE ANDA Y PUNTO (19-sep-2026, decisión del dueño tras probarlo: «esté cerca o
 * lejos el dedo, eso es andar»). Aquí vivió medio día un borde donde se corría, con histéresis, y
 * hacía que un pulgar suelto saliera corriendo sin querer. Correr queda para la barra espaciadora
 * y para el toque lejano, que ya corre solo (`journey`).
 *
 * ⛔ LA CÁMARA ES DEL DUENDE Y NO SE ARRASTRA (19-sep-2026, decisión del dueño: «quitaría también
 * lo de desplazarse por el mapa; dejaría solo el zoom»). Dos dedos hacen ZOOM y nada más, la rueda
 * también, y el botón derecho no hace nada. La única excepción es construir, donde arrastrar
 * mueve el mapa para llevar la pieza a su sitio, y al terminar la cámara vuelve sola. Nada de esto
 * dibuja DOM: el aro del mando lo pinta el renderizador con `stickView` mientras el dedo manda.
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
  /** La cámara es del gesto: solo construyendo, mientras se arrastra el mapa. */
  get dragging() {
    return this.mode === "pan";
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
    // ⛔ SOLO CONSTRUYENDO, con la cámara del gesto, el zoom se clava bajo los dedos. Siguiendo al
    // duende el ancla es el CENTRO de la vista: si fuera el punto medio de los dedos, dos dedos que
    // viajan por la pantalla a la misma distancia arrastrarían la cámara con ellos —que es el paneo
    // que el dueño quitó— cada vez que hubiera un viaje tocado en marcha.
    const pinned = !g.cameraFollowing;
    const u = pinned && Number.isFinite(anchor.x)
      ? Math.max(0, Math.min(1, (anchor.x - rect.left) / rect.width))
      : 0.5;
    const v = pinned && Number.isFinite(anchor.y)
      ? Math.max(0, Math.min(1, (anchor.y - rect.top) / rect.height))
      : 0.5;
    const focus = { x: g.camera.x + u * r.width, y: g.camera.y + v * r.height };
    r.requestedZoom = ratio;
    r.resize();
    // Siguiendo al duende, el zoom se clava sobre él. Si la cámara es tuya —o está VIAJANDO hacia
    // un sitio tocado, que `centerCamera` no clava— el centro de la vista se queda donde estaba.
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
    // Solo el botón principal, o el dedo. El derecho o el central únicamente arrastran el mapa
    // construyendo; fuera de ahí no hacen nada, que la cámara es del duende.
    if (button !== 0 && !([1, 2].includes(button) && !this.points.size && this.exploring())) return;
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
      // Llega el segundo dedo: es un pellizco, o sea zoom, y nada más. El mando se suelta, así que
      // el duende se para: te has detenido a mirar más cerca o más lejos.
      this.suppressed = true;
      const [a, b] = this.points.values();
      this.pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        ratio: this.game.renderer.viewZoom,
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
    this.stick = { origin: { ...p.origin }, finger: { x: p.x, y: p.y } };
    // Igual que pulsar una flecha: el viaje tocado se cancela, la cámara es del duende.
    g.cancelPath();
    g.cameraFollowing = true;
    g.focusPoint = null;
    g.unlockAudio?.();
    this.canvas.focus?.({ preventScroll: true });
  }
  /**
   * ⛔ EL ORIGEN SIGUE AL DEDO pasado el radio: el dedo nunca se sale del mando, así que volver
   * hacia atrás es cambiar de rumbo al instante, sin levantar.
   */
  steer(p) {
    const s = this.stick;
    s.finger = { x: p.x, y: p.y };
    const dx = p.x - s.origin.x,
      dy = p.y - s.origin.y,
      len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS)
      s.origin = { x: p.x - (dx / len) * STICK_RADIUS, y: p.y - (dy / len) * STICK_RADIUS };
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
   * renderizador pinte el aro encima del mundo. `unit` es lo que mide un píxel de pantalla ahí,
   * para que los trazos tengan el mismo grosor a cualquier zoom; `heading` es la dirección que
   * manda ahora mismo (la misma que `intent`), o null en la zona muerta.
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
      radius: STICK_RADIUS * k,
      dead: STICK_DEAD * k,
      unit: k,
      heading: this.intent(),
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
      // El pellizco hace zoom sobre el duende y nada más: la cámara sigue siendo suya aunque los
      // dedos viajen por la pantalla.
      this.zoom(
        (this.pinch.ratio * Math.hypot(a.x - b.x, a.y - b.y)) /
          Math.max(1, this.pinch.distance),
        { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      );
      return;
    }
    // El dedo que queda tras un pellizco no manda ni toca hasta que se levante.
    if (this.mode === "pinch") return;
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
      // El dedo que queda tras un pellizco no manda ni toca: se queda en «pellizco» hasta que se
      // levante, y `move` lo ignora.
      this.pinch = null;
      this.suppressed = true;
      this.mode = "pinch";
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
module.exports = { MapGestures, DRAG_SLOP, STICK_DEAD, STICK_RADIUS };
