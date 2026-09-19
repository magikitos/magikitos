"use strict";
const { TILE, waterAt, collisionBounds, clamp } = require("./geometry");
const { riverSection } = require("./river-course");
const { facing } = require("./characters");
const { playerVariant } = require("./player-art");

// The hull, not Ascua's walking footprint. Oars skim the water and are not a solid body.
const HULL_RADIUS = 26;
const ROW_SPEED = 82;
const FAST_ROW_SPEED = 205;
/**
 * ⛔ UNA BARCA TIENE MASA, Y SIN ELLA NO HAY NADA QUE PILOTAR.
 *
 * Estos dos números eran 8 y 4, o sea: la barca alcanzaba su velocidad objetivo en **0,12
 * segundos** y perdía toda su inercia en 0,25 al soltar. Eso no se conduce, se apunta: girar
 * redirigía toda la velocidad de golpe y soltar el remo era frenar. Por eso el río «no tiene
 * flow» aunque la física estuviera bien escrita.
 *
 * Con estos, la barca TARDA en coger velocidad (así que arrancar bien vale algo), gira trazando
 * en vez de pivotar (así que la línea importa) y se DESLIZA cuando sueltas (así que hay algo que
 * administrar). Es lo que convierte remar en pilotar, y lo que hace que echar una carrera tenga
 * sentido.
 *
 * La forma sigue siendo `1 - exp(-dt·k)`, que es independiente de los fotogramas: eso lo exige
 * una prueba y no se toca.
 */
const ROW_RESPONSE = 2.6;
const GLIDE_DRAG = 0.9;
/** Lo deprisa que la barca se corre para dejar sitio a quien la alcanza, en píxeles por segundo. */
const YIELD_SPEED = 70;
/**
 * ⛔ Y LO HACE BLANDO, QUE ES LO QUE QUITA EL BANDAZO. Apartarse a tope desde el primer roce es un
 * cambio de dirección de 173° en un fotograma —medido: la barca iba a 0,04 px por fotograma y
 * pasaba a 1,1 en sentido contrario—, y eso desde fuera es un temblor, no un empujoncito. Con la
 * rigidez, la corrección vale lo que vale el SOLAPE: al tocarse es casi nada y crece según el
 * cuerpo insiste, hasta el tope de arriba. Siete píxeles de solape ya dan el empujón entero, que
 * sobre un alcance de cuarenta y seis no se ve venir de lejos pero tampoco pega un salto.
 */
const YIELD_STIFFNESS = 10;
/**
 * Y el último trocito se cierra a esta velocidad, porque una rampa proporcional se ACERCA al
 * borde del casco y no llega nunca: la barca se quedaría rozando para siempre, que es lo que hace
 * que `canFloat` siga diciendo que ahí no se puede estar. Un cuarto de píxel por fotograma no se
 * ve y garantiza que apartarse TERMINA.
 */
const YIELD_CLOSE = 15;
const probes = [[0, 0]];
for (let y = -HULL_RADIUS; y <= HULL_RADIUS; y += 4)
  for (let x = -HULL_RADIUS; x <= HULL_RADIUS; x += 4)
    if (x * x + y * y <= HULL_RADIUS * HULL_RADIUS) probes.push([x, y]);
for (let i = 0; i < 32; i++)
  probes.push([
    Math.cos((i * Math.PI) / 16) * HULL_RADIUS,
    Math.sin((i * Math.PI) / 16) * HULL_RADIUS,
  ]);

/**
 * Quién más está en el agua justo ahora (ver river-life.js: el vecino que rema y el corcho de
 * quien pesca). `world.riverBodies` lo repone el módulo del río en cada fotograma con el MISMO
 * reloj con el que se dibujan, así que el choque cae donde se ve el cuerpo y no dos metros más
 * allá.
 *
 * ⛔ UN CUERPO QUE YA TE ENVUELVE NO TE ENCIERRA. Sin esto, llegar a una pantalla justo donde
 * pasa una cáscara de nuez te deja sin poder remar hasta que se vaya: el casco está dentro del
 * cuerpo, así que TODAS las direcciones están bloqueadas y no hay forma de salir. Con `from`, lo
 * que ya te pisa deja de contar y el agua te devuelve solo, que es lo que pasa en un río.
 */
function riverBodyAt(world, x, y, from = null) {
  for (const body of world.riverBodies || []) {
    const reach = body.radius + HULL_RADIUS;
    if (from && Math.hypot(from.x - body.x, from.y - body.y) < reach) continue;
    if (Math.hypot(x - body.x, y - body.y) < reach) return body;
  }
  return null;
}
/**
 * ⛔ Y EL RÍO SE APARTA EN LOS DOS SENTIDOS. Bloquear el casco impide que TÚ atravieses a nadie,
 * pero el vecino que rema se mueve solo: con la barca parada en mitad del canal te pasaba por
 * encima igual, que es el mismo «se atraviesa y ya» visto del otro lado. Cuando un cuerpo te
 * alcanza, la barca se corre lo justo para dejarle sitio, y solo hacia donde hay agua: si no la
 * hay, se queda donde está antes que empotrarse en la orilla.
 */
