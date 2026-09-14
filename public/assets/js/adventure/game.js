"use strict";
const { tryPush, pushPath } = require("./movables");
const { releaseContact } = require("./obstacles");
const { World, TILE, clamp, insideThreshold } = require("./model");
const { furnishWorkshop } = require("./workshop");
const { Renderer } = require("./renderer");
const { clampCamera } = require("./camera");
const { portalArrival, acceptsEntry, portalPath } = require("./portals");
const { WoodlandAudio } = require("./audio");
const { deviceIdentity } = require("./identity");
const { WorldSite } = require("./site");
const { WorldApi } = require("./api");
const { Session } = require("./session");
const { WorldContent } = require("./content");
const { HumanProof } = require("./proof");
const { GuardianChat } = require("./guardian");
const { WorldExperience } = require("./experience");
const { WorldMedia } = require("./media");
const { facing } = require("./characters");
const { active, planReaction, actions, matches } = require("./rules");
const { SAVE_KEY, readSave } = require("./save");
const { move, follow } = require("./movement");
const { SceneDirector } = require("./scenes");
const { fare } = require("./economy");
const { dialogueText } = require("./dialogue");
const { WorldInput } = require("./input");
const { RollMotion, WALK_SPEED, ROLL_DISTANCE } = require("./locomotion");
const { PickupFeedback } = require("./pickups");
const { Inventory } = require("./inventory");
const { ContentRooms } = require("./rooms");
const { Self } = require("./self");
const { expireTimers } = require("./timers");
const { needStatus } = require("./needs");
const { Voyage } = require("./voyage");
const { Sequence } = require("./sequence");
const { Presentation } = require("./presentation");
const byId = (id) => document.getElementById(id);

