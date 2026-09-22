"use strict";
/** Authoring only: preview unsaved body edits using the same scene projection and physics. */
const { World, insideThreshold, TILE, collisionBounds } = require("../../public/assets/js/adventure/model");
const { renderScene } = require("./scene-edits");
const { frameName } = require("./catalog");
const { doorGeometry, acceptsEntry } = require("../../public/assets/js/adventure/portals");
const { docks, dockAt, enteringDock } = require("../../public/assets/js/adventure/docks");
const { move } = require("../../public/assets/js/adventure/movement");
const { Journey } = require("../../public/assets/js/adventure/journey");
const { walkingSpeed, RUN_SPEED } = require("../../public/assets/js/adventure/locomotion");
const { playerVariant } = require("../../public/assets/js/adventure/player-art");
function previewBody(data, scope, body) {
  if (!scope) return data;
  if (scope.kind === "element") return renderScene({
    world: { scenes: { [data.id]: data } }, scenery: { [data.id]: data.scenery || [] },
  }, data.id, {}, { [scope.family]: { [scope.variant]: body } });
  const apply = e => {
    if (frameName(e) !== scope.sprite) return e;
    const next = { ...e, ...body };
    delete next.solid;
    if (next.entrance === null) delete next.entrance;
    if (next.portal) Object.assign(next, doorGeometry(data, next));
    return next;
  };
  return { ...data, entities: data.entities.map(apply), scenery: (data.scenery || []).map(apply) };
}
class ProbeWorld {
  constructor(data) {
    this.actor = { x: 0, y: 0, direction: "down", variant: playerVariant(), actor: true };
    this.journey = new Journey();
    this.reset(data);
  }
  reset(data) {
    this.world = new World(data);
    this.docks = docks(data);
    this.clear();
  }
  clear() {
    this.journey.clear();
    this.walking = this.running = false;
    this.contact = this.trigger = null;
    this.terrainBlocked = false;
    this.triggerTime = 0;
  }
  place(point) { this.clear(); Object.assign(this.actor, { x: point.x, y: point.y }); }
  travel(point) {
    const dock = dockAt(this.world.data, point),
      entity = this.world.entities.find(e => e.portal && insideThreshold(e, point));
    return this.journey.start(this.world, this.actor, dock ? { kind: "dock", dock }
      : entity ? { kind: "portal", entity } : { kind: "ground", point });
  }
  step(dt, intent, run, viewport) {
    this.contact = null;
    this.triggerTime = Math.max(0, this.triggerTime - dt);
    if (!this.triggerTime) this.trigger = null;
    let activated = false;
    const before = { x: this.actor.x, y: this.actor.y };
    const contact = hit => { this.contact = hit; };
    // Test only the trigger. Never travel, interact, mutate inventory or contact an account API.
    const onStep = motion => {
      const door = this.world.entities.find(e => e.portal && this.journey.permitsPortal(e) && insideThreshold(e, this.actor) && acceptsEntry(e, motion));
      const dock = (!this.journey.intent || this.journey.intent.kind === "dock") && this.docks.find(d => enteringDock(d, this.actor, motion, "foot"));
      if (door || dock) {
        activated = true;
        this.triggerTime = 0.8;
        this.trigger = door ? { kind: "door", id: door.id, rect: door.threshold.map(v => v * TILE) }
          : { kind: "dock", id: dock.id, dock };
        return false;
      }
      return true;
    };
    const length = Math.hypot(intent.x, intent.y), walking = walkingSpeed(viewport);
    if (length) {
      this.journey.clear();
      this.running = !!run;
      const speed = run ? RUN_SPEED : walking;
      this.walking = move(this.world, this.actor, intent.x / length * speed * dt, intent.y / length * speed * dt,
        contact, { onStep, gait: run ? "run" : "walk" });
    } else {
      const speed = this.journey.pace.speed(this.actor, this.journey.path, walking);
      this.running = speed === RUN_SPEED && this.journey.path.length > 0;
      this.walking = this.journey.step(this.world, this.actor, dt, speed,
        { onStep, gait: this.running ? "run" : "walk" }).moved;
    }
    if (activated) this.journey.clear();
    this.running &&= this.walking;
    this.terrainBlocked = dt > 0 && length > 0 && !this.walking && !this.contact && !activated;
    this.moved = Math.hypot(this.actor.x - before.x, this.actor.y - before.y);
    this.valid = this.world.canStand(this.actor.x, this.actor.y, this.actor);
    this.contactRect = this.contact ? collisionBounds(this.contact) : null;
  }
}
module.exports = { ProbeWorld, previewBody };
