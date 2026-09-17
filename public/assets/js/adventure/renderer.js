"use strict";
const { TILE, random, hash } = require("./model");
const { artworkBounds, drawArtwork, drawAttachments } = require("./entity-art");
const { matches, active } = require("./rules");
const { characterFrame, pushFrame, runFrame } = require("./characters");
const { SpriteLibrary } = require("./sprites");
const { Terrain, drawBridges } = require("./terrain");
const { drawInteriors, drawPartition } = require("./interiors");
const { drawRipples } = require("./water");
const { cameraMetrics } = require("./camera");
const { chunkRange } = require("./scene-frame");
const fences = require("./fences");
class Renderer {
  constructor(canvas, viewport) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.sprites = new SpriteLibrary();
    this.terrain = new Terrain();
    this.productImages = new Map();
    this.scale = 3;
    this.viewZoom = 1;
    this.requestedZoom = null; // Automatic framing until the first wheel/pinch gesture.
  }
  resize(zoom = this.zoom || 1) {
    this.zoom = zoom;
    const r = this.viewport.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const metrics = cameraMetrics(r, this.world, this.requestedZoom, zoom);
    this.viewZoom = metrics.ratio;
    this.scale = metrics.scale;
    this.width = metrics.width;
    this.height = metrics.height;
    const pixelWidth = Math.round(r.width * dpr),
      pixelHeight = Math.round(r.height * dpr);
    // Assigning even the same dimensions clears the canvas. Activity changes must not flash black.
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
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
      require("./elements").frameName(entity)
    );
  }
  hit(entity, point, state) {
    // ⛔ UNA VALLA ES SU TRAZADO, NO LA CAJA QUE LO ENVUELVE. Con la caja, una valla en L se lleva
    // todos los clics del hueco que rodea —que es justo por donde se quiere andar—, y eso se nota
    // en cuanto alguien construye una de verdad en el claro. `fences.hit` mide la distancia a los
    // travesaños, que es lo que la persona ve.
    if (entity.fence)
      return require("./fences").hit(
        entity,
        point,
        Math.max(2, 12 / this.scale),
      );
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
    // ⛔ NOTHING IS PAINTED ON A SURFACE THAT DOES NOT EXIST. The website keeps the
    // world in an iframe and hides it with `display: none`, which leaves this
    // canvas at 0×0 while the document still believes it is visible (an iframe's
    // visibility follows the TOP-level page). Drawing there throws
    // InvalidStateError on the first sprite — and inside init() that lands in the
    // catch, so a world preloaded out of sight would come up saying it failed.
    // The guard lives HERE, at the one place that draws, and not at each caller.
    if (!this.width || !this.height) return;
    const c = this.ctx,
      world = game.world,
      cam = game.camera;
    c.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#273e35";
    c.fillRect(0, 0, this.width, this.height);
    c.save();
    c.translate(-Math.round(cam.x), -Math.round(cam.y));
    if (!world.data.indoor) {
      c.beginPath();
      c.rect(0, 0, world.width * TILE, world.height * TILE);
      c.clip();
    }
    this.terrain.beginFrame(world, {
      ...cam,
      width: this.width,
      height: this.height,
    });
    const range = chunkRange(world, {
      ...cam,
      width: this.width,
      height: this.height,
    });
    for (let cy = range.top; cy <= range.bottom; cy++)
      for (let cx = range.left; cx <= range.right; cx++) {
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
          this.terrain.chunk(world, cx, cy, this.sprites),
          x,
          y,
          right - x,
          bottom - y,
        );
        c.restore();
      }
    drawBridges(c, world, this.sprites, {
      ...cam,
      width: this.width,
      height: this.height,
    });
    drawRipples(
      c,
      world,
      { ...cam, width: this.width, height: this.height },
      time,
    );
    drawInteriors(c, world);
    game.river?.drawWater(c, time);
    game.self.drawGround(c);
    const visible = (e) => {
      if (e.wall) return true;
      const frame = this.sprites.frame(this.frame(e, game.state));
      const b = frame
        ? artworkBounds(e, frame)
        : { x: e.x - 32, y: e.y - 64, w: 64, h: 72 };
      return (
        b.x + b.w >= cam.x &&
        b.x <= cam.x + this.width &&
        b.y + b.h >= cam.y &&
        b.y <= cam.y + this.height
      );
    };
    const player = {
      ...game.player,
      sprite:
        game.river?.frame() ||
        game.self.frame() ||
        game.presentation?.frame() ||
        pushFrame(game.player) ||
        runFrame(game.player, game.running) ||
        characterFrame(0, game.player, game.walking),
      player: true,
    };
    const list = [
      ...world.props,
      ...world.architecture,
      ...world.entities.filter(
        (e) =>
          !(e.animal && game.cats) &&
          (game.showAllEntities ||
            (active(e, game.state) && !game.presentation?.hides(e))),
      ),
      ...game.neighbors,
      ...require("./river-life").riverVisitors(world.data, time),
      ...(game.cats?.renderables() || []),
      ...(game.cats?.carried() ? [game.cats.carried()] : []),
      ...(game.guardian ? [game.guardian] : []),
      ...(game.hidePlayer || game.cats?.locked ? [] : [player]),
    ]
      .flatMap((e) => (e.fence ? fences.parts(e) : e))
      .filter(visible)
      .sort((a, b) => (a.depth ?? a.y) - (b.depth ?? b.y));
    for (const e of list) {
      if (e.fencePart) {
        fences.drawPart(c, e);
        continue;
      }
      if (e.wall) {
        drawPartition(c, e.wall);
        continue;
      }
      const name = e.neighbor
          ? e.activitySprite || characterFrame(e.variant, e, e.moving)
          : this.frame(e, game.state),
        f = this.sprites.frame(name);
      if (!f) continue;
      require("./seating").drawSeat(c, this.sprites, e);
      if ((e.player && !game.river?.active) || e.neighbor) {
        c.fillStyle = "rgba(31,46,33,.22)";
        c.beginPath();
        c.ellipse(e.x, e.y + 1, 8, 3, 0, 0, 7);
        c.fill();
      }
      if (
        !require("./ambient-actors").drawAmbientActor(
          c,
          this.sprites,
          e,
          name,
          time,
        ) &&
        !require("./vegetation").drawVegetation(c, this.sprites, e, name, time)
      )
        drawArtwork(c, this.sprites, e, name);
      drawAttachments(c, this.sprites, e);
      if (e.player) game.self.drawStream(c);
      require("./river-life").drawFishing(c, e, time);
      if (e.cat) game.cats.drawWarning(c, e);
      if (e.lightRadius) {
        const radius = e.lightRadius;
        const light = c.createRadialGradient(
          e.x,
          e.y - 12,
          1,
          e.x,
          e.y - 12,
          radius,
        );
        light.addColorStop(0, "rgba(255,225,144,.15)");
        light.addColorStop(1, "rgba(255,225,144,0)");
        c.fillStyle = light;
        c.fillRect(e.x - radius, e.y - 12 - radius, radius * 2, radius * 2);
      }
      require("./keepsakes").drawKeepsakes(c, this.sprites, e, game.state);
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
        // Soft ember bounce fades to zero; a filled ellipse reads as a painted ground patch.
        const glow = c.createRadialGradient(e.x, e.y - 8, 2, e.x, e.y - 8, 30);
        glow.addColorStop(
          0,
          `rgba(250,186,80,${0.1 + Math.sin(time * 6) * 0.02})`,
        );
        glow.addColorStop(1, "rgba(250,186,80,0)");
        c.fillStyle = glow;
        c.fillRect(e.x - 30, e.y - 38, 60, 60);
        for (let i = 0; i < 3; i++) {
          const t = (time * 0.4 + i * 0.3) % 1;
          c.fillStyle = "#ffe6a0";
          c.fillRect(e.x + Math.sin(time + i) * 4, e.y - 11 - t * 18, 1, 1);
        }
      }
    }
    game.presentation?.draw(c);
    game.community?.draw(c);
    if (world.data.night) this.night(world.data.night, time, cam);
    const destination =
      game.journey?.intent?.point || game.journey?.path.at(-1);
    if (destination) {
      const end = destination;
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