class Adventure {
  constructor(config) {
    this.config = config;
    this.s = config.strings;
    this.catalog = furnishWorkshop(config.world, config.products);
    this.renderer = new Renderer(byId("world-canvas"), byId("world-viewport"));
    this.audio = new WoodlandAudio();
    this.keys = new Set();
    this.roll = new RollMotion();
    this.sequence = new Sequence();
    this.presentation = new Presentation(this);
    this.voyage = new Voyage(this);
    this.path = [];
    this.pending = null;
    this.dialogue = null;
    this.ready = false;
    this.scenes = new SceneDirector(this);
    this.transitioning = false;
    this.neighbors = [];
    this.camera = { x: 0, y: 0 };
    this.lastTime = 0;
    this.lastSave = 0;
    this.dirty = false;
    this.storageOK = true;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Public content enriches the local cast asynchronously; no polling or socket.
    const cast = new Map();
    for (const person of config.neighbors)
      if (!cast.has(person.handle)) cast.set(person.handle, person);
    this.cast = Array.from(cast.values());
    for (let i = this.cast.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cast[i], this.cast[j]] = [this.cast[j], this.cast[i]];
    }
    this.state = readSave(this.catalog);
    this.deviceId = deviceIdentity();
    this.session = new Session();
    this.api = new WorldApi(config, this.session);
    this.content = new WorldContent(this);
    this.proof = new HumanProof(this);
    this.guardianChat = new GuardianChat(this);
    this.rooms = new ContentRooms(this);
    this.site = new WorldSite(this);
    this.media = new WorldMedia(this);
    this.experience = new WorldExperience(this);
    this.inventory = new Inventory(this);
    this.pickups = new PickupFeedback(this);
    this.self = new Self(this);
    this.bind();
  }
  text(key) {
    const value = this.s[key];
    return Array.isArray(value) ? value[0] : (value ?? key);
  }
  lines(key) {
    const value = this.s[key];
    return Array.isArray(value)
      ? value
      : typeof value === "string"
        ? [value]
        : [this.s.empty];
  }
  async init() {
    try {
      // Show the actual terrain immediately; no modal loading screen or artificial progress.
      this.world = new World(this.catalog.scenes[this.state.scene]);
      this.player = { ...this.state.position, direction: "down" };
      this.renderer.world = this.world;
      this.renderer.resize();
      this.centerCamera(true);
      byId("loading").hidden = true;
      this.renderer.render(this, 0);
      await this.renderer.sprites.initialize(this.config.assetManifest);
      const prepared = await this.scenes.prepare(
        this.state.scene,
        this.state.position,
        this.state,
      );
      this.scenes.enter(prepared);
      this.renderer.resize();
      this.centerCamera(true);
      this.paintPortrait();
      this.paintCards();
      byId("loading").hidden = true;
      this.ready = true;
      this.updateUI();
      this.closeContent();
      if (!this.state.flags.introSeen) {
        this.state.flags.introSeen = true;
        this.openDialogue(this.lines("intro"));
        this.dirty = true;
      }
      // Persist freshly sampled deadlines and normalized saves even if the player only looks around.
      this.dirty = true;
      this.save();
      this.frame = requestAnimationFrame((t) => this.tick(t));
    } catch (error) {
      byId("loading").textContent = this.s.loadError;
      byId("loading").hidden = false;
      console.error("Adventure initialization:", error);
    }
  }
  bind() {
    new ResizeObserver(() => {
      if (this.ready) {
        this.renderer.resize();
        this.centerCamera(true);
      }
    }).observe(byId("world-viewport"));
    this.input = new WorldInput(this);
    window.addEventListener("blur", () => {
      this.pauseMovement();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(this.frame);
        this.audio.stop();
        this.keys.clear();
        this.save();
      } else if (this.ready) {
        this.lastTime = 0;
        this.frame = requestAnimationFrame((t) => this.tick(t));
      }
    });
    window.addEventListener("pagehide", () => this.save());
    byId("dialogue-next").addEventListener("click", () => {
      this.unlockAudio();
      this.nextDialogue();
    });
    byId("sound-toggle").addEventListener("click", () => {
      if (this.transitioning) return;
      this.state.muted = this.audio.on;
      if (this.state.muted) this.audio.stop();
      else this.unlockAudio();
      this.dirty = true;
      this.updateUI();
      this.save();
    });
    document
      .querySelectorAll("[data-dismiss]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          button.closest("dialog").close(),
        ),
      );
    document
      .querySelectorAll("dialog")
      .forEach((dialog) =>
        dialog.addEventListener("close", () => this.keys.clear()),
      );
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (
          !byId("world-content").hidden &&
          !event.target.closest("#world-content,.world-listening") &&
          !this.hasOverlay()
        ) {
          if (event.target === byId("world-canvas")) event.preventDefault();
          this.closeContent();
        }
      },
      true,
    );
    byId("world-language").addEventListener("change", (event) => {
      this.save();
      location.assign(event.target.value);
    });
  }

  blocked() {
    return (
      this.transitioning ||
      this.hasOverlay() ||
      Boolean(!byId("world-content").hidden && window.innerWidth < 800)
    );
  }
  hasOverlay() {
    return Boolean(document.querySelector("dialog[open]"));
  }
  cancelPath() {
    this.path = [];
    this.pending = null;
  }
  pauseMovement() {
    this.roll.stop();
    this.rollIntent = null;
    this.input?.clearGesture();
    this.cancelPath();
    this.keys.clear();
    this.walking = false;
    this.player.pushing = null;
  }
  async unlockAudio() {
    if (!this.state.muted && !this.audio.on) {
      await this.audio.start();
      this.updateUI();
    }
  }
  duck(on) {
    if (this.audio.master && this.audio.context)
      this.audio.master.gain.setTargetAtTime(
        on ? 0.06 : 0.3,
        this.audio.context.currentTime,
        0.12,
      );
  }
  tap(point) {
    if (this.roll.current) return;
    this.cancelPath();
    if (
      this.world.data.indoor &&
      (point.x < 0 ||
        point.y < 0 ||
        point.x >= this.world.width * TILE ||
        point.y >= this.world.height * TILE)
    )
      return; // The garden framing a cutaway is presentation, not a walking destination.
    const candidates = [
      ...this.world.entities.filter(
        (e) =>
          active(e, this.state) &&
          (e.rules.length || e.product || e.interactAs || e.pushable),
      ),
      ...this.neighbors,
      ...(this.guardian ? [this.guardian] : []),
    ].sort((a, b) => b.y - a.y);
    const hit = candidates.find((e) => this.renderer.hit(e, point, this.state));
    const entity = this.interactionTarget(hit);
    if (entity) {
      if (entity.pushable) {
        if (this.inventory.held) {
          this.openDialogue(this.lines("noUse"));
          return;
        }
        const path = pushPath(this.world, this.player, entity);
        if (path) this.path = path;
        else this.toast(this.s.blocked);
        return;
      }
      if (entity.threshold) {
        this.path = portalPath(this.world, this.player, entity);
        return;
      }
      if (this.world.distanceTo(this.player, entity) < TILE * 1.35) {
        this.interact(entity);
        return;
      }
      const path = this.world.approach(this.player, entity, 6);
      if (path) {
        this.path = path;
        this.pending = entity;
        if (entity.neighbor) {
          entity.path = [];
          entity.pause = 30;
        }
      } else this.toast(this.s.blocked);
    } else {
      const path =
        this.world.path(this.player, point) ||
        this.world.approach(this.player, point, 2);
      if (path) this.path = path;
      else this.toast(this.s.blocked);
    }
  }
  interactionTarget(entity) {
    if (entity?.interactWhen && !matches(this.state, entity.interactWhen))
      return null;
    return entity?.interactAs
      ? this.world.entities.find((e) => e.id === entity.interactAs)
      : entity;
  }
  async interact(entity, action = null) {
    entity = this.interactionTarget(entity);
    if (
      this.transitioning ||
      !this.ready ||
      !entity ||
      !active(entity, this.state)
    )
      return;
    const held = this.inventory?.held;
    const context = {
      action: action || (held && !entity.threshold ? "use" : "interact"),
      item: held,
    };
    this.closeContent();
    this.contactLatch = entity.id;
    this.pauseMovement();
    this.player.direction = facing(
      entity.x - this.player.x,
      entity.y - this.player.y,
      this.player.direction,
    );
    if (typeof entity.onInteract === "function" && !held) {
      entity.onInteract();
      return;
    }
    if (entity.product) {
      if (held) {
        this.openDialogue(this.lines("noUse"));
        return;
      }
      this.site.showProduct(entity.product);
      return;
    }
    if (entity.neighbor) {
      entity.path = [];
      entity.pause = 8;
      if (held) {
        this.openDialogue(this.lines("noUse"));
        return;
      }
      if (entity.content && this.rooms.contains(entity.content)) {
        if (entity.piece) this.site.showPiece(entity.piece, { play: true });
        else this.openContent(entity.content);
      } else
        this.openDialogue(
          this.lines(entity.dialogue || "neighborGreeting"),
          this.s.neighbors,
          entity.variant,
          entity,
        );
      return;
    }
    this.transitioning = true;
    this.closeDialogue();
    this.contactLatch = entity.id;
    try {
      const plan = planReaction(entity, this.state, this.catalog, context);
      if (!plan) {
        if (context.action === "use") this.openDialogue(this.lines("noUse"));
        return;
      }
      const travel = plan.effects.find((e) => e.type === "travel");
      let prepared = null;
      if (travel) {
        let position = { x: travel.x * TILE, y: travel.y * TILE };
        if (
          this.world.data.indoor &&
          this.state.entrance?.scene === travel.scene
        )
          position =
            portalArrival(
              this.catalog,
              travel.scene,
              this.state.entrance.portal,
            ) || position;
        if (!this.world.data.indoor && this.catalog.scenes[travel.scene].indoor)
          plan.state.entrance = {
            scene: this.world.data.id,
            portal: entity.id,
          };
        prepared = await this.scenes.prepare(
          travel.scene,
          position,
          plan.state,
        );
        if (travel.presentation) {
          byId("loading").hidden = true;
          await this.voyage.play(travel, entity);
        }
      }
      for (const effect of plan.effects)
        if (effect.type === "presentation") await this.presentation.play(effect, entity);
      await this.presentation.gains(this.state, plan.state, entity);
      // Commit effects together only after all required resources and gestures finish.
      const before = this.state;
      this.state = plan.state;
      if (prepared) {
        this.scenes.enter(prepared);
        this.toast(
          this.text(
            this.world.data.label ||
              this.world.region(this.player.x / TILE, this.player.y / TILE),
          ),
        );
      }
      for (const effect of plan.effects) {
        if (effect.type === "dialogue")
          this.openDialogue(
            this.lines(effect.key),
            this.text(entity.label || "you"),
            0,
            entity,
          );
        else if (effect.type === "sound") this.audio.effect(effect.key);
        else if (effect.type === "content") this.openContent(effect.key);
      }
      if (held) this.inventory.clear();
      this.world.refresh(this.state);
      this.dirty = true;
      this.updateUI();
      this.pickups.gained(before, this.state, { x:this.player.x, y:this.player.y-26 });
      this.save();
    } catch (error) {
      console.error("Adventure interaction:", error);
      this.toast(this.text("travelError"));
    } finally {
      byId("loading").hidden = true;
      this.transitioning = false;
    }
  }
  openDialogue(lines, speaker = this.s.you, variant = 0, entity = null) {
    this.pauseMovement();
    this.dialogue = { lines, index: 0, speaker, entity };
    byId("dialogue").hidden = false;
    this.paintPortrait(
      typeof entity?.portrait === "string"
        ? entity.portrait
        : entity?.portrait
          ? this.renderer.frame(entity, this.state)
          : variant,
    );
    this.paintDialogue();
  }
  paintDialogue() {
    if (!this.dialogue) return;
    byId("speaker").textContent = this.dialogue.speaker;
    byId("dialogue-text").textContent = dialogueText(
      this.dialogue.lines[this.dialogue.index],
      this.catalog,
    );
    byId("page-count").textContent =
      `${this.dialogue.index + 1} / ${this.dialogue.lines.length}`;
    byId("page-count").hidden = this.dialogue.lines.length < 2;
    this.paintActions();
    byId("dialogue-next").textContent =
      this.dialogue.index === this.dialogue.lines.length - 1
        ? this.s.done
        : this.s.next + " ▸";
  }
  paintActions() {
    const holder = byId("dialogue-actions");
    holder.replaceChildren();
    if (
      !this.dialogue.entity ||
      this.dialogue.index !== this.dialogue.lines.length - 1
    )
      return;
    const entity = this.dialogue.entity;
    for (const action of actions(entity, this.state)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "world-primary";
      button.dataset.action = action.id;
      button.disabled = !matches(this.state, action.enabledWhen);
      button.textContent = this.text(action.label).replace(
        ":price",
        action.fare ? fare(this.catalog, action.fare) : "",
      );
      button.addEventListener("click", () => this.interact(entity, action.id));
      holder.append(button);
    }
  }
  nextDialogue() {
    if (!this.dialogue) return;
    this.dialogue.index++;
    if (this.dialogue.index >= this.dialogue.lines.length) this.closeDialogue();
    else this.paintDialogue();
  }
  closeDialogue() {
    if (this.dialogue?.entity) this.contactLatch = this.dialogue.entity.id;
    this.dialogue = null;
    byId("dialogue").hidden = true;
    byId("world-canvas").focus({ preventScroll: true });
  }
  closeContent() {
    this.site?.cancel();
    const sheet = byId("world-content");
    if (sheet.hidden) return;
    sheet.hidden = true;
    this.experience.focus(false);
    byId("world-canvas").focus({ preventScroll: true });
  }
  showContent() {
    byId("world-content").hidden = false;
    this.experience.focus(true);
    this.pauseMovement();
    this.closeDialogue();
  }
  openContent(key) {
    if (this.rooms.contains(key)) this.site.open(key);
  }
  contact(entity) {
    entity = this.interactionTarget(entity);
    if (
      !entity ||
      entity.threshold ||
      entity.pushable ||
      this.contactLatch === entity.id ||
      !(entity.neighbor || entity.rules?.length || entity.product)
    )
      return;
    this.contactLatch = entity.id;
    this.interact(entity);
  }
  summonGuardian() {
    if (!this.rooms.contains("expressions")) return;
    this.closeContent();
    this.pauseMovement();
    // Spawn on reachable ground, then follow the same collision-safe paths as other neighbors.
    for (const offset of [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
      [-5, 0],
      [5, 0],
      [0, -5],
      [0, 5],
    ]) {
      const start = {
        x: this.player.x + offset[0] * TILE,
        y: this.player.y + offset[1] * TILE,
      };
      if (!this.world.canStand(start.x, start.y)) continue;
      const path = this.world.approach(start, this.player, 3, TILE * 1.8);
      if (!path) continue;
      this.guardian = {
        id: "guardian",
        ...start,
        path,
        sprite: "person-3-down",
        neighbor: true,
        variant: 3,
      };
      this.world.actors = [this.player, ...this.neighbors, this.guardian];
      break;
    }
  }
  checkThresholds(motion = null) {
    if (this.transitioning || this.dialogue) return false;
    for (const entity of this.world.entities) {
      if (!entity.threshold || !active(entity, this.state)) continue;
      const inside = insideThreshold(entity, this.player);
      if (!inside) this.portalLatch.delete(entity.id);
      if (
        inside &&
        !this.portalLatch.has(entity.id) &&
        acceptsEntry(entity, motion)
      ) {
        this.interact(entity);
        return true;
      }
    }
    return false;
  }
  updateUI() {
    this.inventory?.paint();
    this.self?.paint();
    byId("sound-toggle").setAttribute("aria-pressed", String(this.audio.on));
    byId("sound-toggle").setAttribute(
      "aria-label",
      this.audio.on ? this.s.soundOn : this.s.soundOff,
    );
    byId("sound-toggle").classList.toggle("is-muted", !this.audio.on);
  }
  paintPortrait(variant = 0) {
    const c = byId("portrait").getContext("2d");
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    const sprite =
      typeof variant === "string" ? variant : `person-${variant}-down`;
    this.renderer.sprites.portrait(
      c,
      sprite,
      c.canvas.width,
      c.canvas.height,
    );
  }
  paintCards() {
    document.querySelectorAll("[data-sprite]").forEach((el) => {
      const icon = this.renderer.sprites.icon(el.dataset.sprite);
      if (icon) el.replaceChildren(icon);
    });
  }
  toast(message) {
    const el = byId("world-toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 3500);
  }
  save() {
    if (!this.dirty) return;
    this.state.position = { x: this.player.x, y: this.player.y };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      this.storageOK = true;
      byId("save-status").textContent = this.s.saved;
      this.dirty = false;
    } catch (_) {
      this.storageOK = false;
      byId("save-status").textContent = this.s.unsaved;
    }
  }
  centerCamera(snap = false) {
    if (!this.renderer.width) return;
    const reading = !byId("world-content").hidden;
    const subject = (reading ? this.site.focus() : null) || this.player;
    const target = clampCamera(
      {
        x: subject.x - this.renderer.width / 2,
        y: subject.y - this.renderer.height * (reading ? 0.34 : 0.55),
      },
      this.world,
      this.renderer,
    );

    if (snap) this.camera = target;
    else {
      this.camera.x += (target.x - this.camera.x) * this.cameraEase;
      this.camera.y += (target.y - this.camera.y) * this.cameraEase;
    }
    this.camera = clampCamera(this.camera, this.world, this.renderer);
  }
  obstacleOptions() {
    return {
      resolveCollision: (entity, dx, dy) => {
        const moved = tryPush(
          this.world,
          this.player,
          entity,
          dx,
          dy,
          this.state,
        );
        if (moved) this.dirty = true;
        return moved;
      },
      edgeSlide: (entity) =>
        !this.dialogue && entity.edgeSlide && this.contactLatch === entity.id,
    };
  }
  follow(actor, path, dt, speed) {
    return follow(
      this.world,
      actor,
      path,
      dt,
      speed,
      (entity) => {
        if (actor === this.player) this.contact(entity);
        else {
          path.splice(0);
          actor.pause = 3;
        }
      },
      actor === this.player
        ? (motion) => !this.checkThresholds(motion)
        : undefined,
      actor === this.player ? this.obstacleOptions() : {},
    );
  }
  updateNeighbors(dt) {
    for (const n of this.neighbors) {
      if (
        n === this.pending ||
        Math.abs(n.x - this.camera.x) > this.renderer.width + 120 ||
        Math.abs(n.y - this.camera.y) > this.renderer.height + 120
      ) {
        n.moving = false;
        continue;
      }
      if (n.path.length) {
        n.moving = this.follow(n, n.path, dt, 15);
        n.sprite = `person-${n.variant}-${n.direction || "down"}`;
        if (!n.path.length) n.pause = 3 + n.rand() * 8;
      } else {
        n.moving = false;
        if (n.lookAt)
          n.direction = facing(n.lookAt.x - n.x, n.lookAt.y - n.y, n.direction);
        n.pause -= dt;
        if (n.pause <= 0) {
          const target = {
            x:
              (Math.floor(n.home.x / TILE + (n.rand() - 0.5) * n.radius * 2) +
                0.5) *
              TILE,
            y:
              (Math.floor(n.home.y / TILE + (n.rand() - 0.5) * n.radius * 2) +
                0.5) *
              TILE,
          };
          n.path = this.world.path(n, target) || [];
          n.pause = 4 + n.rand() * 8;
        }
      }
    }
  }
  keyboardIntent() {
    const x =
      Number(this.keys.has("d") || this.keys.has("arrowright")) -
      Number(
        this.keys.has("a") || this.keys.has("q") || this.keys.has("arrowleft"),
      );
    const y =
      Number(this.keys.has("s") || this.keys.has("arrowdown")) -
      Number(
        this.keys.has("w") || this.keys.has("z") || this.keys.has("arrowup"),
      );
    return x || y ? { x, y } : null;
  }
  movementIntent() {
    const keys = this.keyboardIntent();
    if (keys) return keys;
    const next = this.path.find(
      (p) => Math.hypot(p.x - this.player.x, p.y - this.player.y) >= 0.7,
    );
    return next
      ? { x: next.x - this.player.x, y: next.y - this.player.y }
      : null;
  }
  startRoll() {
    if (!this.ready || this.transitioning || this.dialogue || this.blocked())
      return;
    const intent = this.movementIntent();
    if (!intent) return;
    const target = this.path[this.path.length - 1];
    const distance =
      !this.keyboardIntent() && target
        ? Math.min(
            ROLL_DISTANCE,
            Math.hypot(target.x - this.player.x, target.y - this.player.y),
          )
        : ROLL_DISTANCE;
    if (!this.roll.start(intent.x, intent.y, distance)) return;
    this.rollIntent = target ? { target, pending: this.pending } : null;
    this.cancelPath();
    this.unlockAudio();
  }
  finishRoll() {
    const intent = this.rollIntent;
    this.rollIntent = null;
    if (!intent || this.keyboardIntent() || this.dialogue || this.blocked())
      return;
    if (intent.pending && active(intent.pending, this.state)) {
      this.path = this.world.approach(this.player, intent.pending, 6) || [];
      this.pending = intent.pending;
    } else if (
      Math.hypot(
        intent.target.x - this.player.x,
        intent.target.y - this.player.y,
      ) > 6
    )
      this.path = this.world.path(this.player, intent.target) || [];
  }
  tick(ms) {
    if (document.hidden) return;
    const dt = Math.min(0.05, this.lastTime ? (ms - this.lastTime) / 1000 : 0);
    this.lastTime = ms;
    this.cameraEase = 1 - Math.exp(-dt * 9);
    this.walking = false;
    this.player.pushing = null;
    this.contactLatch = releaseContact(
      this.world,
      this.player,
      this.contactLatch,
    );
    this.sequence.advance(dt);
    this.self.update();
    if (expireTimers(this.state)) {
      this.world.refresh(this.state);
      this.dirty = true;
      this.updateUI();
      if (this.dialogue) this.paintActions();
    }
    if (!this.dialogue && !this.blocked()) {
      const intent = this.keyboardIntent();
      if (this.roll.current) {
        const result = this.roll.step(
          this.world,
          this.player,
          dt,
          (entity) => this.contact(entity),
          (motion) => !this.checkThresholds(motion),
        );
        this.walking = result.moved;
        if (result.finished) this.finishRoll();
      } else if (intent) {
        const k = (WALK_SPEED * dt) / Math.hypot(intent.x, intent.y);
        this.walking = move(
          this.world,
          this.player,
          intent.x * k,
          intent.y * k,
          (entity) => this.contact(entity),
          {
            ...this.obstacleOptions(),
            onStep: (motion) => !this.checkThresholds(motion),
          },
        );
      } else this.walking = this.follow(this.player, this.path, dt, WALK_SPEED);
      if (this.walking) this.dirty = true;
      if (!this.transitioning && !this.dialogue) this.checkThresholds(intent);
      if (!this.path.length && this.pending) {
        const e = this.pending;
        this.pending = null;
        if (
          this.world.distanceTo(this.player, e) < TILE * 1.5 &&
          active(e, this.state)
        )
          this.interact(e);
      }
      if (!this.reducedMotion) this.updateNeighbors(dt);
    }
    if (this.guardian) {
      this.guardian.moving = this.follow(
        this.guardian,
        this.guardian.path,
        dt,
        38,
      );
      this.guardian.sprite = "person-3-" + (this.guardian.direction || "down");
      this.guardianChat.update();
    }
    this.scenes.prewarm(ms);
    this.rooms.enforce();
    this.centerCamera();
    // Suspend expensive animation behind reading/dialogs; render only 12fps there.
    const calm =
      !this.sequence.current &&
      (this.blocked() || this.reducedMotion || this.dialogue);
    if (!calm || ms - (this.lastRender || 0) > 83) {
      this.renderer.render(this, this.reducedMotion ? 0 : ms / 1000);
      this.lastRender = ms;
    }
    if (ms - this.lastSave > 2000) {
      this.save();
      this.lastSave = ms;
    }
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
  inspect() {
    if (!this.world) return { ready: false };
    return {
      ready: this.ready,
      locale: this.config.locale,
      scene: this.state.scene,
      player: { ...this.player },
      camera: { ...this.camera },
      flags: { ...this.state.flags },
      timers: { ...this.state.timers },
      inventory: { ...this.state.inventory },
      dialogue: this.dialogue ? { ...this.dialogue } : null,
      pathLength: this.path.length,
      pending: this.pending?.id,
      neighbors: this.neighbors.map(({ id, x, y, variant }) => ({
        id,
        x,
        y,
        variant,
      })),
      entities: this.world.entities
        .filter((e) => active(e, this.state))
        .map(({ id, x, y }) => ({ id, x, y })),
      bounds: {
        width: this.world.width * TILE,
        height: this.world.height * TILE,
      },
      view: { width: this.renderer.width, height: this.renderer.height },
      scale: this.renderer.scale,
      storageOK: this.storageOK,
      chunkCount: this.renderer.terrain.chunks.size,
      terrainBuilds: this.renderer.terrain.buildCount,
      assets: this.renderer.sprites.inspect(),
      wallet: {
        ...this.state.wallet,
        claimed: { ...this.state.wallet.claimed },
      },
      transitioning: this.transitioning,
      roll: this.roll.current ? { ...this.roll.current } : null,
      sequence: this.sequence.inspect(),
      needs: {
        pee: { ...this.state.needs.pee },
        poop: { ...this.state.needs.poop },
      },
      needStatus: needStatus(this.state.needs),
      traces: this.state.traces.map((t) => ({ ...t })),
      sound: this.audio.on,
      content: this.site.current
        ? {
            group: this.site.current.group,
            path: this.site.current.path,
            open: !byId("world-content").hidden,
          }
        : null,
      heldItem: this.inventory.held,
      objects: JSON.parse(JSON.stringify(this.state.objects || {})),
      contactLatch: this.contactLatch,
    };
  }
}
module.exports = { Adventure };
