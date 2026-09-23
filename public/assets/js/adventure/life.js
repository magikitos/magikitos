"use strict";
const { TILE, hash, random, distance } = require("./geometry");
const { facing } = require("./characters");
const { artworkBounds } = require("./entity-art");
const { frameName } = require("./elements");

/**
 * ⛔ EL BOSQUE VIVE AUNQUE NO LE MIRES (22-sep-2026, decisión del dueño: «que se sienta más vivo…
 * que usen los caminitos, caminen juntos, hablen entre ellos, se echen la siesta en las hamacas,
 * usen los banquitos… alguien pescando… mucha vida»).
 *
 * Every ambient resident lives a schedule of EPISODES. Which episode and what it does come from
 * the SHARED server clock and the resident's id, so two people looking at the same meadow see the
 * same neighbour napping in the same hammock; only the steps between spots are local. That is
 * the shared life the owner asked for, without a server simulation.
 *
 * What a place offers is DERIVED from its element and its body (`data/aventura/life.json`
 * `kinds`): a bench is sat on from its front, a vegetable bed is tended from its four sides, a
 * fire warms a ring around it. Nothing is placed by hand per scene, so a bench built by the
 * community or dropped by the Studio is used the moment it exists. Furniture that brings its own
 * `slots` (community construction) keeps them.
 *
 * Content hosts (residents holding published content) are never taken away from their spot:
 * people walk up to them to read. Off screen a resident is placed at its spot instead of walking,
 * which costs nothing and makes arriving somewhere feel like arriving at something going on.
 */
const TICK = 0.25;
const PATH_BUDGET = 0.25; // seconds between two route searches in a world
// Cells one route search may close: a resident with a place further than this, or cut off from it,
// gives the place up and hangs about. Without the cap one search crossed the whole meadow in 67 ms.
const PATH_LIMIT = 700,
  // And a place further than this is not searched at all: even the straight-line check that opens
  // every search walks the whole segment, and across the meadow that alone was 19 ms.
  PATH_REACH = 36 * TILE;
const GREET_DISTANCE = 2.4 * TILE;
const VIEW_MARGIN = 160;
const CARDINAL = { down: "down", up: "up", left: "left", right: "right", "down-left": "left", "down-right": "right", "up-left": "left", "up-right": "right" };