function yieldToRiverBodies(world, player, dt, motion = null) {
  // Una sola pregunta: la de antes la hacía dos veces con los MISMOS argumentos («body || …»),
  // así que la segunda no podía contestar nunca otra cosa.
  const touching = riverBodyAt(world, player.x, player.y);
  if (!touching) return null;
  const away = Math.hypot(player.x - touching.x, player.y - touching.y) || 1;
  const overlap = touching.radius + HULL_RADIUS - away;
  if (overlap <= 0) return null;
  const step = Math.min(
    Math.max(overlap * YIELD_STIFFNESS * dt, YIELD_CLOSE * dt),
    YIELD_SPEED * dt,
    overlap,
  );
  if (step <= 0) return null;
  const nx = (player.x - touching.x) / away,
    ny = (player.y - touching.y) / away;
  const dx = nx * step,
    dy = ny * step;
  if (canFloat(world, player.x + dx, player.y + dy, player)) {
    player.x += dx;
    player.y += dy;
  } else if (canFloat(world, player.x + dx, player.y, player)) player.x += dx;
  else if (canFloat(world, player.x, player.y + dy, player)) player.y += dy;
  else return null;
  /**
   * ⛔ APARTARSE TAMBIÉN ES FRENAR, Y SIN ESTO LA BARCA TIEMBLA (19-sep-2026, lo vio el dueño:
   * «en las corrientes del río, incluso en las más suaves, parece que el barquito vibra»).
   *
   * El apartado movía la POSICIÓN y no tocaba la velocidad, así que mientras el cuerpo te
   * alcanzaba la barca se iba a un lado a setenta píxeles por segundo —casi lo que se rema— con
   * su velocidad todavía apuntando al otro: en cuanto el cuerpo dejaba de rozarte, volvía. Medido
   * sobre los tres ríos, cinco segundos de deriva por cada punto de agua con corriente: 179 sitios
   * en los que el dibujado iba y venía tres veces o más, y los peores coincidían con los
   * fotogramas en los que algo te estaba empujando.
   *
   * Lo que se quita es SOLO la componente que te metía dentro del cuerpo, que es la que la física
   * ya no puede gastar: el resto de la velocidad —la que te lleva río abajo— se respeta entera.
   * Con eso la corriente vuelve a acelerarte desde cero, que tarda casi un segundo, y lo que se ve
   * es un empujoncito y seguir, no un temblor.
   */
  if (motion) {
    const into = motion.vx * nx + motion.vy * ny;
    if (into < 0) {
      motion.vx -= into * nx;
      motion.vy -= into * ny;
    }
  }
  return touching;
}
/**
 * Por qué bordes se abre el agua de esta pantalla: los que tienen una salida a remo cuya banda,
 * ensanchada lo que mide el casco, alcanza este punto. Geometría de los datos (`world.bands`).
 */
function openSeamEdges(world, x, y) {
  const open = { up: false, down: false, left: false, right: false };
  for (const band of world.bands || []) {
    if (!band.modes.has("boat")) continue;
    const along = (band.edge === "up" || band.edge === "down" ? x : y) / TILE;
    if (along >= band.from - HULL_RADIUS / TILE && along < band.to + HULL_RADIUS / TILE)
      open[band.edge] = true;
  }
  return open;
}
function canFloat(world, x, y, from = null) {
  const data = world.data || world;
  if (![x, y].every(Number.isFinite)) return false;
  // ⛔ EN UNA COSTURA DE BARCA EL BORDE NO ES ORILLA (mundo continuo). El margen del casco contra el
  // borde del mapa se salta en el tramo que una salida a remo abre, y el agua de más allá la
  // contesta la vecina enlazada o, sin ella en memoria, la propia banda: por ahí se rema hasta la
  // pantalla de al lado sin frenar en una pared que no existe.
  const open = openSeamEdges(world, x, y);
  if (
    (x < HULL_RADIUS && !open.left) ||
    (y < HULL_RADIUS && !open.up) ||
    (x > data.width * TILE - HULL_RADIUS && !open.right) ||
    (y > data.height * TILE - HULL_RADIUS && !open.down)
  )
    return false;
  const wet = (px, py) => {
    const tx = px / TILE,
      ty = py / TILE;
    if (tx >= 0 && ty >= 0 && tx < data.width && ty < data.height) return waterAt(data, tx, ty);
    return Boolean(world.waterBeyond?.(tx, ty));
  };
  if (!probes.every(([dx, dy]) => wet(x + dx, y + dy))) return false;
  if (riverBodyAt(world, x, y, from)) return false;
  return !(world.colliders || []).some((e) => {
    const b = collisionBounds(e);
    const px = clamp(x, b.x, b.x + b.w),
      py = clamp(y, b.y, b.y + b.h);
    return Math.hypot(x - px, y - py) < HULL_RADIUS;
  });
}

