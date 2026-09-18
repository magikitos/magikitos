"use strict";
const assert = require("node:assert/strict");
const { ForestConnection } = require("../public/assets/js/adventure/forest-connection");
const { ForestPeople } = require("../public/assets/js/adventure/forest-people");

let clock = 0;
const peers = new ForestPeople((variant) => variant, () => clock), id = "a".repeat(24), bounds = { width: 1000, height: 1000 };
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
  /**
   * ⛔ DOS DUENDES NO SE ATRAVIESAN, Y NADIE SE QUEDA ENCERRADO.
   *
   * El cuerpo de un desconocido solo frena a QUIEN LO MIRA: nadie empuja a nadie y la autoridad
   * no cambia. Lo que de verdad hay que probar aquí son las dos mitades que se estropean solas:
   * que el cuerpo se AÑADE y se QUITA de la lista de actores de la pantalla (si no, cada
   * instantánea dejaría un fantasma sólido más), y que alguien que ya te está encima es
   * atravesable — llegan interpolados y el servidor puede corregirte dentro de otro, así que un
   * solape convertido en muro te dejaría clavado sin nada que pulsar.
   */
  {
    const { ForestLive } = require("../public/assets/js/adventure/forest-live");
    const { actorBounds, overlaps } = require("../public/assets/js/adventure/geometry");
    const live = Object.create(ForestLive.prototype);
    const actors = [];
    live.people = new ForestPeople((v) => v, () => clock);
    live.connection = { ready: true };
    live.role = "player";
    live.game = { player: { x: 500, y: 500 }, world: { actors }, reducedMotion: true };
    const push = (rows) => {
      live.people.snapshot({ scene: "forest", people: rows }, "forest", bounds);
      live.people.update(true);
      live.bodies();
    };
    const far = "b".repeat(24), near = "c".repeat(24);
    push([[far, 200, 200, 2, 0, 0, 0]]);
    assert.equal(actors.length, 1, "A stranger gets a body");
    assert.equal(actors[0].actor, true, "and it is an actor-sized one");
    assert.equal(actors[0].passable, false, "which stops you");
    // Otra instantánea NO acumula cuerpos.
    push([[far, 210, 200, 2, 0, 0, 0]]);
    assert.equal(actors.length, 1, "Every snapshot replaces the bodies, never stacks them");
    // Quien te está encima es atravesable, y solo ese.
    push([[far, 200, 200, 2, 0, 0, 0], [near, 500, 500, 2, 0, 0, 0]]);
    assert.equal(actors.length, 2);
    assert.deepEqual(
      actors.map((p) => p.passable),
      [false, true],
      "Somebody already standing on you never walls you in",
    );
    assert(overlaps(actorBounds(500, 500), actorBounds(actors[1].x, actors[1].y)));
    // Sin conexión no hay cuerpos, y un espectador tampoco los reparte.
    live.connection.ready = false;
    live.bodies();
    assert.deepEqual(actors, [], "A dropped connection takes the bodies with it");
    live.connection.ready = true;
    push([[far, 200, 200, 2, 0, 0, 0]]);
    assert.equal(actors.length, 1);
    live.role = "spectator";
    live.bodies();
    assert.deepEqual(actors, [], "A spectator walks through the world, not into it");
    // Y al cambiar de pantalla la lista de actores es OTRA: no se toca la que ya no existe.
    live.role = "player";
    push([[far, 200, 200, 2, 0, 0, 0]]);
    const fresh = [];
    live.game.world = { actors: fresh };
    live.bodies();
    assert.equal(actors.length, 1, "The old screen's list is left alone");
    assert.equal(fresh.length, 1, "and the new one gets its bodies");
  }
  console.log("PASS forest client: bounded validated snapshots, interpolation, stale-scene isolation, lifecycle cancellation, offline crossings and peer bodies.");
})().catch(error => { console.error(error); process.exitCode = 1; });
