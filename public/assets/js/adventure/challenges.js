"use strict";
const { el, button } = require("./dom");
const { MemoryBoard } = require("./challenge-memory");
const { planReaction } = require("./rules");

/** Personal puzzle progress uses the existing durable action queue and installed server rules.
 * No new currency, local-storage namespace, API endpoint or client snapshot mints rewards. */
function advance(game, challenge, action) {
  const sequence = game.catalog.challenges, at = sequence.indexOf(challenge);
  if (at < 0 || sequence.slice(0, at).some((c) => !game.state.flags[c.completed]) ||
      game.state.scene !== challenge.scene || game.transitioning) return false;
  const entity = game.world.entities.find((e) => e.id === challenge.giver);
  if (!entity) return false;
  const context = { action }, plan = planReaction(entity, game.state, game.catalog, context);
  if (!plan?.rule) return false;
  if (!game.materials.canRecord(plan.rule)) {
    game.toast(game.text("communitySyncNeeded"));
    return false;
  }
  game.state = plan.state;
  game.materials.record(challenge.scene, entity, context, plan.rule);
  game.world.refresh(game.state);
  game.dirty = true;
  game.updateUI();
  game.save();
  return true;
}

class Challenges {
  constructor(game) { this.game = game; }
  async open() {
    const g = this.game, sequence = g.catalog.challenges;
    this.challenge = sequence.find((c) => !g.state.flags[c.completed]) || sequence.at(-1);
    const c = this.challenge;
    if (!c || !g.state.flags[c.met] || c.kind !== "memory") return;
    const request = g.site.begin("challenges");
    if (!request) return;
    this.request = request;
    this.practice = false;
    this.root = el("article", { class: "world-experience world-challenge" });
    this.root.append(el("h1", { tabindex: "-1", text: g.text(c.title) }),
      el("p", { role: "status", text: g.text("findingContent") }));
    g.site.mount(this.root, request);
    const sheet = document.getElementById("world-content");
    sheet.setAttribute("data-held", "");
    g.retireControls("challenge", true);
    request.signal.addEventListener("abort", () => {
      clearTimeout(this.timer);
      sheet.removeAttribute("data-held");
      g.retireControls("challenge", false);
    }, { once: true });
    try {
      const lease = await g.renderer.sprites.prepare([
        "avelino-portrait", "mill-key", ...c.pairs.map((p) => p.sprite),
      ]);
      try {
        if (request.signal.aborted) return;
        // Canvas copies survive sprite-package eviction. Each card owns its own copy.
        this.icons = new Map(["avelino-portrait", "mill-key", ...c.pairs.map((p) => p.sprite)]
          .map((s) => [s, g.renderer.sprites.icon(s)]));
      } finally { lease.release(); }
      if (g.state.flags[c.completed]) this.reward();
      else this.intro();
    } catch (_) {
      if (request.signal.aborted) return;
      this.root.replaceChildren(el("h1", { tabindex: "-1", text: g.text(c.title) }),
        el("p", { role: "status", text: g.text("contentUnavailable") }),
        button(g.text("retry"), () => this.open(), "world-primary"));
    }
  }
  active() { return this.request && !this.request.signal.aborted && this.game.rooms.contains("challenges"); }
  icon(name, className = "") {
    const source = this.icons.get(name);
    if (!source) return null;
    const copy = document.createElement("canvas");
    copy.width = source.width; copy.height = source.height;
    copy.getContext("2d").drawImage(source, 0, 0);
    copy.className = className;
    copy.setAttribute("aria-hidden", "true");
    return copy;
  }
  heading(title) {
    const g = this.game;
    this.root.replaceChildren(el("header", { class: "world-challenge-header" }, [
      this.icon("avelino-portrait", "world-challenge-wizard"),
      el("div", {}, [
        el("p", { class: "world-experience-eyebrow", text: g.text("challengeChapter") }),
        el("h1", { tabindex: "-1", text: title }),
        el("p", { class: "world-challenge-byline", text: g.text("challengeByline") }),
      ]),
    ]));
  }
  focusTitle() { this.root.querySelector("h1")?.focus({ preventScroll: true }); }
  intro() {
    const g = this.game, c = this.challenge;
    this.heading(g.text(c.title));
    const found = c.pairs.filter((p) => g.state.flags[p.flag]).length;
    this.root.append(
      el("p", { class: "world-challenge-invitation", text: g.text("challengeInvitation") }),
      el("p", { class: "world-challenge-note", text: g.text("challengeInstructions") }),
      el("div", { class: "world-challenge-prize" }, [this.icon("mill-key"),
        el("span", { text: g.text("challengePrize") })]),
      el("div", { class: "world-experience-actions" }, [button(
        g.text(found ? "challengeResume" : "challengeStart"), () => this.play(), "world-primary")]),
      el("p", { class: "world-challenge-note", text: g.text("challengeAtYourPace") }),
    );
    this.focusTitle();
  }
  play(practice = false) {
    if (!this.active()) return;
    const g = this.game, c = this.challenge;
    this.practice = practice;
    this.board = new MemoryBoard(c.pairs, practice ? [] : c.pairs.filter((p) => g.state.flags[p.flag]).map((p) => p.id));
    if (this.board.complete) return this.reward();
    this.heading(g.text(c.title));
    this.counter = el("span", { class: "world-challenge-count" });
    this.status = el("p", { class: "world-challenge-status", role: "status", "aria-live": "polite", "aria-atomic": "true", text: g.text("challengeChoose") });
    this.grid = el("div", { class: "world-memory-grid", role: "group", "aria-label": g.text("challengeBoard") });
    this.cards = this.board.cards.map((id, index) => {
      const pair = c.pairs.find((p) => p.id === id);
      const card = button("", () => this.turn(index), "world-memory-card");
      card.dataset.card = String(index);
      card.append(el("span", { class: "world-memory-back", "aria-hidden": "true" }, [
        el("span", { class: "world-memory-seal", text: "✺" }),
        el("span", { class: "world-memory-number", text: index + 1 }),
      ]), el("span", { class: "world-memory-face", "aria-hidden": "true" }, [
        this.icon(pair.sprite), el("span", { text: g.text(pair.label) }),
      ]), el("span", { class: "world-memory-check", "aria-hidden": "true", text: "✓" }));
      card.addEventListener("keydown", (event) => {
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 }[event.key];
        if (!delta) return;
        event.preventDefault(); event.stopPropagation();
        this.cards[(index + delta + this.cards.length) % this.cards.length].focus();
      });
      return card;
    });
    this.grid.append(...this.cards);
    this.root.append(el("div", { class: "world-challenge-meta" }, [
      el("span", { text: g.text(practice ? "challengePractice" : "challengeFindPairs") }), this.counter,
    ]), this.grid, this.status,
    el("p", { class: "world-challenge-note", text: g.text(practice ? "challengePracticeNote" : "challengeAtYourPace") }));
    this.paint();
    this.cards.find((card) => card.getAttribute("aria-disabled") !== "true")?.focus({ preventScroll: true });
  }
  paint() {
    const g = this.game, b = this.board;
    this.counter.textContent = g.text("challengePairs").replace(":n", b.found.size).replace(":total", this.challenge.pairs.length);
    this.cards.forEach((card, i) => {
      const found = b.found.has(b.cards[i]), exposed = found || b.open.includes(i);
      const pair = this.challenge.pairs.find((p) => p.id === b.cards[i]);
      card.classList.toggle("is-open", exposed);
      card.classList.toggle("is-found", found);
      card.setAttribute("aria-disabled", String(found || b.open.length === 2 || b.open.includes(i)));
      card.setAttribute("aria-label", g.text("challengeCard").replace(":n", i + 1) + ", " +
        (exposed ? g.text(pair.label) + (found ? ", " + g.text("challengeMatched") : "") : g.text("challengeFaceDown")));
    });
  }
  turn(index) {
    if (!this.active()) return;
    const result = this.board.turn(index);
    if (!result) return;
    const g = this.game;
    this.paint();
    if (result.type === "first") { this.status.textContent = g.text("challengeChooseAnother"); return; }
    if (result.type === "pair") {
      const pair = this.challenge.pairs.find((p) => p.id === result.id);
      // Commit before acknowledging the match. A full offline queue keeps the pair playable.
      if (!this.practice && !g.state.flags[pair.flag] && !advance(g, this.challenge, "pair-" + pair.id)) {
        this.board.settle(false); this.paint();
        this.status.textContent = g.text("communitySyncNeeded");
        return;
      }
      this.board.settle(); this.paint();
      g.audio.effect("found");
      this.status.textContent = g.text("challengePairFound");
      if (this.board.complete) this.timer = setTimeout(() => { if (this.active()) this.reward(); }, 650);
    } else {
      this.status.textContent = g.text("challengeTryAgain");
      this.timer = setTimeout(() => {
        if (!this.active()) return;
        this.board.settle(false); this.paint();
        this.status.textContent = g.text("challengeChoose");
      }, 1300);
    }
  }
  reward() {
    if (!this.active()) return;
    const g = this.game, claimed = Boolean(g.state.flags[this.challenge.completed]);
    this.heading(g.text(claimed ? "challengeCompleted" : "challengeSolved"));
    this.root.append(el("div", { class: "world-challenge-reward" }, [this.icon("mill-key")]),
      el("p", { class: "world-challenge-invitation", text: g.text(claimed ? "challengeKeyYours" : "challengeWellDone") }),
      el("p", { class: "world-challenge-note", text: g.text(g.state.flags.avelinoChestOpened ? "challengeMoreToCome" : "challengeChestHint") }));
    const actions = el("div", { class: "world-experience-actions" });
    if (!claimed) actions.append(button(g.text("challengeClaim"), () => {
      if (!this.active() || !advance(g, this.challenge, this.challenge.action)) return;
      g.audio.effect("found");
      g.telemetry?.milestone("challenge:" + this.challenge.id);
      this.reward();
    }, "world-primary"));
    else actions.append(button(g.text("challengeExplore"), () => g.closeContent(), "world-primary"));
    this.root.append(actions);
    if (claimed) this.root.append(el("div", { class: "world-experience-links" }, [
      button(g.text("challengeReplay"), () => this.play(true)),
    ]));
    this.focusTitle();
  }
}
module.exports = { Challenges, advance };
