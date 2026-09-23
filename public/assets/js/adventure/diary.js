"use strict";
const { el, button } = require("./dom");
const { activity } = require("./activities");
const { operationId } = require("./ids");

/**
 * EL DIARIO DEL BOSQUE (23-sep-2026, `DIARIO.md`). A book on a table of the meadow: one page a day
 * per person with an account, read by anyone. The website owns the pages, the judge and the
 * accounts; this is only the book.
 *
 * The book is the designer's two-page panel (`forest-diary-panel`), drawn once into a canvas and
 * reused, with each page's text laid over its safe area. On a narrow screen only the left page
 * shows, so the reader turns one page at a time. Writing happens on that same page.
 *
 * The draft lives in this browser until it is published or discarded: going to get an account
 * must not cost the person what they wrote. Without an account nothing leaves the browser.
 */
const DRAFT = "magikitos.diary.draft";
const WORD = /[\p{L}\p{N}][\p{L}\p{N}\p{M}'’-]*/gu;
const words = (text) => (text.match(WORD) || []).length;

function readDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT) || "null"); } catch (_) { return null; }
}
function writeDraft(draft) {
  try {
    if (draft) localStorage.setItem(DRAFT, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT);
  } catch (_) { /* a private window keeps it in memory for this visit */ }
}

