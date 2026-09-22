"use strict";
const { TILE, random, hash } = require("./model");
const { artworkBounds, drawArtwork, drawAttachments } = require("./entity-art");
const { drawGrowing } = require("./construction-growth");
const { matches, active } = require("./rules");
const { characterFrame, pushFrame, runFrame } = require("./characters");
const { SpriteLibrary } = require("./sprites");
const { ActorArt } = require("./actor-art");
const { VesselArt } = require("./vessel-art");
const { playerVariant } = require("./player-art");
const { Terrain, drawBridges } = require("./terrain");
const { drawInteriors, drawPartition } = require("./interiors");
const { drawRipples } = require("./water");
const { cameraMetrics } = require("./camera");
const { chunkRange } = require("./scene-frame");
const fences = require("./fences");
const { frameName } = require("./elements");
const { riverVisitors, drawFishing } = require("./river-life");
const { drawSeat } = require("./seating");
const { drawAmbientActor } = require("./ambient-actors");
const { drawVegetation } = require("./vegetation");
const { drawKeepsakes } = require("./keepsakes");
/** La porción del aro del mando que marca la dirección: un octavo de vuelta. */
const STICK_SLICE = Math.PI / 4;
class Renderer {
  constructor(canvas, viewport) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.sprites = new SpriteLibrary();
    this.actorArt = new ActorArt(this.sprites);
    this.vesselArt = new VesselArt(this.sprites);
    this.terrain = new Terrain();
    this.scale = 3;
    this.viewZoom = 1;
    this.requestedZoom = null; // Automatic framing until the first wheel/pinch gesture.
  }
  resize(zoom = this.zoom || 1) {
    this.zoom = zoom;
    const r = this.viewport.getBoundingClientRect();
    this.viewportSize = { width: r.width, height: r.height };
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
    if (entity.neighbor)
      return entity.activitySprite || characterFrame(entity.variant, entity, entity.moving);
    // El parpadeo sutil de la bombita a media hora del final: dos sprites que se alternan despacio
    // (ciclo de 2,2 s), nunca un estrobo. `since` ya viene traducido al reloj del navegador.
    if (entity.pulse && this.epochNow >= entity.pulse.since &&
        Math.floor(this.epochNow / (entity.pulse.periodMs / 2)) % 2)
      return entity.pulse.sprite;
    return (
      (entity.visuals || []).find((v) => matches(state, v.when))?.sprite ||
      frameName(entity)
    );
  }
  hit(entity, point, state) {
    // ⛔ UNA VALLA ES SU TRAZADO, NO LA CAJA QUE LO ENVUELVE. Con la caja, una valla en L se lleva
    // todos los clics del hueco que rodea —que es justo por donde se quiere andar—, y eso se nota
    // en cuanto alguien construye una de verdad en el claro. `fences.hit` mide la distancia a los
    // travesaños, que es lo que la persona ve.
    if (entity.fence)
      return fences.hit(
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
    const frame = this.sprites.frame(this.actorArt.frame(this.frame(entity, state)));
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
    this.epochNow = Date.now();
    const c = this.ctx,
      world = game.world,
      cam = game.camera;
    c.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#273e35";
    c.fillRect(0, 0, this.width, this.height);
    c.save();
    c.translate(-Math.round(cam.x), -Math.round(cam.y));
    const view = { ...cam, width: this.width, height: this.height };
    this.terrain.beginFrame();
    /**
     * ⛔ EL SUELO ENTERO PRIMERO, LAS COSAS DESPUÉS, Y NINGÚN RECORTE POR PANTALLA (mundo continuo).
     * Recortar cada pantalla a su rectángulo dejaba una raya en la costura —el borde del recorte
     * cae en medio píxel y se difumina— y partía por la mitad al duende y a cualquier árbol que
     * asomara al otro lado. Aquí se pinta el hueco del plano, luego el suelo de las vecinas y el
     * de la tuya, y por último TODAS las cosas de todas las pantallas en una sola pasada ordenada
     * por profundidad, cada una trasladada a las coordenadas de la tuya.
     */
    const seams = world.data.indoor ? [] : world.seams || [];
    // Todo lo que este fotograma enseña se ancla ANTES de pintar nada: hueco, vecinas y la tuya.
    // Ver `Terrain.pin`: anclar por partes y podar entre medias construía las mismas baldosas
    // cada fotograma en cuanto una vecina asomaba.
    const voidArea = this.voidArea(game, world, view);
    const grounds = seams
      .map((seam) => ({ world: seam.world, view: this.localView(seam, view), ox: seam.dx * TILE, oy: seam.dy * TILE }))
      .filter((g) => g.view);
    grounds.unshift({ world, view, ox: 0, oy: 0 });
    if (voidArea) this.terrain.pinVoid(voidArea.range);
    for (const g of grounds) this.terrain.pin(g.world, g.view);
    if (voidArea) this.drawVoid(voidArea);
    for (const g of grounds) this.drawGround(g.world, g.view, time, g.ox, g.oy);
    game.river?.drawWater(c, time);
    game.self.drawGround(c);
    const visible = (e) => this.inView(e, view, game.state);
    const player = {
      ...game.player,
      vesselArt: game.river?.layers(),
      sprite:
        game.river?.frame() ||
        game.self.frame() ||
        game.presentation?.frame() ||
        pushFrame(game.player) ||
        runFrame(game.player, game.running) ||
        characterFrame(playerVariant(game.player), game.player, game.walking),
      player: true,
      opacity: game.live?.spectator ? 0.45 : 1,
    };
    const frameFor = (e) => this.frame(e, game.state);
    const renderables = [
      ...world.props,
      ...world.architecture,
      ...world.entities.filter(
        (e) =>
          !(e.animal && game.cats) &&
          (game.showAllEntities ||
            (active(e, game.state) && !game.presentation?.hides(e))),
      ),
      ...game.neighbors,
      ...(game.notes?.entities || []),
      ...(game.live?.people.list || []),
      ...riverVisitors(world.data, time),
      ...(game.cats?.renderables() || []),
      ...(game.cats?.carried() ? [game.cats.carried()] : []),
      ...(game.guardian ? [game.guardian] : []),
      ...(game.hidePlayer || game.cats?.locked ? [] : [player]),
    ].flatMap((e) => (e.fence ? fences.parts(e) : e))
      .map(e => game.live?.objects.visual(e) || e);
    // Las cosas de las vecinas, con el desplazamiento de su costura; sin duende, sin presencia
    // en vivo ni gatos, que esos son de la pantalla que pisas.
    const placed = renderables.filter(visible).map((e) => ({ e, ox: 0, oy: 0 }));
    const artDue = this.actorArt.due();
    const streamed = artDue ? [...renderables] : null;
    for (const seam of seams) {
      const local = this.localView(seam, view);
      if (!local) continue;
      const w = seam.world,
        ox = seam.dx * TILE,
        oy = seam.dy * TILE;
      const theirs = [
        ...w.props,
        ...w.architecture,
        ...w.entities.filter((e) => active(e, game.state)),
        ...(w.actors || []),
        ...riverVisitors(w.data, time),
      ].flatMap((e) => (e.fence ? fences.parts(e) : e));
      for (const e of theirs) {
        if (!this.inView(e, local, game.state)) continue;
        placed.push({ e, ox, oy });
        // Para pedir su arte hace falta verlos desde aquí: copia trasladada, solo para eso, y
        // solo los fotogramas en los que el repaso de arte toca (`actorArt.due`).
        if (artDue) streamed.push({ ...e, x: e.x + ox, y: e.y + oy });
      }
    }
    // El arte de los actores se pide una vez por fotograma para TODO lo que se ve, los de las
    // vecinas incluidos y ya traducidos a estas coordenadas: una segunda llamada pisaría la
    // primera, porque el foco de residencia se sustituye, no se suma.
    if (artDue) this.actorArt.update(streamed, view, frameFor);
    placed.sort((a, b) => (a.e.depth ?? a.e.y) + a.oy - ((b.e.depth ?? b.e.y) + b.oy));
    for (const { e, ox, oy } of placed) {
      if (!ox && !oy) {
        this.drawRenderable(c, e, game, time, player, frameFor);
        continue;
      }
      c.save();
      c.translate(ox, oy);
      this.drawRenderable(c, e, game, time, { x: player.x - ox, y: player.y - oy }, frameFor);
      c.restore();
    }
    game.presentation?.draw(c);
    game.community?.draw(c);
    if (world.data.night) this.night(world.data.night, time, cam);
    // ⛔ AQUÍ SE DIBUJABA UN ÓVALO CLARO EN EL DESTINO DEL VIAJE, y se quitó el 19-sep-2026
    // (decisión del dueño: «no quiero el puntito blanco placeholder de posición final, eso
    // molesta»). Guiando con el dedo el destino se replantaba varias veces por segundo y el
    // puntito iba dando saltitos por delante del duende; y tocando, el sitio ya lo sabes porque
    // acabas de tocarlo. El destino sigue existiendo para el viaje y para `inspect`, solo no se pinta.
    if (!game.reducedMotion) this.ambient(world, cam, time);
    c.restore();
    // Una baldosa del anillo de alrededor, por adelantado, si este fotograma no construyó ninguna.
    // El orden es el de `grounds`: primero la pantalla que pisas, que es por donde se anda.
    if (!game.transitioning)
      this.terrain.prefetch(
        [
          ...grounds.map((g) => ({ world: g.world, range: chunkRange(g.world, g.view) })),
          ...(voidArea ? [{ plane: voidArea.plane, range: voidArea.range, inside: voidArea.inside }] : []),
        ],
        this.sprites,
      );
    this.stickHint(game.stickHint?.());
    // A quiet edge vignette; no per-frame image processing, and one gradient per view size.
    c.fillStyle = this.vignette();
    c.fillRect(0, 0, this.width, this.height);
  }
  vignette() {
    const key = this.width + "x" + this.height;
    if (this.vignetteKey !== key) {
      const w = this.width,
        h = this.height;
      this.vignetteGradient = this.ctx.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w * 0.8);
      this.vignetteGradient.addColorStop(0, "rgba(19,38,27,0)");
      this.vignetteGradient.addColorStop(1, "rgba(19,38,27,.17)");
      this.vignetteKey = key;
    }
    return this.vignetteGradient;
  }
  /** Si un renderable cae dentro de una vista (píxeles de mundo de su propia pantalla). */
  inView(e, view, state) {
    if (e.wall) return true;
    const frame = this.sprites.frame(this.frame(e, state));
    const vessel = e.vesselArt && this.vesselArt.bounds(e.vesselArt);
    const b = vessel
      ? { x: e.x + vessel.x, y: e.y + vessel.y, w: vessel.w, h: vessel.h }
      : frame
        ? artworkBounds(e, frame)
        : { x: e.x - 32, y: e.y - 64, w: 64, h: 72 };
    return (
      b.x + b.w >= view.x &&
      b.x <= view.x + view.width &&
      b.y + b.h >= view.y &&
      b.y <= view.y + view.height
    );
  }
  /**
   * El suelo de UNA pantalla: trozos de terreno, puentes, ondas y recortes interiores. Las
   * baldosas se pegan en píxeles de pantalla y ya llevan su sitio en la vista traducida; lo demás
   * se dibuja en coordenadas del mundo y necesita el desplazamiento de la costura (20-sep-2026:
   * sin él, el puente y las ondas de una vecina caían una pantalla entera fuera de la vista, y su
   * río se veía quieto y sin puente hasta pisarlo).
   */
  drawGround(world, view, time, ox = 0, oy = 0) {
    const c = this.ctx;
    const range = chunkRange(world, view);
    this.blitChunks(range, view.x, view.y, (cx, cy) =>
      this.terrain.chunk(world, cx, cy, this.sprites),
    );
    c.save();
    if (ox || oy) c.translate(ox, oy);
    drawBridges(c, world, this.sprites, view);
    drawRipples(c, world, view, time);
    drawInteriors(c, world);
    c.restore();
  }
  /** La vista de la cámara en coordenadas de una vecina, o null si no la toca. */
  localView(seam, view) {
    const w = seam.world,
      local = { x: view.x - seam.dx * TILE, y: view.y - seam.dy * TILE, width: view.width, height: view.height };
    if (
      local.x + local.width <= 0 ||
      local.y + local.height <= 0 ||
      local.x >= w.width * TILE ||
      local.y >= w.height * TILE
    )
      return null;
    return local;
  }
  /**
   * El hueco del plano que la cámara ve, en trozos de 256 en coordenadas del plano: suelo que
   * continúa el borde más cercano (`terrain.voidChunk`). Se pinta debajo de todo y solo dentro de
   * la caja del plano, que es hasta donde la cámara puede llegar.
   */
  voidArea(game, world, view) {
    const plane = game.scenes?.plane,
      origin = world.origin;
    if (!plane?.bounds || !origin || world.data.indoor) return null;
    const b = plane.bounds;
    // La vista en coordenadas del plano, acotada a su caja.
    const px = view.x + origin.x,
      py = view.y + origin.y;
    const left = Math.max(b.x, px),
      top = Math.max(b.y, py),
      right = Math.min(b.x + b.w, px + view.width),
      bottom = Math.min(b.y + b.h, py + view.height);
    if (right <= left || bottom <= top) return null;
    const range = {
      left: Math.floor(left / 256),
      top: Math.floor(top / 256),
      right: Math.floor((right - 0.001) / 256),
      bottom: Math.floor((bottom - 0.001) / 256),
    };
    // Qué trozos del hueco existen: los que caen dentro de la caja del plano.
    const inside = (cx, cy) =>
      (cx + 1) * 256 > b.x && cx * 256 < b.x + b.w && (cy + 1) * 256 > b.y && cy * 256 < b.y + b.h;
    return { plane, range, px, py, inside };
  }
  drawVoid({ plane, range, px, py }) {
    this.blitChunks(range, px, py, (cx, cy) => this.terrain.voidChunk(plane, cx, cy));
  }
  /**
   * Las baldosas de 256×256 que toca la vista, pegadas en píxeles del dispositivo: los bordes se
   * redondean en la pantalla y no en el mundo, porque un zoom fraccionario abriría si no una raya
   * entre dos trozos contiguos. Lo comparten el suelo de una pantalla y el hueco del plano.
   */
  blitChunks(range, viewX, viewY, chunkAt) {
    const c = this.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    for (let cy = range.top; cy <= range.bottom; cy++)
      for (let cx = range.left; cx <= range.right; cx++) {
        const x = Math.round((cx * 256 - Math.round(viewX)) * this.pixelScale),
          y = Math.round((cy * 256 - Math.round(viewY)) * this.pixelScale),
          right = Math.round(((cx + 1) * 256 - Math.round(viewX)) * this.pixelScale),
          bottom = Math.round(((cy + 1) * 256 - Math.round(viewY)) * this.pixelScale);
        c.drawImage(chunkAt(cx, cy), x, y, right - x, bottom - y);
      }
    c.restore();
  }
  /**
   * Una cosa del mundo, dibujada en las coordenadas del contexto actual. En una vecina, `player`
   * llega trasladado a esas mismas coordenadas (solo su sitio), que es lo que necesitan los
   * efectos que miran dónde está el duende.
   */
  drawRenderable(c, e, game, time, player, frameFor) {
    if (e.vesselArt) {
      this.vesselArt.draw(c, e, e.vesselArt);
      return;
    }
    if (drawGrowing(c, e, game.serverClock?.now())) return;
    if (e.fencePart) {
      fences.drawPart(c, e);
      return;
    }
    if (e.wall) {
      drawPartition(c, e.wall);
      return;
    }
    const name = this.actorArt.frame(frameFor(e)),
      f = this.sprites.frame(name);
    if (!f) return;
    drawSeat(c, this.sprites, e);
    if ((e.player && !game.river?.active) || e.neighbor) {
      c.fillStyle = "rgba(31,46,33,.22)";
      c.beginPath();
      c.ellipse(e.x, e.y + 1, 8, 3, 0, 0, 7);
      c.fill();
    }
    if (
      !drawAmbientActor(c, this.sprites, e, name, time) &&
      !drawVegetation(c, this.sprites, e, name, time)
    )
      drawArtwork(c, this.sprites, e, name);
    drawAttachments(c, this.sprites, e);
    if (e.player) game.self.drawStream(c);
    drawFishing(c, e, time);
    if (e.cat) game.cats.drawWarning(c, e);
    if (e.lightRadius) {
      const radius = e.lightRadius;
      const light = c.createRadialGradient(e.x, e.y - 12, 1, e.x, e.y - 12, radius);
      light.addColorStop(0, "rgba(255,225,144,.15)");
      light.addColorStop(1, "rgba(255,225,144,0)");
      c.fillStyle = light;
      c.fillRect(e.x - radius, e.y - 12 - radius, radius * 2, radius * 2);
    }
    drawKeepsakes(c, this.sprites, e, game.state);
    if (
      player &&
      (e.rules?.length || e.neighbor || e.interactAs) &&
      (!e.interactWhen || matches(game.state, e.interactWhen)) &&
      !game.dialogue &&
      Math.hypot(e.x - player.x, e.y - player.y) < 52
    ) {
      c.fillStyle = "#faf1c5";
      c.fillRect(e.x - 1, e.y - f.anchor[1] - 6 + Math.round(Math.sin(time * 3)), 3, 3);
    }
    if (name === "fire" || name === "barbecue-lit") {
      // Soft ember bounce fades to zero; a filled ellipse reads as a painted ground patch.
      const glow = c.createRadialGradient(e.x, e.y - 8, 2, e.x, e.y - 8, 30);
      glow.addColorStop(0, `rgba(250,186,80,${0.1 + Math.sin(time * 6) * 0.02})`);
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
  /**
   * ⛔ EL ARO DEL MANDO (19-sep-2026). Un círculo tenue donde apoyaste el dedo, una bolita donde
   * está ahora y, dentro del aro, una PORCIÓN casi transparente que apunta a donde manda el dedo
   * (decisión del dueño: «la bolita bajo el dedo no se ve; debe ser un pizza slice de la dirección
   * actual, casi transparente, dentro del joystick… y en general todo un poco más transparente»).
   * Enseña que el mando nace bajo tu dedo y, cuando el origen se arrastra detrás, que no hace
   * falta levantar para virar. Se pinta en unidades de la vista, encima del mundo y debajo del
   * viñeteado, SIEMPRE que el dedo manda y se apaga al soltar. Nada de DOM.
   */
  stickHint(view) {
    if (!view) return;
    const c = this.ctx,
      u = view.unit,
      { x, y } = view.origin;
    c.save();
    c.lineWidth = 1.5 * u;
    c.strokeStyle = "rgba(255, 255, 255, 0.16)";
    c.fillStyle = "rgba(255, 255, 255, 0.04)";
    c.beginPath();
    c.arc(x, y, view.radius, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    if (view.heading) {
      // La porción: un octavo de aro centrado en la dirección que manda, del origen al borde.
      const angle = Math.atan2(view.heading.y, view.heading.x),
        half = STICK_SLICE / 2;
      c.fillStyle = "rgba(255, 255, 255, 0.11)";
      c.beginPath();
      c.moveTo(x, y);
      c.arc(x, y, view.radius - 0.75 * u, angle - half, angle + half);
      c.closePath();
      c.fill();
    }
    c.fillStyle = "rgba(255, 255, 255, 0.28)";
    c.beginPath();
    c.arc(x, y, view.dead * 0.35, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255, 255, 255, 0.5)";
    c.beginPath();
    c.arc(view.knob.x, view.knob.y, 8 * u, 0, Math.PI * 2);
    c.fill();
    c.restore();
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
