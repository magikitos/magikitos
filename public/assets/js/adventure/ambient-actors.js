"use strict";
const { drawArtwork } = require("./entity-art");
const { seatedClip } = require("./seating");
/**
 * Authored ambient clips, in seconds. Feet/collision anchors never depend on time.
 * All poses live with their idle sprite in one scene-lazy pack: no GIF decoder,
 * canvas readback, timers, or per-pose network requests.
 */
const clips = {
  "picnic-smoker": {
    phase: 1.3,
    fixedBelow: -32,
    steps: [
      ["picnic-smoker", 6.8],
      ["picnic-smoker-raise", 0.22],
      ["picnic-smoker-puff", 0.85],
      ["picnic-smoker-lower", 0.22],
      ["picnic-smoker", 4.1],
    ],
    smoke: { start: 7.5, duration: 2.1, origin: [10, -66] },
  },
  "picnic-human-friend": {
    phase: 4.7,
    fixedBelow: -34,
    steps: [
      ["picnic-human-friend", 4.2],
      ["picnic-friend-talk", 1.3],
      ["picnic-human-friend", 3.6],
      ["picnic-friend-talk", 0.22],
      ["picnic-friend-sip", 0.7],
      ["picnic-friend-talk", 0.22],
      ["picnic-friend-smile", 1.8],
      ["picnic-human-friend", 3],
    ],
  },
};
for (const clip of Object.values(clips))
  clip.duration = clip.steps.reduce((total, [, seconds]) => total + seconds, 0);

function pose(clip, time) {
  // Renderer supplies zero for reduced motion and the still Studio view.
  if (!(time > 0)) return { frame: clip.steps[0][0], smoke: 0 };
  const clock = (time + clip.phase) % clip.duration;
  let remaining = clock;
  for (const [frame, duration] of clip.steps) {
    if (remaining < duration) {
      const age = clip.smoke
        ? (clock - clip.smoke.start) / clip.smoke.duration
        : -1;
      return { frame, smoke: age > 0 && age < 1 ? age : 0 };
    }
    remaining -= duration;
  }
  return { frame: clip.steps[0][0], smoke: 0 };
}
function drawSmoke(ctx, entity, origin, progress) {
  if (!progress) return;
  ctx.save();
  ctx.translate(
    Math.round(entity.x + (entity.offset?.[0] || 0)),
    Math.round(entity.y + (entity.offset?.[1] || 0)),
  );
  ctx.rotate(((entity.rotation || 0) * Math.PI) / 180);
  ctx.scale((entity.scale ?? 1) * (entity.flip ? -1 : 1), entity.scale ?? 1);
  ctx.fillStyle = "#e0dec8";
  for (let i = 0; i < 3; i++) {
    const age = progress - i * 0.12;
    if (age <= 0) continue;
    ctx.globalAlpha = Math.sin(age * Math.PI) * 0.28;
    ctx.fillRect(
      Math.round(origin[0] + age * 9 + Math.sin(age * 5 + i)),
      Math.round(origin[1] - age * 16),
      2,
      1,
    );
  }
  ctx.restore();
}
function drawAmbientActor(ctx, sprites, entity, name, time) {
  const clip = clips[name] || seatedClip(name);
  if (!clip || !sprites.frame(name)) return false;
  const p = pose(clip, time);
  const frame = sprites.frame(p.frame) ? p.frame : name;
  if (frame === name) drawArtwork(ctx, sprites, entity, name);
  else {
    // Generated poses retain a shared registration canvas, but tiny drawing
    // differences must never make seated legs wobble. Keep the lower body exact.
    const f = sprites.frame(name),
      width = f.nativeSize?.[0] || f.w,
      height = f.nativeSize?.[1] || f.h;
    drawArtwork(ctx, sprites, entity, name, {
      x: -width,
      y: clip.fixedBelow,
      w: width * 2,
      h: height * 2,
    });
    drawArtwork(ctx, sprites, entity, frame, {
      x: -width,
      y: -height,
      w: width * 2,
      h: height + clip.fixedBelow,
    });
  }
  if (clip.smoke) drawSmoke(ctx, entity, clip.smoke.origin, p.smoke);
  return true;
}
module.exports = { clips, pose, drawAmbientActor };