class ResidentLife {
  constructor(game) {
    this.game = game;
    this.config = game.catalog.life || { weights: {}, kinds: {}, crops: {} };
    this.places = new WeakMap(); // world → derived affordances
    this.banks = new WeakMap(); // world → fishing spots
    this.reset();
  }
  reset() {
    for (const n of this.residents(this.game.world)) this.release(n);
    this.reserved = new Map();
    this.clock = 0;
    this.elapsed = 0; // game seconds: the route budget runs on it, not on the wall clock
    this.nextPath = new WeakMap();
  }
  /** Community furniture changed: its places are derived again, and whoever used it stands up. */
  reconcile(changedIds, world = this.game.world) {
    if (!world) return;
    this.places.delete(world);
    for (const n of this.residents(world))
      if (n.life?.entity && changedIds.has(n.life.entity)) {
        this.release(n);
        n.path = []; // walking to furniture that moved or went: stop, the next tick plans again
      }
  }
  now() {
    return this.game.serverClock?.now() ?? Date.now();
  }
  /** Residents free to live: not content hosts, not the ones the Studio placed standing still. */
  residents(world) {
    return (world?.actors || []).filter((n) => n.neighbor && n.lifeFree);
  }
  worlds() {
    const g = this.game,
      out = [{ world: g.world, dx: 0, dy: 0 }];
    for (const seam of g.world?.seams || []) out.push({ world: seam.world, dx: seam.dx * TILE, dy: seam.dy * TILE });
    return out;
  }
  update(dt) {
    const g = this.game;
    if (!g.world || g.community?.editing) return;
    this.animate();
    this.elapsed += dt;
    this.clock -= dt;
    if (this.clock > 0) return;
    this.clock = TICK;
    const now = this.now();
    for (const { world, dx, dy } of this.worlds()) {
      const view = {
        x: g.camera.x - dx - VIEW_MARGIN,
        y: g.camera.y - dy - VIEW_MARGIN,
        w: g.renderer.width + VIEW_MARGIN * 2,
        h: g.renderer.height + VIEW_MARGIN * 2,
      };
      for (const n of this.residents(world)) this.live(world, n, now, view, world === g.world);
    }
  }
  /** Animation frames need more than four ticks a second: the work cycle and the nap sway. */
  animate() {
    const time = performance.now() / 1000;
    for (const { world } of this.worlds()) {
      // The anglers the Studio placed fish with their own sheet too, when their face has one.
      for (const n of world.actors || [])
        if (n.neighbor && !n.lifeFree && n.fishing?.target) this.angle(n, n.fishing.target, time, n.id.length);
      for (const n of this.residents(world)) {
        const life = n.life;
        if (!life?.arrived) continue;
        if (life.kind === "tend") {
          // Digging, four frames. Until the sheet has streamed in the resident stands at the bed.
          const frame = `person-${n.variant}-${CARDINAL[n.direction] || "down"}-work-${Math.floor(time * 5 + life.phase) % 4}`;
          n.activitySprite = this.ready(frame) ? frame : null;
        }
        if (life.kind === "fish") this.angle(n, life.float, time, life.phase);
        if (life.kind === "sit" && life.seat) {
          // Quiet or happy for the whole episode, with a blink every few seconds (`seating.js`
          // does the same for the authored elders). Seated on the seat, drawn in front of it.
          const blink = (time + life.phase * 3) % 4.2 < 0.16,
            frame = `person-${n.variant}-${life.seat.direction}-sit-${life.mood + (blink ? 1 : 0)}`;
          if (this.ready(frame)) {
            if (!n.seated) Object.assign(n, { x: life.seat.x, y: life.seat.y, depth: life.seat.depth, seated: true });
            n.direction = life.seat.direction;
            n.activitySprite = frame;
          }
        }
      }
    }
  }
  /** 0 waiting, 1 a tug now and then, 2 reeling in, 3 the fish held up after a bite. The rod is in
   *  the drawing; the line leaves from its tip (`life.json` `rodTips`) to the float. A face with no
   *  angler sheet keeps the drawn rod over its standing body. */
  angle(n, float, time, phase) {
    const side = float[0] * TILE < n.x ? "left" : "right";
    if (!this.has(`person-${n.variant}-${side}-fish-0`)) {
      n.fishing = { target: float };
      return;
    }
    n.artHints = [`person-${n.variant}-${side}-fish-0`];
    const bite = n.splash ? this.now() - n.splash.at : Infinity,
      step = bite < 700 ? 2 : bite < 1800 ? 3 : Math.floor(time * 0.7 + phase) % 5 === 0 ? 1 : 0,
      frame = `person-${n.variant}-${side}-fish-${step}`;
    const ready = this.ready(frame);
    n.activitySprite = ready ? frame : null;
    n.fishing = ready ? { target: float, drawnRod: true, tip: this.config.rodTips?.[frame] } : { target: float };
  }
  visible(n, view) {
    return n.x >= view.x && n.x <= view.x + view.w && n.y >= view.y && n.y <= view.y + view.h;
  }
  has(name) {
    return this.game.renderer.sprites.has(name);
  }
  /** Loaded, not just in the release: an activity frame that is still streaming draws nothing. */
  ready(name) {
    return Boolean(this.game.renderer.sprites.frame?.(name));
  }
  /** The first frame of each activity sheet a face HAS, so only those faces are offered it. */
  canDo(n, kind) {
    const v = n.variant;
    if (kind === "sit") return this.has(`person-${v}-down-sit-0`);
    if (kind === "tend") return this.has(`person-${v}-down-work-0`);
    if (kind === "fish") return this.has(`person-${v}-left-fish-0`);
    return true;
  }
  /** One resident, one tick: keep doing the episode's thing, or start the next episode. */
  live(world, n, now, view, current) {
    const g = this.game;
    if (n === g.journey.target || (g.dialogue && g.dialogue.entity === n)) return;
    const episode = this.episode(n, now);
    // A resident that joined somebody else's walk or chat keeps it until it ends, whatever its own
    // episode says; everyone else starts the next episode when theirs changes.
    if (!n.life || (n.life.episode !== episode && !(n.life.locked > now))) {
      this.release(n);
      this.plan(world, n, episode, now);
    }
    const life = n.life;
    if (!life) return;
    if (current && !n.bubble && this.greet(n, now)) return;
    if (life.kind === "follow") return this.during(world, n, now);
    if (!life.arrived) {
      if (n.path.length) return;
      // A route ends at the centre of the target's tile, up to half a diagonal away from the spot
      // itself: within a tile, step onto the spot. With 10 px the resident searched the same
      // route again forever and never arrived, standing in a knot beside the bench.
      if (!life.target || distance(n, life.target) <= TILE) {
        if (life.target) Object.assign(n, { x: life.target.x, y: life.target.y });
        return this.arrive(world, n, now);
      }
      if (!this.visible(n, view) && !this.visible(life.target, view)) {
        // Nobody is looking: be there already.
        Object.assign(n, { x: life.target.x, y: life.target.y });
        return this.arrive(world, n, now);
      }
      this.route(world, n, life.target);
      return;
    }
    this.during(world, n, now, view);
  }
  episode(n, now) {
    const rand = random(hash(n.id + ":period")),
      [min, max] = this.config.episodeSeconds || [35, 80],
      period = (min + rand() * (max - min)) * 1000,
      offset = rand() * period;
    return Math.floor((now + offset) / period);
  }
  /** Deterministic: the same resident, episode and place list give the same plan on every screen. */
  plan(world, n, episode, now) {
    const rand = random(hash(n.id + ":" + episode)),
      places = this.affordances(world),
      weights = this.config.weights || {},
      options = [];
    const add = (kind, weight) => weight > 0 && options.push([kind, weight]);
    add("stroll", this.paths(world).length ? weights.stroll : 0);
    add("walkTogether", this.paths(world).length ? weights.walkTogether : 0);
    add("chat", weights.chat);
    for (const kind of ["sit", "tend", "nap", "warm", "socialize", "read"])
      add(kind, this.canDo(n, kind) && places.some((p) => p.kind === kind) ? weights[kind] : 0);
    add("fish", this.canDo(n, "fish") && this.fishingSpots(world).length ? weights.fish : 0);
    add("wander", weights.wander || 1);
    const plan = (life) => { n.life = { episode, rand, phase: rand() * 4, ...life }; };
    // Weighted choice, and if the chosen thing cannot happen right now (no free partner, every
    // bench taken) the next one is tried: a resident with a plan that failed is not idle.
    while (options.length) {
      let pick = rand() * options.reduce((sum, [, w]) => sum + w, 0),
        index = options.length - 1;
      for (let i = 0; i < options.length; i++) if ((pick -= options[i][1]) < 0) { index = i; break; }
      const [kind] = options.splice(index, 1)[0];
      if (this.attempt(world, n, kind, rand, now, plan)) return;
    }
    plan({ kind: "wander", arrived: true });
  }
  attempt(world, n, kind, rand, now, plan) {
    if (kind === "wander") return plan({ kind, arrived: true }), true;
    if (kind === "stroll" || kind === "walkTogether") {
      const legs = this.strollLegs(world, n, rand);
      if (!legs.length) return false;
      plan({ kind: "stroll", legs, target: legs.shift() });
      if (kind === "walkTogether") this.recruit(world, n, rand, now, "follow");
      return true;
    }
    if (kind === "chat") return Boolean(this.recruit(world, n, rand, now, "chat"));
    if (kind === "fish") {
      const spots = near(n, this.fishingSpots(world).filter((s) => !this.reserved.has(s.key)), (s) => [s]);
      const spot = spots[Math.floor(rand() * spots.length)];
      if (!spot) return false;
      this.reserved.set(spot.key, n.id);
      plan({ kind, key: spot.key, target: spot, direction: spot.direction, float: spot.float });
      n.artHints = [`person-${n.variant}-${spot.direction}-fish-0`];
      return true;
    }
    const free = [];
    for (const place of this.affordances(world))
      if (place.kind === kind)
        for (const spot of place.spots) if (!this.reserved.has(spot.key)) free.push({ place, spot });
    const within = near(n, free, (f) => [f.spot]);
    const choice = within[Math.floor(rand() * within.length)];
    if (!choice) return false;
    this.reserved.set(choice.spot.key, n.id);
    plan({
      kind,
      key: choice.spot.key,
      entity: choice.place.entity.id,
      target: choice.spot,
      direction: choice.spot.direction,
      anchor: { x: choice.place.entity.x, y: choice.place.entity.y },
      seat: choice.spot.seat,
      mood: rand() < 0.5 ? 0 : 2,
    });
    // The sheet streams in while the resident walks there (`actor-art.js` reads the hint).
    if (kind === "sit") n.artHints = [`person-${n.variant}-${choice.spot.seat.direction}-sit-0`];
    if (kind === "tend") n.artHints = [`person-${n.variant}-down-work-0`];
    return true;
  }
  /** Another free resident joins: walks alongside the leader, or meets it halfway to talk. */
  recruit(world, leader, rand, now, how) {
    const candidates = this.residents(world).filter(
      (m) => m !== leader && !(m.life?.locked > now) && distance(m, leader) < 18 * TILE &&
        (!m.life || ["wander", "stroll"].includes(m.life.kind)),
    );
    if (!candidates.length) return null;
    const partner = candidates[Math.floor(rand() * candidates.length)],
      until = now + 45000;
    this.release(partner);
    if (how === "follow") {
      partner.life = { kind: "follow", leader, episode: -1, locked: until, rand, phase: rand() * 4, target: null };
      return partner;
    }
    const mid = { x: (leader.x + partner.x) / 2, y: (leader.y + partner.y) / 2 };
    const beside = (side) => {
      for (const d of [1.2, 1.6, 2]) {
        const p = { x: mid.x + side * d * TILE, y: mid.y };
        if (world.canStand(p.x, p.y)) return p;
      }
      return null;
    };
    const a = beside(-1), b = beside(1);
    if (!a || !b) return null;
    leader.life = { kind: "chat", episode: leader.life?.episode ?? this.episode(leader, now), rand, phase: 0, target: a, direction: "right", partner, speaker: true, locked: until };
    partner.life = { kind: "chat", episode: -1, rand, phase: 2, target: b, direction: "left", partner: leader, speaker: false, locked: until };
    return partner;
  }
  arrive(world, n, now) {
    const life = n.life;
    if (life.kind === "stroll" && life.legs?.length) {
      life.target = life.legs.shift();
      return;
    }
    if (life.kind === "stroll") {
      life.kind = "wander";
      life.arrived = true;
      return;
    }
    if (life.kind === "follow") return;
    life.arrived = true;
    life.since = now;
    n.path = [];
    if (life.direction) n.direction = life.direction;
    if (life.kind === "nap") n.napAt = { x: life.anchor.x, y: life.anchor.y };
    if (life.kind === "warm" && life.anchor) n.direction = facing(life.anchor.x - n.x, life.anchor.y - n.y, n.direction);
  }
  /** What a settled resident does while its episode lasts: speech, catches, a stretch. */
  during(world, n, now) {
    const life = n.life;
    n.moving = false;
    n.pause = 3;
    if (life.kind === "follow") {
      const leader = life.leader;
      if (!leader?.life || leader.life.kind !== "stroll" || !leader.life.target) {
        this.release(n);
        return;
      }
      // Alongside where the leader IS, not where it is going: short searches, and they walk together.
      const side = { x: leader.x + TILE * 1.1, y: leader.y };
      if (!n.path.length && distance(n, side) > 14 && world.canStand(side.x, side.y)) this.route(world, n, side);
      life.arrived = false;
      return;
    }
    if (life.kind === "chat") {
      const other = life.partner;
      if (!other?.life || other.life.partner !== n) {
        this.release(n);
        return;
      }
      if (other.life.arrived) n.direction = facing(other.x - n.x, other.y - n.y, n.direction);
      const turn = Math.floor((now - (life.since || now)) / 2600) % 2 === 0;
      n.bubble = other.life.arrived && turn === life.speaker ? { kind: life.rand() < 0.08 ? "note" : "talk", until: now + 400 } : null;
      return;
    }
    if (life.kind === "nap") {
      n.bubble = { kind: "sleep", until: now + 400 };
      return;
    }
    if (life.kind === "fish") {
      // Now and then a bite: a splash at the float and a little "!" over the angler.
      const beat = Math.floor((now + life.phase * 5000) / 23000);
      if (beat !== life.beat) {
        life.beat = beat;
        if (life.rand() < 0.35) {
          n.bubble = { kind: "catch", until: now + 1800 };
          n.splash = { at: now };
        }
      }
      return;
    }
    if (life.kind === "read") {
      // Reading the forest diary: the little book over the head, most of the time.
      if (!n.bubble && life.rand() < 0.08) n.bubble = { kind: "read", until: now + 2600 };
      return;
    }
    if (["sit", "warm", "socialize"].includes(life.kind) && !n.bubble && life.rand() < 0.012)
      n.bubble = { kind: life.kind === "warm" ? "note" : "talk", until: now + 1500 };
    if (life.kind === "wander") n.pause = Math.min(n.pause, 1);
  }
  /** A free resident near you turns and says hello, once in a while. */
  greet(n, now) {
    const p = this.game.player;
    if (!p || distance(n, p) > GREET_DISTANCE || (n.greetedAt || 0) > now - 60000) return false;
    if (n.life && !["wander", "stroll", "sit", "warm", "socialize"].includes(n.life.kind)) return false;
    n.greetedAt = now;
    n.direction = facing(p.x - n.x, p.y - n.y, n.direction);
    n.bubble = { kind: "hello", until: now + 1600 };
    return true;
  }
  route(world, n, target) {
    if ((this.nextPath.get(world) ?? -Infinity) > this.elapsed) return;
    this.nextPath.set(world, this.elapsed + PATH_BUDGET);
    const path = distance(n, target) <= PATH_REACH ? world.path(n, target, PATH_LIMIT) : null;
    if (path?.length) n.path = path;
    else if (n.life) {
      // Unreachable from here: give the place back and just be around.
      this.release(n);
      n.life = { kind: "wander", arrived: true, episode: this.episode(n, this.now()) };
    }
  }
  release(n) {
    const life = n.life;
    if (life?.key && this.reserved?.get(life.key) === n.id) this.reserved.delete(life.key);
    if (life?.partner?.life?.partner === n) life.partner.life = null;
    // Standing up puts the feet back on the ground in front of the seat, where they sat down from.
    if (n.seated && life?.target) Object.assign(n, { x: life.target.x, y: life.target.y });
    n.life = null;
    n.activitySprite = null;
    n.artHints = null;
    n.napAt = null;
    n.seated = false;
    n.depth = undefined;
    if (life?.kind === "fish") n.fishing = null;
    n.bubble = null;
    n.splash = null;
  }
  paths(world) {
    const data = world.data;
    return [...(data.paths || []), ...(data.communityPaths || []).map((p) => p.points)].filter((p) => p?.length > 1);
  }
  /** A walk along one of the paths: from the nearest vertex, three to six vertices on. */
  strollLegs(world, n, rand) {
    const paths = near(n, this.paths(world).map((p) => p.map(([x, y]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE }))), (p) => p);
    const path = paths[Math.floor(rand() * paths.length)];
    let start = 0;
    for (let i = 1; i < path.length; i++) if (distance(n, path[i]) < distance(n, path[start])) start = i;
    const step = rand() < 0.5 ? -1 : 1,
      count = 3 + Math.floor(rand() * 4),
      legs = [];
    for (let i = 0, at = start; i < count; i++, at += step) {
      if (at < 0 || at >= path.length) break;
      if (world.canStand(path[at].x, path[at].y)) legs.push(path[at]);
    }
    return legs;
  }
  /** The places this world offers, derived from element kinds and bodies. Cached per world. */
  affordances(world) {
    if (this.places.has(world)) return this.places.get(world);
    const kinds = this.config.kinds || {},
      places = [];
    for (const entity of [...world.entities, ...world.props]) {
      const kind = kinds[entity.sprite] || (entity.slots?.length && entity.capabilities?.find((c) => ["sit", "socialize", "tend", "garden"].includes(c)));
      if (!kind) continue;
      // The seat is measured on what is DRAWN: a bench family can be drawn as its log variant.
      const seat = kind === "sit" ? this.config.seats?.[frameName(entity)] ?? this.config.seats?.[entity.sprite] : null;
      // Sitting needs the seat's geometry: a bench without it is not sat on, not faked.
      if (kind === "sit" && !seat) continue;
      const spots = (seat ? spotsFor(entity, kind, seat) : entity.slots?.length ? entity.slots.map(([x, y, direction]) => ({ x: entity.x + x * TILE, y: entity.y + y * TILE, direction })) : spotsFor(entity, kind))
        .map((s) => settle(world, s))
        .filter(Boolean)
        .map((s, i) => ({ ...s, key: world.data.id + ":" + entity.id + ":" + i }));
      if (spots.length) places.push({ entity, kind: kind === "garden" ? "tend" : kind, spots });
    }
    this.places.set(world, places);
    return places;
  }
  /** Standable bank points with open water in front of them. Cached per world. */
  fishingSpots(world) {
    if (this.banks.has(world)) return this.banks.get(world);
    const spots = [],
      // The angler sheets face left or right, so do the banks they fish from.
      dirs = [["left", -1, 0], ["right", 1, 0]];
    if ((world.data.rivers || []).length || (world.data.waters || []).length)
      for (let ty = 4; ty < world.height - 4; ty += 3)
        for (let tx = 4; tx < world.width - 4; tx += 3) {
          const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
          if (world.waterAt(tx + 0.5, ty + 0.5) || !reachable(world, { x, y })) continue;
          for (const [direction, dx, dy] of dirs)
            if (world.waterAt(tx + 0.5 + dx * 2.5, ty + 0.5 + dy * 2.5) && world.waterAt(tx + 0.5 + dx * 3.5, ty + 0.5 + dy * 3.5)) {
              spots.push({ x, y, direction, float: [tx + 0.5 + dx * 3, ty + 0.5 + dy * 3], key: world.data.id + ":fish:" + tx + ":" + ty });
              break;
            }
        }
    // Not behind a tree: an angler under a canopy is a fishing line coming out of the leaves.
    const drawnInFront = (spot) => [...world.entities, ...world.props].some((e) => {
      if (!(e.y > spot.y) || !e.sprite) return false;
      const f = this.game.renderer.sprites.frame?.(frameName(e));
      if (!f?.anchor) return false;
      const b = artworkBounds(e, f);
      return spot.x > b.x - 12 && spot.x < b.x + b.w + 12 && spot.y - 40 < b.y + b.h && spot.y > b.y;
    });
    for (let i = spots.length - 1; i >= 0; i--) if (drawnInFront(spots[i])) spots.splice(i, 1);
    // A handful spread over the bank, the same ones on every screen.
    const rand = random(hash(world.data.id + ":banks")),
      chosen = [];
    for (const spot of spots.sort(() => rand() - 0.5))
      if (chosen.length < 10 && chosen.every((c) => distance(c, spot) > 8 * TILE)) chosen.push(spot);
    this.banks.set(world, chosen);
    return chosen;
  }
  inspect() {
    return this.residents(this.game.world).map((n) => ({
      id: n.id, x: n.x, y: n.y, kind: n.life?.kind || null, arrived: Boolean(n.life?.arrived),
      bubble: n.bubble?.kind || null, sprite: n.activitySprite || null, nap: Boolean(n.napAt), fishing: Boolean(n.fishing),
      seated: Boolean(n.seated), variant: n.variant,
    }));
  }
  /** Sprites a scene needs for the life it can show (only those that exist in this release). */
  sprites(world) {
    const names = [];
    for (const entity of [...world.entities, ...world.props]) {
      const crop = this.config.crops?.[entity.sprite];
      if (crop) for (const stage of crop.stages) if (this.has(stage)) names.push(stage);
    }
    // Bubbles and the splash are two small sheets; the seated, digging and fishing sheets are
    // per face and stream in with the resident (`artHints`), so a scene never pins eighteen.
    if (this.residents(world).length)
      for (const name of ["emote-talk", "fish-splash-0"]) if (this.has(name)) names.push(name);
    return names;
  }
  /** A vegetable bed's growth stage, on the shared clock: sown, growing, ready, then again. */
  cropFrame(entity) {
    const crop = this.config.crops?.[entity.sprite];
    if (!crop || !this.game.renderer.sprites.manifest) return null;
    this.cropReady ||= new Map();
    if (!this.cropReady.has(entity.sprite))
      this.cropReady.set(entity.sprite, crop.stages.every((stage) => this.has(stage)));
    if (!this.cropReady.get(entity.sprite)) return null;
    const cycle = crop.cycleMinutes * 60000,
      at = ((this.now() + (hash(entity.id) % cycle)) % cycle) / cycle,
      stage = crop.stages[Math.min(crop.stages.length - 1, Math.floor(at * crop.stages.length))];
    return this.ready(stage) ? stage : null;
  }
}

