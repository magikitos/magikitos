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
/** La cámara acotada al marco: el mismo `frameCamera` de `scene-frame`, con el nombre que usa el juego. */
const clampCamera = frameCamera;

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

module.exports = { cameraMetrics, clampCamera, cameraFollow, continuousTravel, CAMERA_LOCK };
