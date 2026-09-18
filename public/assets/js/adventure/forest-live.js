"use strict";
const { ForestConnection, protocol } = require("./forest-connection");
const { ForestPeople } = require("./forest-people");
const { ForestObjects } = require("./forest-objects");
const { TILE } = require("./geometry");

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
        this.objects.reconnect();
      } });
    window.addEventListener("pagehide", () => this.connection.stop());
    window.addEventListener("pageshow", () => { this.identity = null; });
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
      const previous = this.role;
      this.role = packet.role;
      if (this.spectator) g.community.cancel();
      if (previous !== this.role && (packet.type === "plaza" || this.spectator))
        g.toast(g.text(this.spectator ? "forestSpectator" : "forestAdmitted"));
      if (packet.type === "bienvenido") this.correct(packet.position);
    } else if (packet.type === "corregir") this.correct(packet.position);
    else if (packet.type === "vecinos") this.people.snapshot(packet, g.state.scene,
      { width: g.world.width * TILE, height: g.world.height * TILE });
    else if (packet.type === "objetos") this.objects.snapshot(packet);
    else if (packet.type === "zona") g.community.sync.notice(packet);
    else if (packet.type === "inactivo") g.toast(g.text("forestIdle"));
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
      } catch (_) { this.connection.stop(); }
      finally { prepared?.packs.release?.(); g.transitioning = false; }
      return;
    }
    if (Math.hypot(position.x - g.player.x, position.y - g.player.y) < 1) return;
    g.pauseMovement();
    Object.assign(g.player, { x: position.x, y: position.y });
    g.dirty = true;
  }
  update(ms) {
    const g = this.game;
    this.people.update(g.reducedMotion);
    this.objects.update();
    if (ms < this.next) return;
    this.next = ms + protocol.limits.playerSnapshotMs;
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
    if (!this.spectator) return true;
    this.game.toast(this.game.text("forestSpectator"));
    return false;
  }
  inspect() { return { connected: this.connection.ready, role: this.role, visible: this.people.list.length,
    failure: this.connection.lastFailure || null }; }
}
module.exports = { ForestLive };