/** A spot a route can end on: standable itself AND on a walkable tile, which is what the search
 *  asks first. A bench's front can be standable while its tile is not, and then every search for
 *  it failed at once and the resident gave the bench up, every time. */
function reachable(world, s) {
  return world.canStand(s.x, s.y) && (!world.cellCanStand || world.cellCanStand(Math.floor(s.x / TILE), Math.floor(s.y / TILE)));
}

/** The spot itself if a route can end there, else the centre of the nearest tile that can (the
 *  one below first, then the sides), else nothing. Only where the resident STANDS moves; a seat
 *  keeps its own place on the furniture. */
function settle(world, s) {
  if (reachable(world, s)) return s;
  const tx = Math.floor(s.x / TILE), ty = Math.floor(s.y / TILE);
  for (const [dx, dy] of [[0, 0], [0, 1], [-1, 0], [1, 0], [-1, 1], [1, 1], [0, -1]]) {
    const p = { ...s, x: (tx + dx + 0.5) * TILE, y: (ty + dy + 0.5) * TILE };
    if (reachable(world, p)) return p;
  }
  return null;
}

/** The options with a point within route reach of the resident, or all of them if none is: a
 *  place nobody can walk to in one search is still reached, off-screen, when nobody is looking. */
function near(n, options, points) {
  const close = options.filter((o) => points(o).some((p) => distance(n, p) <= PATH_REACH));
  return close.length ? close : options;
}

