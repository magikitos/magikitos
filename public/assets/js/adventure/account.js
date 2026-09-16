"use strict";
const byId = (id) => document.getElementById(id);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Identity uses the public API and the shared browser-session contract, never a website bundle.
 *
 * Two doors, the same two the website offers: Google, or a six-digit code by
 * email. Both are the website's own endpoints, so there is one account system
 * and one set of rate limits, and a player who already has a Magikitos account
 * arrives here as themselves. Minting an anonymous identity is still a separate,
 * explicit act owned by the cloud-save panel. */
class Account {
  constructor(game) {
    this.game = game;
    this.user = null;
    this.loaded = false;
    this.busy = false;
    this.email = "";
    const on = (id, event, handler) =>
      byId(id)?.addEventListener(event, handler);
    on("self-google", "click", () => this.google());
    on("self-email-form", "submit", (e) => {
      e.preventDefault();
      this.requestCode();
    });
    on("self-code-form", "submit", (e) => {
      e.preventDefault();
      this.verifyCode();
    });
    on("self-code-back", "click", () => {
      this.email = "";
      this.step("email");
      this.note("");
    });
  }

  /** The identity this browser already has, if any. Never mints. */
  async read() {
    if (
      this.busy ||
      (this.loaded && this.loadedToken === this.game.session.get())
    )
      return;
    this.busy = true;
    try {
      const data = await this.post({});
      this.user = (data && data.user) || null;
      this.loaded = true;
      this.loadedToken = this.game.session.get();
    } catch (_) {
      // A failed read leaves the section as it was: an unreachable endpoint is
      // not a reason to tell the player they have no account.
    } finally {
      this.busy = false;
      this.paint();
    }
  }

  /** Mints an anonymous identity, on an explicit click only (cloud save). */
  async claim() {
    if (this.busy) return;
    this.busy = true;
    this.note(this.game.text("identityBusy"));
    try {
      const token = await this.game.proof.request();
      const data = await this.post({
        create: true,
        turnstile_token: token || "",
      });
      if (!data || !data.ok) {
        this.note(this.game.text(this.reason(data && data.error)));
        return;
      }
      this.user = data.user || null;
      this.loaded = true;
      this.loadedToken = this.game.session.get();
      this.game.telemetry?.account("claim");
      this.note("");
    } catch (error) {
      this.note(this.game.text(this.reason(error.code, error.status)));
      return;
    } finally {
      this.busy = false;
    }
    this.paint();
  }

  /** Leaves the game to Google and comes back to this same route. Local progress
   * lives in storage, so the round trip does not lose a session. */
  async google() {
    if (this.busy) return;
    this.game.telemetry?.account("google");
    this.busy = true;
    this.note(this.game.text("authSending"));
    try {
      const data = await this.game.api.authRequest("google/prepare", {
        return: location.pathname + location.search,
        locale: this.game.config.locale,
      });
      const url = this.game.api.url(data && data.url);
      if (!url) throw Object.assign(Error("auth"), { code: data?.error });
      // Save before leaving: the trip is a full navigation away.
      this.game.save();
      location.href = url;
    } catch (error) {
      this.busy = false;
      this.note(this.game.text(this.reason(error.code, error.status)));
    }
  }

  async requestCode() {
    if (this.busy) return;
    const email = String(byId("self-email")?.value || "")
      .trim()
      .toLowerCase();
    if (!EMAIL.test(email) || email.length > 190) {
      this.note(this.game.text("authInvalidEmail"));
      return;
    }
    this.busy = true;
    this.note(this.game.text("authSending"));
    try {
      const token = await this.game.proof.request();
      await this.game.api.authRequest("request-code", {
        email,
        locale: this.game.config.locale,
        turnstile_token: token || "",
      });
      this.email = email;
      this.game.telemetry?.account("code_sent");
      this.step("code");
      this.note(this.game.text("authCodeSent").replace(":email", email));
      byId("self-code")?.focus();
    } catch (error) {
      this.note(this.game.text(this.reason(error.code, error.status)));
    } finally {
      this.busy = false;
    }
  }

