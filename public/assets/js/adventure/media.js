"use strict";
const { Heard } = require("./session");
const format = (seconds) =>
  Math.floor(seconds / 60) +
  ":" +
  String(Math.floor(seconds % 60)).padStart(2, "0");
/** One audio element, one bounded queue. No website DOM scraping or analytics collectors. */
class WorldMedia {
  constructor(game) {
    this.game = game;
    this.audio = document.getElementById("world-audio");
    this.bar = document.getElementById("world-listening");
    this.heard = new Heard(game.config.locale);
    this.queues = new Map();
    this.rounds = new Map();
    this.history = [];
    this.historyIndex = -1;
    this.item = null;
    this.busy = false;
    this.completed = new Set();
    try {
      this.auto = localStorage.getItem("magikitos.autoplay") === "1";
    } catch (_) {}
    const byId = (id) => document.getElementById(id);
    byId("listening-play").onclick = () => this.toggle();
    byId("listening-stop").onclick = () => this.stop();
    byId("listening-next").onclick = () => this.next();
    byId("listening-auto").onclick = () => this.setAuto(!this.auto);
    byId("listening-sheet").onclick = () => {
      if (this.item) game.site.showPiece(this.item);
    };
    byId("listening-seek").oninput = (event) => this.seek(event.target.value);
    this.audio.addEventListener("play", () => {
      game.duck(true);
      if (this.item) this.heard.add(this.item.kind, this.item.id);
      this.paint();
    });
    this.audio.addEventListener("pause", () => {
      game.duck(false);
      this.paint();
    });
    for (const event of ["timeupdate", "loadedmetadata"])
      this.audio.addEventListener(event, () => this.paint());
    this.audio.addEventListener("ended", () => {
      game.duck(false);
      if (this.item) this.completed.add(this.item.audio);
      this.paint();
      if (this.auto) this.scheduleNext();
    });
    this.audio.addEventListener("error", () => {
      game.duck(false);
      game.toast(game.text("missingMedia"));
      this.paint();
    });
  }
  current() {
    return this.game.site.current?.item || this.item;
  }
  allowed(kind) {
    return this.game.rooms.contains(this.game.rooms.forKind(kind));
  }
  async start(item, toggle = false, remember = true) {
    if (!item?.audio || !this.allowed(item.kind)) return;
    clearTimeout(this.advanceTimer);
    const same = this.item?.audio === item.audio;
    if (same && toggle && !this.audio.paused) {
      this.audio.pause();
      return;
    }
    if (!same) {
      this.audio.pause();
      this.item = item;
      this.audio.src = item.audio;
      if (remember) {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(item);
        this.history = this.history.slice(-50);
        this.historyIndex = this.history.length - 1;
      }
    }
    this.bar.hidden = false;
    this.paint();
    try {
      await this.audio.play();
    } catch (error) {
      if (error.name !== "AbortError")
        this.game.toast(
          error.name === "NotAllowedError"
            ? this.game.text("listen")
            : this.game.text("missingMedia"),
        );
    }
  }
  toggle() {
    if (!this.item) return;
    if (!this.audio.paused) this.audio.pause();
    else this.start(this.item);
  }
  stop() {
    clearTimeout(this.advanceTimer);
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.item = null;
    this.bar.hidden = true;
    this.paint();
  }
  suspend() {
    clearTimeout(this.advanceTimer);
    this.audio.pause();
    this.game.duck(false);
  }
  setAuto(value) {
    this.auto = Boolean(value);
    try {
      localStorage.setItem("magikitos.autoplay", this.auto ? "1" : "0");
    } catch (_) {}
    if (!this.auto) clearTimeout(this.advanceTimer);
    this.paint();
  }
  scheduleNext() {
    clearTimeout(this.advanceTimer);
    this.advanceTimer = setTimeout(() => this.next(this.item?.kind), 3000);
  }
  async next(kind) {
    clearTimeout(this.advanceTimer);
    if (this.busy) return;
    const current = document.getElementById("world-content").hidden
      ? this.item
      : this.current();
    kind ||= current?.kind;
    if (
      !["cuento", "chiste", "expresion"].includes(kind) ||
      !this.allowed(kind)
    )
      return;
    this.busy = true;
    this.paint();
    try {
      const exclude = new Set(this.heard.get(kind));
      if (current?.kind === kind) exclude.add(current.id);
      let queue = (this.queues.get(kind) || []).filter(
        (item) => !exclude.has(item.id),
      );
      if (!queue.length) {
        const round = this.rounds.get(kind) || 1;
        queue = await this.game.content.batch(kind, round, [...exclude]);
        this.rounds.set(kind, round + 1);
      }
      const next = queue.shift();
      this.queues.set(kind, queue);
      if (!next) {
        this.game.toast(this.game.text("empty"));
        return;
      }
      // A reply arriving after leaving the room cannot restart its content.
      if (!this.allowed(kind)) return;
      if (!document.getElementById("world-content").hidden)
        this.game.site.showPiece(next, { play: true });
      else await this.start(next);
    } catch (_) {
      this.game.toast(this.game.text("contentUnavailable"));
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  async previous() {
    if (this.historyIndex <= 0) return;
    const item = this.history[this.historyIndex - 1];
    if (!this.allowed(item.kind)) return;
    this.historyIndex--;
    this.game.site.showPiece(item);
    await this.start(item, false, false);
  }
  duration() {
    return this.item?.duration > 0
      ? this.item.duration
      : Number.isFinite(this.audio.duration)
        ? this.audio.duration
        : 0;
  }
  seek(value) {
    if (this.duration())
      this.audio.currentTime = (Number(value) / 1000) * this.duration();
  }
  paint() {
    const playing = Boolean(this.item && !this.audio.paused),
      byId = (id) => document.getElementById(id);
    this.bar.classList.toggle(
      "world-listening--compact",
      !byId("world-content").hidden &&
        Boolean(this.game.site.current?.item?.audio),
    );
    byId("listening-play").textContent = playing ? "Ⅱ" : "▶";
    byId("listening-play").setAttribute(
      "aria-label",
      this.game.text(playing ? "pause" : "listen"),
    );
    for (const node of document.querySelectorAll(
      "[data-world-auto],#listening-auto",
    ))
      node.setAttribute("aria-pressed", String(Boolean(this.auto)));
    byId("listening-next").disabled = this.busy;
    if (this.item) {
      byId("listening-title").textContent = this.item.title;
      byId("listening-kind").textContent = this.game.text(
        this.game.rooms.forKind(this.item.kind),
      );
    }
    const duration = this.duration();
    byId("listening-time").textContent = format(this.audio.currentTime || 0);
    byId("listening-duration").textContent = format(duration);
    byId("listening-seek").disabled = !duration;
    byId("listening-seek").value = duration
      ? (this.audio.currentTime / duration) * 1000
      : 0;
    const current = this.game.site.current?.item;
    for (const node of document.querySelectorAll("[data-world-rating]"))
      node.hidden =
        current?.kind === "expresion" && !this.completed.has(current.audio);
    const matching = current?.audio && current.audio === this.item?.audio;
    for (const node of document.querySelectorAll("[data-world-play]")) {
      const active = Boolean(matching && playing);
      node.textContent = this.game.text(active ? "pause" : "listen");
      node.setAttribute("aria-pressed", String(active));
    }
    for (const node of document.querySelectorAll("[data-world-seek]")) {
      node.disabled = !matching || !duration;
      node.value =
        matching && duration ? (this.audio.currentTime / duration) * 1000 : 0;
    }
    for (const node of document.querySelectorAll("[data-world-elapsed]"))
      node.textContent = format(matching ? this.audio.currentTime : 0);
    for (const node of document.querySelectorAll("[data-world-duration]"))
      node.textContent = format(matching ? duration : current?.duration || 0);
  }
}
module.exports = { WorldMedia, format };
