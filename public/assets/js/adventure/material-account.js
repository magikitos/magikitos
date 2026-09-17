"use strict";
const KEY = "magikitos.adventure.actions";
const operationId = () => crypto.randomUUID().replaceAll("-", "");
const MUTATIONS = new Set([
  "item",
  "flag",
  "collect",
  "timer",
  "reward",
  "spend",
]);
/** Bounded durable outbox. Server validates each recipe/pickup; local snapshots
 * are never submitted as a request to mint community materials. */
class MaterialAccount {
  constructor(game) {
    this.game = game;
    this.account = null;
    this.owner = null;
    this.queue = [];
    this.busy = null;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && Array.isArray(saved.queue) && saved.queue.length <= 192) {
        this.queue = saved.queue;
        this.owner = saved.owner;
      }
    } catch (_) {}
    window.addEventListener("online", () => this.flush());
  }
  persist() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ owner: this.owner, queue: this.queue }),
      );
    } catch (_) {
      this.game.toast(this.game.text("unsaved"));
    }
  }
  record(scene, entity, context, rule) {
    if (!rule?.effects?.some((e) => MUTATIONS.has(e.type))) return;
    if (this.queue.length >= 192) {
      this.game.toast(this.game.text("communitySyncNeeded"));
      return;
    }
    this.queue.push({
      operationId: operationId(),
      scene,
      entity: entity.id,
      action: context.action || "interact",
    });
    this.persist();
    this.flush();
  }
  canRecord(rule) {
    return (
      !rule?.effects?.some((e) => MUTATIONS.has(e.type)) ||
      this.queue.length < 192
    );
  }
  async connect(create = false) {
    const g = this.game;
    if (create && !g.cloud.owner) await g.cloud.connect(true);
    if (!g.cloud.owner || !g.session.get() || g.cloud.conflict) return false;
    const owner = g.cloud.owner,
      token = g.session.get();
    if (this.owner !== null && this.owner !== g.cloud.owner) {
      // Never attribute another identity's queued gameplay to the new account.
      if (this.queue.length) {
        try {
          const archives = JSON.parse(
            localStorage.getItem(KEY + ".recovery") || "[]",
          );
          archives.push({ owner: this.owner, queue: this.queue });
          localStorage.setItem(
            KEY + ".recovery",
            JSON.stringify(archives.slice(-3)),
          );
        } catch (_) {}
      }
      this.queue = [];
    }
    this.owner = g.cloud.owner;
    const result = await g.api.request("game-account", {}, { auth: true });
    if (owner !== g.cloud.owner || token !== g.session.get()) return false;
    this.token = token;
    this.accept(result.account);
    // Browser-only saves from before server authority have no frozen server
    // snapshot. Re-establish finite tool/quest entitlements through the same
    // validated commands, never upload an arbitrary balance/material count.
    if (
      this.account.revision === 0 &&
      !this.queue.length &&
      !Object.keys(this.account.inventory).length &&
      !this.account.setines &&
      !Object.keys(this.account.progress.flags || {}).length
    )
      this.recoverLocalTools();
    this.persist();
    return true;
  }
  accept(value) {
    if (
      !value ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 0 ||
      !value.inventory
    )
      throw Error("invalid_account");
    this.account = value;
  }
  recoverLocalTools() {
    const s = this.game.state,
      commands = [];
    const add = (entity, action = "interact", scene = "overworld") =>
      commands.push({ scene, entity, action, operationId: operationId() });
    const fed = s.flags.picnicFed || s.inventory.boat;
    const cooked = fed || s.flags.skewerCooked || s.inventory.skewer;
    const lit = cooked || s.flags.fireLit;
    if (s.inventory.twig || cooked) add("picnic-twig");
    if (s.inventory.lighter || lit) add("picnic-lighter");
    if (s.inventory.knife || cooked || s.inventory.mushroom)
      add("picnic-knife");
    if (s.inventory.mushroom || cooked) add("picnic-mushroom");
    if (lit) add("picnic-barbecue", "light");
    if (cooked) add("picnic-barbecue", "cook");
    if (fed) add("picnic-neighbor", "give");
    if (s.inventory.bottle || s.inventory.boat) add("picnic-bin");
    if (s.inventory.boat) add("river-dock", "craft");
    if (s.inventory.boat && s.flags.bowlFound)
      add("cat-water-bowl", "interact", "human-hedge");
    if (s.inventory.boat && s.flags.seedsFound)
      add("garden-seeds", "interact", "human-hedge");
    if (commands.length) this.queue.push(...commands);
  }
  async flush() {
    if (this.busy) return this.busy;
    clearTimeout(this.retryTimer);
    this.busy = Promise.resolve().then(async () => {
      try {
        if (
          (!this.account ||
            this.owner !== this.game.cloud.owner ||
            this.token !== this.game.session.get()) &&
          !(await this.connect())
        )
          return;
        if (this.game.cloud.conflict) return;
        let conflicts = 0;
        while (this.queue.length) {
          if (
            this.owner !== this.game.cloud.owner ||
            this.token !== this.game.session.get()
          ) {
            this.account = null;
            return;
          }
          const entry = this.queue[0];
          entry.baseRevision ??= this.account.revision;
          this.persist();
          try {
            const result = await this.game.api.request("game-action", entry, {
              auth: true,
            });
            if (
              this.owner !== this.game.cloud.owner ||
              this.token !== this.game.session.get()
            ) {
              this.account = null;
              return;
            }
            this.accept(result.account);
            this.queue.shift();
            this.persist();
          } catch (error) {
            if (error.code === "account_conflict" && error.details?.account) {
              this.accept(error.details.account);
              delete entry.baseRevision;
              this.persist();
              if (++conflicts < 3) continue;
              return;
            }
            if (
              [
                "already_collected",
                "unavailable",
                "no_material_action",
              ].includes(error.code)
            ) {
              this.queue.shift();
              this.persist();
              continue;
            }
            this.error = error.code || "offline";
            this.retry(error);
            return;
          }
        }
        this.error = null;
        this.reconcile();
      } catch (error) {
        this.error = error.code || "offline";
        this.retry(error);
      } finally {
        this.busy = null;
      }
    });
    return this.busy;
  }
  retry(error) {
    if ((!error.status || error.status === 429 || error.status >= 500) && this.queue.length) {
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.flush(), 30000);
      this.retryTimer.unref?.(); // Node fixtures must not outlive their assertions.
    }
  }
  async ready() {
    if (!(await this.connect(true))) return false;
    await this.flush();
    return !this.queue.length && !this.error;
  }
  reconcile() {
    const g = this.game,
      a = this.account;
    if (!a || this.queue.length || g.cloud.conflict) return;
    // Migration recovery preserves the private pre-authority bag before replacing
    // counters with authoritative materials. Never overwrite the archive on retry.
    try {
      if (!localStorage.getItem(KEY + ".first-bank"))
        localStorage.setItem(
          KEY + ".first-bank",
          JSON.stringify({ owner: this.owner, state: g.state }),
        );
    } catch (_) {}
    g.state.inventory = { ...a.inventory };
    Object.assign(g.state.flags, a.progress.flags || {});
    Object.assign(g.state.timers, a.progress.timers || {});
    g.state.resources = { ...a.resources };
    g.state.wallet = {
      balance: a.setines,
      claimed: { ...(a.progress.rewards || {}) },
    };
    g.world?.refresh(g.state);
    g.dirty = true;
    if (g.ready) {
      g.updateUI();
      g.save();
    }
  }
}
module.exports = { MaterialAccount, operationId };
