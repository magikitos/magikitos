"use strict";
const { el, button, websiteLink } = require("./dom");
const { activity } = require("./activities");
/** The existing guardian conversation, presented by a visitor in the world. No embedded website. */
class GuardianChat {
  constructor(game) {
    this.game = game;
    this.item = null;
    this.arriving = false;
  }
  summon(item) {
    if (!this.game.rooms.contains("expressions")) return;
    this.item = item;
    this.game.summonGuardian();
    if (this.game.guardian) {
      this.game.guardian.onInteract = () => this.open();
      this.arriving = true;
    } else this.open();
  }
  update() {
    if (!this.arriving) return;
    const g = this.game;
    if (!g.guardian || !g.rooms.contains("expressions")) {
      this.arriving = false;
      return;
    }
    if (!g.guardian.path.length && !g.transitioning) {
      this.arriving = false;
      this.open();
    }
  }
  open() {
    const g = this.game,
      item = this.item,
      request = g.site.begin("expressions");
    if (!request || !item) return;
    this.arriving = false;
    const root = activity(g, "expressions", g.text("guardianName"));
    root.classList.add("world-native-guardian");
    const log = el("div", {
      class: "world-native-chat",
      role: "log",
      "aria-live": "polite",
    });
    const say = (who, text) => {
      log.append(
        el("p", {
          class: who === "humano" ? "world-chat-you" : "world-chat-guardian",
          text,
        }),
      );
      log.scrollTop = log.scrollHeight;
    };
    say("magikito", g.text("guardianIntro").replace(":term", item.title));
    const input = el("textarea", {
      rows: 2,
      maxlength: 300,
      placeholder: g.text("guardianPrompt"),
      "aria-label": g.text("guardianPrompt"),
    });
    const send = el("button", {
      type: "submit",
      class: "world-primary",
      text: g.text("send"),
    });
    const status = el("p", {
      role: "status",
      class: "world-experience-byline",
    });
    const form = el("form", { class: "world-native-chat-form" }, [input, send]);
    let busy = false,
      submitted = false;
    form.onsubmit = async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (busy || !text) return;
      busy = true;
      submitted = true;
      input.disabled = send.disabled = true;
      send.textContent = g.text("sending");
      status.textContent = "";
      try {
        const [csrf, proof] = await Promise.all([
          g.api.request("csrf", {}, { auth: true }),
          g.proof.request(),
        ]);
        // Never cancel a sent write just because the surface closed: its returned identity must be adopted.
        const data = await g.api.request(
          "guardian",
          {
            lang: g.config.locale,
            term_id: item.id,
            texto: text,
            csrf_token: csrf.csrf_token,
            turnstile_token: proof,
          },
          { auth: true, timeout: 60000 },
        );
        if (!data.ok || typeof data.texto !== "string")
          throw Error("invalid_guardian_reply");
        if (request.signal.aborted) return;
        say("humano", text);
        say("magikito", data.texto);
        input.value = "";
        if (data.despedida) form.hidden = true;
      } catch (_) {
        if (!request.signal.aborted)
          status.textContent = g.text("guardianError");
      } finally {
        busy = false;
        input.disabled = send.disabled = false;
        send.textContent = g.text("send");
      }
    };
    root.append(
      log,
      form,
      status,
      el("p", {
        class: "world-experience-byline",
        text: g.text("guardianPrivacy"),
      }),
      el("div", { class: "world-experience-links" }, [
        websiteLink(g, g.text("sendExpression") + " ↗", item.url),
        button(g.text("backToMoment"), () => g.site.showPiece(item)),
      ]),
    );
    g.site.current = { group: "expressions", guardian: true, path: item.url };
    g.site.mount(root, request);
    g.api
      .request(
        "guardian-thread",
        { term_id: item.id },
        { auth: true, signal: request.signal },
      )
      .then((data) => {
        if (request.signal.aborted || submitted) return;
        for (const message of (data.mensajes || []).slice(-40))
          if (typeof message.texto === "string") say(message.de, message.texto);
      })
      .catch(() => {});
  }
}
module.exports = { GuardianChat };
