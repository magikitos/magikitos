"use strict";
function cropFor(record) {
  const d = record.definition;
  return d.crop || [0, 0, ...d.size];
}
function validateSprites(snapshot, changes = {}) {
  if (!changes || Array.isArray(changes) || typeof changes !== "object")
    throw Error("Ajustes de arte inválidos");
  const result = {};
  for (const [name, edit] of Object.entries(changes)) {
    const record = snapshot.sprites?.[name],
      crop = edit?.crop;
    if (
      !record ||
      Object.keys(edit).some((k) => k !== "crop") ||
      !Array.isArray(crop) ||
      crop.length !== 4 ||
      crop.some((v) => !Number.isInteger(v)) ||
      crop[0] < 0 ||
      crop[1] < 0 ||
      crop[2] < 1 ||
      crop[3] < 1 ||
      crop[0] + crop[2] > record.definition.size[0] ||
      crop[1] + crop[3] > record.definition.size[1]
    )
      throw Error("Recorte fuera del sprite: " + name);
    if (JSON.stringify(crop) !== JSON.stringify(cropFor(record)))
      result[name] = { crop: [...crop] };
  }
  return result;
}
function spriteDiff(snapshot, changes) {
  return Object.entries(validateSprites(snapshot, changes)).map(
    ([sprite, after]) => {
      const r = snapshot.sprites[sprite];
      return {
        sprite,
        file: r.file,
        sourceHash: r.sourceHash,
        before: { crop: cropFor(r) },
        after,
        proposedDefinition: { ...r.definition, ...after },
      };
    },
  );
}
/** Source frames are immutable. Crop moves the atlas window and anchor together. */
function croppedFrame(source, crop) {
  const [tx, ty] = source.trim || [0, 0];
  const left = Math.max(tx, crop[0]),
    top = Math.max(ty, crop[1]);
  const right = Math.min(tx + source.w, crop[0] + crop[2]),
    bottom = Math.min(ty + source.h, crop[1] + crop[3]);
  if (right <= left || bottom <= top)
    throw Error("El recorte deja el sprite vacío");
  const dx = left - tx,
    dy = top - ty,
    w = right - left,
    h = bottom - top;
  const anchor = [source.anchor[0] - dx, source.anchor[1] - dy];
  const [ix,iy,iw,ih] = source.ink || [0,0,source.w,source.h];
  const il = Math.max(ix,dx), it = Math.max(iy,dy);
  const ink = [il-dx,it-dy,Math.max(0,Math.min(ix+iw,dx+w)-il),Math.max(0,Math.min(iy+ih,dy+h)-it)];
  return {
    ...source,
    x: source.x + dx * source.pixelRatio,
    y: source.y + dy * source.pixelRatio,
    w,
    h,
    anchor,
    ink,
    trim: [left, top],
    crop,
    bounds: [-anchor[0], -anchor[1], w, h],
  };
}
module.exports = { cropFor, validateSprites, spriteDiff, croppedFrame };