/**
 * ⛔ UN RÍO ES MÁS RÁPIDO POR EL MEDIO, Y ESO ES LO QUE LO HACE DIVERTIDO.
 *
 * El perfil era `clamp((1-d)*4, 0, 1)`: fuerza MÁXIMA en todo el tramo hasta el 75% del radio y
 * una rampa corta al final. O sea una meseta, y una meseta no tiene línea: da igual por dónde
 * vayas. Medido en el claro de los sauces, la corriente valía lo mismo (17) en cuatro tiles
 * seguidos y se caía a cero en cuatro más.
 *
 * Ahora es parabólico, que es como se reparte de verdad el caudal en un cauce: el máximo sigue
 * siendo el vector que el mapa declara —nada se acelera— pero cae de forma continua hacia las
 * orillas. Con eso aparecen dos cosas que el juego ya prometía y no daba: una LÍNEA RÁPIDA que
 * encontrar y sostener, y REMANSOS de verdad pegados a la orilla para remontar. Está escrito en
 * la doctrina desde el principio («las rápidas empujan de verdad: busca remansos») y hasta hoy
 * era mentira, porque el remanso empezaba donde la corriente ya se había acabado.
 */
const channelProfile = (d) => (d < 1 ? 1 - d * d : 0);

/** Currents are authored vector fields. Soft edges avoid invisible discontinuities. */
function currentAt(data, x, y) {
  const result = { x: 0, y: 0 };
  for (const current of data.navigation?.currents || []) {
    const [cx, cy, rx, ry] = current.area;
    const banks =
      current.channel && data.rivers?.[0]
        ? riverSection(data.rivers[0], y / TILE)
        : null;
    const bend = banks ? (banks.left + banks.right) / 2 - cx : 0;
    const d = Math.hypot((x / TILE - cx - bend) / rx, (y / TILE - cy) / ry);
    const strength = channelProfile(d);
    result.x +=
      (current.vector[0] + (banks?.tangent || 0) * current.vector[1]) *
      strength;
    result.y += current.vector[1] * strength;
  }
  return result;
}

/** Pure, sub-stepped boat physics. Blocked movement slides; never teleports through a bank. */
class VesselMotion {
  constructor() {
    this.stop();
  }
  stop() {
    this.vx = this.vy = this.stroke = 0;
    this.rowing = false;
    this.bumped = null;
  }
  /** Contra quién se ha chocado esta tanda de pasos, una sola vez: leerlo lo consume. */
  takeBump() {
    const body = this.bumped;
    this.bumped = null;
    return body;
  }
  step(world, player, intent, dt, fast = false) {
    dt = clamp(dt, 0, 0.05);
    const length = intent ? Math.hypot(intent.x, intent.y) : 0;
    this.rowing = length > 0;
    const flow = currentAt(world.data, player.x, player.y);
    const speed = fast ? FAST_ROW_SPEED : ROW_SPEED;
    const tx = (length ? (intent.x / length) * speed : 0) + flow.x;
    const ty = (length ? (intent.y / length) * speed : 0) + flow.y;
    const blend = 1 - Math.exp(-dt * (length ? ROW_RESPONSE : GLIDE_DRAG));
    this.vx += (tx - this.vx) * blend;
    this.vy += (ty - this.vy) * blend;
    if (length) player.direction = facing(intent.x, intent.y, player.direction);
    const dx = this.vx * dt,
      dy = this.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
    let moved = false;
    for (let i = 0; i < steps; i++) {
      const here = { x: player.x, y: player.y };
      if (canFloat(world, player.x + dx / steps, player.y + dy / steps, here)) {
        player.x += dx / steps;
        player.y += dy / steps;
        moved ||= Math.abs(dx) + Math.abs(dy) > 0.01;
      } else {
        // Quien te ha parado importa: una orilla no dice nada y un vecino sí.
        this.bumped ||= riverBodyAt(
          world,
          player.x + dx / steps,
          player.y + dy / steps,
          here,
        );
        if (canFloat(world, player.x + dx / steps, player.y, here)) {
          player.x += dx / steps;
          moved ||= Math.abs(dx) > 0.01;
        } else this.vx = 0;
        if (canFloat(world, player.x, player.y + dy / steps, here)) {
          player.y += dy / steps;
          moved ||= Math.abs(dy) > 0.01;
        } else this.vy = 0;
      }
    }
    if (this.rowing) this.stroke += dt * (fast ? 1.4 : 1);
    else this.stroke = 0;
    return moved;
  }
  phase(reduced = false) {
    return (
      this.rowing && !reduced
        ? Math.floor(this.stroke * 5) % 4
        : 0);
  }
  frame(direction, reduced = false, variant = playerVariant()) {
    return `person-${variant}-${direction || "down"}-row-${this.phase(reduced)}`;
  }
}

module.exports = {
  HULL_RADIUS,
  ROW_SPEED,
  FAST_ROW_SPEED,
  canFloat,
  riverBodyAt,
  yieldToRiverBodies,
  currentAt,
  VesselMotion,
};
