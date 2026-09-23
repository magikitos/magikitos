"use strict";
const { TILE } = require("./model");
const { active, planReaction } = require("./rules");
/**
 * ⛔ NADA SE ABRE POR CHOCAR (24-sep-2026, decisión del dueño). Chocar con un cartel o un vecino
 * abría su diálogo, y lo que ya estabas haciendo —otra flecha, el dedo arrastrando— lo cerraba en
 * el acto; como el choque quedaba bloqueado hasta alejarse, el elemento ya no se volvía a abrir.
 * Ahora se abre como en Zelda: te acercas guiando tú al duende y encima del más cercano aparece
 * una etiqueta con lo que harías. Con flechas o WASD dice «E · Hablar» y lo abren E o Enter; con
 * el dedo arrastrando dice «Hablar» y se toca. Ir tocando un destino no la enseña nunca: al llegar
 * el elemento se abre solo. Recoger al pisar y los gatos siguen yendo por el choque.
 */
const SHOW = TILE * 1.9;
const HIDE = TILE * 2.5;
/** Picking up is walking over it: the bump only acts when it actually puts something in the sack. */
function givesItem(entity, state, catalog) {
  try {
    const plan = planReaction(entity, state, catalog);
    return Boolean(
      plan &&
        Object.entries(plan.state.inventory).some(
          ([id, n]) => n > (state.inventory[id] || 0),
        ),
    );
  } catch (_) {
    return false;
  }
}
function verb(entity) {
  if (entity.neighbor || entity.portrait) return "promptTalk";
  const types = new Set(
    (entity.rules || []).flatMap((r) => (r.effects || []).map((e) => e.type)),
  );
  if (types.has("travel")) return "promptEnter";
  if (types.has("content")) return "promptOpen";
  if (entity.actions?.length) return "promptUse";
  if (entity.label === "sign") return "promptRead";
  return "promptLook";
}
class WorldPrompt {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.mode = null;
    this.node = document.createElement("button");
    this.node.type = "button";
    this.node.className = "world-prompt";
    this.node.hidden = true;
    // A finger that was already down steering must lift and press again: the press that
    // brought you here cannot be the one that opens it.
    this.node.addEventListener("pointerdown", () => {
      this.pressedAt = performance.now();
    });
    this.node.addEventListener("click", (event) => {
      event.stopPropagation();
      if (event.detail && !(this.pressedAt > this.shownAt)) return;
      this.open();
    });
    document.body.append(this.node);
  }
  /** Who is steering: set by the tick from where the movement came, cleared by a tapped journey. */
  steer(mode) {
    this.mode = mode;
  }
  candidates() {
    const g = this.game;
    return [
      ...g.world.entities.filter(
        (e) =>
          active(e, g.state) &&
          !e.threshold &&
          !e.pushable &&
          (e.rules?.length || e.interactAs || e.onInteract),
      ),
      ...(g.neighbors || []),
      ...(g.guardian ? [g.guardian] : []),
    ];
  }
  pick() {
    const g = this.game;
    let best = null,
      bestD = Infinity;
    for (const raw of this.candidates()) {
      const entity = g.interactionTarget(raw);
      if (!entity || entity.animal) continue;
      const d = g.world.distanceTo(g.player, raw);
      const reach = raw === this.target ? HIDE : SHOW;
      if (d > reach || d >= bestD) continue;
      if (givesItem(entity, g.state, g.catalog)) continue;
      best = raw;
      bestD = d;
    }
    return best;
  }
  hide() {
    if (!this.node.hidden) this.node.hidden = true;
    this.target = this.next = null;
    this.pickedAt = 0;
  }
  update(now = performance.now()) {
    const g = this.game;
    if (
      !this.mode ||
      !g.entry?.entered ||
      g.dialogue ||
      g.transitioning ||
      g.river?.active ||
      g.cats?.locked ||
      g.hasOverlay() ||
      !document.getElementById("world-content").hidden
    )
      return this.hide();
    // Finding the nearest element is a walk over the scene; where to paint the label is two
    // multiplications. The first runs a few times a second, the second every frame.
    if (!(now - (this.pickedAt || 0) < 120)) {
      this.pickedAt = now;
      this.next = this.pick();
    }
    const target = this.next && active(this.next, g.state) ? this.next : null;
    if (!target) {
      if (!this.node.hidden) this.node.hidden = true;
      this.target = null;
      return;
    }
    const bounds = g.renderer.artBounds(target, g.state);
    const canvas = g.renderer.canvas.getBoundingClientRect();
    const fx = canvas.width / g.renderer.width,
      fy = canvas.height / g.renderer.height;
    const x = bounds ? bounds.x + bounds.w / 2 : target.x,
      y = bounds ? bounds.y : target.y - TILE * 2;
    const label = g.text(verb(g.interactionTarget(target)));
    const text = this.mode === "keys" ? "E · " + label : label;
    if (target !== this.target || this.node.hidden) this.shownAt = performance.now();
    this.target = target;
    if (this.node.textContent !== text) this.node.textContent = text;
    this.node.classList.toggle("world-prompt--keys", this.mode === "keys");
    this.node.style.left = Math.round(canvas.left + (x - g.camera.x) * fx) + "px";
    this.node.style.top = Math.round(canvas.top + (y - g.camera.y) * fy) + "px";
    this.node.hidden = false;
  }
  /** E, Enter or a tap on the label: the same interaction a tap on the element starts. */
  open() {
    const target = this.target;
    if (!target || this.node.hidden) return false;
    this.hide();
    this.game.interact(target);
    return true;
  }
}
module.exports = { WorldPrompt, givesItem };
