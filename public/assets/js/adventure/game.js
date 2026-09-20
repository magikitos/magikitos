"use strict";
const { tryPush } = require("./movables");
const { releaseContact } = require("./obstacles");
const { World, TILE, insideThreshold } = require("./model");
const { Renderer } = require("./renderer");
const { clampCamera, cameraFollow, continuousTravel } = require("./camera");
const { doorDestination, acceptsEntry } = require("./portals");
const { WoodlandAudio } = require("./audio");
const { Entry } = require("./entry");
const { deviceIdentity } = require("./identity");
const { Telemetry } = require("./telemetry");
const { WorldSite } = require("./site");
const { WorldApi } = require("./api");
const { Session } = require("./session");
const { WorldContent } = require("./content");
const { HumanProof } = require("./proof");
const { GuardianChat } = require("./guardian");
const { WorldExperience } = require("./experience");
const { WorldMedia } = require("./media");
const { facing } = require("./characters");
const { hash } = require("./geometry");
const { active, planReaction, actions, matches } = require("./rules");
const { SAVE_KEY, readSave, readCast, writeCast } = require("./save");
const { move, follow } = require("./movement");
const { SceneDirector } = require("./scenes");
const { fare } = require("./economy");
const { dialogueText } = require("./dialogue");
const { WorldInput } = require("./input");
const { WALK_SPEED, RUN_SPEED, routeDistance } = require("./locomotion");
/**
 * Lo deprisa que la cámara se pega a quien sigue, y lo despacio que VIAJA a un sitio que acabas
 * de señalar. Son dos ritmos porque son dos cosas: seguir al duende que anda es no despegarse, y
 * llevar la mirada a otro sitio es un movimiento que se ve, y que mareaba yendo al ritmo del
 * primero. A 1,8 el viaje entero dura poco más de un segundo y medio.
 */
const CAMERA_FOLLOW_RATE = 9;
const CAMERA_TRAVEL_RATE = 1.8;
const { Embed } = require("./embed");
const { Journey } = require("./journey");
const { PickupFeedback } = require("./pickups");
const { Inventory } = require("./inventory");
const { ContentRooms } = require("./rooms");
const { Self } = require("./self");
const { expireTimers } = require("./timers");
const { needStatus } = require("./needs");
const { River } = require("./river");
const { Crossings } = require("./crossings");
const { Community } = require("./community");
const { CloudSave } = require("./cloud-save");
const { Sequence } = require("./sequence");
const { Presentation } = require("./presentation");
const { CatEncounters } = require("./cat-encounters");
const { MaterialAccount } = require("./material-account");
const { SceneText } = require("./scene-text");
const { ServerClock } = require("./server-clock");
const { ForestLive } = require("./forest-live");
const { ForestBody } = require("./forest-body");
const { ForestNotes } = require("./forest-notes");
const byId = (id) => document.getElementById(id);