  async verifyCode() {
    if (this.busy) return;
    const code = String(byId("self-code")?.value || "").replace(/\D/g, "");
    if (code.length !== 6) {
      this.note(this.game.text("authCodeInvalid"));
      return;
    }
    this.busy = true;
    this.note(this.game.text("authSending"));
    try {
      // The client adopts the returned session token; from here the browser is
      // that account everywhere, game and website alike.
      const data = await this.game.api.authRequest("verify-code", {
        email: this.email,
        code,
      });
      this.user = (data && data.user) || null;
      this.loaded = true;
      this.loadedToken = this.game.session.get();
      this.email = "";
      this.step("email");
      const field = byId("self-code");
      if (field) field.value = "";
      this.note(this.game.text("authDone"));
      this.game.telemetry?.account("done");
      this.game.telemetry?.milestone("account");
      this.paint();
      // A fresh session owns a different cloud profile: reconcile now rather
      // than leaving the panel claiming the previous one.
      this.game.cloud?.connect(false);
    } catch (error) {
      this.note(this.game.text(this.reason(error.code, error.status)));
      const field = byId("self-code");
      if (field) field.select();
    } finally {
      this.busy = false;
    }
  }

  /** Server codes the player can act on get their own line; the rest share the
   * honest generic one. */
  reason(code, status = 0) {
    return (
      {
        code_invalid: "authCodeInvalid",
        code_expired: "authCodeExpired",
        invalid_email: "authInvalidEmail",
        rate_limited: "authTooMany",
        too_many: "identityTooMany",
        google_unavailable: "authGoogleUnavailable",
        network: "authNetwork",
      }[code] || (status === 429 ? "authTooMany" : "authError")
    );
  }

  async post(body) {
    return this.game.api.request(
      "identity",
      { locale: this.game.config.locale, ...body },
      { auth: true },
    );
  }

  note(text) {
    const el = byId("self-identity-note");
    if (el) el.textContent = text || "";
  }

  step(which) {
    const email = byId("self-email-form"),
      code = byId("self-code-form");
    if (email) email.hidden = which === "code";
    if (code) code.hidden = which !== "code";
    const google = byId("self-google"),
      or = byId("self-signin-or");
    // The whole point of the code step is that nothing else competes with it.
    if (google) google.hidden = which === "code";
    if (or) or.hidden = which === "code";
  }

  /** Your name once you have one, anonymous or real — on the panel and on the
   * button that opens it. "Yo" is only the label for a browser that is nobody
   * yet. The HUD chip is short on room, so it takes the first word. */
  title() {
    const name = (this.user && this.user.name) || "";
    const panel = byId("self-title");
    if (panel) panel.textContent = name || this.game.text("self");
    const chip = byId("self-toggle");
    if (chip) {
      chip.setAttribute("aria-label", name || this.game.text("self"));
      const label = chip.querySelector("small");
      if (label)
        label.textContent = name
          ? name.split(/\s+/)[0]
          : this.game.text("self");
    }
  }

  paint() {
    this.title();
    const signin = byId("self-signin"),
      identity = byId("self-identity");
    if (!signin || !identity) return;
    const link = byId("self-account-link"),
      url = this.game.config.destinations.account;
    if (link && url) link.href = url;

    // Anonymous counts as "no account yet": the name exists but nothing brings
    // it back on another device, which is exactly what this door is for.
    const claimed = this.user && !this.user.anonymous;
    signin.hidden = Boolean(claimed);
    identity.hidden = !claimed;
    if (!claimed) this.step("email");
    if (link) link.hidden = !claimed || !url;

    // Handle and portrait belong to the identity, claimed or not: an anonymous
    // player already has both, and they sit next to the sprite, not inside the
    // block that only appears once the account is recoverable.
    const handle = byId("self-identity-handle"),
      avatar = byId("self-identity-avatar");
    if (handle) {
      const h = this.user && this.user.handle;
      handle.hidden = !h;
      if (h)
        handle.textContent = this.game
          .text("identityHandle")
          .replace(":handle", "/u/" + h);
    }
    // The portrait is painted later by the avatar cron, so null is the normal
    // case for an account made seconds ago and must not leave a broken image.
    if (avatar) {
      const safe = this.game.api.url(this.user && this.user.avatar_url);
      avatar.hidden = !safe;
      if (safe) avatar.src = safe;
    }
    // The cloud button's visibility depends on whether an identity exists, so
    // it has to be repainted by whoever learns that: this.
    this.game.cloud?.paint();
  }
}

module.exports = { Account };
