"use strict";
const { TILE, riverOffset, random } = require("./geometry");
const { currentAt } = require("./river-navigation");
const traceRandom = random(873421);
const TRACES = Array.from({ length: 96 }, () => ({
  phase: traceRandom(), across: traceRandom() * 2 - 1,
  length: 0.65 + traceRandom() * 0.45,
}));

/** Deterministic tracers covering the full authored ellipse, including channel
 * bends. Only visible water is painted; at most 96 traces per visible field.
 * No retained particles, DOM nodes or off-screen simulation. */
function drawCurrentTraces(ctx, world, camera, view, time) {
  for (const field of world.data.navigation?.currents || []) {
    const [cx, cy, rx, ry] = field.area;
    const river = field.channel && world.data.rivers?.[0];
    const margin = river ? Math.abs(river.meander || 0) : 0;
    if (
      (cx + rx + margin) * TILE < camera.x ||
      (cy + ry) * TILE < camera.y ||
      (cx - rx - margin) * TILE > camera.x + view.width ||
      (cy - ry) * TILE > camera.y + view.height
    )
      continue;
    const speed = Math.hypot(...field.vector);
    if (speed < 4) continue;
    const ux = field.vector[0] / speed,
      uy = field.vector[1] / speed;
    const extent = (Math.abs(ux) * rx + Math.abs(uy) * ry) * TILE;
    const breadth = (Math.abs(uy) * rx + Math.abs(ux) * ry) * TILE;
    const count = speed > 45 ? 96 : 64;
    const duration = Math.max(1, (2 * extent) / speed);
    for (let i = 0; i < count; i++) {
      const age = (((time / duration + TRACES[i].phase) % 1) + 1) % 1;
      const across = TRACES[i].across * breadth * 0.82;
      const along = (age * 2 - 1) * extent;
      const y = cy * TILE + ux * across + uy * along;
      const x =
        (cx + (river ? riverOffset(river, y / TILE) : 0)) * TILE -
        uy * across +
        ux * along;
      if (
        x < camera.x - 24 ||
        y < camera.y - 24 ||
        x > camera.x + view.width + 24 ||
        y > camera.y + view.height + 24 ||
        !world.waterAt(x / TILE, y / TILE)
      )
        continue;
      const flow = currentAt(world.data, x, y);
      const magnitude = Math.hypot(flow.x, flow.y);
      if (magnitude < 4) continue;
      const dx = flow.x / magnitude,
        dy = flow.y / magnitude;
      const length = (5 + Math.min(14, magnitude / 8)) * TRACES[i].length;
      ctx.globalAlpha =
        Math.sin(age * Math.PI) * (0.25 + Math.min(0.52, magnitude / 170));
      ctx.strokeStyle = i % 11 === 0 ? "#c3d58a" : "#dceee8";
      ctx.lineWidth = magnitude > 55 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dx * length, y - dy * length);
      ctx.stroke();
      if (magnitude > 55 && i % 5 === 0) {
        // Short foam crests clarify direction without turning the river into UI arrows.
        ctx.beginPath();
        ctx.moveTo(x - dy * 4 - dx * 3, y + dx * 4 - dy * 3);
        ctx.quadraticCurveTo(
          x + dx * 2,
          y + dy * 2,
          x + dy * 4 - dx * 3,
          y - dx * 4 - dy * 3,
        );
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}
module.exports = { drawCurrentTraces };
