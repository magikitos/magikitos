"use strict";
const { operationId } = require("./ids");
const { ambiguous } = require("./api");
const KEY = "magikitos.adventure.forest-action";
const ENDPOINTS = new Set(["forest-relief", "forest-message"]);

/** One durable, unacknowledged intent, not another inventory. A lost reply is retried byte for
 * byte; a definitive revision rejection may be rebased once. Never carries credentials. */
class ForestActions {
  constructor(game, storage = localStorage, validate = () => {}) {
    this.game = game;
    this.storage = storage;
    this.validate = validate;
    this.pending = null;
    this.busy = false;
    try {
      const value = JSON.parse(storage.getItem(KEY));
      if (ENDPOINTS.has(value?.endpoint) && (typeof value.owner === "string" || Number.isSafeInteger(value.owner)) &&
          /^[a-f0-9]{32}$/.test(value.request?.operationId) &&
          Number.isSafeInteger(value.request.baseRevision)) this.pending = value;
    } catch (_) {}
  }
  get ownPending() { return this.pending?.owner === this.game.cloud.owner ? this.pending : null; }
  remember(value) {
    // Refuse a new mutation when it cannot be journalled: otherwise a reload after a lost
    // acknowledgement could spend twice. Preserve the previous identity's unresolved intent.
    if (this.pending && value && this.pending.owner !== value.owner) {
      let archive = [];
      try { archive = JSON.parse(this.storage.getItem(KEY + ".recovery") || "[]"); } catch (_) {}
      if (!Array.isArray(archive)) archive = [];
      this.storage.setItem(KEY + ".recovery", JSON.stringify([...archive, this.pending].slice(-3)));
    }
    if (value) this.storage.setItem(KEY, JSON.stringify(value));
    else this.storage.removeItem(KEY);
    this.pending = value;
  }
  async run(endpoint, payload) {
    if (!ENDPOINTS.has(endpoint)) throw Error("invalid_forest_action");
    if (this.busy || this.ownPending) throw Error("forest_action_pending");
    return this.perform(async current => {
      if (!(await this.game.materials.ready())) throw Error("materials_pending");
      if (!current()) throw Error("identity_changed");
      this.remember({ owner: this.game.cloud.owner, endpoint,
        request: { ...payload, operationId: operationId(), baseRevision: this.game.materials.account.revision } });
    });
  }
  async retry() {
    if (this.busy || !this.ownPending) throw Error("forest_action_pending");
    return this.perform();
  }
  async perform(prepare) {
    const g = this.game, owner = g.cloud.owner, token = g.session.get();
    const current = () => owner === g.cloud.owner && token === g.session.get() && !g.cloud.conflict;
    if (!owner || !token || g.cloud.conflict) throw Error("identity_required");
    this.busy = true;
    try {
      await prepare?.(current);
      if (!current()) throw Error("identity_changed");
      for (let attempt = 0; attempt < 2; attempt++) {
        const intent = this.ownPending;
        if (!intent) throw Error("identity_changed");
        try {
          const data = await g.api.request(intent.endpoint, intent.request, { auth: true });
          if (!current()) throw Error("identity_changed");
          if (!Number.isSafeInteger(data.account?.revision) || data.account.revision < 0 || !data.account.inventory)
            throw Error("invalid_account");
          this.validate({ ...intent, data });
          // Other validated actions may have completed while this reply was in flight.
          if (!g.materials.account || data.account?.revision >= g.materials.account.revision)
            g.materials.accept(data.account);
          g.materials.reconcile();
          this.remember(null);
          return { ...intent, data };
        } catch (error) {
          if (!current()) throw Error("identity_changed");
          if (error.code === "account_conflict" && error.details?.account && prepare && attempt === 0) {
            g.materials.accept(error.details.account);
            this.remember({ ...intent, request: { ...intent.request, operationId: operationId(),
              baseRevision: error.details.account.revision } });
            continue;
          }
          // An old ambiguous intent must NEVER become a new operation on retry. Its receipt
          // may have aged out of the account's bounded journal; an old revision then rejects
          // safely instead of spending another leaf when the body becomes due again.
          if (error.code === "account_conflict" && error.details?.account) {
            if (error.details.account.revision >= g.materials.account.revision) g.materials.accept(error.details.account);
            g.materials.reconcile();
          }
          if (!ambiguous(error)) this.remember(null);
          throw error;
        }
      }
    } finally { this.busy = false; }
  }
}
module.exports = { ForestActions };
