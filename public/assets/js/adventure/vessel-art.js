"use strict";
const definition = require("../../../../data/aventura/rowing.json");
const { playerVariant, rowingRigs } = require("./player-art");

function vesselLayers(actor, phase = 0, vessel = definition.defaultVessel) {
  const direction = actor.direction || "down", variant = playerVariant(actor);
  const hull = definition.vessels[vessel];
  if (!hull?.views[direction]) throw Error("Unknown vessel view");
  return { vessel, direction, phase, variant,
    hull: `${hull.prefix}-${direction}-0`,
    rower: `person-${variant}-${direction}-row-${phase}` };
}
function polygon(points) {
  const path = new Path2D();
  points.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y));
  path.closePath();
  return path;
}
function placement(vessel, direction) {
  return { scale: vessel.rowerScale ?? 1, offset: vessel.views[direction].rowerOffset ?? [0, 0] };
}
function compositionBounds(rower, hull, { scale = 1, offset = [0, 0] } = {}) {
  const x = Math.floor(Math.min(-rower.anchor[0] * scale + offset[0], -hull.anchor[0]));
  const y = Math.floor(Math.min(-rower.anchor[1] * scale + offset[1], -hull.anchor[1]));
  return { x, y,
    w: Math.ceil(Math.max((rower.w - rower.anchor[0]) * scale + offset[0], hull.w - hull.anchor[0])) - x,
    h: Math.ceil(Math.max((rower.h - rower.anchor[1]) * scale + offset[1], hull.h - hull.anchor[1])) - y };
}
function blade(points, depth, { scale, offset }) {
  let [gx, gy, tx, ty, radius, length] = points;
  [gx, gy, tx, ty] = [gx * scale + offset[0], gy * scale + offset[1], tx * scale + offset[0], ty * scale + offset[1]];
  radius *= scale; length *= scale;
  const angle = Math.atan2(ty - gy, tx - gx);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const cx = tx - dx * length / 2, cy = ty - dy * length / 2;
  const path = new Path2D();
  path.ellipse(cx, cy, length / 2 + 1, radius, angle, 0, Math.PI * 2);
  // A generous cap covers the complete blade contour, including its dark edge.
  // The old tight ellipse faded only the middle, leaving sharp uncut scraps.
  const cap = polygon([
    [tx + dx * 2 - dy * (radius + 2), ty + dy * 2 + dx * (radius + 2)],
    [tx + dx * 2 + dy * (radius + 2), ty + dy * 2 - dx * (radius + 2)],
    [tx - dx * (length + 2) + dy * (radius + 2), ty - dy * (length + 2) - dx * (radius + 2)],
    [tx - dx * (length + 2) - dy * (radius + 2), ty - dy * (length + 2) + dx * (radius + 2)],
  ]);
  const oar = new Path2D(cap), start = [gx + dx * 2, gy + dy * 2];
  oar.moveTo(start[0] - dy, start[1] + dx);
  oar.lineTo(cx - dy, cy + dx); oar.lineTo(cx + dy, cy - dx);
  oar.lineTo(start[0] + dy, start[1] - dx); oar.closePath();
  // A far paddle can project upwards on screen. Immerse its tip-facing cap,
  // never assume that every direction uses the frontal downward-V silhouette.
  const waterSide = ty >= gy ? 1 : -1;
  const waterline = cy + waterSide * radius * (1 - depth * 2);
  return { path, cap, oar, waterline, waterSide, tip: [cx, waterline], radius };
}

const SURFACE_SIZE = 256, PIXEL_RATIO = 2, LOGICAL_SIZE = SURFACE_SIZE / PIXEL_RATIO;
function surface() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SURFACE_SIZE;
  return canvas;
}
function clearSurface(canvas, left, top) {
  const context = canvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, SURFACE_SIZE, SURFACE_SIZE);
  context.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, -left * PIXEL_RATIO, -top * PIXEL_RATIO);
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
  context.fillStyle = "#000";
  context.imageSmoothingEnabled = false;
  return context;
}
function applyMask(context, canvas) {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = "destination-out";
  context.drawImage(canvas, 0, 0);
  context.restore();
}

/** Two reusable 2x surfaces (512 KiB total). No source-pixel scans, image rewriting or per-player
 * composite textures. Hull masks belong to the vessel; paddle landmarks belong to the actor.
 * Paths are weakly cached by the actual decoded rowing pack: eviction releases the cache too. */
