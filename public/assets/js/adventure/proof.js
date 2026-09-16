"use strict";
const { el, button } = require("./dom");
/** Lazy human proof owned by the game; the server remains the only authority. */
class HumanProof {
  constructor(game) {
    this.game = game;
    this.pending = null;
  }
  async load() {
    if (window.turnstile) return window.turnstile;
    if (!this.loading)
      this.loading = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        const timer = setTimeout(() => {
          script.remove();
          reject(Error("proof_timeout"));
        }, 12000);
        script.onload = () => {
          clearTimeout(timer);
          window.turnstile
            ? resolve(window.turnstile)
            : reject(Error("proof_unavailable"));
        };
        script.onerror = () => {
          clearTimeout(timer);
          script.remove();
          reject(Error("proof_unavailable"));
        };
        document.head.append(script);
      }).catch((error) => {
        this.loading = null;
        throw error;
      });
    return this.loading;
  }
  async request() {
    await this.game.content.bootstrap();
    const key = this.game.config.capabilities?.turnstileSiteKey;
    if (!key) return "";
    // Never share a one-use proof token between two writes.
    if (this.pending) throw Error("proof_busy");
    const job = this.run(key);
    this.pending = job;
    try {
      return await job;
    } finally {
      this.pending = null;
    }
  }
  async run(key) {
    const provider = await this.load();
    const dialog = el("dialog", {
      class: "world-modal world-proof",
      "aria-labelledby": "world-proof-title",
    });
    const host = el("div", { class: "world-proof-host" });
    let widget,
      timer,
      finished = false;
    const displaced = [];
    return new Promise((resolve, reject) => {
      const finish = (error, token = "") => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (widget !== undefined) provider.remove(widget);
        if (dialog.open) dialog.close();
        dialog.remove();
        for (const previous of displaced)
          if (previous.isConnected && !previous.open) previous.showModal();
        error ? reject(error) : resolve(token);
      };
      const show = () => {
        if (finished) return;
        for (const previous of document.querySelectorAll("dialog[open]")) {
          if (previous === dialog) continue;
          displaced.push(previous);
          previous.close();
        }
        if (!dialog.open) dialog.showModal();
        clearTimeout(timer);
        timer = setTimeout(() => finish(Error("proof_timeout")), 120000);
      };
      dialog.append(
        el("h2", {
          id: "world-proof-title",
          text: this.game.text("humanProof"),
        }),
        host,
        button(this.game.text("cancel"), () =>
          finish(Error("proof_cancelled")),
        ),
      );
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        finish(Error("proof_cancelled"));
      });
      document.body.append(dialog);
      timer = setTimeout(() => finish(Error("proof_timeout")), 15000);
      try {
        widget = provider.render(host, {
          sitekey: key,
          language: this.game.config.locale,
          theme: "dark",
          size: "compact",
          appearance: "interaction-only",
          execution: "execute",
          callback: (token) => finish(null, token),
          "before-interactive-callback": show,
          "error-callback": () => {
            finish(Error("proof_failed"));
            return true;
          },
          "expired-callback": () => finish(Error("proof_expired")),
          "timeout-callback": () => finish(Error("proof_timeout")),
        });
        if (finished) provider.remove(widget);
        else provider.execute(widget);
      } catch (error) {
        finish(error);
      }
    });
  }
}
module.exports = { HumanProof };
