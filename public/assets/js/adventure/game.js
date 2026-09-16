"use strict";
const { tryPush } = require("./movables");
const { releaseContact } = require("./obstacles");
const { World, TILE, clamp, insideThreshold } = require("./model");
const { furnishWorkshop } = require("./workshop");
const { Renderer } = require("./renderer");
const { clampCamera } = require("./camera");
const { doorDestination, acceptsEntry } = require("./portals");
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
const { WALK_SPEED, RUN_SPEED, routeDistance } = require("./locomotion");
const { Journey } = require("./journey");
const { PickupFeedback } = require("./pickups");
const { Inventory } = require("./inventory");
const { ContentRooms } = require("./rooms");
const { Self } = require("./self");
const { expireTimers } = require("./timers");
const { needStatus } = require("./needs");
const { River } = require("./river");
const { Community } = require("./community");
const { CloudSave } = require("./cloud-save");
const { Sequence } = require("./sequence");
const { Presentation } = require("./presentation");
const { CatEncounters } = require("./cat-encounters");
const { MaterialAccount } = require("./material-account");
const byId = (id) => document.getElementById(id);

class Adventure {
  constructor(config) {
    this.config = config;
    this.s = config.strings;
    this.catalog = furnishWorkshop(config.world, config.products);
    this.renderer = new Renderer(byId("world-canvas"), byId("world-viewport"));
    this.audio = new WoodlandAudio();
    this.keys = new Set();
    this.journey = new Journey();
    this.sequence = new Sequence();
    this.presentation = new Presentation(this);
    this.dialogue = null;
    this.ready = false;
    this.scenes = new SceneDirector(this);
    this.transitioning = false;
    this.neighbors = [];
    this.camera = { x: 0, y: 0 };
    this.cameraFollowing = true;
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
    this.river = new River(this);
    this.cats = new CatEncounters(this);
    this.community = new Community(this);
    this.cloud = new CloudSave(this);
    this.materials = new MaterialAccount(this);
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
      const cloud = this.cloud.connect(false);
      // Show the actual terrain immediately; no modal loading screen or artificial progress.
      this.world = new World(this.catalog.scenes[this.state.scene]);
      this.player = { ...this.state.position, direction: "down" };
      this.renderer.world = this.world;
      this.renderer.resize();
      this.centerCamera(true);
      byId("loading").hidden = true;
      this.renderer.render(this, 0);
      await this.renderer.sprites.initialize(this.config.assetManifest);
      await cloud;
      if (this.cloud.owner && !this.cloud.conflict)
        await this.materials.flush();
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
    byId("world-recenter").addEventListener("click", () =>
      this.recenterCamera(),
    );
    window.addEventListener("blur", () => {
      this.pauseMovement();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(this.frame);
        this.audio.stop();
        this.pauseMovement();
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
      this.cats?.locked ||
      this.community?.editing ||
      Boolean(!byId("world-content").hidden && window.innerWidth < 800)
    );
  }
  hasOverlay() {
    return Boolean(document.querySelector("dialog[open]"));
  }
  cancelPath() {
    this.journey.clear();
  }
  pauseMovement({ keepPointerGesture = false } = {}) {
    this.river?.pause();
    if (!keepPointerGesture) this.input?.map.clear();
    this.cancelPath();
    this.keys.clear();
    this.walking = false;
    this.running = false;
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
    if (this.cats.locked) return;
    if (this.community.tap(point)) return;
    if (this.river.active) {
      this.river.tap(point);
      return;
    }
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
          (e.rules.length ||
            e.product ||
            e.interactAs ||
            e.pushable ||
            e.onInteract),
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
        if (
          !this.journey.start(this.world, this.player, { kind: "push", entity })
        )
          this.toast(this.s.blocked);
        return;
      }
      if (entity.threshold) {
        if (
          !this.journey.start(this.world, this.player, {
            kind: "portal",
            entity,
          })
        )
          this.toast(this.s.blocked);
        return;
      }
      if (this.world.distanceTo(this.player, entity) < TILE * 1.35) {
        this.interact(entity);
        return;
      }
      if (
        this.journey.start(this.world, this.player, {
          kind: "interact",
          entity,
        })
      ) {
        if (entity.neighbor) {
          entity.path = [];
          entity.pause = 30;
        }
      } else this.toast(this.s.blocked);
    } else {
      if (
        !this.journey.start(this.world, this.player, { kind: "ground", point })
      )
        this.toast(this.s.blocked);
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
      this.cats.locked ||
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
      if (!this.materials.canRecord(plan.rule)) {
        this.toast(this.text("communitySyncNeeded"));
        return;
      }
      const travel = plan.effects.find((e) => e.type === "travel");
      let prepared = null;
      if (travel) {
        const destination = doorDestination(
          this.catalog,
          this.world.data,
          entity,
          travel,
          this.state.entrance,
        );
        if (
          !this.world.data.indoor &&
          this.catalog.scenes[destination.scene].indoor
        )
          plan.state.entrance = {
            scene: this.world.data.id,
            portal: entity.id,
          };
        prepared = await this.scenes.prepare(
          destination.scene,
          destination.position,
          plan.state,
        );
      }
      if (plan.effects.some((e) => e.type === "navigation"))
        prepared = await this.river.prepareBoard(entity, plan.state);
      for (const effect of plan.effects)
        if (effect.type === "presentation")
          await this.presentation.play(effect, entity);
      await this.presentation.gains(this.state, plan.state, entity);
      // Commit effects together only after all required resources and gestures finish.
      const before = this.state;
      this.state = plan.state;
      this.materials.record(this.world.data.id, entity, context, plan.rule);
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
      this.pickups.gained(before, this.state, {
        x: this.player.x,
        y: this.player.y - 26,
      });
      this.save();
    } catch (error) {
      console.error("Adventure interaction:", error);
      this.toast(this.text("travelError"));
    } finally {
      this.presentation.finish();
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
        sprite: "person-11-down",
        neighbor: true,
        variant: 11,
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
        this.journey.permitsPortal(entity) &&
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
    this.river?.paint();
    this.community?.paint();
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
    this.renderer.sprites.portrait(c, sprite, c.canvas.width, c.canvas.height);
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
    this.state.position = this.cats?.safePosition
      ? { ...this.cats.safePosition }
      : { x: this.player.x, y: this.player.y };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      this.storageOK = true;
      byId("save-status").textContent = this.s.saved;
      this.dirty = false;
      this.cloud?.mark();
    } catch (_) {
      this.storageOK = false;
      byId("save-status").textContent = this.s.unsaved;
    }
  }
  centerCamera(snap = false) {
    if (!this.renderer.width) return;
    const reading = !byId("world-content").hidden;
    byId("world-recenter").hidden =
      this.cameraFollowing ||
      reading ||
      Boolean(this.dialogue) ||
      this.hasOverlay() ||
      this.transitioning;
    if (!this.cameraFollowing && !reading) {
      this.camera = clampCamera(this.camera, this.world, this.renderer);
      return;
    }
    const subject = (reading ? this.site.focus() : null) || this.player;
    const target = clampCamera(
      {
        x: subject.x - this.renderer.width / 2,
        y: subject.y - this.renderer.height * (reading ? 0.34 : 0.5),
      },
      this.world,
      this.renderer,
    );

    if (snap || (this.walking && !reading)) this.camera = target;
    else {
      this.camera.x += (target.x - this.camera.x) * this.cameraEase;
      this.camera.y += (target.y - this.camera.y) * this.cameraEase;
    }
    this.camera = clampCamera(this.camera, this.world, this.renderer);
  }
  recenterCamera(snap = false) {
    this.input?.map.clear();
    this.cameraFollowing = true;
    this.centerCamera(snap);
    byId("world-canvas").focus({ preventScroll: true });
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
  followResident(actor, dt, speed) {
    const path = actor.path;
    return follow(this.world, actor, path, dt, speed, () => {
      path.splice(0);
      actor.pause = 3;
    });
  }
  updateNeighbors(dt) {
    this.community.activities.update(dt);
    for (const n of this.neighbors) {
      if (n.activity && !n.path.length) {
        n.moving = false;
        continue;
      }
      if (
        n === this.journey.target ||
        Math.abs(n.x - this.camera.x) > this.renderer.width + 120 ||
        Math.abs(n.y - this.camera.y) > this.renderer.height + 120
      ) {
        n.moving = false;
        continue;
      }
      if (n.path.length) {
        n.moving = this.followResident(n, dt, 15);
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
    const next = this.journey.path.find(
      (p) => Math.hypot(p.x - this.player.x, p.y - this.player.y) >= 0.7,
    );
    return next
      ? { x: next.x - this.player.x, y: next.y - this.player.y }
      : null;
  }
  tick(ms) {
    if (document.hidden) return;
    const dt = Math.min(0.05, this.lastTime ? (ms - this.lastTime) / 1000 : 0);
    this.lastTime = ms;
    this.cameraEase = 1 - Math.exp(-dt * 9);
    this.walking = false;
    this.running = false;
    this.player.pushing = null;
    this.contactLatch = releaseContact(
      this.world,
      this.player,
      this.contactLatch,
    );
    this.sequence.advance(dt);
    this.self.update();
    this.cats.update(dt);
    if (expireTimers(this.state)) {
      this.world.refresh(this.state);
      this.dirty = true;
      this.updateUI();
      if (this.dialogue) this.paintActions();
    }
    if (!this.dialogue && !this.blocked()) {
      if (this.river.active) {
        this.river.update(dt);
      } else {
        const intent = this.keyboardIntent();
        if (intent) {
          const speed = this.keys.has(" ") ? RUN_SPEED : WALK_SPEED;
          const k = (speed * dt) / Math.hypot(intent.x, intent.y);
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
          this.running =
            this.walking && speed === RUN_SPEED && !this.player.pushing;
        } else {
          const speed = this.keys.has(" ")
            ? RUN_SPEED
            : this.journey.pace.speed(this.player, this.journey.path);
          const travel = this.journey.step(this.world, this.player, dt, speed, {
            onStep: (motion) => !this.checkThresholds(motion),
            resolveCollision: this.obstacleOptions().resolveCollision,
          });
          this.walking = travel.moved;
          this.running =
            this.walking && speed === RUN_SPEED && !this.player.pushing;
          if (travel.arrived) this.interact(travel.arrived);
        }
      }
      if (this.walking) this.dirty = true;
      if (!this.reducedMotion) this.updateNeighbors(dt);
    }
    if (this.guardian) {
      this.guardian.moving = this.followResident(this.guardian, dt, 38);
      this.guardian.sprite = "person-11-" + (this.guardian.direction || "down");
      this.guardianChat.update();
    }
    this.scenes.prewarm(ms);
    this.rooms.enforce();
    this.river.paint();
    this.community.paint();
    // Panning is a stationary inspection mode. Any actual player movement resumes follow.
    if (this.walking) this.cameraFollowing = true;
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
      cameraFollowing: this.cameraFollowing,
      pace: this.running ? "run" : this.walking ? "walk" : "idle",
      flags: { ...this.state.flags },
      timers: { ...this.state.timers },
      inventory: { ...this.state.inventory },
      dialogue: this.dialogue ? { ...this.dialogue } : null,
      pathLength: this.journey.path.length,
      travel: {
        remaining: routeDistance(this.player, this.journey.path),
        intent: this.journey.intent?.kind || null,
        destination: this.journey.intent?.point || null,
        replans: this.journey.replans,
        waiting: Boolean(this.journey.intent && !this.journey.path.length),
      },
      pending: this.journey.target?.id,
      neighbors: this.neighbors.map(({ id, x, y, variant }) => ({
        id,
        x,
        y,
        variant,
      })),
      entities: this.world.entities
        .filter((e) => active(e, this.state))
        .map((e) => ({
          id: e.id,
          x: e.x,
          y: e.y,
          presented: !this.presentation.hides(e),
        })),
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
      cats: this.cats.actors.map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
        phase: c.phase,
        direction: c.direction,
      })),
      carried: this.cats.carrier?.id || null,
      sequence: this.sequence.inspect(),
      navigation: {
        ...this.state.navigation,
        routeLength: this.river.path.length,
      },
      community: {
        zone: this.community.zone,
        editing: this.community.editing,
        objects: this.community.snapshot?.objects || [],
        ghost: this.community.ghost,
        invalid: this.community.invalid,
      },
      sync: {
        status: this.cloud.status,
        connected: Boolean(this.cloud.owner),
        conflict: Boolean(this.cloud.conflict),
        revision: this.cloud.meta.revision || 0,
      },
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