class VesselArt {
  constructor(sprites) { this.sprites = sprites; this.paths = new WeakMap(); }
  bounds(layers) {
    const rower = this.sprites.frame(layers.rower), hull = this.sprites.frame(layers.hull);
    return rower && hull ? compositionBounds(rower, hull, placement(definition.vessels[layers.vessel], layers.direction)) : null;
  }
  masks(layers) {
    const pack = this.sprites.packs.get(this.sprites.owners.get(layers.rower));
    if (!pack) return null;
    let cache = this.paths.get(pack);
    if (!cache) { cache = new Map(); this.paths.set(pack, cache); }
    const key = `${layers.vessel}/${layers.rower}`;
    if (cache.has(key)) return cache.get(key);
    const hull = definition.vessels[layers.vessel], view = hull.views[layers.direction];
    const rig = definition.rigs[rowingRigs[layers.variant]]?.[layers.direction]?.[layers.phase];
    if (!rig) return null; // Never borrow another person's seated anatomy.
    const rowerPlacement = placement(hull, layers.direction);
    const body = definition.bodies?.[rowingRigs[layers.variant]]?.[layers.direction];
    const value = { rim: polygon(view.rim), far: view.far, placement: rowerPlacement,
      body: body ? polygon(body.map(([x, y]) => [x * rowerPlacement.scale + rowerPlacement.offset[0],
        y * rowerPlacement.scale + rowerPlacement.offset[1]])) : null,
      farMask: view.farMask ? polygon(view.farMask) : null,
      blades: rig.map(p => blade(p, hull.immersion.depth[layers.phase], rowerPlacement)),
      depth: hull.immersion.depth[layers.phase] };
    if (value.body) {
      value.outsideBody = new Path2D();
      value.outsideBody.rect(-LOGICAL_SIZE, -LOGICAL_SIZE, LOGICAL_SIZE * 2, LOGICAL_SIZE * 2);
      value.outsideBody.addPath(value.body);
    }
    cache.set(key, value);
    return value;
  }
  drawRower(context, layers) {
    const frame = this.sprites.frame(layers.rower);
    const { scale, offset } = placement(definition.vessels[layers.vessel], layers.direction);
    return this.sprites.draw(context, layers.rower, offset[0] - frame.anchor[0] * scale,
      offset[1] - frame.anchor[1] * scale, frame.w * scale, frame.h * scale);
  }
  drawHull(context, layers) {
    const frame = this.sprites.frame(layers.hull);
    this.sprites.draw(context, layers.hull, -frame.anchor[0], -frame.anchor[1]);
  }
  excludeHull(context, layers) {
    context.globalCompositeOperation = "destination-out";
    this.drawHull(context, layers);
    context.globalCompositeOperation = "source-over";
  }
  draw(context, entity, layers, { water = true, occlusion = true } = {}) {
    const sprites = this.sprites, f = sprites.frame(layers.rower), h = sprites.frame(layers.hull);
    if (!f || !h) return false; // Embark prepares both; peers wait for their own appearance.
    const masks = this.masks(layers);
    if (!masks) return false;
    const { x: left, y: top, w: width, h: height } = compositionBounds(f, h, masks.placement);
    if (width > LOGICAL_SIZE || height > LOGICAL_SIZE) throw Error("Vessel composition exceeds its 512 KiB scratch budget");
    this.canvas ??= surface();
    this.waterCanvas ??= surface();
    const c = clearSurface(this.canvas, left, top);
    this.drawRower(c, layers);
    if (occlusion) {
      const mask = clearSurface(this.waterCanvas, left, top);
      mask.save(); mask.clip(masks.rim); this.drawHull(mask, layers); mask.restore();
      // Exempt near oars from the occluder rather than painting the character twice:
      // original alpha, colour and contour remain untouched above the waterline.
      for (let i = 0; i < masks.blades.length; i++) if (i !== masks.far) {
        mask.save(); mask.globalCompositeOperation = "destination-out";
        mask.fill(masks.blades[i].oar); mask.restore();
      }
      // Far-oar occlusion uses actual plastic pixels too, not the polygon's empty corners.
      if (masks.far !== null && masks.farMask) {
        mask.save(); mask.clip(masks.blades[masks.far].oar); mask.clip(masks.farMask);
        // The far shaft passes BEHIND the actor. Its projected line must never erase
        // the neck, face or clothing merely because the hull occupies the same pixel.
        if (masks.outsideBody) mask.clip(masks.outsideBody, "evenodd");
        this.drawHull(mask, layers); mask.restore();
      }
      applyMask(c, this.waterCanvas);
    }
    if (water && masks.depth) {
      const wc = clearSurface(this.waterCanvas, left, top);
      for (const p of masks.blades) {
        wc.save(); wc.clip(p.cap);
        const top = p.waterSide > 0 ? p.waterline : -LOGICAL_SIZE;
        const bottom = p.waterSide > 0 ? LOGICAL_SIZE : p.waterline;
        wc.fillRect(-LOGICAL_SIZE, top, LOGICAL_SIZE * 2, bottom - top); wc.restore();
      }
      // Exact hull alpha owns this exclusion, not an approximate polygon.
      // A submerged cap disappears cleanly; no semi-transparent blade patches.
      this.excludeHull(wc, layers);
      if (masks.body) {
        wc.save(); wc.globalCompositeOperation = "destination-out"; wc.fill(masks.body); wc.restore();
      }
      applyMask(c, this.waterCanvas);
    }
    context.save(); context.globalAlpha *= entity.opacity ?? 1;
    context.translate(Math.round(entity.x), Math.round(entity.y));
    this.drawHull(context, layers);
    context.imageSmoothingEnabled = false;
    context.drawImage(this.canvas, 0, 0, width * PIXEL_RATIO, height * PIXEL_RATIO, left, top, width, height);
    if (water && masks.depth) {
      const wc = clearSurface(this.waterCanvas, left, top);
      wc.strokeStyle = "rgba(206,236,230,.38)"; wc.lineWidth = .6;
      for (let i = 0; i < masks.blades.length; i++) {
        if (i === masks.far) continue;
        const [x, y] = masks.blades[i].tip;
        wc.beginPath(); wc.ellipse(x, y, 3 + masks.depth, .8, 0, 0, Math.PI); wc.stroke();
      }
      this.excludeHull(wc, layers);
      context.drawImage(this.waterCanvas, 0, 0, width * PIXEL_RATIO, height * PIXEL_RATIO, left, top, width, height);
    }
    context.restore();
    return true;
  }
}
module.exports = { VesselArt, vesselLayers, compositionBounds, definition };
