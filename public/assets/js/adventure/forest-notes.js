"use strict";
const { TILE } = require("./geometry");
const { characters, noteDto } = require("./forest-data");
const KEY = "magikitos.adventure.forest-note";
const byId = id => document.getElementById(id);

/** One scene-sized, expiring snapshot. Tiny notes live outside World: they never become
 * colliders, personal save entities or quest rules. Only deliberate clicks read them. */
class ForestNotes {
  constructor(game) {
    this.game = game;
    this.zone = null;
    this.records = new Map();
    this.entities = [];
    this.nextRead = 0;
    this.nextPaint = 0;
    this.reading = null;
    this.own = null;
    this.composing = null;
    try { this.own = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
    byId("forest-note-form").addEventListener("submit", event => { event.preventDefault(); this.publish(); });
    byId("forest-note-text").addEventListener("input", () => this.paintComposer());
    byId("forest-note-dialog").addEventListener("close", () => { this.composing = null; });
    byId("forest-note-dialog").addEventListener("pointerdown", event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)
        event.currentTarget.close();
    });
  }
  now() { return this.game.serverClock.now() ?? Date.now(); }
  update(ms) {
    const zone = this.game.community.zone;
    if (zone !== this.zone) {
      this.reading?.abort(); this.reading = null;
      this.zone = zone; this.records.clear(); this.entities = []; this.nextRead = 0;
      if (this.composing) byId("forest-note-dialog").close();
    }
    if (zone && ms >= this.nextRead && !document.hidden) this.refresh();
    if (ms >= this.nextPaint) { this.nextPaint = ms + 500; this.rebuild(); }
  }
  async refresh(force = false) {
    if (!this.zone || (this.reading && !force)) return;
    this.reading?.abort();
    const zone = this.zone, abort = this.reading = new AbortController();
    this.nextRead = performance.now() + 30000;
    try {
      const data = await this.game.api.request("forest-messages", { zone }, { signal: abort.signal });
      if (abort.signal.aborted || zone !== this.zone) return;
      if (data.zone !== zone || !Array.isArray(data.messages)) throw Error("invalid_forest_notes");
      const scene = this.game.catalog.scenes[this.game.state.scene];
      const records = new Map(data.messages.map(value => {
        const row = noteDto(value, zone, scene, this.game.catalog.messages);
        return [row.id, row];
      }));
      if (records.size !== data.messages.length) throw Error("duplicate_forest_note");
      this.game.serverClock.sync(data.now);
      this.records = records;
      this.rebuild();
    } catch (_) { /* Keep unexpired notes on a transient read outage, not an error screen. */ }
    finally { if (this.reading === abort) this.reading = null; }
  }
  rebuild() {
    const now = this.now();
    for (const [id, row] of this.records) if (row.expiresAt <= now) this.records.delete(id);
    this.entities = [...this.records.values()].map(row => ({
      id: "forest-note-" + row.id, x: row.x, y: row.y,
      opacity: Math.min(1, (row.expiresAt - now) / 30000),
      sprite: row.text === null ? "poop" : "poop-message", label: "noteTitle", rules: [],
      onInteract: action => action === "write" ? this.compose(row.id) : this.open(row.id),
      literal: row.text !== null,
      portrait: row.text === null ? "parchment" : "poop-message",
      actions: this.writable(row.id) ? [{ id: "write", label: "noteWrite" }] : [],
    }));
  }
  remember(trace) {
    const g = this.game, zone = trace.zone;
    const scene = g.catalog.construction.zones[zone]?.scene;
    if (!scene) throw Error("invalid_forest_note");
    const row = noteDto(trace, zone, g.catalog.scenes[scene], g.catalog.messages);
    this.own = { owner: g.cloud.owner, trace: row };
    try { localStorage.setItem(KEY, JSON.stringify(this.own)); } catch (_) {}
    if (zone === this.zone) { this.records.set(row.id, row); this.rebuild(); this.refresh(true); }
  }
  get fresh() {
    const row = this.own?.owner === this.game.cloud.owner ? this.own.trace : null;
    return row && row.text === null && row.zone === this.zone && row.expiresAt > this.now() &&
      this.now() - row.createdAt <= this.game.catalog.messages.writeWithinMs ? row : null;
  }
  writable(id) {
    const g = this.game, row = this.fresh, policy = g.catalog.messages;
    return Boolean(row && row.id === id && g.live.connection.ready && g.live.role === "player" &&
      !g.body.actions.ownPending && policy.tools.every(key => g.state.inventory[key] > 0) &&
      g.state.inventory[policy.stickItem] > 0 &&
      Math.hypot(row.x - g.player.x, row.y - g.player.y) <= policy.reachTiles * TILE);
  }
  open(id) {
    const row = this.records.get(id), g = this.game;
    if (!row || row.expiresAt <= this.now()) { g.toast(g.text("noteExpired")); return; }
    this.rebuild();
    const entity = this.entities.find(e => e.id === "forest-note-" + id);
    g.openDialogue([row.text ?? g.text(this.writable(id) ? "noteOffer" : "noteBare")],
      row.text === null ? g.s.you : row.author.name || row.author.handle || g.text("noteTitle"), 0, entity);
  }
  offer() { if (this.fresh && this.writable(this.fresh.id)) this.open(this.fresh.id); }
  compose(id) {
    if (!this.writable(id)) return;
    const g = this.game;
    g.pauseMovement(); g.closeDialogue(); g.closeContent();
    this.composing = { id, owner: g.cloud.owner, token: g.session.get() };
    byId("forest-note-text").value = "";
    byId("forest-note-error").textContent = "";
    this.paintComposer();
    byId("forest-note-dialog").showModal();
    byId("forest-note-text").focus();
  }
  paintComposer() {
    const count = characters(byId("forest-note-text").value), max = this.game.catalog.messages.maxCharacters;
    byId("forest-note-count").textContent = `${count} / ${max}`;
    byId("forest-note-publish").disabled = Boolean(this.publishing || count < 1 || count > max);
  }
  async publish() {
    const g = this.game, compose = this.composing, text = byId("forest-note-text").value;
    if (!compose || this.publishing || characters(text) < 1 || characters(text) > g.catalog.messages.maxCharacters) return;
    if (compose.owner !== g.cloud.owner || compose.token !== g.session.get()) {
      byId("forest-note-dialog").close(); return;
    }
    this.publishing = true; this.paintComposer();
    try {
      const result = await g.body.actions.run("forest-message", { traceId: compose.id, text });
      g.body.finish(result);
      byId("forest-note-dialog").close();
      g.toast(g.text("notePublished"));
    } catch (error) {
      byId("forest-note-error").textContent = g.text(g.body.errorKey(error));
      if (g.body.actions.ownPending) byId("forest-note-error").textContent += " " + g.text("forestActionPending");
    } finally { this.publishing = false; this.paintComposer(); }
  }
  published(request) {
    const row = this.records.get(request.traceId);
    if (row) row.text = request.text;
    if (this.own?.trace?.id === request.traceId) {
      this.own.trace.text = request.text;
      try { localStorage.setItem(KEY, JSON.stringify(this.own)); } catch (_) {}
    }
    this.rebuild(); this.refresh(true);
  }
  inspect() { return { zone: this.zone, count: this.records.size, ids: [...this.records.keys()],
    pending: this.game.body.actions.ownPending?.endpoint || null }; }
}
module.exports = { ForestNotes };
