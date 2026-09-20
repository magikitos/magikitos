"use strict";
const { deviceIdentity } = require("./identity");

/** What the game learns about itself, and nothing else.
 *
 * Same collector, same table and same 400-day sweep as the website: this only
 * adds the game's own vocabulary and posts it to `/api/world/telemetry`. The
 * device id is the one already in `magikito.discovery`, so a player who leaves
 * the game and browses the site is the same device on both sides.
 *
 * ⛔ WHAT IS NOT HERE, on purpose: position per frame, every key, every line of
 * dialogue read, every object looked at. Each of those is a row that nobody will
 * ever query and that has to be swept for a year. The bar for a new event is
 * that it changes a decision about the game.
 *
 * Nothing here can break play: every path is wrapped, the queue is capped, and a
 * failed send is dropped rather than retried forever. */
const MAX_QUEUE = 50;
const FLUSH_MS = 15000;
const STUCK_MS = 120000;
const CELL = 32; // Heat-map cell, in world pixels: two tiles.
const MAX_CELLS = 40;
const MINUTES = [1, 5, 15, 30];

const { uuid } = require("./ids");

class Telemetry {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.sessionUid = uuid();
    this.deviceId = deviceIdentity();
    this.startedAt = 0;
    this.acted = false;
    this.milestones = new Set();
    this.minutes = new Set();
    this.scene = null;
    this.sceneAt = 0;
    this.cells = new Map();
    this.lastAct = 0;
    this.stuckAt = 0;
    this.sampleAt = 0;
    this.url = new URL("telemetry", game.api.base).href;
    // pagehide is the only close event mobile browsers reliably fire.
    addEventListener("pagehide", () => this.end());
    this.timer = setInterval(() => this.flush(), FLUSH_MS);
  }

  push(type, extra = {}) {
    try {
      if (this.queue.length >= MAX_QUEUE) return;
      this.queue.push({
        // `event_type`, not `type`: that is the field the collector reads, and
        // anything else it drops in silence with a cheerful 204.
        event_type: type,
        path: location.pathname,
        locale: this.game.config.locale,
        ...extra,
      });
      if (this.queue.length >= MAX_QUEUE) this.flush();
    } catch (_) {
      /* Measuring must never be able to stop the game. */
    }
  }

  flush() {
    if (!this.queue.length) return;
    const body = JSON.stringify({
      device_id: this.deviceId,
      session_uid: this.sessionUid,
      session_token: this.game.session.get() || "",
      events: this.queue.splice(0, MAX_QUEUE),
    });
    try {
      const blob = new Blob([body], { type: "application/json" });
      // sendBeacon survives the page going away, which is exactly when game_end
      // is emitted. fetch with keepalive is the fallback, never a plain fetch.
      if (navigator.sendBeacon?.(this.url, blob)) return;
      fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        credentials: "include",
      }).catch(() => {});
    } catch (_) {
      /* A dropped batch is a lost row, not a bug the player should feel. */
    }
  }

  /** The world is on screen and the clock starts. */
  begin(mode) {
    this.startedAt = Date.now();
    this.lastAct = this.startedAt;
    this.push("game_start", {
      value: { mode, scene: this.game.state.scene },
    });
    this.enterScene(this.game.state.scene);
  }

  /** A gesture that CHANGED something: picking up, talking, a door, a rule.
   * Walking is not an act — it is how you get to one. */
  act(what) {
    const now = Date.now();
    this.lastAct = now;
    this.stuckAt = 0;
    if (!this.acted && this.startedAt) {
      this.acted = true;
      this.push("game_first_act", {
        duration_ms: now - this.startedAt,
        value: { what: what || "", scene: this.game.state.scene },
      });
    }
  }

  /** Once per session, whatever happens later. */
  milestone(id) {
    if (!id || this.milestones.has(id)) return;
    this.milestones.add(id);
    this.push("game_milestone", {
      duration_ms: this.startedAt ? Date.now() - this.startedAt : 0,
      value: { milestone: id, scene: this.game.state.scene },
    });
  }

  enterScene(scene) {
    if (this.scene === scene) return;
    this.leaveScene();
    this.scene = scene;
    this.sceneAt = Date.now();
    this.cells = new Map();
  }

  /** One row per scene on the way out, carrying the heat map with it. */
  leaveScene() {
    if (!this.scene || !this.sceneAt) return;
    const seconds = Math.round((Date.now() - this.sceneAt) / 1000);
    if (seconds > 0)
      this.push("game_scene", {
        duration_ms: Math.min(seconds * 1000, 1800000),
        value: { scene: this.scene },
      });
    const cells = [...this.cells.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CELLS)
      .map(([key, count]) => [...key.split(",").map(Number), count]);
    if (cells.length)
      this.push("game_where", { value: { scene: this.scene, cells } });
    this.scene = null;
    this.sceneAt = 0;
    this.cells = new Map();
  }

  listen(step, kind, id) {
    this.push("game_listen", {
      content_type: kind || "",
      content_id: Number.isSafeInteger(id) && id > 0 ? id : null,
      value: { step },
    });
  }

  contribute(kind) {
    this.push("game_contribute", { content_type: kind || "" });
  }

  account(step) {
    this.push("game_account", { value: { step } });
  }

  /** Called from the frame loop; does its own throttling. */
  tick() {
    if (!this.startedAt) return;
    const now = Date.now();
    const minutes = Math.floor((now - this.startedAt) / 60000);
    for (const mark of MINUTES)
      if (minutes >= mark && !this.minutes.has(mark)) {
        this.minutes.add(mark);
        this.push("game_minute", { value: { minute: mark } });
      }
    // Heat map: where the player actually STANDS, sampled, never per frame.
    if (now - this.sampleAt >= 2000) {
      this.sampleAt = now;
      const key =
        Math.floor(this.game.player.x / CELL) +
        "," +
        Math.floor(this.game.player.y / CELL);
      if (this.cells.size < 400)
        this.cells.set(key, (this.cells.get(key) || 0) + 1);
    }
    // Listening to a six-minute story is not being stuck, and neither is
    // reading a panel: both are the game working.
    const busy =
      !this.game.media.audio.paused ||
      !document.getElementById("world-content").hidden ||
      Boolean(this.game.dialogue);
    if (busy) {
      this.lastAct = now;
      return;
    }
    if (now - this.lastAct >= STUCK_MS && now - this.stuckAt >= STUCK_MS) {
      this.stuckAt = now;
      this.push("game_stuck", {
        value: { scene: this.game.state.scene },
        duration_ms: now - this.lastAct,
      });
    }
  }

  end() {
    if (this.ended || !this.startedAt) return;
    this.ended = true;
    clearInterval(this.timer);
    this.leaveScene();
    this.push("game_end", {
      duration_ms: Math.min(Date.now() - this.startedAt, 1800000),
      value: {
        scene: this.game.state.scene,
        milestones: this.milestones.size,
        acted: this.acted,
      },
    });
    this.flush();
  }
}
module.exports = { Telemetry };
