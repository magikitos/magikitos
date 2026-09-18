"use strict";
const { ForestActions } = require("./forest-actions");
const { appendTrace } = require("./needs");
const { bodyDto, noteDto, serverTime } = require("./forest-data");

/** Connected needs have one authority: the server's deadlines + a monotonic clock. Offline
 * private play still uses needs.js. No public trace is ever synthesized from a browser save. */
class ForestBody {
  constructor(game) {
    this.game = game;
    this.actions = new ForestActions(game, localStorage, result => this.validate(result));
    this.identity = null;
    this.known = false;
    this.nextRead = 0;
    this.reading = null;
  }
  key() {
    const g = this.game;
    return g.cloud.owner && g.session.get() && !g.cloud.conflict
      ? g.cloud.owner + ":" + g.session.get() : null;
  }
  get connected() { return this.game.live.connection.ready; }
  now() { return this.known && this.identity === this.key() ? this.game.serverClock.now() : Date.now(); }
  update(ms) {
    const identity = this.key();
    if (identity !== this.identity) {
      this.reading?.abort(); this.reading = null;
      this.identity = identity; this.known = false; this.nextRead = 0;
    }
    if (identity && this.connected && ms >= this.nextRead && !document.hidden && !this.game.transitioning) this.read();
  }
  accept(data) {
    const needs = bodyDto(data, this.game.catalog);
    this.game.serverClock.sync(data.now);
    this.game.state.needs = needs;
    this.known = true;
    this.game.dirty = true;
    this.game.self.paint();
  }
  validate({ endpoint, data }) {
    serverTime(data.now);
    if (endpoint !== "forest-relief") return;
    const catalog = this.game.catalog;
    bodyDto(data, catalog);
    if (data.trace !== null) {
      const scene = catalog.construction.zones[data.trace?.zone]?.scene;
      noteDto(data.trace, data.trace?.zone, catalog.scenes[scene], catalog.messages);
    }
  }
  async read() {
    const identity = this.key();
    if (!identity || !this.connected || this.reading || this.actions.busy) return;
    this.identity = identity;
    const abort = this.reading = new AbortController();
    this.nextRead = performance.now() + 60000;
    try {
      const data = await this.game.api.request("game-body", {}, { auth: true, signal: abort.signal });
      if (identity === this.key() && !abort.signal.aborted) this.accept(data);
    } catch (_) { /* Read outages do not interrupt the private adventure. */ }
    finally { if (this.reading === abort) this.reading = null; }
  }
  async relieve(kind) {
    // A GET begun before a mutation must not later resurrect its old deadline.
    this.reading?.abort(); this.reading = null;
    const result = await this.actions.run("forest-relief", { kind });
    this.finish(result);
    return result;
  }
  async retry() {
    this.reading?.abort(); this.reading = null;
    const result = await this.actions.retry();
    this.finish(result);
    return result;
  }
  finish(result) {
    const g = this.game;
    if (result.endpoint === "forest-relief") {
      this.accept(result.data);
      if (result.data.trace) g.notes.remember(result.data.trace);
      // Pee and relief inside private interiors remain local traces, not shared notes.
      else if (!result.data.replayed) g.state.traces = appendTrace(g.state, result.request.kind,
        g.catalog, g.player, result.data.now);
    } else g.notes.published(result.request);
    g.dirty = true;
    g.save();
  }
  errorKey(error) {
    return ({ no_need: "noNeed", materials_required: "communityNoMaterials", tool_required: "noteWritingTools",
      too_close: "communityTooClose", too_far: "noteTooFar", trace_not_fresh: "noteExpired",
      trace_missing: "noteExpired", already_written: "noteExpired", forest_banned: "forestBanned",
      live_player_required: "forestSpectator", forest_action_pending: "forestActionPending",
      account_conflict: "communitySyncNeeded", materials_pending: "communitySyncNeeded" })[error.code || error.message] || "forestUnavailable";
  }
}
module.exports = { ForestBody };
