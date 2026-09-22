"use strict";
const { ForestConnection, protocol } = require("./forest-connection");
const { ForestPeople } = require("./forest-people");
const { ForestObjects } = require("./forest-objects");
const { TILE, actorBounds, overlaps } = require("./geometry");

/** Adapter between optional network presence and the existing local game. Transport and
 * interpolation remain independently testable; neither knows the DOM or private PHP. */
class ForestLive {
  constructor(game) {
    this.game = game;
    this.role = "offline";
    this.identity = null;
    this.people = new ForestPeople((variant) =>
      require("./player-art").castVariant(game.catalog, variant),
    );
    this.objects = new ForestObjects(game);
    this.next = 0;
    this.connection = new ForestConnection({ api: game.api, viewport: () => this.viewport(),
      // Lo que el bosque va a enseñar de ti manda sobre lo que este navegador creía ser.
      granted: grant => { if (Number.isInteger(grant.variant)) game.wear(grant.variant, { push: false }); },
      receive: packet => this.receive(packet), disconnected: () => {
        this.role = "offline";
        this.people.clear();
        this.bodies();
        this.objects.reconnect();
      } });
    window.addEventListener("pagehide", () => this.connection.stop());
    window.addEventListener("pageshow", () => { this.identity = null; });
    const activity = event => {
      if (!event.isTrusted || !this.connection.ready || performance.now() < (this.nextActivity || 0)) return;
      this.nextActivity = performance.now() + 1000;
      this.connection.send({ type: "actividad" });
    };
    window.addEventListener("pointerdown", activity, { passive: true });
    window.addEventListener("pointermove", event => { if (game.community?.editing) activity(event); }, { passive: true });
    window.addEventListener("keydown", activity);
  }
  get spectator() { return this.connection.ready && this.role === "spectator"; }
  viewport() {
    const g = this.game;
    return [g.camera.x, g.camera.y, Math.max(1, g.renderer.width), Math.max(1, g.renderer.height)];
  }
  receive(packet) {
    const g = this.game;
    if (packet.type === "bienvenido" || packet.type === "plaza") {
      g.serverClock.sync(packet.now);
      this.role = packet.role;
      // Admission is silent. A scoped placement already in hand survives losing the seat.
      if (packet.type === "bienvenido") this.correct(packet.position);
    } else if (packet.type === "corregir") this.correct(packet.position);
    else if (packet.type === "vecinos") this.people.snapshot(packet, g.state.scene,
      { width: g.world.width * TILE, height: g.world.height * TILE });
    else if (packet.type === "objetos") this.objects.snapshot(packet);
    else if (packet.type === "zona") g.community.sync.notice(packet);
    else if (packet.type === "adios" && ["protocol_mismatch", "replaced"].includes(packet.reason))
      g.toast(g.text(packet.reason === "replaced" ? "forestOtherWindow" : "forestReload"));
  }
  async correct(position) {
    const g = this.game;
    // An in-flight local transition owns its state until it commits. Cross acknowledgements
    // validate that transition separately; a stale packet cannot take over its destination.
    if (g.transitioning) return;
    if (!position || !Object.hasOwn(g.catalog.scenes, position.scene) || !["boat", "foot"].includes(position.mode) ||
        !Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
    if (position.scene !== g.state.scene || position.mode !== (g.river.active ? "boat" : "foot")) {
      const generation = this.connection.generation;
      g.pauseMovement(); g.transitioning = true;
      let prepared;
      try {
        const state = { ...g.state, navigation: { ...g.state.navigation, mode: position.mode } };
        prepared = await g.scenes.prepare(position.scene, position, state);
        if (generation !== this.connection.generation) return;
        g.state = state;
        g.scenes.enter(prepared);
        g.save();
      } catch (error) {
        // Sin identidad, `update` vuelve a arrancar la presencia; con `stop` a secas quedaba muerta.
        console.error("Correction:", error);
        this.connection.stop(); this.identity = null;
      }
      finally { prepared?.packs.release?.(); g.transitioning = false; }
      return;
    }
    if (Math.hypot(position.x - g.player.x, position.y - g.player.y) < 1) return;
    g.pauseMovement();
    Object.assign(g.player, { x: position.x, y: position.y });
    g.dirty = true;
  }
  /**
   * ⛔ DOS DUENDES NO SE ATRAVIESAN (18-sep-2026, decisión del dueño). Los desconocidos eran solo
   * un dibujo y se cruzaban como fantasmas, que es lo que quita la sensación de que hay alguien
   * ahí. Aquí se les da cuerpo, y SOLO contra ti: nadie empuja a nadie, cada navegador se frena a
   * sí mismo. La autoridad del bosque no cambia — lo suyo es el presupuesto de distancia, no las
   * cajas —, así que esto no puede desincronizar a nadie ni inventar una posición.
   *
   * ⛔ Y QUIEN YA TE ESTÁ ENCIMA NO TE ENCIERRA. Los cuerpos ajenos llegan interpolados y con un
   * décimo de segundo de retraso, y el servidor puede corregirte a un sitio donde ya hay alguien:
   * si el solape fuera un muro, te quedarías clavado sin nada que pulsar. Un cuerpo que ya se
   * superpone al tuyo es atravesable hasta que sales de él, que es la misma salida que la casa ya
   * le dio al gato que acaba de soltarte.
   */
  bodies() {
    const g = this.game,
      actors = g.world?.actors;
    if (!actors) return;
    // La lista de vecinos se rehace en cada instantánea, así que primero salen los de la vuelta
    // anterior. Si la pantalla ha cambiado, el array es otro y no hay nada que quitar.
    if (this.bound === actors)
      for (const peer of this.peerBodies || []) {
        const i = actors.indexOf(peer);
        if (i >= 0) actors.splice(i, 1);
      }
    const live = this.connection.ready && !this.spectator ? this.people.list : [];
    const mine = actorBounds(g.player.x, g.player.y);
    for (const peer of live) {
      peer.actor = true;
      peer.passable = overlaps(mine, actorBounds(peer.x, peer.y));
      actors.push(peer);
    }
    this.bound = actors;
    this.peerBodies = live;
  }
  update(ms) {
    const g = this.game;
    this.people.update(g.reducedMotion);
    this.bodies();
    this.objects.update();
    if (ms < this.next) return;
    this.next = ms + (this.spectator ? 400 : protocol.limits.playerSnapshotMs);
    const identity = g.cloud.owner && !g.cloud.conflict && g.session.get()
      ? `${g.cloud.owner}:${g.session.get()}` : null;
    if (identity !== this.identity) {
      this.connection.stop();
      g.community.sync.reset(true);
      this.identity = identity;
      if (identity) {
        // Publish the already-owned snapshot before PHP signs the initial position. A failed
        // cloud save must not upload somebody else's local conflict into a live identity.
        Promise.resolve(g.cloud.flush()).then(() => {
          if (identity === this.identity && !g.cloud.conflict) this.connection.start();
        }).catch(() => {});
      }
    }
    g.community.sync.update();
    if (!this.connection.ready || this.connection.crossing) return;
    const pose = g.cats.locked ? "carried" : g.sequence.current?.type === "relief" ? g.sequence.current.data.kind :
      g.presentation.frame() ? (g.sequence.current?.data.kind === "discover" ? "discover" : "work") :
      g.player.pushing ? "push" : g.walking ? (g.river.active ? "row" : g.running ? "run" : "walk") : "idle";
    // ⛔ EMPUJANDO SE MANDA LA DIRECCIÓN DEL EMPUJE, NO LA DE ANDAR, y no es un matiz: la hoja de
    // empujar tiene CUATRO direcciones (se empuja por un eje, no en diagonal) mientras que la de
    // andar tiene ocho. Mandando la de andar, quien empuja en diagonal se veía empujando y todos
    // los demás lo veían quieto — el motor cae al plano de reposo cuando el nombre no existe, así
    // que no fallaba nada: simplemente el gesto no se veía. Es la misma dirección que se dibuja a
    // sí mismo (`pushFrame`), que es lo que hace que los dos lados enseñen lo mismo.
    this.connection.send({ type: "estoy", scene: g.state.scene, x: g.player.x, y: g.player.y,
      direction: g.player.pushing?.direction || g.player.direction, pose,
      mode: g.river.active ? "boat" : "foot" });
    this.objects.transmit(); // Observation precedes intent on the same ordered socket.
    const view = this.viewport(), encoded = JSON.stringify(view);
    if (encoded !== this.lastView) {
      this.connection.send({ type: "ventana", viewport: view });
      this.lastView = encoded;
    }
  }
  async cross(kind, id, scene, position, mode = this.game.river.active ? "boat" : "foot") {
    const g = this.game;
    if (!this.connection.ready) {
      // Do not let a greeting issued for the old scene arrive after the local transition.
      this.connection.stop(); this.identity = null; return;
    }
    if (kind === "dock" && mode === "boat") {
      await g.materials.flush();
      if (g.materials.queue.length || g.materials.error)
        throw Error(g.materials.error || "materials_pending");
      const renewed = await this.connection.renew(); // Wait for the signed entitlement's server ACK.
      if (!renewed) {
        if (this.connection.ready) throw Error("ticket_renewal_failed");
        this.connection.stop(); this.identity = null; return;
      }
    }
    const reply = await this.connection.cross({ kind, id, from: [g.player.x, g.player.y, g.player.direction],
      scene, position: [position.x, position.y], mode });
    if (reply && !reply.ok) throw Error("crossing_rejected");
    this.people.clear(); this.lastView = null;
  }
  canWrite() {
    if (this.connection.ready && this.role === "player") return true;
    this.game.openDialogue([this.game.text(this.spectator ? "forestSpectator" : "communityOffline")]);
    return false;
  }
  async checkWrite() {
    try {
      const result = await this.game.api.request("community-access", {}, { auth: true });
      if (result.allowed) return true;
      this.game.openDialogue([this.game.text("forestSpectator")]);
    } catch (_) { this.game.toast(this.game.text("communityOffline")); }
    return false;
  }
  /** Los desconocidos que hay en pantalla, con el duende y la pose que se les está dibujando.
   * Es lo único que hace COMPROBABLE que el elenco viaja en la presencia: sin esto, «los demás te
   * ven como te ves tú» es una afirmación que solo se puede mirar a ojo. Acotado por el propio
   * tope de 100 y sin nada de identidad: ni id público, ni nombre, ni posición. */
  inspect() { return { connected: this.connection.ready, role: this.role, visible: this.people.list.length,
    peers: this.people.list.map(p => ({ variant: p.variant, pose: p.pose })),
    failure: this.connection.lastFailure || null }; }
}
module.exports = { ForestLive };
