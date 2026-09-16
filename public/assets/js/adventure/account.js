"use strict";
const byId = (id) => document.getElementById(id);

/** Identity uses the public API and the shared browser-session contract, never a website bundle. */
class Account {
  constructor(game) {
    this.game = game;
    this.user = null;
    this.loaded = false;
    this.busy = false;
    const claim = byId("self-claim");
    if (claim) claim.addEventListener("click", () => this.claim());
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
      // not a reason to tell the player they have no corner.
    } finally {
      this.busy = false;
      this.paint();
    }
  }

  /** Mints, on an explicit click only. */
  async claim() {
    if (this.busy) return;
    this.busy = true;
    this.note(this.game.text("identityBusy"));
    this.button(false);
    try {
      const token = await this.game.proof.request();
      const data = await this.post({
        create: true,
        turnstile_token: token || "",
      });
      if (!data || !data.ok) {
        this.note(
          this.game.text(
            data && data.error === "too_many"
              ? "identityTooMany"
              : "identityError",
          ),
        );
        this.button(true);
        return;
      }
      this.user = data.user || null;
      this.loaded = true;
      this.loadedToken = this.game.session.get();
    } catch (error) {
      this.note(
        this.game.text(
          error.code === "too_many" || error.status === 429
            ? "identityTooMany"
            : "identityError",
        ),
      );
      this.button(true);
      return;
    } finally {
      this.busy = false;
    }
    this.paint();
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

  button(shown) {
    const el = byId("self-claim");
    if (el) el.hidden = !shown;
  }

  paint() {
    const section = byId("self-identity");
    if (!section) return;
    section.hidden = false;
    const link = byId("self-account-link"),
      url = this.game.config.destinations.account;
    if (link && url) {
      link.href = url;
      link.hidden = false;
    }
    const name = byId("self-identity-name"),
      handle = byId("self-identity-handle"),
      avatar = byId("self-identity-avatar");

    if (!this.user) {
      if (name) name.textContent = "";
      if (handle) handle.hidden = true;
      if (avatar) avatar.hidden = true;
      this.note(this.game.text("identityNone"));
      this.button(true);
      return;
    }

    if (name)
      name.textContent = this.game
        .text("identityMine")
        .replace(":name", this.user.name || "");
    if (handle) {
      const h = this.user.handle;
      handle.hidden = !h;
      if (h)
        handle.textContent = this.game
          .text("identityHandle")
          .replace(":handle", "/u/" + h);
    }
    // The portrait is painted later by the avatar cron, so null is the normal
    // case for a corner made seconds ago and must not leave a broken image.
    if (avatar) {
      const url = this.user.avatar_url;
      avatar.hidden = !url;
      const safe = this.game.api.url(url);
      avatar.hidden = !safe;
      if (safe) avatar.src = safe;
    }
    this.note("");
    this.button(false);
  }
}

module.exports = { Account };