class Diary {
  constructor(game) {
    this.game = game;
    this.data = null;
    this.pages = [];
    this.next = null;
    this.at = 0;
    this.draft = readDraft();
  }
  get l() { return this.data?.labels || {}; }
  open() {
    const g = this.game;
    return g.site.load("diary", g.text("diary"), async (signal) => {
      const [data] = await Promise.all([g.api.request("diary", {}, { auth: true, signal }), this.panel()]);
      this.data = data;
      this.pages = data.pages;
      this.next = data.next;
      this.at = 0;
      // Back from getting an account, with a page half written: straight back to it.
      if (this.draft?.text && data.me.account && !data.me.wroteToday) return this.composeView();
      return this.readView();
    }, () => this.open());
  }
  /** The empty spread, drawn once from its sprite pack and kept. */
  async panel() {
    if (this.canvas) return;
    const sprites = this.game.renderer.sprites;
    if (!sprites.has("forest-diary-panel")) return;
    try {
      const lease = await sprites.prepare(["forest-diary-panel"]);
      this.canvas = sprites.icon("forest-diary-panel", { fullCanvas: true });
      lease.release();
      if (this.canvas) this.canvas.className = "world-diary-art";
    } catch (_) { /* the book still reads without its drawing */ }
  }
  book(left, right) {
    const book = el("div", { class: "world-diary-book" + (this.canvas ? "" : " world-diary-book--plain") });
    if (this.canvas) book.append(this.canvas);
    book.append(el("div", { class: "world-diary-page world-diary-page--left" }, left),
      el("div", { class: "world-diary-page world-diary-page--right" }, right));
    return book;
  }
  today() {
    const now = new Date(this.game.serverClock?.now() ?? Date.now());
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(now);
  }
  day(iso) {
    if (iso === this.today()) return this.l.today;
    return new Intl.DateTimeFormat(this.game.config.locale, { day: "numeric", month: "long" }).format(new Date(iso + "T12:00:00"));
  }
  page(p) {
    if (!p) return [];
    const text = el("div", { class: "world-diary-text", tabindex: "0" });
    for (const block of p.text.split(/\n{2,}/)) text.append(el("p", { text: block }));
    // Whether the page goes on below its area, for the fade that says so; gone once read to the end.
    const mark = () => {
      text.classList.toggle("is-long", text.scrollHeight > text.clientHeight + 2);
      text.classList.toggle("is-end", text.scrollTop + text.clientHeight >= text.scrollHeight - 2);
    };
    text.addEventListener("scroll", mark, { passive: true });
    requestAnimationFrame(mark);
    return [
      el("p", { class: "world-diary-day", text: this.day(p.day) }),
      text,
      el("p", { class: "world-diary-signature", text: p.signature || this.l.anonymous }),
    ];
  }
  /** How many pages one turn shows: two side by side, or one on a narrow screen. */
  spread() {
    return matchMedia("(min-width: 560px)").matches ? 2 : 1;
  }
  readView() {
    const g = this.game, l = this.l, root = activity(g, "diary", l.title);
    root.append(el("p", { class: "world-experience-byline", text: l.intro }));
    const step = this.spread();
    this.at = Math.max(0, Math.min(this.at, this.pages.length - 1));
    const left = this.pages[this.at], right = step === 2 ? this.pages[this.at + 1] : null;
    root.append(this.book(left ? this.page(left) : [el("p", { class: "world-diary-empty", text: l.empty })], this.page(right)));
    const newer = button("‹", () => { this.at = Math.max(0, this.at - step); this.redraw(); });
    const older = button("›", () => this.older(step));
    newer.disabled = this.at === 0;
    older.disabled = this.at + step >= this.pages.length && this.next === null;
    newer.setAttribute("aria-label", l.back);
    older.setAttribute("aria-label", l.more);
    root.append(el("div", { class: "world-diary-turn" }, [newer, older]));
    const write = button(l.write, () => this.compose(), "world-primary");
    if (this.data.me.wroteToday) {
      write.disabled = true;
      root.append(write, el("p", { class: "world-diary-note", text: l.already }));
    } else root.append(write);
    return root;
  }
  redraw(view = () => this.readView()) {
    const request = this.game.site.begin("diary");
    if (request) this.game.site.mount(view(), request);
  }
  async older(step) {
    if (this.at + step >= this.pages.length && this.next !== null) {
      try {
        const page = await this.game.api.request("diary", { before: this.next }, { auth: true });
        this.pages.push(...page.pages);
        this.next = page.next;
      } catch (_) { this.game.toast(this.game.text("contentUnavailable")); return; }
    }
    this.at = Math.min(this.at + step, this.pages.length - 1);
    this.redraw();
  }
  compose() {
    if (this.data.me.wroteToday) return;
    this.redraw(() => this.composeView());
  }
  composeView() {
    const g = this.game, l = this.l, limits = this.data.limits;
    const draft = this.draft ||= { operationId: operationId(), lang: g.config.locale, text: "" };
    const root = activity(g, "diary", l.write);
    const area = el("textarea", { class: "world-diary-input", maxlength: limits.maxChars, placeholder: l.placeholder, "aria-label": l.placeholder, text: draft.text });
    const count = el("p", { class: "world-diary-count", "aria-live": "polite" });
    const status = el("p", { class: "world-diary-status", role: "status", "aria-live": "polite" });
    const send = button(l.send, () => this.send(area, status, send), "world-primary");
    const paint = () => {
      const n = words(area.value);
      count.textContent = l.words.replace(":n", n).replace(":max", limits.maxWords);
      count.classList.toggle("is-short", n < limits.minWords);
      count.classList.toggle("is-long", n > limits.maxWords);
      send.disabled = n < limits.minWords || n > limits.maxWords;
    };
    area.oninput = () => {
      draft.text = area.value;
      draft.operationId = operationId(); // a different page is a different operation
      writeDraft(draft);
      status.textContent = "";
      paint();
    };
    paint();
    root.append(this.book([area], []), count);
    root.append(el("div", { class: "world-diary-actions" }, [
      send,
      button(l.discard, () => { this.draft = null; writeDraft(null); this.redraw(); }),
    ]), status);
    return root;
  }
  async send(area, status, send) {
    const g = this.game, l = this.l, draft = this.draft;
    if (!this.data.me.account) {
      writeDraft(draft);
      return g.self.explain("diaryNeedsAccount");
    }
    send.disabled = true; area.disabled = true;
    send.textContent = l.sending;
    const payload = { operationId: draft.operationId, lang: draft.lang, text: draft.text };
    try {
      const write = (token) => g.api.request("diary-write", { ...payload, ...(token ? { turnstile_token: token } : {}) },
        { auth: true, timeout: 70000 });
      let result;
      try { result = await write(); } catch (error) {
        if (error.code !== "turnstile_required") throw error;
        result = await write(await g.proof.request());
      }
      if (result.status === "published") {
        this.draft = null; writeDraft(null);
        this.data.me.wroteToday = true;
        this.pages.unshift(result.page);
        this.at = 0;
        g.toast(l.saved);
        return this.redraw();
      }
      if (result.status === "care") {
        // Not published, and not the person's fault: the draft goes, the words stay with them.
        this.draft = null; writeDraft(null);
        return this.redraw(() => this.careView());
      }
      status.textContent = l["reason" + result.reason.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join("")] || l.rejected;
    } catch (error) {
      if (error.code === "account_required" || error.code === "identity_required") {
        this.data.me.account = false;
        return g.self.explain("diaryNeedsAccount");
      }
      if (error.code === "already_today") { this.data.me.wroteToday = true; status.textContent = l.already; }
      else if (error.code === "invalid_length") status.textContent = l.min.replace(":n", this.data.limits.minWords);
      else status.textContent = l.error;
    } finally {
      if (area.isConnected) { area.disabled = false; send.textContent = l.send; send.disabled = false; }
    }
  }
  careView() {
    const g = this.game, l = this.l, root = activity(g, "diary", l.title);
    root.append(el("p", { class: "world-diary-care", text: l.care }), el("p", { class: "world-diary-care", text: l.careLine }),
      button(l.back, () => this.redraw(), "world-primary"));
    return root;
  }
}
module.exports = { Diary, words };
