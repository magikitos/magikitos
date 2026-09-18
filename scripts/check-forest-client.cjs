"use strict";
const assert = require("node:assert/strict");
const { ForestConnection } = require("../public/assets/js/adventure/forest-connection");
const { ForestPeople } = require("../public/assets/js/adventure/forest-people");

let clock = 0;
const peers = new ForestPeople(() => clock), id = "a".repeat(24), bounds = { width: 1000, height: 1000 };
const snapshot = (rows, scene = "forest") => peers.snapshot({ scene, people: rows }, "forest", bounds);
assert(snapshot([[id, 100, 100, 2, 1, 0, 0]]));
peers.update();
assert.equal(peers.list[0].sprite, "person-0-right-walk-1");
assert(snapshot([[id, 120, 100, 2, 1, 0, 0]]));
clock = 50; peers.update(); assert.equal(peers.list[0].x, 110);
clock = 100; peers.update(); assert.equal(peers.list[0].x, 120);
clock = 10000; peers.update(); assert.equal(peers.list[0].x, 120, "No unbounded dead reckoning after loss");
assert(!snapshot([[id, Infinity, 100, 2, 1, 0, 0]]));
assert(!snapshot([[id, 10, 10, 80, 1, 0, 0]]));
assert(!snapshot([[id, 10, 10, 2, 1, 0, 0], [id, 20, 10, 2, 1, 0, 0]]));
assert(!snapshot([[id, 10, 10, 2, 1, 0, 0]], "old-scene"));
assert.equal(peers.list[0].x, 120, "Invalid snapshot cannot partly mutate peers");
assert(snapshot([])); assert.equal(peers.list.length, 0, "Departures immediately free appearance references");
assert(snapshot([[id, 100, 100, 2, 3, 100, 1]])); peers.update();
assert.match(peers.list[0].sprite, /^person-100-right-row-/);
assert.equal(peers.list[0].vesselArt.hull, "boat-bottle-right-0");
peers.clear(); assert.equal(peers.list.length, 0);

(async () => {
  let resolveOld, opened = 0;
  const connection = new ForestConnection({ api: { web: new URL("https://test.invalid"),
    request: () => new Promise(resolve => { resolveOld = resolve; }) },
    viewport: () => [0, 0, 100, 100], receive() {}, Socket: class { constructor() { opened++; } } });
  connection.start(); connection.stop();
  resolveOld({ protocol: 1, ticket: "should-not-be-used", socketPath: "/bosque" });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(opened, 0, "Ticket from old identity must never open a socket");
  assert.equal(await connection.cross({}), null, "Offline traversal needs no network authority");
  let resolveNew;
  connection.api.request = () => new Promise(resolve => { resolveNew = resolve; });
  connection.start();
  resolveNew({ protocol: 99, ticket: "wrong-protocol", socketPath: "/bosque" });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(connection.running, false, "Protocol incompatibility must not reconnect forever");
  connection.stop();
  {
    let socket, grants = 0;
    class Socket {
      constructor() { socket = this; this.readyState = 1; this.bufferedAmount = 0; this.sent = []; }
      send(data) { this.sent.push(JSON.parse(data)); }
      close() { this.readyState = 3; }
      receive(packet) { this.onmessage({ data: JSON.stringify(packet) }); }
    }
    const live = new ForestConnection({ api: { web: new URL("https://test.invalid"),
      request: async () => { grants++; return { protocol: 1, ticket: "synthetic", socketPath: "/bosque" }; } },
      viewport: () => [0, 0, 100, 100], receive() {}, Socket, now: () => 0 });
    live.start(); await new Promise(setImmediate); socket.onopen();
    socket.receive({ type: "bienvenido", protocol: 1, role: "player", expiresAt: 301000, now: 1000 });
    let settled = false;
    const renewal = live.renew(); renewal.then(() => { settled = true; });
    assert.equal(live.renew(), renewal, "Heartbeat and embark share one pending renewal");
    await new Promise(setImmediate);
    assert.equal(grants, 2);
    assert.equal(socket.sent.at(-1).type, "renovar");
    assert.equal(settled, false, "Fetching/sending a ticket does not grant the boat yet");
    socket.receive({ type: "renovado", expiresAt: 302000 });
    assert.equal(await renewal, true, "Only the server acknowledgement opens the crossing gate");
    const interrupted = live.renew(); live.stop();
    assert.equal(await interrupted, false, "Disconnect releases callers waiting for an acknowledgement");
    await new Promise(setImmediate);
  }
  console.log("PASS forest client: bounded validated snapshots, interpolation, stale-scene isolation, lifecycle cancellation and offline crossings.");
})().catch(error => { console.error(error); process.exitCode = 1; });
