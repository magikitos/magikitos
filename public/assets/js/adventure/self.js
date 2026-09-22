"use strict";
const { needStatus, reliefError, completeRelief } = require("./needs");
const { Account } = require("./account");
const { reliefPose, reliefFrame, reliefOffset } = require("./relief-art");
const {
  castOffered,
  castPortrait,
  playerVariant,
} = require("./player-art");
const byId = (id) => document.getElementById(id);
/** Body status UI and presentation; deadlines/inventory accounting stay in needs.js. */
class Self {
  constructor(game) {
    this.game = game;
    this.lastStatus = null;
    // El turno del elenco: `++undefined` es NaN y NaN nunca se parece a sí mismo, así que sin
    // este cero la primera apertura del panel se descartaba a sí misma por «llegas tarde».
    this.castToken = 0;
    this.castLease = null;
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
      for (const card of document.querySelectorAll("#self-dialog .world-card.is-wanted"))
        card.classList.remove("is-wanted");
      this.paint();
      // Reading here and not in the constructor: the panel is a deliberate
      // act, boot is not, and this request must never ride on a page load.
      this.account.read();
      game.body.read();
      this.openCast();
      byId("self-dialog").showModal();
    });
    // Los retratos se sueltan al cerrar, cierre como cierre: el aspa, Escape o cualquier sitio
    // del juego que cierre el panel. Con un `hidden` por su cuenta se quedarían clavados.
    byId("self-dialog").addEventListener("close", () => this.closeCast());
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
      // Las posiciones se borran ANTES de preparar, porque la pantalla se rehace con el estado ya
      // limpio; si preparar falla, hay que devolverlas: si no, se seguiría jugando un mundo que ya
      // no coincide con lo guardado y el siguiente `save` lo daría por bueno.
      const scene = game.state.scene,
        placed = game.state.objects[scene];
      try {
        delete game.state.objects[scene];
        game.scenes.cache.delete(scene);
        await game.scenes.transition(scene, null, game.state, {
          after: () => { game.dirty = true; game.save(); },
        });
      } catch (error) {
        if (placed !== undefined) game.state.objects[scene] = placed;
        console.error("Puzzle reset:", error);
        game.toast(game.text("travelError"));
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
    this.openCast();
    if (!byId("self-dialog").open) byId("self-dialog").showModal();
    // La puerta que falta se señala y se trae a la vista: sin cuenta es la tarjeta de la cuenta,
    // con cuenta pero sin la partida guardada, la de la partida. En el teléfono, donde el panel
    // scrollea entero, sin esto el aviso podía quedar por debajo del elenco.
    const wanted = byId(key === "communitySyncNeeded" ? "cloud-title" : "self-account")?.closest(".world-card");
    for (const card of document.querySelectorAll("#self-dialog .world-card.is-wanted"))
      card.classList.remove("is-wanted");
    if (wanted) {
      wanted.classList.add("is-wanted");
      requestAnimationFrame(() => why?.scrollIntoView({ block: "start", behavior: "smooth" }));
    }
  }
  /**
   * ⛔ EL ELENCO SE PIDE AL ABRIR EL PANEL Y SE SUELTA AL CERRARLO.
   *
   * La hoja de andar de un duende son 1024x400 ya decodificados: enseñar treinta caras con ellas
   * serían casi 50 MB y el presupuesto de sprites se llevaría por delante la pantalla que se está
   * jugando. Los retratos viven en su propio paquete pequeño (ver `prepare-cast-portraits.php`) y
   * aquí se toman en préstamo mientras el panel está abierto: ni se fijan, ni sobreviven al cierre.
   *
   * Si el paquete no llega, la sección no se pinta. Un selector con huecos donde van las caras es
   * peor que no ofrecerlo: parece roto y no se puede elegir igual.
   */
  async openCast() {
    const game = this.game,
      section = byId("self-cast");
    // Con un solo duende dibujado no hay nada que elegir, y una rejilla de uno es una pregunta
    // sin respuestas. El elenco crece solo el día que entra su arte.
    if (castOffered(game.catalog).length < 2) {
      section.hidden = true;
      return;
    }
    const token = ++this.castToken;
    let lease;
    try {
      lease = await game.renderer.sprites.prepare(castOffered(game.catalog).map(castPortrait));
    } catch (_) {
      section.hidden = true;
      return;
    }
    if (token !== this.castToken) {
      lease.release?.();
      return;
    }
    this.castLease?.();
    this.castLease = () => lease.release?.();
    section.hidden = false;
    this.paintCast();
  }
  closeCast() {
    this.castToken++;
    this.castLease?.();
    this.castLease = null;
    byId("self-cast-grid").replaceChildren();
  }
  /** Todos a la vez, sin categorías y sin nombres que nadie ha traducido: se elige por la cara. */
  paintCast() {
    const game = this.game,
      current = playerVariant(game.player);
    // La cara con la que te ven, grande, arriba del panel: el retrato del elenco mientras está
    // prestado. Si no llega, se queda el sprite de siempre, que `paintCards` ya pinta.
    const portrait = game.renderer.sprites.icon(castPortrait(current), { fullCanvas: true });
    if (portrait) {
      portrait.classList.add("is-portrait");
      portrait.style.width = portrait.style.height = "";
      byId("self-portrait").replaceChildren(portrait);
    }
    byId("self-cast-grid").replaceChildren(
      ...castOffered(game.catalog).map((variant, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "world-self-cast-option";
        button.setAttribute(
          "aria-label",
          game.text("castChoose").replace(":n", String(index + 1)),
        );
        button.setAttribute("aria-pressed", String(variant === current));
        button.classList.toggle("is-chosen", variant === current);
        const portrait = game.renderer.sprites.icon(castPortrait(variant), { fullCanvas: true });
        if (portrait) {
          portrait.style.width = portrait.style.height = "";
          button.append(portrait);
        }
        button.addEventListener("click", () => this.choose(variant));
        return button;
      }),
    );
  }
  /** Cambiarse de cara mientras te llevan en brazos o mientras colocas algo no es un capricho
   * inocente: son secuencias que ya están dibujando este cuerpo. Se espera a que terminen. */
  async choose(variant) {
    const game = this.game;
    if (
      this.castBusy ||
      game.transitioning ||
      game.cats?.locked ||
      game.community?.editing
    )
      return;
    if (variant === playerVariant(game.player)) {
      byId("self-dialog").close();
      return;
    }
    this.castBusy = true;
    try {
      // Un hito y no un evento propio: elegir duende pasa como mucho una vez por partida, así
      // que cabe en el vocabulario que ya existe y no pide otra fila que barrer durante un año.
      game.telemetry?.milestone("duende");
      await game.wear(variant);
      byId("self-dialog").close();
    } catch (error) {
      game.toast(game.text("loadError"));
    } finally {
      this.castBusy = false;
      if (byId("self-dialog").open) this.paintCast();
    }
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
        Boolean(game.river?.active || game.community?.editing ||
          game.body?.actions.ownPending || (game.body?.connected && !game.body.known));
    // El elenco se repinta por el MISMO camino que el resto del panel: la firma de abajo lleva
    // el duende, así que cambiar de cara desde cualquier sitio mueve la marca de la rejilla. La
    // condición es tener los retratos EN PRÉSTAMO, que es lo único que significa «hay rejilla»:
    // preguntarle a la sección si está oculta daría por abierta una que nunca llegó a abrirse.
    if (this.castLease) this.paintCast();
    byId("self-forest-retry").hidden = !game.body?.actions.ownPending;
    byId("self-forest-retry").disabled = Boolean(game.body?.actions.busy || !game.body?.connected ||
      (game.live?.spectator && game.body?.actions.ownPending?.endpoint === "forest-message"));
    byId("self-note-write").hidden = !game.notes?.writable(game.notes.fresh?.id);
    this.lastStatus = this.signature();
  }
  signature() {
    const g = this.game;
    return [playerVariant(g.player), needStatus(g.state.needs, g.body?.now() ?? Date.now()), g.live?.role, g.body?.known,
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
    if (g.transitioning || !g.body.actions.ownPending || !g.body.connected ||
      (g.live.spectator && g.body.actions.ownPending.endpoint === "forest-message")) return;
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
    if (reliefPose(kind, this.game.player) === "pee" && p > 0.3 && p < 0.7)
      pose = (Math.floor(seq.elapsed * 3) % 2) + 1;
    return reliefFrame(this.game.player, kind, pose);
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
      const [dx, dy] = reliefOffset(kind, player);
      game.renderer.drawSprite("pee-puddle", player.x + dx, player.y + dy);
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
    const crouched = reliefPose("pee", game.player) === "poop";
    c.fillStyle = "#e9d67a";
    for (let i = 0; i < 11; i++) {
      if (!game.reducedMotion && (i + Math.floor(seq.elapsed * 12)) % 4 === 0)
        continue;
      const t = i / 10;
      c.fillRect(
        Math.round(x + (crouched ? -5 - t * 2 : 9 + t * 12)),
        Math.round(y + (crouched ? -5 + t * 8 : -13 - 7 * Math.sin(t * Math.PI) + 16 * t)),
        1,
        2,
      );
    }
  }
}
module.exports = { Self };
