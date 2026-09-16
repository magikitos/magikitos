"use strict";
/** Browser storage names are a documented interface shared with the website, not its JS runtime. */
const SESSION_KEY = "magikitos_session";
class Session {
  constructor(storage) {
    try {
      this.storage = storage || localStorage;
    } catch (_) {}
    this.memory = "";
  }
  get() {
    try {
      const value = this.storage.getItem(SESSION_KEY);
      return typeof value === "string" && value.length <= 4096 ? value : "";
    } catch (_) {
      return this.memory;
    }
  }
  set(token) {
    if (typeof token !== "string" || !token || token.length > 4096) return;
    this.memory = token;
    try {
      this.storage.setItem(SESSION_KEY, token);
    } catch (_) {}
  }
}
class Heard {
  constructor(locale, storage) {
    this.locale = locale;
    try {
      this.storage = storage || localStorage;
    } catch (_) {}
  }
  key(kind) {
    return "mgk_heard_" + kind + "_" + this.locale;
  }
  get(kind) {
    try {
      const value = JSON.parse(this.storage.getItem(this.key(kind)) || "[]");
      return Array.isArray(value)
        ? value.filter((n) => Number.isSafeInteger(n) && n > 0).slice(-400)
        : [];
    } catch (_) {
      return [];
    }
  }
  add(kind, id) {
    if (!Number.isSafeInteger(id) || id < 1) return;
    const items = this.get(kind);
    if (!items.includes(id)) items.push(id);
    try {
      this.storage.setItem(this.key(kind), JSON.stringify(items.slice(-400)));
    } catch (_) {}
  }
}
module.exports = { Session, Heard, SESSION_KEY };
