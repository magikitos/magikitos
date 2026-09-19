"use strict";
const { TILE, clamp } = require("./geometry");
const { indoor, frameCamera } = require("./scene-frame");
/** One camera scale for ground, actors, props, picking and motion. No browser-page zoom. */
function cameraMetrics(view, world, requested = null, presentation = 1) {
  const room = indoor(world);
  const normal = room
    ? view.width < 600
      ? 1.5
      : 2
    : Math.max(2, Math.round(view.width / (view.width < 600 ? 350 : 580)));
  const cover =
    world && !room
      ? Math.max(
          view.width / (world.width * TILE),
          view.height / (world.height * TILE),
        )
      : 0;
  const maximum = Math.max(normal, cover);
  // Start with breathing room, not at the closest allowed zoom. The short side
  // keeps portrait/landscape equally readable; quarter steps avoid arbitrary
  // pixel magnifications. Large monitors reveal more world, not enormous actors.
  const initialScale = clamp(Math.round(Math.min(view.width, view.height) / 150) / 4, 1.25, 2);
  const initialRatio = room ? 1 : Math.min(1, initialScale / maximum);
  const minimum = room ? 0.7 : cover / maximum;
  const ratio = clamp(Number.isFinite(requested) ? requested : initialRatio, minimum, 1);
  const scale = maximum * ratio * (room ? 1 : Math.max(1, presentation));
  return {
    scale,
    ratio,
    minimum,
    width: view.width / scale,
    height: view.height / scale,
  };
}
function clampCamera(camera, world, view) {
  return frameCamera(camera, world, view);
}

/** Lo cerca que hay que estar para dejar de suavizar y sencillamente seguir. Correr mueve el
 *  objetivo ~1,8 px por frame a 60 Hz, así que esto no se suelta andando; un mapa que acabas de
 *  arrastrar está a cientos de píxeles. */
const CAMERA_LOCK = 24;

/**
 * ⛔ QUÉ CUENTA COMO VIAJE CONTINUO, Y POR QUÉ ESTO NO ES UN DETALLE DEL BUCLE.
 *
 * Andar, ir en brazos de un gato y remar son lo mismo para la cámara: te mueves sin parar y hay
 * que seguirte pegado. Lo que NO vale es preguntar «¿se ha movido este frame?», porque el paso
 * devuelve false justo al pisar un waypoint y la cámara alternaba entre pegada y suavizada frame
 * a frame: ese es el bote del gato. Y remar no ponía `walking` en absoluto, así que la barca no
 * se enganchaba nunca: ese es el temblor del río.
 */
function continuousTravel({ walking, carried, rowing } = {}) {
  return Boolean(walking || carried || rowing);
}

/**
 * ⛔ SEGUIR A ALGUIEN Y VIAJAR A UN SITIO SON DOS COSAS, Y LA DIFERENCIA SE DECIDE AQUÍ.
 *
 * Quien se mueve de forma CONTINUA (andas, te lleva un gato, vas en barca) se sigue pegado: la
 * cámara se pone donde toca y punto. Todo lo demás se suaviza. Y el enganche solo ocurre si ya
 * estás cerca, porque tocar el mapa para andar enciende el seguimiento y empieza a caminar en el
 * mismo gesto: con enganche incondicional, la cámara TELETRANSPORTABA cientos de píxeles sobre lo
 * que acababas de arrastrar.
 *
 * Es una función pura a propósito. Vivía suelta dentro del bucle del juego, que es donde no se
 * puede probar: el temblor de la barca estuvo ahí meses porque `walking` se quedaba en false
 * remando y nadie podía preguntárselo a nada.
 */
function cameraFollow(camera, target, { tracking, goal, reading, snap, ease, travelEase }) {
  if (snap || (!goal && tracking && !reading && distance(camera, target) <= CAMERA_LOCK))
    return { x: target.x, y: target.y };
  const rate = goal ? travelEase : ease;
  return {
    x: camera.x + (target.x - camera.x) * rate,
    y: camera.y + (target.y - camera.y) * rate,
  };
}
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

/** Hasta dónde se adelanta la cámara hacia donde guías, en píxeles de mundo. */
const CAMERA_LEAD = 32;
/** Desde qué distancia del dedo al duende empieza a adelantarse: coincide con el «quieto» del gesto. */
const CAMERA_LEAD_FROM = 14;

/**
 * ⛔ LA CÁMARA SE ADELANTA UN POCO HACIA DONDE GUÍAS, para que el pulgar no tape justo lo que viene.
 *
 * Guiando, el dedo va por delante del duende y el duende va al centro de la pantalla, así que el
 * pulgar se planta encima del camino. Desplazar la vista unos píxeles hacia el rumbo deja al duende
 * un poco atrás y despeja lo de delante. El adelanto crece con la distancia al dedo —con el dedo
 * encima del duende es cero— y se suaviza, para que virar o soltar no dé un tirón: al soltar el
 * vector es null y el adelanto vuelve a cero por el mismo suavizado.
 *
 * Función pura por la misma razón que `cameraFollow`: lo que vive dentro del bucle no se puede
 * preguntar desde una prueba.
 */
function cameraLead(current, vector, { reach = CAMERA_LEAD, from = CAMERA_LEAD_FROM, ease }) {
  let want = { x: 0, y: 0 };
  if (vector) {
    const n = Math.hypot(vector.x, vector.y);
    const span = Math.min(reach, Math.max(0, n - from));
    if (n > 0) want = { x: (vector.x / n) * span, y: (vector.y / n) * span };
  }
  const x = current.x + (want.x - current.x) * ease,
    y = current.y + (want.y - current.y) * ease;
  return { x: Math.abs(x) < 0.01 ? 0 : x, y: Math.abs(y) < 0.01 ? 0 : y };
}

module.exports = {
  cameraMetrics,
  clampCamera,
  cameraFollow,
  cameraLead,
  continuousTravel,
  CAMERA_LOCK,
  CAMERA_LEAD,
};
