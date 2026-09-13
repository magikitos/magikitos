"use strict";
const { TILE, random, hash } = require("./model");
const { artworkBounds, drawArtwork } = require("./entity-art");
const { matches, active } = require("./rules");
const { characterFrame } = require("./characters");
const { SpriteLibrary } = require("./sprites");
const { Terrain } = require("./terrain");
const { drawRipples } = require("./water");
class Renderer {
  constructor(canvas, viewport) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.sprites = new SpriteLibrary();
    this.terrain = new Terrain(this.sprites);
    this.productImages = new Map();
    this.scale = 3;
  }
  resize(zoom = this.zoom || 1) {
    this.zoom = zoom;
    const r = this.viewport.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const target = r.width < 600 ? 350 : 580;
    this.scale = Math.max(2, Math.round(r.width / target)) * zoom;
    this.width = Math.ceil(r.width / this.scale);
    this.height = Math.ceil(r.height / this.scale);
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.canvas.style.width = r.width + "px";
    this.canvas.style.height = r.height + "px";
    this.pixelScale = this.canvas.width / this.width;
    this.ctx.imageSmoothingEnabled = false;
  }
  drawSprite(name, x, y) {
    const f = this.sprites.frame(name);
    if (!f) return;
    const c = this.ctx;
    this.sprites.draw(
      c,
      name,
      Math.round(x - f.anchor[0]),
      Math.round(y - f.anchor[1]),
    );
  }
  frame(entity, state) {
    return (
      (entity.visuals || []).find((v) => matches(state, v.when))?.sprite ||
      entity.sprite
    );
  }
  hit(entity, point, state) {
    // Authored interaction areas also support invisible barriers across visible passageways.
    if (entity.hitArea) {
      const [dx, dy, w, h] = entity.hitArea;
      return (
        point.x >= entity.x + dx * TILE &&
        point.x <= entity.x + (dx + w) * TILE &&
        point.y >= entity.y + dy * TILE &&
        point.y <= entity.y + (dy + h) * TILE
      );
    }
    if (entity.sprite === "doorway")
      return (
        Math.abs(point.x - entity.x) <= TILE &&
        Math.abs(point.y - entity.y) <= TILE
      );
    if (entity.product)
      return (
        Math.abs(point.x - entity.x) <= 24 &&
        point.y >= entity.y - 57 &&
        point.y <= entity.y + 8
      );
    const frame = this.sprites.frame(this.frame(entity, state));
    if (!frame) return false;
    const b = artworkBounds(entity, frame);
    const pad = Math.max(2, 12 / this.scale);
    return (
      point.x >= b.x - pad &&
      point.x <= b.x + b.w + pad &&
      point.y >= b.y - pad &&
      point.y <= b.y + b.h + pad
    );
  }
  render(game, time) {
    const c = this.ctx,
      world = game.world,
      cam = game.camera;
    c.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
    c.imageSmoothingEnabled = false;
    if (game.voyage.active) {
      game.voyage.render(c, this.width, this.height, time);
      return;
    }
    c.fillStyle = "#273e35";
    c.fillRect(0, 0, this.width, this.height);
    c.save();
    c.translate(-Math.round(cam.x), -Math.round(cam.y));
    c.beginPath();
    c.rect(0, 0, world.width * TILE, world.height * TILE);
    c.clip();
    for (
      let cy = Math.max(0, Math.floor(cam.y / 256));
      cy <= Math.floor((cam.y + this.height) / 256) &&
      cy * 256 < world.height * TILE;
      cy++
    )
      for (
        let cx = Math.max(0, Math.floor(cam.x / 256));
        cx <= Math.floor((cam.x + this.width) / 256) &&
        cx * 256 < world.width * TILE;
        cx++
      ) {
        // Snap shared chunk edges in device pixels so fractional zoom cannot open seams.
        const x = Math.round((cx * 256 - Math.round(cam.x)) * this.pixelScale);
        const y = Math.round((cy * 256 - Math.round(cam.y)) * this.pixelScale);
        const right = Math.round(
          ((cx + 1) * 256 - Math.round(cam.x)) * this.pixelScale,
        );
        const bottom = Math.round(
          ((cy + 1) * 256 - Math.round(cam.y)) * this.pixelScale,
        );
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(
          this.terrain.chunk(world, cx, cy),
          x,
          y,
          right - x,
          bottom - y,
        );
        c.restore();
      }
    drawRipples(
      c,
      world,
      { ...cam, width: this.width, height: this.height },
      time,
    );
    if (world.data.indoor) {
      c.fillStyle = "#443e35";
      c.fillRect(0, 0, world.width * TILE, 30);
      c.fillRect(0, 0, 26, world.height * TILE);
      c.fillRect(world.width * TILE - 26, 0, 26, world.height * TILE);
      c.fillRect(0, world.height * TILE - 26, world.width * TILE, 26);
      c.fillStyle = "#cdbb8c";
      c.fillRect(26, 25, world.width * TILE - 52, 10);
      c.fillStyle = "#a38a61";
      c.fillRect(26, 35, world.width * TILE - 52, 18);
      for (const door of world.entities.filter((e) => e.sprite === "doorway")) {
        c.fillStyle = "#d0b279";
        c.fillRect(door.x - 19, door.y - 11, 38, 24);
        c.fillStyle = "#6b5036";
        c.fillRect(door.x - 15, door.y - 8, 30, 18);
        c.fillStyle = "#202f28";
        c.fillRect(door.x - 12, door.y + 5, 24, 36);
        c.fillStyle = "#b38b55";
        c.fillRect(door.x - 14, door.y + 3, 28, 3);
      }
      for (const rug of world.data.rugs || []) {
        const x = (rug.x - rug.width / 2) * TILE,
          y = (rug.y - rug.height / 2) * TILE,
          w = rug.width * TILE,
          h = rug.height * TILE;
        c.fillStyle = "#533e2f";
        c.fillRect(x - 2, y - 2, w + 4, h + 4);
        c.fillStyle = rug.color;
        c.fillRect(x, y, w, h);
        c.strokeStyle = "#c4b48a";
        c.lineWidth = 1;
        c.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
        for (let edge = 5; edge < w - 5; edge += 6) {
          c.fillStyle = "#bdaa7d";
          c.fillRect(x + edge, y - 2, 2, 3);
          c.fillRect(x + edge, y + h - 1, 2, 3);
        }
      }
    }
    game.self.drawGround(c);
    const visible = (e) =>
      e.x > cam.x - 140 &&
      e.x < cam.x + this.width + 140 &&
      e.y > cam.y - 40 &&
      e.y < cam.y + this.height + 140;
    const player = {
      ...game.player,
      sprite:
        game.self.frame() ||
        game.roll.frame() ||
        characterFrame(0, game.player, game.walking),
      player: true,
    };
    const list = [
      ...world.props,
      ...world.entities.filter(
        (e) => game.showAllEntities || active(e, game.state),
      ),
      ...game.neighbors,
      ...(game.guardian ? [game.guardian] : []),
      ...(game.hidePlayer ? [] : [player]),
    ]
      .filter(visible)
      .sort((a, b) => a.y - b.y);
    for (const e of list) {
      const name = e.neighbor
          ? characterFrame(e.variant || 3, e, e.moving)
          : this.frame(e, game.state),
        f = this.sprites.frame(name);
      if (!f) continue;
      if (e.player || e.neighbor) {
        c.fillStyle = "rgba(31,46,33,.22)";
        c.beginPath();
        c.ellipse(e.x, e.y + 1, 8, 3, 0, 0, 7);
        c.fill();
      }
      drawArtwork(c, this.sprites, e, name);
      if (e.player) game.self.drawStream(c);
      if (e.product) this.drawProduct(e);
      if (
        (e.rules?.length || e.neighbor || e.interactAs) &&
        (!e.interactWhen || matches(game.state, e.interactWhen)) &&
        !game.dialogue &&
        Math.hypot(e.x - player.x, e.y - player.y) < 52
      ) {
        c.fillStyle = "#faf1c5";
        c.fillRect(
          e.x - 1,
          e.y - f.anchor[1] - 6 + Math.round(Math.sin(time * 3)),
          3,
          3,
        );
      }
      if (name === "fire" || name === "barbecue-lit") {
        c.fillStyle = `rgba(250,186,80,${0.08 + Math.sin(time * 6) * 0.025})`;
        c.beginPath();
        c.ellipse(e.x, e.y, 27, 11, 0, 0, 7);
        c.fill();
        for (let i = 0; i < 3; i++) {
          const t = (time * 0.4 + i * 0.3) % 1;
          c.fillStyle = "#ffe6a0";
          c.fillRect(e.x + Math.sin(time + i) * 4, e.y - 11 - t * 18, 1, 1);
        }
      }
    }
    if (world.data.night) this.night(world.data.night, time, cam);
    if (game.path.length) {
      const end = game.path[game.path.length - 1];
      c.strokeStyle = "#fff0b1";
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(end.x, end.y, 5, 2, 0, 0, 7);
      c.stroke();
    }
    if (!game.reducedMotion) this.ambient(world, cam, time);
    c.restore();
    // A quiet edge vignette; no per-frame image processing.
    const gradient = c.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.width * 0.28,
      this.width / 2,
      this.height / 2,
      this.width * 0.8,
    );
    gradient.addColorStop(0, "rgba(19,38,27,0)");
    gradient.addColorStop(1, "rgba(19,38,27,.17)");
    c.fillStyle = gradient;
    c.fillRect(0, 0, this.width, this.height);
  }
  drawProduct(entity) {
    const c = this.ctx;
    const product = entity.product;
    let picture = this.productImages.get(product.id);
    if (!picture) {
      picture = new Image();
      picture.src = product.image;
      this.productImages.set(product.id, picture);
    }
    c.fillStyle = "#69452e";
    c.fillRect(entity.x - 19, entity.y - 55, 38, 39);
    c.fillStyle = "#dfc89b";
    c.fillRect(entity.x - 17, entity.y - 53, 34, 35);
    if (picture.complete && picture.naturalWidth) {
      const side = Math.min(picture.naturalWidth, picture.naturalHeight);
      c.drawImage(
        picture,
        (picture.naturalWidth - side) / 2,
        (picture.naturalHeight - side) / 2,
        side,
        side,
        entity.x - 16,
        entity.y - 52,
        32,
        32,
      );
    }
    c.fillStyle = "#f2dfb7";
    c.fillRect(entity.x - 20, entity.y - 14, 40, 10);
    c.fillStyle = "#513c29";
    c.font = "bold 7px monospace";
    c.textAlign = "center";
    c.fillText((product.price / 100).toFixed(2) + " €", entity.x, entity.y - 6);
    c.textAlign = "left";
  }
  night(zone, time, camera) {
    // A small reusable light mask keeps the fire's surroundings readable, without a personal light.
    this.lightCanvas ||= document.createElement("canvas");
    if (
      this.lightCanvas.width !== this.width ||
      this.lightCanvas.height !== this.height
    ) {
      this.lightCanvas.width = this.width;
      this.lightCanvas.height = this.height;
    }
    const c = this.lightCanvas.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    c.save();
    c.translate(-camera.x, -camera.y);
    // Spatial lighting: the same world contains daylight and the nocturnal cove.
    const shade = c.createRadialGradient(
      zone.x * TILE,
      zone.y * TILE,
      zone.inner * TILE,
      zone.x * TILE,
      zone.y * TILE,
      zone.outer * TILE,
    );
    shade.addColorStop(0, "rgba(12,21,53,.65)");
    shade.addColorStop(1, "rgba(12,21,53,0)");
    c.fillStyle = shade;
    c.fillRect(
      (zone.x - zone.outer) * TILE,
      (zone.y - zone.outer) * TILE,
      zone.outer * TILE * 2,
      zone.outer * TILE * 2,
    );
    const [x, y] = zone.fire.map((v) => v * TILE);
    c.globalCompositeOperation = "destination-out";
    for (const [lx, ly, radius, power] of [
      [x, y - 8, 110 + Math.sin(time * 2) * 3, 0.86],
    ]) {
      const light = c.createRadialGradient(lx, ly, 4, lx, ly, radius);
      light.addColorStop(0, "rgba(0,0,0," + power + ")");
      light.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = light;
      c.fillRect(lx - radius, ly - radius, radius * 2, radius * 2);
    }
    c.restore();
    this.ctx.drawImage(this.lightCanvas, camera.x, camera.y);
  }
  ambient(world, cam, time) {
    const c = this.ctx;
    for (
      let cy = Math.floor(cam.y / 160);
      cy <= Math.floor((cam.y + this.height) / 160);
      cy++
    )
      for (
        let cx = Math.floor(cam.x / 160);
        cx <= Math.floor((cam.x + this.width) / 160);
        cx++
      ) {
        const rand = random(hash(world.data.id + ":life:" + cx + ":" + cy));
        for (let i = 0; i < 2; i++) {
          const x = cx * 160 + rand() * 150,
            y = cy * 160 + rand() * 150,
            phase = rand() * 20,
            region = world.region(x / TILE, y / TILE);
          if (world.waterAt(x / TILE, y / TILE)) continue;
          if (region === "village") {
            if (i || (time + phase) % 25 > 5) continue;
            c.fillStyle = "#666659";
            c.fillRect(x + ((time + phase) % 25) * 4, y, 4, 2);
            c.fillRect(x - 2 + ((time + phase) % 25) * 4, y + 1, 3, 1);
          } else if (world.data.indoor) {
            c.globalAlpha = 0.3;
            c.fillStyle = "#ffedb4";
            c.fillRect(
              x + Math.sin(time * 0.3 + phase) * 8,
              y + Math.cos(time * 0.4 + phase) * 5,
              1,
              1,
            );
            c.globalAlpha = 1;
          } else if (i === 0) {
            const shift = Math.sin(time * 0.3 + phase) * 6;
            c.fillStyle = "#a34539";
            c.fillRect(x + shift, y, 3, 3);
            c.fillStyle = "#343e2c";
            c.fillRect(x + shift + 1, y, 1, 3);
          } else {
            c.globalAlpha = 0.25 + Math.max(0, Math.sin(time + phase)) * 0.5;
            c.fillStyle = "#f4e699";
            c.fillRect(
              x + Math.sin(time * 0.5 + phase) * 10,
              y + Math.cos(time * 0.7 + phase) * 8,
              2,
              2,
            );
            c.globalAlpha = 1;
          }
        }
      }
  }
}
module.exports = { Renderer };
