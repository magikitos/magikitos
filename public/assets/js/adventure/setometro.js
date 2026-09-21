"use strict";
const { el, button } = require("./dom");
const { activity } = require("./activities");
const { hash } = require("./geometry");

function concept(value) {
  if (!value || !Number.isSafeInteger(value.id) || value.id < 1 ||
      typeof value.title !== "string" || !value.title.trim() || value.title.length > 300 ||
      !Number.isSafeInteger(value.score) || value.score < 0)
    throw Error("invalid_concept");
  return { id: value.id, title: value.title, score: value.score };
}
function daily(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.day) || !Array.isArray(value.pair) || value.pair.length !== 2)
    throw Error("invalid_daily");
  const pair = value.pair.map(concept);
  if (pair[0].id === pair[1].id) throw Error("invalid_daily");
  return { day: value.day, pair };
}
function ranking(value, offset = 0) {
  if (!value || value.offset !== offset || !Array.isArray(value.items) || value.items.length > 24 ||
      (value.nextCursor !== null && (!Number.isSafeInteger(value.nextCursor) ||
        value.nextCursor !== offset + value.items.length || value.nextCursor <= offset || value.nextCursor > 10000)))
    throw Error("invalid_ranking");
  const items = value.items.map(concept);
  if (new Set(items.map(c => c.id)).size !== items.length) throw Error("invalid_ranking");
  return { items, nextCursor: value.nextCursor };
}

/** Only the daily duel and the shared concept ranking; no room/session game, no inventory reward. */
class Setometro {
  constructor(game) { this.game = game; this.busy = false; }
  scope() { return String(hash(this.game.session.get() || this.game.deviceId || "anonymous")); }
  read(day) {
    try {
      const saved = JSON.parse(localStorage.getItem("magikitos.setometro.daily"));
      return saved?.day === day && saved.scope === this.scope() && Number.isSafeInteger(saved.winner) ? saved : null;
    } catch (_) { return null; }
  }
  open() {
    const g = this.game;
    return g.site.load("setometro", g.text("setometroQuestion"), async (signal) => {
      const data = daily(await g.api.request("setometro", {}, { signal }));
      return this.view(data, signal);
    }, () => this.open());
  }
  view(data, signal) {
    const g = this.game, root = activity(g, "setometro", g.text("setometroQuestion"));
    root.dataset.setometro = "";
    const illustration = g.renderer.sprites.icon("forest-balance");
    if (illustration) { illustration.classList.add("world-scale-art"); illustration.setAttribute("aria-hidden", "true"); root.append(illustration); }
    root.append(el("p", { class: "world-experience-byline", text: g.text("setometroDailyHint") }));
    const note = el("p", { role: "status", class: "world-scale-status" });
    const choices = el("div", { class: "world-scale-choices" });
    const known = this.read(data.day);
    let chosen = data.pair.some(c => c.id === known?.winner) ? known.winner : null;
    const scores = new Map(data.pair.map(c => [c.id, c.score]));
    const paint = () => {
      const receipt = this.read(data.day);
      if (data.pair.some(c => c.id === receipt?.winner)) chosen = receipt.winner;
      if (chosen) note.textContent = g.text("setometroVoted");
      for (const node of choices.children) {
        if (!node.dataset.concept) continue;
        const id = Number(node.dataset.concept);
        node.disabled = Boolean(this.busy || chosen);
        node.setAttribute("aria-pressed", String(id === chosen));
        node.querySelector("small").textContent = chosen ? g.text("setometroScore").replace(":count", new Intl.NumberFormat(g.config.locale).format(scores.get(id))) : "";
      }
    };
    this.refresh = paint;
    for (const c of data.pair) {
      const choice = button("", async () => {
        if (this.busy || chosen || signal.aborted) return;
        this.busy = true; paint(); note.textContent = g.text("sending");
        const scope = this.scope();
        try {
          const [csrf, proof] = await Promise.all([g.api.request("csrf", {}, { auth: true }), g.proof.request()]);
          if (signal.aborted) return;
          const result = await g.api.request("setometro-vote", {
            lang: g.config.locale, day: data.day, winner_id: c.id,
            loser_id: data.pair.find(other => other.id !== c.id).id,
            csrf_token: csrf.csrf_token, turnstile_token: proof || "",
          }, { auth: true }); // Once sent, finish the receipt even if the player closes the surface.
          if (!result.success || Number(result.winner?.id) !== c.id) throw Error("vote_failed");
          chosen = c.id;
          for (const row of [result.winner, result.loser])
            if (scores.has(Number(row?.id)) && Number.isFinite(row.sta_value)) scores.set(Number(row.id), Math.round(row.sta_value));
          try { localStorage.setItem("magikitos.setometro.daily", JSON.stringify({ day: data.day, scope, winner: chosen })); } catch (_) {}
          note.textContent = g.text("setometroVoted");
        } catch (error) {
          note.textContent = g.text(error.code === "daily_changed" ? "setometroChanged" : error.status === 429 ? "setometroLimit" : "voteError");
          if (error.code === "daily_changed") choices.replaceChildren(button(g.text("retry"), () => this.open()));
        } finally { this.busy = false; this.refresh?.(); }
      }, "world-scale-pan");
      choice.dataset.concept = c.id;
      choice.append(el("span", { text: c.title }), el("small", {})); choices.append(choice);
    }
    if (chosen) note.textContent = g.text("setometroVoted");
    paint();
    root.append(choices, note, button(g.text("setometroRanking"), () => this.showRanking(), "world-primary"));
    return root;
  }
  showRanking() {
    const g = this.game;
    return g.site.load("setometro", g.text("setometroRanking"), async (signal) => {
      const root = activity(g, "setometro", g.text("setometroRanking"));
      const list = el("ol", { class: "world-scale-ranking" });
      const note = el("p", { role: "status" });
      const append = rows => rows.forEach(c => list.append(el("li", {}, [
        el("span", { text: c.title }), el("small", { text: new Intl.NumberFormat(g.config.locale).format(c.score) + " 🍄" }),
      ])));
      const first = ranking(await g.api.request("setometro-ranking", {}, { signal }));
      append(first.items);
      let cursor = first.nextCursor, busy = false;
      const more = button(g.text("more"), async () => {
        if (busy || cursor === null || signal.aborted) return;
        busy = true; more.disabled = true;
        try {
          const next = ranking(await g.api.request("setometro-ranking", { cursor }, { signal }), cursor);
          if (signal.aborted) return;
          append(next.items); cursor = next.nextCursor; more.hidden = cursor === null; note.textContent = "";
        } catch (_) { if (!signal.aborted) note.textContent = g.text("contentUnavailable"); }
        finally { busy = false; more.disabled = false; }
      });
      more.hidden = cursor === null;
      root.append(el("p", { class: "world-experience-byline", text: g.text("setometroRankingHint") }), list, more, note,
        button(g.text("setometroDaily"), () => this.open()));
      return root;
    }, () => this.showRanking());
  }
}
module.exports = { Setometro, concept, daily, ranking };