class Adventure {
  constructor(config) {
    this.config = config;
    // El motor y la pantalla: `s` son las frases que el juego dice en cualquier sitio, y
    // `sceneStrings` las de la pantalla en la que estás. La pantalla manda sobre el motor, así
    // que un rincón puede llamar a las cosas por su nombre sin pedirle permiso al catálogo.
    this.s = config.strings;
    this.sceneStrings = {};
    this.sceneText = new SceneText(config);
    this.catalog = config.world;
    this.serverClock = new ServerClock();
    this.renderer = new Renderer(byId("world-canvas"), byId("world-viewport"));
    this.audio = new WoodlandAudio(
      config.audio,
      config.audioBase,
      () => {
        if (this.ready) this.updateUI();
      },
      (key) => {
        if (this.ready) this.toast(this.text(key));
      },
    );
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
    // Qué duende eres: null mientras nadie lo haya dicho, y entonces manda el de la casa.
    this.avatar = readCast(this.catalog);
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
    this.crossings = new Crossings(this);
    this.cats = new CatEncounters(this);
    this.community = new Community(this);
    this.cloud = new CloudSave(this);
    this.materials = new MaterialAccount(this);
    this.live = new ForestLive(this);
    this.body = new ForestBody(this);
    this.notes = new ForestNotes(this);
    this.telemetry = new Telemetry(this);
    // Before the entry card, which asks the bridge whether there is a page that
    // already did the asking.
    this.embed = new Embed(this);
    this.entry = new Entry(this);
    this.bind();
  }
  text(key) {
    const value = this.sceneStrings[key] ?? this.s[key];
    return Array.isArray(value) ? value[0] : (value ?? key);
  }
  /** Every resident of a content room invites you in with a different line, and
   * always the same one for that resident. */
  inviteLines(entity) {
    const pool = this.lines("invite_" + entity.content);
    return pool.length
      ? [pool[hash(String(entity.id)) % pool.length]]
      : this.lines(entity.dialogue || "neighborGreeting");
  }
  lines(key) {
    const value = this.sceneStrings[key] ?? this.s[key];
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
      this.live.objects.bind(this.world);
      this.player = { ...this.state.position, direction: "down", variant: this.avatar };
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
      this.entry.ready();
      this.embed.ready();
      this.updateUI();
      this.closeContent();
      // Persist freshly sampled deadlines and normalized saves even if the player only looks around.
      this.dirty = true;
      this.save();
      this.frame = requestAnimationFrame((t) => this.tick(t));
    } catch (error) {
      byId("loading").textContent = this.s.loadError;
      byId("loading").hidden = false;
      this.entry.fail();
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
    document.addEventListener("visibilitychange", () => this.syncForeground());
    window.addEventListener("magikitos:app-state", (event) => {
      this.nativeInactive = !event.detail.active;
      this.syncForeground();
    });
    window.addEventListener("pagehide", () => this.save());
    byId("dialogue-next").addEventListener("click", () => {
      this.unlockAudio();
      this.nextDialogue();
    });
    byId("sound-toggle").addEventListener("click", () => {
      if (this.transitioning) return;
      this.setMuted(this.audio.on && !this.audio.music?.blocked);
    });
    document
      .querySelectorAll("[data-dismiss]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          button.closest("dialog").close(),
        ),
      );
    document
      .querySelectorAll("dialog:not(#world-entry)")
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
      try {
        const route = event.target.value;
        const locale = Object.entries(this.config.routes || {}).find(
          ([, path]) => path === route,
        )?.[0];
        if (locale) localStorage.setItem("magikitos.locale", locale);
      } catch (_) {}
      location.assign(event.target.value);
    });
  }

  syncForeground() {
    const inactive = document.hidden || Boolean(this.nativeInactive);
    // Backgrounding a NATIVE app is a platform rule: the OS stops our audio
    // anyway and we have not declared a background-audio mode. Hiding a browser
    // TAB is not: an AudioContext and a playing <audio> keep running there, so
    // stopping them was our own choice and it cut the music mid-track.
    this.audio.setHidden(Boolean(this.nativeInactive));
    if (inactive === Boolean(this.inactive)) return;
    this.inactive = inactive;
    cancelAnimationFrame(this.frame);
    if (inactive) {
      // The world stops (no rAF, no simulation) but what is being LISTENED to
      // carries on. A narrated piece is a media player: switching tabs to look
      // something up must not lose your place in the story.
      if (this.nativeInactive) this.media.suspend();
      this.pauseMovement();
      this.save();
    } else if (this.ready) {
      this.lastTime = 0;
      this.frame = requestAnimationFrame((t) => this.tick(t));
    }
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
  pauseMovement({ keepPointerGesture = false, keepControls = false } = {}) {
    this.live?.objects.stop();
    this.river?.pause();
    if (!keepControls) this.keys.clear();
    if (!keepPointerGesture) this.input?.map.clear();
    this.cancelPath();
    this.walking = false;
    this.running = false;
    this.player.pushing = null;
  }
  /** The one place the sound preference changes, so the toggle and the page that
   * embeds us cannot end up meaning different things by the same word. */
  setMuted(muted) {
    this.state.muted = Boolean(muted);
    if (this.state.muted) this.audio.stop();
    else this.unlockAudio();
    this.dirty = true;
    this.updateUI();
    this.save();
  }
  async unlockAudio() {
    if (
      this.entry?.entered &&
      !this.state.muted &&
      (!this.audio.on || this.audio.music?.blocked)
    ) {
      await this.audio.start();
      this.updateUI();
    }
  }
  /**
   * ⛔ UNA NARRACIÓN SE QUEDA CON EL SONIDO Y CON LA PANTALLA, y las dos cosas empiezan y acaban
   * en el mismo instante: por eso son UNA llamada y no dos enganches a los mismos cuatro sucesos
   * del `<audio>`. Antes solo bajaba la música; desde el 17-sep-2026 también retira el mando
   * (decisión del dueño), por la misma puerta que lo retira una conversación.
   *
   * Se llama `narrating` y no `duck` porque lo que ocurre no es un efecto de audio: es que otra
   * cosa está ocupando el sitio.
   */
  narrating(on) {
    this.audio.setVoice(on);
    this.retireControls("listening", on);
  }
  /**
   * ⛔ AQUÍ VIVIÓ `leadTo`, el «guiar hacia el punto bajo el dedo» de la mañana del 19-sep-2026,
   * y se fue la misma tarde tras probarlo el dueño en producción: «con nada que me alejo ya se
   * pone a correr» y «para ir arriba el dedo tiene que estar muy arriba». El mando del dedo es
   * desde entonces un joystick invisible que entra por `directionIntent`, como las flechas
   * (`map-gestures.js`). El toque para ir e interactuar sigue aquí debajo, igual que siempre.
   */
  tap(point) {
    if (this.cats.locked) return;
    if (this.community.tap(point)) return;
    if (this.river.active) {
      this.river.tap(point);
      return;
    }
    this.cancelPath();
    if (this.river.tapFoot(point)) return;
    if (
      point.x < 0 ||
      point.y < 0 ||
      point.x >= this.world.width * TILE ||
      point.y >= this.world.height * TILE
    ) {
      // The garden framing a cutaway is presentation, not a walking destination. Fuera, en
      // cambio, más allá del borde está la pantalla de al lado (mundo continuo): el toque se
      // convierte en un viaje hasta la costura y se repite allí (`crossings.aimBeyond`).
      const beyond = this.world.data.indoor ? null : this.world.beyond(point);
      if (beyond) this.crossings.aimBeyond(beyond, point);
      return;
    }
    const candidates = [
      ...this.world.entities.filter(
        (e) =>
          active(e, this.state) &&
          (e.rules.length || e.interactAs || e.pushable || e.onInteract),
      ),
      ...this.neighbors,
      ...(this.notes?.entities || []),
      ...(this.guardian ? [this.guardian] : []),
    ].sort((a, b) => b.y - a.y);
    const hit = candidates.find((e) => this.renderer.hit(e, point, this.state));
    const entity = this.interactionTarget(hit);
    if (entity) {
      if (entity.pushable) {
        if (entity.shared && !this.live.objects.canPush(entity)) {
          this.toast(this.text(this.live.spectator ? "forestSpectator" : "communitySyncNeeded")); return;
        }
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
    // Una bombita o una tenaza en la mano sobre algo construido: es mantenimiento del bosque, no
    // un uso de objeto sobre una entidad (docs/AUTOMANTENIMIENTO.md §B).
    if (entity.community && held && this.community?.isTool(held)) {
      await this.community.useTool(held, entity);
      return;
    }
    if (typeof entity.onInteract === "function" && !held) {
      entity.onInteract(action);
      return;
    }
    if (entity.neighbor) {
      entity.path = [];
      entity.pause = 8;
      if (held) {
        this.openDialogue(this.lines("noUse"));
        return;
      }
      this.telemetry.act("talk");
      this.telemetry.milestone("talk");
      if (entity.content && this.rooms.contains(entity.content)) {
        if (entity.piece) this.site.showPiece(entity.piece, { play: true });
        // Walking up to somebody should not start a story at you. They say what
        // is going on here, in their own words, and you decide.
        else
          this.openDialogue(
            this.inviteLines(entity),
            this.s.neighbors,
            entity.variant,
            entity,
          );
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
    let prepared = null;
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
        await this.live.cross("door", entity.id, prepared.id, prepared.position);
      }
      for (const effect of plan.effects)
        if (effect.type === "presentation")
          await this.presentation.play(effect, entity);
      await this.presentation.gains(this.state, plan.state, entity);
      // Commit effects together only after all required resources and gestures finish.
      const before = this.state;
      this.state = plan.state;
      this.telemetry.act(entity.id || "rule");
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
      prepared?.packs.release?.();
      this.presentation.finish();
      byId("loading").hidden = true;
      this.transitioning = false;
    }
  }
  openDialogue(lines, speaker = this.s.you, variant = require("./player-art").playerVariant(this.player), entity = null) {
    this.pauseMovement();
    this.dialogue = { lines, index: 0, speaker, entity };
    // The stick cannot move anybody during a conversation (pauseMovement just
    // ran), so leaving it on screen only costs the dialogue 132px of height AND
    // pushes it up by the same amount — for a control that does nothing. One
    // flag on the root: --world-control-clearance drops to zero and the five
    // things that reserve room for the stick recompose themselves.
    this.retireControls("dialogue", true);
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
    const text = this.dialogue.lines[this.dialogue.index];
    byId("dialogue-text").textContent = this.dialogue.entity?.literal ? text : dialogueText(text, this.catalog);
    byId("dialogue-text").classList.toggle("world-literal", Boolean(this.dialogue.entity?.literal));
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
    // The one button every content-room resident shares, whatever else they say.
    if (entity.content && this.rooms.contains(entity.content)) {
      const enter = document.createElement("button");
      enter.type = "button";
      enter.className = "world-primary";
      enter.textContent = this.text("enter_" + entity.content);
      enter.addEventListener("click", () => {
        this.closeDialogue();
        this.openContent(entity.content);
      });
      holder.append(enter);
    }
  }
  nextDialogue() {
    if (!this.dialogue) return;
    this.dialogue.index++;
    if (this.dialogue.index >= this.dialogue.lines.length) this.closeDialogue();
    else this.paintDialogue();
  }
  /**
   * ⛔ QUIEN OCUPA LA PANTALLA RETIRA EL MANDO, Y HOY SON DOS (17-sep-2026, decisión del dueño:
   * al reproducir una voz, un cuento o un chiste el mando también se va).
   *
   * Desde que el joystick se erradicó (19-sep-2026), lo que se retira es el HUECO que el disco de
   * recentrar tiene reservado abajo a la derecha: ese botón se esconde hablando y escuchando, así
   * que reservarle sitio le cuesta al panel su propia altura sin que haya nada debajo. Una sola
   * bandera en la raíz y las reglas que se apartan de la esquina se recomponen solas.
   *
   * Es un CONJUNTO de motivos y no un booleano porque los dos pueden solaparse: abrir un diálogo
   * mientras suena un cuento y cerrarlo NO puede devolver el mando con el cuento todavía sonando.
   * Con un booleano, el último en cerrar manda; con motivos, el mando vuelve cuando no queda
   * ninguno.
   */
  retireControls(reason, on) {
    this.retired ||= new Set();
    if (on) this.retired.add(reason);
    else this.retired.delete(reason);
    const root = document.documentElement;
    if (this.retired.size) root.dataset.worldRetired = "1";
    else delete root.dataset.worldRetired;
  }
  closeDialogue() {
    if (this.dialogue?.entity) this.contactLatch = this.dialogue.entity.id;
    this.dialogue = null;
    this.retireControls("dialogue", false);
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
    if (!this.rooms.contains(key)) return;
    this.telemetry.milestone("content:" + key);
    this.site.open(key);
  }
  contact(entity) {
    /**
     * ⛔ CHOCAR CON UN GATO ES QUE TE COJA, Y AHÍ MISMO (17-sep-2026, decisión del dueño).
     * Hasta hoy el gato tenía que VERTE —y las macetas cortan la visión—, fijarse durante 0,85 s
     * y luego perseguirte; darle un topetazo no hacía nada porque ni siquiera tenía cuerpo. Con
     * cuerpo, el topetazo llega aquí, y aquí no se mira nada más: se gira y te lleva.
     */
    if (entity?.animal?.species === "cat") {
      this.cats?.bump(entity);
      return;
    }
    entity = this.interactionTarget(entity);
    if (
      !entity ||
      entity.threshold ||
      entity.pushable ||
      this.contactLatch === entity.id ||
      !(entity.neighbor || entity.rules?.length)
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
    if (this.river.checkFoot(motion)) return true;
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
  /**
   * ⛔ QUIÉN ERES SE ESCRIBE EN UN SITIO, Y LA CUENTA MANDA.
   *
   * Cambiar de duende toca cuatro cosas —la partida, el cuerpo que se dibuja, la cuenta y lo que
   * ve el resto del bosque— y con eso repartido por el panel acabarían desincronizadas: te verías
   * de un color y los demás de otro, sin que fallara nada. Aquí van juntas y en orden.
   *
   * Y NO se suelta la conexión para que los demás lo vean: el ticket ya lleva el duende dentro y
   * el bosque lo aplica al RENOVARLO, así que cambiarte de cara no te cuesta el asiento. Soltar y
   * volver a entrar te devolvería al final de la cola por haberte cambiado de ropa.
   */
  async wear(variant, { push = true } = {}) {
    const chosen = require("./player-art").castVariant(this.catalog, variant);
    if (chosen === this.avatar) return chosen;
    const previous = this.avatar;
    this.avatar = chosen;
    if (this.player) this.player.variant = chosen;
    writeCast(chosen);
    // Las hojas del cuerpo nuevo, antes de repintar nada con ellas.
    if (this.ready && this.world) await this.scenes.rewear(previous);
    this.paintCards();
    if (this.ready) this.paintPortrait();
    this.dirty = true;
    if (push && (await this.materials.chooseAvatar(chosen)))
      await this.live.connection.renew();
    return chosen;
  }
  paintPortrait(variant = require("./player-art").playerVariant(this.player)) {
    const c = byId("portrait").getContext("2d");
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    const sprite =
      typeof variant === "string" ? variant : `person-${variant}-down`;
    this.renderer.sprites.portrait(c, sprite, c.canvas.width, c.canvas.height);
  }
  paintCards() {
    document.querySelectorAll("[data-sprite], [data-player-sprite]").forEach((el) => {
      const name = el.hasAttribute("data-player-sprite")
        ? `person-${require("./player-art").playerVariant(this.player)}-down` : el.dataset.sprite;
      const icon = this.renderer.sprites.icon(name);
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
    /**
     * ⛔ AL TOCAR UN SITIO, LA CÁMARA VA AL SITIO, NO AL DUENDE (17-sep-2026, decisión del dueño).
     *
     * Tocar el mapa para andar devolvía la cámara al duende, y con el mapa desplazado eso es un
     * barrido de cientos de píxeles: aunque vaya suavizado, marea. Lo que de verdad te interesa
     * mirar es el sitio que acabas de señalar —que además estaba en pantalla, porque lo has
     * tocado—, así que la cámara se lleva allí despacio y el duende entra en cuadro andando. Ya
     * llegará. Al terminar el viaje el destino y el duende son casi el mismo punto, así que
     * volver a seguirle no se nota.
     */
    // `focusPoint` es un destino que pide otra parte del juego —hoy, el claro compartido al
    // abrir la caja de construir—: se viaja a él con el mismo suavizado que a un destino tocado,
    // que es lo que hace que empezar a construir sea VER dónde se puede.
    //
    const goal = this.cameraGoal();
    const subject = (reading ? this.site.focus() : null) || goal || this.player;
    const target = clampCamera(
      {
        x: subject.x - this.renderer.width / 2,
        y: subject.y - this.renderer.height * (reading ? 0.34 : 0.5),
      },
      this.world,
      this.renderer,
    );

    // Qué cuenta como viaje continuo y cómo se sigue viven en `camera.js`, que es donde se
    // pueden probar. Aquí solo se dice en cuál de los tres estás.
    const tracking = continuousTravel({
      walking: this.walking,
      carried: this.cats?.locked,
      rowing: this.river?.active,
    });
    this.camera = clampCamera(
      cameraFollow(this.camera, target, {
        tracking,
        goal,
        reading,
        // ⛔ CLAVAR ES LLEGAR, NO VIAJAR. Un zoom o un cambio de tamaño a medio viaje hacia un
        // sitio tocado no puede teletransportar la cámara al sitio: se reencuadra y sigue
        // viajando despacio, que es lo que estaba haciendo.
        snap: snap && !goal,
        ease: this.cameraEase,
        travelEase: this.cameraTravelEase,
      }),
      this.world,
      this.renderer,
    );
  }
  /**
   * El sitio al que VIAJA la cámara en vez de seguir al duende, o null si le sigue: el foco que
   * pide construir, o el destino de un toque. Con el mando del dedo no hay destino, así que la
   * cámara va pegada al duende, como con las teclas.
   */
  cameraGoal() {
    if (!byId("world-content").hidden) return null;
    return this.focusPoint || this.journey.goal || null;
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
        if (entity.shared) return this.live?.objects.push(entity, dx, dy) || false;
        if (entity.community && this.live?.spectator) return false;
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
  followResident(actor, dt, speed, world = this.world) {
    const path = actor.path;
    return follow(world, actor, path, dt, speed, () => {
      path.splice(0);
      actor.pause = 3;
    });
  }
  updateNeighbors(dt) {
    this.community.activities.update(dt);
    this.wander(this.world, this.neighbors, dt, this.camera);
    // ⛔ LOS DE LA PANTALLA DE AL LADO TAMBIÉN VIVEN (mundo continuo): sus residentes pasean en
    // su propio mundo con la cámara traducida a sus coordenadas, así que quien cae en la vista se
    // mueve igual que los tuyos y quien no, se queda quieto y no cuesta nada.
    for (const seam of this.world.seams || [])
      this.wander(seam.world, seam.world.actors || [], dt, {
        x: this.camera.x - seam.dx * TILE,
        y: this.camera.y - seam.dy * TILE,
      });
  }
  /** El paseo de los residentes de UNA pantalla: los que se ven andan, los demás esperan. */
  wander(world, residents, dt, camera) {
    for (const n of residents) {
      if (!n.neighbor && !n.home) continue; // Solo residentes: la presencia y los gatos van aparte.
      if (n.activity && !n.path.length) {
        n.moving = false;
        continue;
      }
      if (
        n === this.journey.target ||
        Math.abs(n.x - camera.x) > this.renderer.width + 120 ||
        Math.abs(n.y - camera.y) > this.renderer.height + 120
      ) {
        n.moving = false;
        continue;
      }
      if (n.path.length) {
        n.moving = this.followResident(n, dt, 15, world);
        n.sprite = `person-${n.variant}-${n.direction || "down"}`;
        if (!n.path.length) n.pause = 3 + n.rand() * 8;
      } else {
        n.moving = false;
        if (n.lookAt)
          n.direction = facing(n.lookAt.x - n.x, n.lookAt.y - n.y, n.direction);
        if (n.radius === 0) continue;
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
          n.path = world.path(n, target) || [];
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
  /**
   * Hacia dónde se dirige quien juega AHORA MISMO: las teclas, y si no, el mando del dedo. El
   * joystick fijo con su turbo se erradicó el 19-sep-2026 (decisión del dueño); lo que hay es un
   * joystick invisible que nace donde apoyas el dedo (`map-gestures.js`) y entra por aquí como
   * una flecha más, así que colisiones, empujes, charlas al chocar, costuras y remo son los mismos.
   */
  directionIntent() {
    return this.keyboardIntent() || this.input?.map.intent() || null;
  }
  /**
   * El aro del mando: dónde pintarlo, o null. Se pinta SIEMPRE que el dedo manda (19-sep-2026,
   * decisión del dueño tras probarlo: «no lo quitaría cuando pasa el tiempo, que siempre salga,
   * solo ligeramente más transparentito»). Aquí vivió un contador de segundos andados que lo
   * apagaba al aprender, y se fue el mismo día.
   */
  stickHint() {
    return this.input?.map.steering ? this.input.map.stickView() : null;
  }
  /** Correr es la barra espaciadora (o el toque lejano, en `journey`); el dedo del mando solo anda. */
  boosted() {
    return this.keys.has(" ");
  }
  movementIntent() {
    const keys = this.directionIntent();
    if (keys) return keys;
    const next = this.journey.path.find(
      (p) => Math.hypot(p.x - this.player.x, p.y - this.player.y) >= 0.7,
    );
    return next
      ? { x: next.x - this.player.x, y: next.y - this.player.y }
      : null;
  }
  tick(ms) {
    if (document.hidden || this.inactive) return;
    const dt = Math.min(0.05, this.lastTime ? (ms - this.lastTime) / 1000 : 0);
    this.lastTime = ms;
    // ⛔ A FRAME THAT IS NOT ON SCREEN COSTS NOTHING BUT THE LOOP. An iframe set to
    // `display: none` keeps its animation frames coming — its document is not
    // `hidden`, because that follows the TOP-level page — so the website tucking
    // the world away used to leave a whole simulation running for nobody. Skipping
    // the work instead of the loop is what makes showing it again instant: nobody
    // has to remember to restart anything. (Painting is refused one level down,
    // in renderer.render(), which is the only place that touches the canvas.)
    if (!this.renderer.width || !this.renderer.height) {
      this.frame = requestAnimationFrame((t) => this.tick(t));
      return;
    }
    if (!this.entry.entered) {
      if (ms - (this.lastRender || 0) > 83) {
        this.renderer.render(this, this.reducedMotion ? 0 : ms / 1000);
        this.lastRender = ms;
      }
      this.frame = requestAnimationFrame((t) => this.tick(t));
      return;
    }
    this.audio.update(this.world, this.player, ms);
    this.telemetry.tick();
    this.cameraEase = 1 - Math.exp(-dt * CAMERA_FOLLOW_RATE);
    this.cameraTravelEase = 1 - Math.exp(-dt * CAMERA_TRAVEL_RATE);
    this.walking = false;
    this.running = false;
    this.player.pushing = null;
    this.live.objects.begin(this.world);
    this.contactLatch = releaseContact(
      this.world,
      this.player,
      this.contactLatch,
    );
    this.sequence.advance(dt);
    this.body.update(ms);
    this.notes.update(ms);
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
        this.river.update(dt, this.reducedMotion ? 0 : ms / 1000);
      } else {
        const intent = this.directionIntent();
        if (intent) {
          const speed = this.boosted() ? RUN_SPEED : WALK_SPEED;
          const k = (speed * dt) / Math.hypot(intent.x, intent.y);
          this.walking = move(
            this.world,
            this.player,
            intent.x * k,
            intent.y * k,
            (entity) => this.contact(entity),
            {
              ...this.obstacleOptions(),
              gait: speed === RUN_SPEED ? "run" : "walk",
              onStep: (motion) => !this.checkThresholds(motion),
            },
          );
          this.running =
            this.walking && speed === RUN_SPEED && !this.player.pushing;
          // Se anda hasta el borde de la pradera y se pasa a la pantalla de al lado, igual que
          // remando: la misma pieza, el mismo viaje y el mismo aviso.
          if (this.walking) this.crossings.check("foot");
        } else {
          const speed = this.boosted()
            ? RUN_SPEED
            : this.journey.pace.speed(this.player, this.journey.path);
          const travel = this.journey.step(this.world, this.player, dt, speed, {
            gait: speed === RUN_SPEED ? "run" : "walk",
            onStep: (motion) => !this.checkThresholds(motion),
            resolveCollision: this.obstacleOptions().resolveCollision,
          });
          this.walking = travel.moved;
          this.running =
            this.walking && speed === RUN_SPEED && !this.player.pushing;
          if (this.walking) this.crossings.check("foot");
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
    this.community.paint();
    // Panning is a stationary inspection mode. Any actual player movement resumes follow — y
    // señalar un destino también, desde el toque y no desde el primer paso: la cámara ya está
    // haciendo algo que tú le has pedido.
    // ⛔ MIENTRAS DOS DEDOS —O EL BOTÓN DERECHO— MUEVEN EL MAPA, LA CÁMARA ES SUYA, aunque el
    // duende siga andando hacia lo último que le ordenaste: mirar alrededor no le para, y sin
    // esta guarda la cámara tiraría hacia él mientras los dedos tiran hacia otro lado.
    if ((this.walking || this.journey.intent) && !this.input?.map.dragging) {
      this.cameraFollowing = true;
      this.focusPoint = null;
    }
    this.centerCamera();
    this.live.update(ms);
    // Resting/reading can paint at 12fps. Essential travel must stay smooth even
    // with reduced motion; otherwise a running cycle aliases and hides its legs.
    const calm =
      !this.sequence.current &&
      !this.walking &&
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
      entered: this.entry.entered,
      audio: this.audio.inspect(),
      live: this.live.inspect(),
      notes: this.notes.inspect(),
      locale: this.config.locale,
      scene: this.state.scene,
      player: { ...this.player, variant: require("./player-art").playerVariant(this.player) },
      // `chosen` es null mientras nadie haya dicho nada: distinguirlo del duende de la casa es lo
      // único que permite comprobar que elegir GUARDA algo y no que coincide con el de serie.
      cast: { chosen: this.avatar, offered: require("./player-art").castOffered(this.catalog) },
      vessel: this.river.layers(),
      travelFailure: this.river.lastFailure || null,
      materialSync: { pending: this.materials.queue.length, error: this.materials.error || null },
      camera: { ...this.camera },
      cameraFollowing: this.cameraFollowing,
      // Qué está haciendo el dedo: mandar al duende o mover la cámara. Una prueba no puede
      // distinguirlo por la posición, porque en los dos casos el mundo se desplaza.
      gesture: {
        steering: Boolean(this.input?.map.steering),
        intent: this.input?.map.intent() || null,
        panning: Boolean(this.input?.map.dragging),
        hint: Boolean(this.stickHint()),
      },
      // Solo el punto: el destino puede ser una entidad entera y esto se serializa en cada sonda.
      cameraGoal: this.journey.goal
        ? { x: this.journey.goal.x, y: this.journey.goal.y }
        : null,
      pace: this.running ? "run" : this.walking ? "walk" : "idle",
      flags: { ...this.state.flags },
      timers: { ...this.state.timers },
      inventory: { ...this.state.inventory },
      dialogue: this.dialogue ? { ...this.dialogue } : null,
      pathLength: this.journey.path.length,
      // La ruta de la BARCA es otra cola y otro pathfinding: sin esto, una prueba del río no puede
      // distinguir «no le he dado ninguna orden» de «se la he dado y el agua no deja».
      vesselPath: this.river.path.length,
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
      // El mundo continuo, visto desde aquí: qué vecinas están enlazadas por sus costuras, hasta
      // dónde puede mirar la cámara y si hay un toque esperando al otro lado de un borde.
      seams: (this.world.seams || []).map((s) => ({ scene: s.scene, dx: s.dx, dy: s.dy })),
      frame: this.world.frame || null,
      pendingBeyond: this.crossings.pending?.scene || null,
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
      cats: this.cats.actors
        .filter((c) => active(c, this.state))
        .map((c) => ({
          id: c.id,
          x: c.x,
          y: c.y,
          phase: c.phase,
          direction: c.direction,
          home: { ...c.home },
          moving: c.moving,
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
        // `parked` distingue el PREVIO —que sigue al cursor— de una pieza ya apuntada: con el
        // ratón encima del mapa las dos tienen coordenadas, y solo la segunda se puede confirmar.
        parked: this.community.parked,
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
      needStatus: needStatus(this.state.needs, this.body.now()),
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
