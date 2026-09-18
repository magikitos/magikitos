"use strict";
const protocol = require("../../../../docs/forest-protocol.json");

/** One optional presence connection. No bearer goes into a URL or WebSocket. Every
 * async result belongs to one lifecycle; an old login can never replace a new one. */
class ForestConnection {
  constructor({ api, viewport, receive, disconnected = () => {}, Socket = globalThis.WebSocket,
    now = () => performance.now(), random = Math.random }) {
    Object.assign(this, { api, viewport, receive, disconnected, Socket, now, random });
    this.generation = 0;
    this.running = false;
    this.ready = false;
    this.attempt = 0;
    this.serial = 0;
    this.crossing = null;
  }
  start() {
    if (this.running || !this.Socket) return;
    this.running = true;
    this.attempt = 0;
    this.connect();
  }
  stop() {
    this.running = false;
    this.send({ type: "salir" });
    this.drop();
  }
  drop() {
    this.generation++;
    clearTimeout(this.retry);
    clearTimeout(this.openTimeout);
    clearInterval(this.pulse);
    this.abort?.abort();
    this.abort = null;
    const socket = this.socket;
    this.socket = null;
    this.ready = false;
    this.settleRenewal(false);
    this.settleCrossing(null);
    socket?.close();
    this.disconnected();
  }
  retryLater() {
    this.drop();
    if (!this.running) return;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempt++, 5)) * (0.8 + this.random() * 0.4);
    this.retry = setTimeout(() => this.connect(), delay);
  }
  async connect() {
    const generation = ++this.generation;
    const current = () => this.running && generation === this.generation;
    this.abort = new AbortController();
    try {
      const grant = await this.api.request("forest-ticket", {}, { auth: true, signal: this.abort.signal, timeout: 5000 });
      if (!current()) return;
      if (grant.protocol !== protocol.version || grant.socketPath !== "/bosque" || typeof grant.ticket !== "string")
        throw Error("protocol_mismatch");
      const url = new URL(grant.socketPath, this.api.web);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const socket = this.socket = new this.Socket(url.href);
      this.openTimeout = setTimeout(() => { if (current()) this.retryLater(); }, protocol.limits.helloMs + 1000);
      socket.onopen = () => {
        if (current()) socket.send(JSON.stringify({ type: "hola", protocol: protocol.version,
          ticket: grant.ticket, viewport: this.viewport() }));
      };
      socket.onmessage = event => {
        if (!current()) return;
        try {
          const packet = JSON.parse(event.data);
          if (!packet || !Object.hasOwn(protocol.serverMessages, packet.type)) throw Error("invalid_message");
          this.lastPacket = this.now();
          if (packet.type === "bienvenido") {
            if (packet.protocol !== protocol.version || !["player", "spectator"].includes(packet.role)) throw Error("protocol_mismatch");
            clearTimeout(this.openTimeout);
            this.ready = true;
            this.lastFailure = null;
            this.attempt = 0;
            this.expires(packet.expiresAt, packet.now);
            this.pulse = setInterval(() => this.heartbeat(), protocol.limits.heartbeatMs);
          } else if (packet.type === "renovado") {
            this.expires(packet.expiresAt, this.serverTime());
            this.settleRenewal(true);
          }
          else if (packet.type === "cruce") {
            if (packet.request === this.crossing?.request) this.settleCrossing(packet);
          } else if (packet.type === "adios") {
            if (packet.reason === "banned") this.lastFailure = "forest_banned";
            if (["replaced", "protocol_mismatch", "banned"].includes(packet.reason)) this.running = false;
            this.receive(packet);
            this.retryLater();
            return;
          }
          this.receive(packet);
        } catch (error) { if (current()) this.fail(error); }
      };
      socket.onerror = () => { if (current()) this.lastFailure = "socket_error"; }; // close retries once
      socket.onclose = () => { if (current()) this.retryLater(); };
    } catch (error) {
      if (!current()) return;
      this.fail(error);
    }
  }
  fail(error) {
    this.lastFailure = error.code || error.name || "connection_failed";
    if ([401, 403].includes(error.status) || error.message === "protocol_mismatch") this.running = false;
    try {
      if (error.message === "protocol_mismatch") this.receive({ type: "adios", reason: "protocol_mismatch" });
    } finally { this.retryLater(); }
  }
  expires(expiresAt, serverNow) {
    if (!Number.isFinite(expiresAt) || !Number.isFinite(serverNow) || expiresAt <= serverNow) throw Error("expired_ticket");
    this.serverEpoch = serverNow;
    this.sampledAt = this.now();
    this.renewAt = this.sampledAt + Math.max(0, expiresAt - serverNow - 60000);
  }
  serverTime() { return this.serverEpoch + this.now() - this.sampledAt; }
  heartbeat() {
    if (!this.ready) return;
    if (this.now() - this.lastPacket > protocol.limits.lostMs) return this.retryLater();
    this.send({ type: "latido" });
    if (this.now() >= this.renewAt) this.renew();
  }
  renew() {
    if (!this.ready) return Promise.resolve(false);
    if (this.renewal) return this.renewal.promise;
    const generation = this.generation;
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    this.renewal = { promise, resolve, timeout: setTimeout(() => {
      if (generation === this.generation) this.retryLater();
    }, 6000) };
    Promise.resolve().then(async () => {
      try {
        const grant = await this.api.request("forest-ticket", {}, { auth: true, signal: this.abort.signal, timeout: 5000 });
        if (generation !== this.generation) return;
        if (!this.send({ type: "renovar", ticket: grant.ticket })) this.settleRenewal(false);
        // Wait for renovado, not just the HTTP ticket. Server access checks are
        // asynchronous: a following dock request could otherwise overtake it.
      } catch (error) {
        if (generation !== this.generation) return;
        this.settleRenewal(false);
        if ([401, 403].includes(error.status)) { this.running = false; this.drop(); }
      }
    });
    return promise;
  }
  settleRenewal(ok) {
    const pending = this.renewal;
    if (!pending) return;
    this.renewal = null;
    clearTimeout(pending.timeout);
    pending.resolve(ok);
  }
  send(packet) {
    if (!this.ready || this.socket?.readyState !== 1) return false;
    if (this.socket.bufferedAmount > protocol.limits.bufferedBytes) { this.retryLater(); return false; }
    try { this.socket.send(JSON.stringify(packet)); return true; }
    catch (_) { this.retryLater(); return false; }
  }
  cross(value) {
    if (!this.ready) return Promise.resolve(null); // Local adventure survives an unavailable daemon.
    if (this.crossing) return Promise.reject(Error("crossing_pending"));
    return new Promise(resolve => {
      const request = ++this.serial;
      this.crossing = { request, resolve, timeout: setTimeout(() => this.retryLater(), 4000) };
      if (!this.send({ type: "cruzar", request, ...value })) this.settleCrossing(null);
    });
  }
  settleCrossing(packet) {
    const pending = this.crossing;
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.crossing = null;
    pending.resolve(packet);
  }
}
module.exports = { ForestConnection, protocol };
