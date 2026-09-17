"use strict";
const { TILE, waterAt, inRect, collisionBounds, clamp } = require("./geometry");
const { riverSection } = require("./river-course");
const { facing } = require("./characters");

// The hull, not Ascua's walking footprint. Oars skim the water and are not a solid body.
const HULL_RADIUS = 26;
const ROW_SPEED = 82;
const FAST_ROW_SPEED = 205;
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
function yieldToRiverBodies(world, player, dt) {
  const body = riverBodyAt(world, player.x, player.y);
  const touching = body || riverBodyAt(world, player.x, player.y, null);
  if (!touching) return null;
  const away = Math.hypot(player.x - touching.x, player.y - touching.y) || 1;
  const step = Math.min(touching.radius + HULL_RADIUS - away, 70 * dt);
  if (step <= 0) return null;
  const dx = ((player.x - touching.x) / away) * step,
    dy = ((player.y - touching.y) / away) * step;
  if (canFloat(world, player.x + dx, player.y + dy, player)) {
    player.x += dx;
    player.y += dy;
  } else if (canFloat(world, player.x + dx, player.y, player)) player.x += dx;
  else if (canFloat(world, player.x, player.y + dy, player)) player.y += dy;
  else return null;
  return touching;
}
function canFloat(world, x, y, from = null) {
  const data = world.data || world;
  if (
    ![x, y].every(Number.isFinite) ||
    x < HULL_RADIUS ||
    y < HULL_RADIUS ||
    x > data.width * TILE - HULL_RADIUS ||
    y > data.height * TILE - HULL_RADIUS
  )
    return false;
  if (
    !probes.every(([dx, dy]) => waterAt(data, (x + dx) / TILE, (y + dy) / TILE))
  )
    return false;
  if (riverBodyAt(world, x, y, from)) return false;
  return !(world.colliders || []).some((e) => {
    const b = collisionBounds(e);
    const px = clamp(x, b.x, b.x + b.w),
      py = clamp(y, b.y, b.y + b.h);
    return Math.hypot(x - px, y - py) < HULL_RADIUS;
  });
}

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
    const strength = clamp((1 - d) * 4, 0, 1);
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
    const blend = 1 - Math.exp(-dt * (length ? 8 : 4));
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
  frame(direction, reduced = false) {
    const row =
      this.rowing && !reduced
        ? [1, 2, 3, 2][Math.floor(this.stroke * 5) % 4]
        : 0;
    return `boat-ascua-${direction || "down"}-${row}`;
  }
}

/**
 * ⛔ LA BANDA DE SALIDA NO LLEGABA HASTA DONDE LLEGA LA BARCA (17-sep-2026).
 *
 * Las bandas están dibujadas en tiles y el casco se planta a `HULL_RADIUS` del borde del mapa,
 * así que pegándose al borde de abajo la barca acaba en la fila 142,375 y la banda termina en la
 * 142,2: agua, borde, y nada que pase. Medido, le ocurría a las DIEZ salidas «downstream», a las
 * de la izquierda y a la del islote, que su banda ni siquiera alcanza la columna donde el casco
 * se detiene. El síntoma es el peor posible: el río sigue estando ahí delante y el juego no
 * responde, así que parece roto sin que falle nada.
 *
 * No se arregla ensanchando dieciséis rectángulos a mano —que habría que rehacer el día que el
 * casco cambie de tamaño— sino preguntando lo que de verdad importa: si la barca está PEGADA al
 * borde por un lado que tiene salida. La banda sigue mandando en el tramo del borde por el que
 * se pasa (la boca del río del bosque son sus veinticinco columnas y no el lago entero); lo único
 * que se le suma es el hueco que el propio casco se deja.
 */
function riverExit(data, player) {
  const tx = player.x / TILE,
    ty = player.y / TILE;
  const exits = data.navigation?.exits || [];
  const inside = exits.find((e) => inRect(tx, ty, e.area));
  if (inside) return inside;
  const hull = HULL_RADIUS / TILE;
  const pressed = {
    up: ty <= hull,
    down: ty >= data.height - hull,
    left: tx <= hull,
    right: tx >= data.width - hull,
  };
  return (
    exits.find((e) => {
      if (!pressed[e.direction]) return false;
      const [ax, ay, aw, ah] = e.area;
      const vertical = e.direction === "up" || e.direction === "down";
      const [from, to] = vertical ? [ax, ax + aw] : [ay, ay + ah];
      const along = vertical ? tx : ty;
      return along >= from - hull && along <= to + hull;
    }) || null
  );
}

/**
 * Por dónde se entra en la pantalla de al lado. El punto escrito en los datos dice a qué ALTURA
 * del río se aparece —adentro, para no volver a cruzar el borde sin querer— y el jugador pone el
 * resto: se conserva su desvío respecto al centro del paso, así que quien cruzaba pegado a la
 * orilla izquierda sigue pegado a la orilla izquierda. Sin esto, cada costura te devolvía al
 * centro del canal de un tirón, que es lo que se siente como que las pantallas no encajan.
 *
 * El desvío se acota a la propia banda: una salida no puede escupirte más lejos de lo ancha que
 * es. Y quien llama prueba este punto ANTES que el escrito, que es el respaldo cuando el canal de
 * enfrente hace otra curva.
 */
function riverArrival(exit, player) {
  const [ax, ay, aw, ah] = exit.area;
  const vertical = exit.direction === "up" || exit.direction === "down";
  const half = (vertical ? aw : ah) / 2;
  const drift = clamp(
    (vertical ? player.x : player.y) / TILE - ((vertical ? ax : ay) + half),
    -half,
    half,
  );
  return {
    x: (exit.position[0] + (vertical ? drift : 0)) * TILE,
    y: (exit.position[1] + (vertical ? 0 : drift)) * TILE,
  };
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
  riverExit,
  riverArrival,
};
