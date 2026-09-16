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
      this.paint();
      // Reading here and not in the constructor: the panel is a deliberate
      // act, boot is not, and this request must never ride on a page load.
      this.account.read();
      byId("self-dialog").showModal();
    });
    for (const kind of ["pee", "poop"])
      byId("self-" + kind).addEventListener("click", () => this.relieve(kind));
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
  paint() {
    const game = this.game,
      status = needStatus(game.state.needs);
    byId("puzzle-reset").hidden =
      !game.world?.data.puzzleReset || game.river?.active || game.cats?.locked;
    const key = {
      comfortable: "needComfortable",
      pee: "needPee",
      poop: "needPoop",
    }[status];
    byId("self-status").textContent = game.text(key);
    byId("self-toggle").dataset.need = status;
    byId("self-toggle").setAttribute(
      "aria-label",
      game.text("self") + " · " + game.text(key),
    );
    byId("self-leaves").textContent = game
      .text("leafCount")
      .replace(
        ":count",
        game.state.inventory[game.catalog.needs.leafItem] || 0,
      );
    for (const kind of ["pee", "poop"])
      byId("self-" + kind).hidden =
        status !== kind ||
        Boolean(game.river?.active || game.community?.editing);
    this.lastStatus = status;
  }
  update() {
    if (
      this.game.ready &&
      needStatus(this.game.state.needs) !== this.lastStatus
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
      game.community?.editing
    )
      return;
    byId("self-dialog").close();
    const error = reliefError(game.state, kind, game.catalog);
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
    const startedAt = Date.now();
    try {
      await game.sequence.play("relief", game.catalog.needs.durations[kind], {
        kind,
      });
      // Commit at completion. Reloading mid-animation neither consumes a leaf nor resets clocks.
      game.state = completeRelief(game.state, kind, game.catalog, game.player, {
        startedAt,
      });
      if (kind === "poop")
        game.materials.record(
          "player",
          { id: "needs" },
          { action: "poop" },
          { effects: [{ type: "item", item: "leaf", amount: -1 }] },
        );
      game.world.refresh(game.state);
      game.dirty = true;
      game.updateUI();
      game.save();
      game.toast(game.text(kind === "poop" ? "poopDone" : "peeDone"));
    } catch (error) {
      console.error("Adventure relief:", error);
      game.toast(game.text("loadError"));
    } finally {
      game.transitioning = false;
      game.keys.clear();
    }
  }
  frame() {
    const seq = this.game.sequence.current;
    if (seq?.type !== "relief") return null;
    const p = this.game.sequence.progress(),
      kind = seq.data.kind;
    let pose = p < 0.14 ? 0 : p < 0.68 ? 1 : p < 0.88 ? 2 : 3;
    if (kind === "pee" && p > 0.3 && p < 0.7)
      pose = (Math.floor(seq.elapsed * 3) % 2) + 1;
    return "person-0-" + kind + "-" + pose;
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
