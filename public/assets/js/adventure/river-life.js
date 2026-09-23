"use strict";
const { TILE } = require("./model");
const { riverSection } = require("./river-course");
/**
 * Quien vive el río además de ti. Sin estado en red ni búsquedas de camino por fotograma: su
 * sitio es una función del reloj, así que dibujarlos y chocar con ellos leen exactamente lo
 * mismo y no pueden discrepar.
 */
/**
 * El recorrido de un visitante empieza `lead` casillas antes del borde de arriba y sigue `beyond`
 * casillas más allá del de abajo —por defecto diez, o lo que diga `riverLife[].beyond`—, y en las
 * últimas y primeras casillas se DESVANECE en vez de cortarse (20-sep-2026, decisión del dueño:
 * «el NPC de la barquita… desaparece de repente en el mismo punto»). Como las vecinas se pintan
 * trasladadas, la barca de los sauces sigue remando por el lago de la pradera hasta esfumarse.
 */
const FADE = 6;
function riverVisitors(data, time) {
  const river = data.rivers?.[0];
  if (!river) return [];
  return (data.riverLife || []).map((v) => {
    const lead = 10,
      beyond = v.beyond ?? 10,
      span = data.height + lead + beyond,
      y = ((time * v.speed + v.phase) % span) - lead;
    const bank = riverSection(river, y);
    const frame = v.frames[Math.floor(time / 0.9) % v.frames.length];
    const opacity = Math.max(0, Math.min(1, (y + lead) / FADE, (data.height + beyond - y) / FADE));
    return {
      ...v,
      x: ((bank.left + bank.right) / 2 + v.offset) * TILE,
      y: y * TILE,
      sprite: frame,
      artSprite: frame,
      flip: bank.tangent < -0.05,
      opacity,
    };
  });
}
/**
 * ⛔ EL RÍO ES DE TODOS (17-sep-2026, decisión del dueño): los otros duendes y la gente pescando
 * son COSAS DE COLISIÓN, no decorado que se atraviesa.
 *
 * Son dos cuerpos distintos porque están en dos sitios distintos: la cáscara de nuez del vecino
 * que rema va por el medio del canal, y de quien pesca lo que hay en el agua no es él —está en
 * la orilla, donde tu casco no llega nunca— sino su CORCHO. Pasarle a alguien la barca por encima
 * del corcho es justo lo que el cartel del río diría que no se hace.
 *
 * Se recalculan por fotograma porque el rowero se mueve, y por eso no viven en `world.colliders`,
 * que se arma al refrescar la escena y no volvería a mirar.
 */
const VISITOR_RADIUS = 20;
const FLOAT_RADIUS = 12;
function riverBodies(data, time) {
  const bodies = riverVisitors(data, time).map((visitor) => ({
    id: visitor.id,
    x: visitor.x,
    y: visitor.y,
    radius: VISITOR_RADIUS,
    bump: visitor.bump,
  }));
  for (const neighbor of data.neighbors || [])
    if (neighbor.fishing?.target)
      bodies.push({
        id: neighbor.id,
        x: neighbor.fishing.target[0] * TILE,
        y: neighbor.fishing.target[1] * TILE,
        radius: FLOAT_RADIUS,
        bump: neighbor.bump,
      });
  return bodies;
}
function drawFishing(ctx, actor, time) {
  if (!actor.fishing) return;
  // The rod may be part of the angler's own sheet; the line and float are always drawn here.
  const rod = !actor.fishing.drawnRod;
  const [tx, ty] = actor.fishing.target.map((n) => n * TILE);
  const side = tx < actor.x ? -1 : 1;
  const hand = { x: actor.x + side * 8, y: actor.y - 14 };
  // A drawn rod says where its tip is, relative to the feet; the procedural one reaches 42 out.
  const tip = actor.fishing.tip
    ? { x: actor.x + actor.fishing.tip[0], y: actor.y + actor.fishing.tip[1] }
    : { x: actor.x + side * 42, y: actor.y - 42 };
  ctx.save();
  if (rod) {
    ctx.strokeStyle = "#655236";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hand.x, hand.y);
    ctx.quadraticCurveTo(tip.x, hand.y - 24, tip.x, tip.y);
    ctx.stroke();
  }
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = "rgba(234,229,199,.65)";
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.quadraticCurveTo(tx, tip.y + 8, tx, ty);
  ctx.stroke();
  ctx.fillStyle = "#c97951";
  ctx.fillRect(tx - 1, ty + Math.sin(time * 1.3), 3, 3);
  ctx.restore();
}
module.exports = { riverVisitors, riverBodies, drawFishing };
