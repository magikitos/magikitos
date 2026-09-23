"use strict";
const { SpriteBudgetError } = require("./sprite-residency");
const { GAITS } = require("./characters");

function baseActorFrame(name) {
  const actor = /^person-(\d+)-/.exec(name || "");
  if (!actor) return null;
  const direction = /^person-\d+-(down-right|down-left|up-right|up-left|down|up|left|right)(?:-|$)/.exec(name)?.[1] || "down";
  return `person-${actor[1]}-${direction}`;
}

/** Only appearances intersecting the viewport's small approach margin are requested. */
class ActorArt {
  constructor(sprites) {
    this.sprites = sprites;
    this.jobs = new Map();
    this.retry = new Map();
    this.next = 0;
  }
  frame(name) {
    if (this.sprites.frame(name) || /-(sit|row|carried)-/.test(name)) return name;
    // While a distant runner's action pack streams, use the same leg in its
    // already-loaded walking sheet, never a standing body sliding over ground.
    const run = /^(person-\d+-(?:down-right|down-left|up-right|up-left|down|up|left|right))-run-([0-3])$/.exec(name);
    if (run) {
      const walk = `${run[1]}-walk-${GAITS.walk.poses[Number(run[2])]}`;
      if (this.sprites.frame(walk)) return walk;
    }
    return baseActorFrame(name) || name;
  }
  /**
   * Si este fotograma toca repasar el arte. El repaso es cada 120 ms, no cada cuadro, y quien
   * dibuja lo pregunta ANTES de armar la lista de lo que se ve: con el mundo continuo esa lista
   * lleva copias trasladadas de las cosas de las vecinas, y armarlas sesenta veces por segundo
   * para tirarlas es basura pura.
   */
  due(now = performance.now()) {
    return Boolean(this.sprites.manifest) && now >= this.next;
  }
  update(entities, view, frameFor, now = performance.now()) {
    if (!this.due(now)) return;
    this.next = now + 120;
    const requests = new Map();
    const offer = (id, distance) => {
      if (distance < (requests.get(id) ?? Infinity)) requests.set(id, distance);
    };
    for (const e of entities) {
      const name = frameFor(e), base = baseActorFrame(name);
      if (!base || e.x < view.x - 96 || e.x > view.x + view.width + 96 ||
          e.y < view.y - 96 || e.y > view.y + view.height + 96) continue;
      const distance = Math.hypot(e.x - view.x - view.width / 2, e.y - view.y - view.height / 2);
      if (e.vesselArt && this.sprites.owners.has(e.vesselArt.hull))
        offer(this.sprites.packageFor(e.vesselArt.hull), distance);
      // A seated passenger must never flash a standing fallback. Nor should a
      // stationary elder download a whole walking sheet merely for sitting.
      if (!/-(sit|row|carried)-/.test(name)) offer(this.sprites.packageFor(base), distance);
      if (name !== base && this.sprites.owners.has(name))
        offer(this.sprites.packageFor(name), distance + 0.1);
      // The sheet of what the resident is about to do (sit, dig, fish) streams in while it walks.
      for (const hint of e.artHints || [])
        if (this.sprites.owners.has(hint)) offer(this.sprites.packageFor(hint), distance + 0.2);
    }
    this.sprites.residency.focus = requests;
    // Work out the admissible set before scheduling. Repeatedly downloading far-away actors
    // that cannot fit would churn the cache every animation frame when fully zoomed out.
    // Lo fijo, lo visible y lo reservado ya ocupan su sitio: los actores solo entran en lo que
    // queda, los más cercanos primero. Antes solo se contaba lo fijo, y el arte de la gente
    // lejana expulsaba los árboles de la pantalla vecina.
    const selected = new Set([...this.sprites.pinned, ...this.sprites.visible, ...this.sprites.residency.holds.keys()]);
    let bytes = [...selected].reduce((n, id) => n + this.bytes(id), 0);
    for (const [id] of [...requests].sort((a, b) => a[1] - b[1])) {
      if (!selected.has(id)) {
        if (bytes + this.bytes(id) > this.sprites.residency.limit) continue;
        selected.add(id);
        bytes += this.bytes(id);
      }
      if (this.jobs.size >= 2) break;
      if (this.sprites.packs.has(id) || this.jobs.has(id) || now < (this.retry.get(id) || 0)) continue;
      this.jobs.set(id, this.sprites.load(id)
        .catch((error) => {
          // Scene transitions borrow the same budget. A postponed appearance is not a failed scene.
          this.retry.set(id, now + (error instanceof SpriteBudgetError ? 500 : 10000));
        })
        .finally(() => this.jobs.delete(id)));
    }
    for (const id of this.retry.keys()) if (!requests.has(id)) this.retry.delete(id);
  }
  bytes(id) {
    const pack = this.sprites.manifest.packs[id];
    return pack.width * pack.height * 4;
  }
}
module.exports = { ActorArt, baseActorFrame };
