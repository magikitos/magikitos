"use strict";
/** Growth is a view of the original placement time, not another persisted state.
 * Moving a plant never restarts its age. No cron, requests or per-plant timer. */
function growthDeadline(item, definition) {
  if (!definition.growAfterMs) return null;
  if (typeof item.createdAt !== "string" || !item.createdAt.endsWith("Z"))
    throw Error("invalid_plant_time");
  const plantedAt = Date.parse(item.createdAt);
  if (!Number.isFinite(plantedAt)) throw Error("invalid_plant_time");
  return plantedAt + definition.growAfterMs;
}
function germinating(entity, now) {
  return entity.growsAt != null && (now == null || now < entity.growsAt);
}
/** Small freshly raked earth, in the ground's warm palette. Integer clusters,
 * not a new downloaded texture or a per-frame terrain rebuild. */
function drawGrowing(ctx, entity, now) {
  if (!germinating(entity, now)) return false;
  const x = Math.round(entity.x), y = Math.round(entity.y);
  ctx.save();
  ctx.fillStyle = "#80613e";
  ctx.fillRect(x - 6, y - 3, 12, 6);
  ctx.fillRect(x - 8, y - 1, 16, 2);
  ctx.fillStyle = "#b2a16b";
  for (const [dx, dy] of [[-5, -2], [0, -1], [4, 1]])
    ctx.fillRect(x + dx, y + dy, 2, 1);
  ctx.restore();
  return true;
}
module.exports = { growthDeadline, germinating, drawGrowing };