/** Where a resident stands to use an element of this kind, from the element's body. */
function spotsFor(entity, kind, seat = null) {
  const scale = entity.scale ?? 1,
    [sx, sy, sw, sh] = (entity.solid || [-1, -0.5, 2, 0.8]).map((v) => v * scale),
    left = entity.x + sx * TILE,
    top = entity.y + sy * TILE,
    right = left + sw * TILE,
    bottom = top + sh * TILE,
    cx = (left + right) / 2,
    cy = (top + bottom) / 2;
  const gap = 0.7 * TILE;
  if (kind === "sit" && seat) {
    // One place per seat on the furniture: walked up to from the front, then sat on, the hip on
    // the seat (the sheets register it 12 units above the feet) and drawn just in front of it.
    const direction = seat.direction || "down";
    return (seat.places || [0]).map((px) => {
      const x = entity.x + px * scale;
      return { x, y: bottom + gap, direction: "up",
        seat: { x, y: entity.y - seat.height * scale + 12, depth: entity.y + 0.5, direction } };
    });
  }
  if (kind === "sit" || kind === "nap") return [{ x: cx, y: bottom + gap, direction: kind === "nap" ? "down" : "up" }];
  if (kind === "warm") {
    const radius = Math.max(sw, sh) * TILE * 0.5 + 1.6 * TILE;
    return [0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      const x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius * 0.7;
      return { x, y, direction: facing(cx - x, cy - y) };
    });
  }
  const sides = [
    { x: cx, y: bottom + gap, direction: "up" },
    { x: left - gap, y: cy, direction: "right" },
    { x: right + gap, y: cy, direction: "left" },
    { x: cx, y: top - gap, direction: "down" },
  ];
  return kind === "socialize" || kind === "read" ? sides.slice(0, 3) : sides;
}

module.exports = { ResidentLife, spotsFor };
