"use strict";

/** One audio element for the whole world. Closing a folio never owns its lifetime. */
class WorldMedia {
  constructor(game) {
    this.game = game;
    this.audio = document.getElementById("world-audio");
    this.bar = document.getElementById("world-listening");
    this.queues = new Map();
    this.rounds = new Map();
    this.item = null;
    this.completed = new Set();
    this.busy = false;
    const byId = (id) => document.getElementById(id);
    byId("listening-play").addEventListener("click", () => this.toggle());
    byId("listening-stop").addEventListener("click", () => this.stop());
    byId("listening-next").addEventListener("click", () => this.next());
    byId("listening-seek").addEventListener("input", (event) => {
      if (this.duration())
        this.audio.currentTime =
          (Number(event.target.value) / 1000) * this.duration();
    });
    this.audio.addEventListener("loadedmetadata", () => this.paint());
    byId("listening-sheet").addEventListener("click", () => {
      if (this.item) game.site.navigate(this.item.url, { piece: this.item });
    });
    try {
      this.auto = localStorage.getItem("magikitos.autoplay") === "1";
    } catch (_) {}
    byId("listening-auto").setAttribute(
      "aria-pressed",
      String(Boolean(this.auto)),
    );
    byId("listening-auto").addEventListener("click", () => {
      this.setAuto(!this.auto);
    });
    this.audio.addEventListener("play", () => {
      game.duck(true);
      if (!this.played && this.item) {
        this.played = true;
        this.track("audio_play");
        if (
          ["cuento", "chiste", "expresion", "taramundi"].includes(
            this.item.kind,
          )
        ) {
          window.Magikitos?.oidos?.apuntar(
            this.item.kind,
            game.config.locale,
            this.item.id,
          );
          window.Magikitos?.trackPlay?.(
            this.item.kind === "expresion" ? "voice" : this.item.kind,
            this.item.voiceId || this.item.id,
          );
        }
      }
      this.paint();
    });
    this.audio.addEventListener("pause", () => {
      game.duck(false);
      this.paint();
    });
    this.audio.addEventListener("timeupdate", () => {
      if (
        !this.half &&
        this.duration() > 0 &&
        this.audio.currentTime >= this.duration() / 2
      ) {
        this.half = true;
        this.track("audio_progress", { progress: 50 });
      }
      this.paint();
    });
    this.audio.addEventListener("ended", () => {
      this.track("audio_complete");
      if (this.item) this.completed.add(this.item.audio);
      this.revealVote();
      if (this.auto || this.voted) this.scheduleNext();
    });
    this.audio.addEventListener("error", () => {
      game.duck(false);
      game.toast(game.s.missingMedia);
      this.paint();
    });
    document.addEventListener("click", (e) => {
      const play = e.target.closest(
        "[data-world-play], [data-audio-card-play], .audio-btn[data-audio-src]",
      );
      if (play) {
        e.preventDefault();
        const item = this.fromButton(play);
        if (item) this.start(item, true, play);
      }
      const next = e.target.closest("[data-world-next]");
      if (next) {
        e.preventDefault();
        this.next(next.dataset.worldNext);
      }
      const prev = e.target.closest("[data-world-prev]");
      if (prev) {
        e.preventDefault();
        this.previous();
      }
    });
    document.addEventListener("world:mount", () => {
      this.paint();
      document
        .querySelectorAll("[data-audio-card-play], .audio-btn[data-audio-src]")
        .forEach((button) => {
          if (this.completed.has(button.dataset.src || button.dataset.audioSrc))
            this.revealVote(button);
        });
    });
    // Give voting time to settle before replacing the piece underneath the reader.
    const isCurrentVote = (detail) =>
      this.item &&
      detail?.tipo ===
        (this.item.kind === "expresion" ? "voz" : this.item.kind) &&
      Number(detail.id) === (this.item.voiceId || this.item.id);
    document.addEventListener("magikitos:rating-vote", (event) => {
      if (isCurrentVote(event.detail)) clearTimeout(this.advanceTimer);
    });
    document.addEventListener("magikitos:rating-voted", (event) => {
      if (!isCurrentVote(event.detail)) return;
      this.voted = true;
      if (event.detail.setas <= 2 || this.audio.ended) this.scheduleNext();
    });
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
  fromPage() {
    const node = document.querySelector("[data-audio-swap]");
    if (node?.dataset.audioSrc)
      return {
        id: Number(node.dataset.itemId),
        kind: node.dataset.kind,
        audio: node.dataset.audioSrc,
        title: node.querySelector("h1")?.textContent.trim() || document.title,
        duration: Number(node.dataset.durationMs || 0) / 1000,
        url: this.game.site.current?.path,
        nextUrl: node.dataset.nextUrl,
      };
    const voice = document.querySelector(
      ".voice-card .audio-btn[data-audio-src]",
    );
    return voice ? this.fromButton(voice) : null;
  }
  fromButton(button) {
    if (button.hasAttribute("data-world-play")) return this.fromPage();
    const card = button.closest(
      ".voice-card, .audio-card, [data-ranking-item], .ranking__fila",
    );
    const voice = Boolean(
      button.dataset.voiceId || button.dataset.kind === "voz",
    );
    const link = card?.querySelector(
      ".audio-card__title-link, .voice-card__term a, h3 a, h2 a, a[href]",
    );
    return {
      id: Number(
        voice
          ? card?.dataset.termId ||
              card?.dataset.worldId ||
              document.body.dataset.piezaId
          : button.dataset.id,
      ),
      voiceId: voice
        ? Number(button.dataset.voiceId || button.dataset.id)
        : null,
      kind: voice ? "expresion" : button.dataset.kind,
      audio: button.dataset.src || button.dataset.audioSrc,
      duration: Number(button.dataset.durationMs || 0) / 1000,
      title:
        card?.dataset.worldTitle ||
        card
          ?.querySelector("h3, h2, .voice-card__term, .ranking__nombre")
          ?.textContent.trim() ||
        document.querySelector("#world-content h1")?.textContent.trim() ||
        document.title,
      url:
        card?.dataset.worldUrl ||
        link?.getAttribute("href") ||
        this.game.site.current?.path,
    };
  }
  async start(item, toggle = false, button = null) {
    if (
      !item?.audio ||
      !item.kind ||
      !item.id ||
      !this.game.rooms.contains(this.game.rooms.forKind(item.kind))
    )
      return;
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
      this.played = this.half = false;
      this.voted = false;
    }
    this.button =
      button ||
      [
        ...document.querySelectorAll(
          "[data-audio-card-play], .audio-btn[data-audio-src]",
        ),
      ].find((b) => (b.dataset.src || b.dataset.audioSrc) === item.audio);
    this.bar.hidden = false;
    this.paint();
    try {
      await this.audio.play();
    } catch (error) {
      if (error.name !== "AbortError")
        this.game.toast(
          error.name === "NotAllowedError"
            ? this.game.s.listen
            : this.game.s.missingMedia,
        );
    }
  }
  toggle() {
    if (!this.item) return;
    if (this.audio.paused) this.start(this.item);
    else this.audio.pause();
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
  async next(kind) {
    clearTimeout(this.advanceTimer);
    if (this.busy) return;
    const current = document.getElementById("world-content").hidden
      ? this.item
      : this.fromPage() || this.item;
    kind ||= current?.kind;
    if (!["cuento", "chiste", "expresion", "taramundi"].includes(kind)) return;
    if (!this.game.rooms.contains(this.game.rooms.forKind(kind))) return;
    this.busy = true;
    try {
      if (kind === "taramundi") {
        if (current?.nextUrl)
          await this.game.site.navigate(current.nextUrl, { play: true });
        return;
      }
      const heard =
        window.Magikitos?.oidos?.leer(kind, this.game.config.locale) || [];
      const exclude = new Set(heard.map(Number));
      if (current?.kind === kind) exclude.add(current.id);
      let queue = (this.queues.get(kind) || []).filter(
        (item) => !exclude.has(item.id),
      );
      if (!queue.length) {
        const round = this.rounds.get(kind) || 2;
        const params = new URLSearchParams({
          kind,
          lang: this.game.config.locale,
          round,
          exclude: [...exclude].slice(-500).join(","),
        });
        const response = await fetch("/api/world/discover?" + params);
        if (!response.ok) throw new Error("Discovery unavailable");
        queue = (await response.json()).items;
        this.rounds.set(kind, round + 1);
      }
      const next = queue.shift();
      this.queues.set(kind, queue);
      if (!next) {
        this.game.toast(this.game.s.empty);
        return;
      }
      const open = !document.getElementById("world-content").hidden;
      if (open)
        await this.game.site.navigate(next.url, { play: true, piece: next });
      else await this.start(next);
    } catch (_) {
      this.game.toast(this.game.s.loadError);
    } finally {
      this.busy = false;
    }
  }
  previous() {
    const item = this.fromPage() || this.item;
    if (!item || !this.game.rooms.contains(this.game.rooms.forKind(item.kind)))
      return;
    const history =
      window.Magikitos?.oidos?.leer(item.kind, this.game.config.locale) || [];
    const at = history.lastIndexOf(item.id);
    const id = history[at > 0 ? at - 1 : history.length - 2];
    if (!["cuento", "chiste"].includes(item.kind)) return;
    const choice = id ? { id } : { direction: "prev", current: item.id };
    fetch(
      "/api/audio-next?" +
        new URLSearchParams({
          kind: item.kind,
          lang: this.game.config.locale,
          ...choice,
        }),
    )
      .then((r) => r.json())
      .then(
        (data) => data.url && this.game.site.navigate(data.url, { play: true }),
      )
      .catch(() => this.game.toast(this.game.s.loadError));
  }
  track(event, extra = {}) {
    if (!this.item) return;
    window.Magikitos?.analyticsTrack?.(event, {
      content_type: this.item.kind,
      content_id: this.item.id,
      value: { via: "world", voz: this.item.voiceId || null, ...extra },
    });
  }
  duration() {
    return this.item?.duration > 0
      ? this.item.duration
      : Number.isFinite(this.audio.duration)
        ? this.audio.duration
        : 0;
  }
  revealVote(button = this.button) {
    const card = button?.closest(".voice-card, .audio-card, .ranking__fila");
    if (!card) return;
    card
      .querySelectorAll(
        "[data-audio-card-rating], [data-rating-despues], [data-voz-setas]",
      )
      .forEach((el) => el.classList.remove("hidden"));
    card
      .querySelectorAll("[data-rating-antes]")
      .forEach((el) => el.classList.add("hidden"));
  }
  paint() {
    const playing = Boolean(this.item && !this.audio.paused);
    document
      .querySelectorAll("[data-world-auto],#listening-auto")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(Boolean(this.auto))),
      );
    const experience = document.querySelector(
      "#world-content[data-presentation=experience]:not([hidden]) .world-experience",
    );
    this.bar.classList.toggle("world-listening--compact", Boolean(experience));
    const byId = (id) => document.getElementById(id);
    byId("listening-play").textContent = playing ? "Ⅱ" : "▶";
    byId("listening-play").setAttribute(
      "aria-label",
      playing ? this.game.s.pause : this.game.s.listen,
    );
    if (this.item) {
      byId("listening-title").textContent = this.item.title;
      byId("listening-kind").textContent =
        this.game.s[
          {
            cuento: "stories",
            chiste: "jokes",
            expresion: "expressions",
            taramundi: "stories",
            historia: "workshop",
          }[this.item.kind]
        ];
      byId("listening-next").hidden =
        this.item.kind === "historia" ||
        (this.item.kind === "taramundi" && !this.item.nextUrl);
    }
    const duration = this.duration();
    const format = (seconds) =>
      Math.floor(seconds / 60) +
      ":" +
      String(Math.floor(seconds % 60)).padStart(2, "0");
    byId("listening-time").textContent = format(this.audio.currentTime || 0);
    byId("listening-duration").textContent = format(duration);
    byId("listening-seek").disabled = !duration;
    byId("listening-seek").value = duration
      ? (this.audio.currentTime / duration) * 1000
      : 0;
    const current = this.fromPage();
    const matching = Boolean(
      current?.audio && current.audio === this.item?.audio,
    );
    document.querySelectorAll("[data-world-seek]").forEach((input) => {
      input.disabled = !matching || !duration;
      input.value =
        matching && duration ? (this.audio.currentTime / duration) * 1000 : 0;
    });
    document
      .querySelectorAll("[data-world-elapsed]")
      .forEach(
        (el) =>
          (el.textContent = format(matching ? this.audio.currentTime : 0)),
      );
    document
      .querySelectorAll("[data-world-duration]")
      .forEach(
        (el) =>
          (el.textContent = format(
            matching ? duration : current?.duration || 0,
          )),
      );
    document
      .querySelectorAll(
        "[data-world-play], [data-audio-card-play], .audio-btn[data-audio-src]",
      )
      .forEach((button) => {
        const item = this.fromButton(button);
        const active = Boolean(playing && item?.audio === this.item.audio);
        button.classList.toggle("is-playing", active);
        button.setAttribute("aria-pressed", String(active));
        const icon = button.querySelector("i");
        if (icon)
          icon.className = "fa-solid " + (active ? "fa-pause" : "fa-play");
        const label = button.querySelector("[data-world-play-label]");
        if (label)
          label.textContent = active ? this.game.s.pause : this.game.s.listen;
        const voice = button.closest(".voice-player");
        if (voice) {
          voice.classList.toggle("is-playing", active);
          const progress =
            item?.audio === this.item?.audio && duration
              ? Math.min(1, this.audio.currentTime / duration)
              : 0;
          voice.style.setProperty("--progress", `${progress * 100}%`);
        }
      });
  }
}
module.exports = { WorldMedia };
