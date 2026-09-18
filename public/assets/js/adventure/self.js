"use strict";
const { needStatus, reliefError, completeRelief } = require("./needs");
const { Account } = require("./account");
const byId = (id) => document.getElementById(id);
/** Body status UI and presentation; deadlines/inventory accounting stay in needs.js. */
class Self {
  constructor(game) {
    this.game = game;
    this.lastStatus = null;
    this.account = new Account(game);
    byId("self-toggle").addEventListener("click", () => {
      if (!game.ready || game.transitioning) return;
      game.closeContent();
      game.closeDialogue();
      game.pauseMovement();
      const why = byId("self-why");
      if (why) {
        why.hidden = true;
        why.textContent = "";
      }
      this.paint();
      // Reading here and not in the constructor: the panel is a deliberate
      // act, boot is not, and this request must never ride on a page load.
      this.account.read();
      game.body.read();
      byId("self-dialog").showModal();
    });
    for (const kind of ["pee", "poop"])
      byId("self-" + kind).addEventListener("click", () => this.relieve(kind));
    byId("self-forest-retry").addEventListener("click", () => this.retry());
    byId("self-note-write").addEventListener("click", () => {
      if (!game.notes.fresh) return;
      byId("self-dialog").close();
      game.notes.compose(game.notes.fresh.id);
    });
    byId("puzzle-reset").onclick = async () => {
      if (!game.world.data.puzzleReset || game.cats.locked) return;
      byId("self-dialog").close();
      game.pauseMovement();
      game.transitioning = true;
      try {
        delete game.state.objects[game.state.scene];
        game.scenes.cache.delete(game.state.scene);
        const prepared = await game.scenes.prepare(
          game.state.scene,
          null,
          game.state,
        );
        game.scenes.enter(prepared);
        game.dirty = true;
        game.save();
      } finally {
        game.transitioning = false;
      }
    };
  }
  /**
   * ⛔ UN BOTÓN QUE NO PUEDE HACER SU TRABAJO ABRE LA PUERTA QUE FALTA, y lo dice (17-sep-2026,
   * lo vio el dueño: «le di a construir juntos y no pasa nada»).
   *
   * Construir necesita una partida conectada, porque lo que dejas en el claro lo ve todo el
   * bosque y lleva tu firma. Cuando no la hay, lo que había era un aviso flotante que se va solo
   * y que no ofrece NADA: ni dice cómo conectarse ni lleva a ningún sitio, así que desde fuera se
   * ve exactamente igual que un botón roto. Ahora se abre el panel de «Yo», que es donde está la
   * puerta, con una línea que dice por qué se ha abierto.
   */
  explain(key) {
    const game = this.game;
    game.closeContent();
    game.closeDialogue();
    game.pauseMovement();
    this.paint();
    const why = byId("self-why");
    if (why) {
      why.hidden = false;
      why.textContent = game.text(key);
    }
    this.account.read();
    if (!byId("self-dialog").open) byId("self-dialog").showModal();
  }
  paint() {
    const game = this.game,
      status = needStatus(game.state.needs, game.body?.now() ?? Date.now());
    byId("puzzle-reset").hidden =
      !game.world?.data.puzzleReset || game.river?.active || game.cats?.locked;
    // Nothing to say when there is nothing to do: a line reporting that your
    // bladder is fine is not a status, it is noise in the one panel that also
    // holds your account. The leaf count lives in the bag, where the leaf is.
    const key = { pee: "needPee", poop: "needPoop" }[status];
    const line = byId("self-status");
    line.hidden = !key;
    line.textContent = key ? game.text(key) : "";
    // ⛔ And a need never lights the toggle. It is a joke on a timer that the
    // player did not ask for and cannot lose; badging it turns the panel into a
    // chore and trains people to ignore the dot that other things DO need.
    // The toggle's own label belongs to Account, which is what knows your name.
    for (const kind of ["pee", "poop"])
      byId("self-" + kind).hidden =
        status !== kind ||
        Boolean(game.river?.active || game.community?.editing || game.live?.spectator ||
          game.body?.actions.ownPending || (game.body?.connected && !game.body.known));
    byId("self-forest-retry").hidden = !game.body?.actions.ownPending;
    byId("self-forest-retry").disabled = Boolean(game.body?.actions.busy || !game.body?.connected || game.live?.spectator);
    byId("self-note-write").hidden = !game.notes?.writable(game.notes.fresh?.id);
    this.lastStatus = this.signature();
  }
  signature() {
    const g = this.game;
    return [needStatus(g.state.needs, g.body?.now() ?? Date.now()), g.live?.role, g.body?.known,
      g.body?.actions.ownPending?.request.operationId, g.body?.actions.busy, g.body?.connected,
      g.notes?.writable(g.notes.fresh?.id), g.river?.active, g.community?.editing].join(":");
  }
  update() {
    if (
      this.game.ready &&
      this.signature() !== this.lastStatus
    )
      this.paint();
  }
  async relieve(kind) {
    const game = this.game;
    if (
      !game.ready ||
      game.transitioning ||
      game.cats?.locked ||
      game.river?.active ||
      game.community?.editing ||
      game.live?.spectator ||
      game.body?.actions.ownPending
    )
      return;
    byId("self-dialog").close();
    const error = reliefError(game.state, kind, game.catalog, game.body?.now() ?? Date.now());
    if (error) {
      game.openDialogue(game.lines(error));
      return;
    }
    if (
      kind === "poop" &&
      !game.materials.canRecord({ effects: [{ type: "item" }] })
    ) {
      game.toast(game.text("communitySyncNeeded"));
      return;
    }
    game.pauseMovement();
    game.closeContent();
    game.closeDialogue();
    game.transitioning = true;
    game.player.direction = "up-right";
    const startedAt = game.body?.now() ?? Date.now(), remote = game.body?.connected;
    let completed = false;
    try {
      await game.sequence.play("relief", game.catalog.needs.durations[kind], {
        kind,
      });
      // Commit at completion. Reloading mid-animation neither consumes a leaf nor resets clocks.
      if (remote) await game.body.relieve(kind);
      else {
        game.state = completeRelief(game.state, kind, game.catalog, game.player, {
          startedAt, now: game.body?.now() ?? Date.now(),
        });
        if (kind === "poop")
          game.materials.record("player", { id: "needs" }, { action: "poop" },
            { effects: [{ type: "item", item: "leaf", amount: -1 }] });
      }
      game.world.refresh(game.state);
      game.dirty = true;
      game.updateUI();
      game.save();
      game.toast(game.text(kind === "poop" ? "poopDone" : "peeDone"));
      completed = true;
    } catch (error) {
      game.toast(game.text(game.body?.errorKey(error) || "loadError"));
      game.body?.read();
    } finally {
      game.transitioning = false;
      game.keys.clear();
      this.paint();
    }
    if (completed && remote && kind === "poop") game.notes.offer();
  }
  async retry() {
    const g = this.game;
    if (g.transitioning || !g.body.actions.ownPending || !g.body.connected || g.live.spectator) return;
    byId("self-dialog").close(); g.pauseMovement(); g.transitioning = true;
    try {
      const result = await g.body.retry();
      g.toast(g.text(result.endpoint === "forest-message" ? "notePublished" :
        result.request.kind === "poop" ? "poopDone" : "peeDone"));
    } catch (error) { g.toast(g.text(g.body.errorKey(error))); g.body.read(); }
    finally { g.transitioning = false; this.paint(); }
    g.notes.offer();
  }
  frame() {
    const seq = this.game.sequence.current;
    if (seq?.type !== "relief") return null;
    const p = this.game.sequence.progress(),
      kind = seq.data.kind;
    let pose = p < 0.14 ? 0 : p < 0.68 ? 1 : p < 0.88 ? 2 : 3;
    if (kind === "pee" && p > 0.3 && p < 0.7)
      pose = (Math.floor(seq.elapsed * 3) % 2) + 1;
    return `person-${require("./player-art").playerVariant(this.game.player)}-${kind}-${pose}`;
  }
  drawGround(c) {
    const game = this.game,
      now = Date.now();
    for (const trace of game.state.traces) {
      if (trace.scene !== game.state.scene || trace.expires <= now) continue;
      c.save();
      c.globalAlpha = Math.min(1, (trace.expires - now) / 30000);
      game.renderer.drawSprite(
        trace.kind === "poop" ? "poop" : "pee-puddle",
        trace.x,
        trace.y,
      );
      c.restore();
    }
    const seq = game.sequence.current;
    if (seq?.type !== "relief") return;
    const p = game.sequence.progress(),
      kind = seq.data.kind,
      player = game.player;
    if (kind === "poop" && p > 0.5)
      game.renderer.drawSprite("poop", player.x - 7, player.y + 3);
    if (kind === "pee" && p > 0.2) {
      c.save();
      c.globalAlpha = Math.min(1, (p - 0.2) * 3);
      game.renderer.drawSprite("pee-puddle", player.x + 20, player.y + 3);
      c.restore();
    }
  }
  drawStream(c) {
    const game = this.game,
      seq = game.sequence.current;
    if (seq?.type !== "relief" || seq.data.kind !== "pee") return;
    const p = game.sequence.progress();
    if (p < 0.2 || p > 0.83) return;
    const { x, y } = game.player;
    c.fillStyle = "#e9d67a";
    for (let i = 0; i < 11; i++) {
      if (!game.reducedMotion && (i + Math.floor(seq.elapsed * 12)) % 4 === 0)
        continue;
      const t = i / 10;
      c.fillRect(
        Math.round(x + 9 + t * 12),
        Math.round(y - 13 - 7 * Math.sin(t * Math.PI) + 16 * t),
        1,
        2,
      );
    }
  }
}
module.exports = { Self };
