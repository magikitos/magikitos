"use strict";
const { TILE } = require("./model");
const { riverSection } = require("./river-course");
/** Decorative residents have no physics, network state or per-frame path searches. */
function riverVisitors(data, time) {
  const river = data.rivers?.[0];
  if (!river) return [];
  return (data.riverLife || []).map((v) => {
    const y = ((time * v.speed + v.phase) % (data.height + 20)) - 10;
    const bank = riverSection(river, y);
    const frame = v.frames[Math.floor(time / 0.9) % v.frames.length];
    return {
      ...v,
      x: ((bank.left + bank.right) / 2 + v.offset) * TILE,
      y: y * TILE,
      sprite: frame,
      artSprite: frame,
      flip: bank.tangent < -0.05,
    };
  });
}
function drawFishing(ctx, actor, time) {
  if (!actor.fishing) return;
  const [tx, ty] = actor.fishing.target.map((n) => n * TILE);
  const side = tx < actor.x ? -1 : 1;
  const hand = { x: actor.x + side * 8, y: actor.y - 14 };
  const tip = { x: actor.x + side * 42, y: actor.y - 42 };
  ctx.save();
  ctx.strokeStyle = "#655236";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hand.x, hand.y);
  ctx.quadraticCurveTo(tip.x, hand.y - 24, tip.x, tip.y);
  ctx.stroke();
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
module.exports = { riverVisitors, drawFishing };
