"use strict";
const { cleanSave } = require("./save");
const { validateLayout } = require("./homestead-layout");
const KEY = "magikitos.adventure.sync";
const id = () =>
  [...crypto.getRandomValues(new Uint8Array(16))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
const same = (a, b) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const byId = (name) => document.getElementById(name);

/** Debounced private snapshots, not analytics. CAS detects other tabs/devices; retries are idempotent. */
class CloudSave {
  constructor(game) {
    this.game = game;
    this.owner = null;
    this.epoch = 0;
    this.busy = false;
    this.conflict = null;
    this.recoveries = [];
    this.meta = {};
    this.hadLocalSave = false;
    this.archivedLayout = null;
    // One controlled migration: old private layouts are recoverable data, never a live private world.
    try {
      const old = JSON.parse(localStorage.getItem("magikitos.adventure.home"));
      if (old)
        this.archivedLayout = validateLayout(old, game.catalog.homesteads);
    } catch (_) {}
    try {
      this.hadLocalSave = Boolean(localStorage.getItem("magikitos.adventure"));
      const v = JSON.parse(localStorage.getItem(KEY));
      if (
        v &&
        typeof v === "object" &&
        Number.isSafeInteger(v.owner) &&
        v.owner > 0 &&
        Number.isSafeInteger(v.revision) &&
        v.revision >= 0
      ) {
        this.meta = v;
        this.meta.backups = Array.isArray(v.backups)
          ? v.backups
              .filter((b) => b && Number.isSafeInteger(b.at) && b.state)
              .slice(-3)
          : [];
      }
    } catch (_) {
      /* Local gameplay does not depend on cloud metadata. */
    }
    byId("cloud-connect").addEventListener("click", () => this.connect(true));
    byId("cloud-remote").addEventListener("click", () =>
      this.resolve("remote"),
    );
    byId("cloud-local").addEventListener("click", () => this.resolve("local"));
    window.addEventListener("online", () =>
      this.owner ? this.flush() : this.connect(false),
    );
    window.addEventListener("storage", (e) => {
      if (e.key === "magikitos_session") {
        this.epoch++;
        this.owner = null;
        this.conflict = null;
        clearTimeout(this.timer);
        this.timer = null;
        this.connect(false);
      }
    });
  }
  snapshot() {
    return {
      state: JSON.parse(JSON.stringify(this.game.state)),
      parcel: this.archivedLayout
        ? JSON.parse(JSON.stringify(this.archivedLayout))
        : null,
    };
  }
  validProfile(value) {
    if (
      !value ||
      !/^[a-f0-9]{32}$/.test(value.id) ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 1
    )
      throw new Error("invalid_profile");
    return {
      id: value.id,
      revision: value.revision,
      state: cleanSave(value.state, this.game.catalog),
      parcel: value.parcel
        ? validateLayout(value.parcel, this.game.catalog.homesteads)
        : null,
    };
  }
  persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.meta));
    } catch (_) {
      this.status = "cloudError";
    }
  }
  async connect(create = false) {
    const g = this.game,
      epoch = ++this.epoch;
    try {
      if (create) {
        await g.self.account.read();
        if (!g.self.account.user) await g.self.account.claim();
      }
      if (!g.session.get()) {
        this.paint();
        return;
      }
      const identity = await g.api.request(
        "identity",
        {},
        { auth: true, timeout: 2500 },
      );
      if (epoch !== this.epoch) return;
      if (!identity.user) {
        this.owner = null;
        this.status = "cloudError";
        this.paint();
        return;
      }
      this.owner = identity.user.id;
      const data = await g.api.request(
        "game-state",
        {},
        { auth: true, timeout: 3500 },
      );
      if (epoch !== this.epoch) return;
      this.recoveries = Array.isArray(data.recoveries) ? data.recoveries : [];
      const profile = data.profile ? this.validProfile(data.profile) : null;
      const local = this.snapshot(),
        bound = !this.meta.owner || this.meta.owner === this.owner;
      // A response may have been lost just before a reload. Replay its receipt before
      // treating the newer server revision as a competing device's edit.
      if (bound && this.meta.pending && this.meta.owner === this.owner) {
        await this.flush();
        this.paint();
        return;
      }
      const changed = this.meta.base
        ? !same(local, this.meta.base)
        : this.hadLocalSave;
      const remoteUnchanged =
        profile?.id === this.meta.id &&
        profile?.revision === this.meta.revision;
      // Never upload the previous person's progress into a newly selected account automatically.
      if (
        !bound ||
        (profile &&
          changed &&
          !remoteUnchanged &&
          !same(local, { state: profile.state, parcel: profile.parcel }))
      ) {
        this.conflict = { profile, local };
        this.status = "cloudConflict";
        if (g.ready) g.toast(g.text("cloudConflict"));
        if (create && !byId("self-dialog").open)
          byId("self-dialog").showModal();
      } else if (profile && changed && remoteUnchanged) {
        // Offline/local edits have no rival when the acknowledged server revision
        // is still current. Keep them and let the usual debounce upload them.
        this.status = "cloudOffline";
        if (g.ready) this.mark();
      } else {
        if (profile) {
          await this.apply(profile);
          this.accept(profile);
        } else
          this.meta = {
            owner: this.owner,
            id: null,
            revision: 0,
            base: null,
            backups: this.meta.backups || [],
          };
        this.persist();
        this.status = profile ? "cloudSaved" : "cloudOffline";
        if (g.ready) this.mark();
      }
    } catch (_) {
      if (epoch === this.epoch) {
        this.owner = null;
        this.status = "cloudOffline";
      }
    }
    this.paint();
  }
  accept(profile, base = { state: profile.state, parcel: profile.parcel }) {
    this.meta = {
      ...this.meta,
      owner: this.owner,
      id: profile.id,
      revision: profile.revision,
      base,
      pending: null,
    };
  }
  async apply(profile) {
    const g = this.game;
    const next = cleanSave(profile.state, g.catalog);
    const layout = validateLayout(
      profile.parcel || g.catalog.homesteads.initial,
      g.catalog.homesteads,
    );
    g.scenes.cache.clear();
    if (g.ready) {
      g.pauseMovement();
      g.transitioning = true;
      try {
        const prepared = await g.scenes.prepare(
          next.scene,
          next.position,
          next,
        );
        g.state = next;
        g.scenes.enter(prepared);
      } catch (error) {
        throw error;
      } finally {
        g.transitioning = false;
      }
    } else g.state = next;
    this.archivedLayout = profile.parcel ? layout : null;
    try {
      if (this.archivedLayout)
        localStorage.setItem(
          "magikitos.adventure.home",
          JSON.stringify(this.archivedLayout),
        );
    } catch (_) {}
    g.dirty = true;
    if (g.ready) {
      g.updateUI();
      g.save();
    }
  }
  mark() {
    if (
      !this.owner ||
      this.conflict ||
      this.owner !== this.meta.owner ||
      this.game.community?.busy
    )
      return;
    this.status = "cloudOffline";
    if (!this.timer)
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush();
      }, 10000);
    this.paint();
  }
  async flush() {
    if (
      this.busy ||
      !this.owner ||
      this.owner !== this.meta.owner ||
      this.conflict ||
      this.game.community?.busy
    )
      return;
    const current = this.snapshot();
    if (!this.meta.pending && same(current, this.meta.base)) {
      this.status = "cloudSaved";
      this.paint();
      return;
    }
    const epoch = this.epoch;
    this.busy = true;
    this.meta.pending ||= {
      profileId: this.meta.id || null,
      baseRevision: this.meta.revision || 0,
      operationId: id(),
      ...current,
    };
    this.persist();
    const sent = this.meta.pending;
    try {
      const data = await this.game.api.request("game-save", sent, {
        auth: true,
      });
      if (epoch !== this.epoch) return;
      const profile = this.validProfile(data.profile);
      if (profile.revision !== data.acknowledgedRevision) {
        this.conflict = { profile, local: this.snapshot() };
        this.status = "cloudConflict";
      } else {
        this.accept(profile, { state: sent.state, parcel: sent.parcel });
        this.status = "cloudSaved";
        this.persist();
        if (!same(this.snapshot(), this.meta.base)) this.mark();
      }
    } catch (error) {
      if (epoch !== this.epoch) return;
      if (error.status === 409) {
        const data = await this.game.api
          .request("game-state", {}, { auth: true })
          .catch(() => null);
        if (epoch !== this.epoch) return;
        this.conflict = {
          profile: data?.profile ? this.validProfile(data.profile) : null,
          local: this.snapshot(),
        };
        this.status = "cloudConflict";
      } else {
        this.status = "cloudOffline";
        if (error.status === 401) this.owner = null;
        else if (error.status === 400) {
          this.meta.pending = null;
          this.status = "cloudError";
          this.persist();
        } else if (!this.timer)
          this.timer = setTimeout(() => {
            this.timer = null;
            this.flush();
          }, 30000);
      }
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  async resolve(choice) {
    if (!this.conflict || this.busy) return;
    const { profile, local } = this.conflict;
    if (choice === "remote" && !profile) return;
    if (choice === "remote") {
      try {
        await this.apply(profile);
      } catch (_) {
        this.status = "cloudError";
        this.paint();
        return;
      }
    }
    const kept =
      choice === "remote"
        ? local
        : profile && { state: profile.state, parcel: profile.parcel };
    this.meta.backups = [
      ...(Array.isArray(this.meta.backups) ? this.meta.backups : []),
      ...(kept ? [{ at: Date.now(), ...kept }] : []),
    ].slice(-3);
    this.conflict = null;
    if (profile) this.accept(profile);
    else
      this.meta = {
        ...this.meta,
        owner: this.owner,
        id: null,
        revision: 0,
        base: null,
        pending: null,
      };
    this.persist();
    if (choice === "remote") this.status = "cloudSaved";
    else await this.flush();
    this.paint();
  }
  async restore(record) {
    if (this.busy || this.conflict) return;
    try {
      this.busy = true;
      const data = await this.game.api.request(
        "game-restore",
        {
          profileId: record.id,
          currentId: this.meta.id,
          baseRevision: this.meta.revision,
        },
        { auth: true },
      );
      const profile = this.validProfile(data.profile);
      this.accept(profile);
      await this.apply(profile);
      this.recoveries = data.recoveries || [];
      this.persist();
      this.status = "cloudSaved";
    } catch (_) {
      this.status = "cloudError";
    } finally {
      this.busy = false;
      this.paint();
    }
  }
  async recoverLocal(backup) {
    if (this.busy || this.conflict) return;
    const before = this.snapshot();
    try {
      await this.apply(backup);
      this.meta.backups = [
        ...(this.meta.backups || []),
        { at: Date.now(), ...before },
      ].slice(-3);
      this.meta.pending = null;
      this.persist();
      await this.flush();
    } catch (_) {
      this.status = "cloudError";
    }
    this.paint();
  }
  paint() {
    byId("cloud-status").textContent = this.game.text(
      this.status || "cloudOffline",
    );
    byId("cloud-connect").hidden = Boolean(this.owner);
    byId("cloud-conflict").hidden = !this.conflict;
    byId("cloud-remote").disabled = !this.conflict?.profile;
    const list = byId("cloud-recoveries");
    list.replaceChildren();
    for (const record of this.recoveries) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${this.game.text("cloudRecovery")} · ${record.updatedAt || record.id.slice(0, 8)}`;
      button.addEventListener("click", () => this.restore(record));
      list.append(button);
    }
    for (const backup of this.meta.backups || []) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${this.game.text("cloudRecovery")} · ${new Date(backup.at).toLocaleString(this.game.config.locale)}`;
      button.addEventListener("click", () => this.recoverLocal(backup));
      list.append(button);
    }
  }
}
module.exports = { CloudSave };
