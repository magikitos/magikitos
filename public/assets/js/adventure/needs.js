"use strict";
const { TILE } = require("./geometry");
const HOUR = 3600000;
function nextDue(kind, now, catalog, random) {
  const [min, max] = catalog.needs.hours[kind];
  return (
    now +
    Math.round(
      (min + Math.min(0.999999, Math.max(0, random())) * (max - min)) * HOUR,
    )
  );
}
/** Absolute deadlines are sampled once per completed relief, never on reload or render. */
function cleanNeeds(value, catalog, now = Date.now(), random = Math.random) {
  const out = {};
  for (const kind of ["pee", "poop"]) {
    const [min, max] = catalog.needs.hours[kind];
    const last = value?.[kind]?.last,
      due = value?.[kind]?.due;
    out[kind] =
      Number.isSafeInteger(last) &&
      last > 0 &&
      Number.isSafeInteger(due) &&
      due >= last + min * HOUR &&
      due <= last + max * HOUR
        ? { last, due }
        : { last: now, due: nextDue(kind, now, catalog, random) };
  }
  return out;
}
function needStatus(needs, now = Date.now()) {
  if (now >= needs.poop.due) return "poop";
  if (now >= needs.pee.due) return "pee";
  return "comfortable";
}
function reliefError(state, kind, catalog, now = Date.now()) {
  if (!["pee", "poop"].includes(kind)) return "noNeed";
  if (kind === "poop" && !(state.inventory[catalog.needs.leafItem] > 0))
    return "needLeaf";
  const due = needStatus(state.needs, now);
  if (kind === "pee" && due === "poop") return "poopIncludesPee";
  return due === kind ? null : "noNeed";
}
function completeRelief(
  state,
  kind,
  catalog,
  position,
  { now = Date.now(), random = Math.random, startedAt = now } = {},
) {
  const error = reliefError(state, kind, catalog, startedAt);
  if (error) throw new Error(error);
  const needs = { pee: { ...state.needs.pee }, poop: { ...state.needs.poop } };
  const inventory = { ...state.inventory };
  needs.pee = { last: now, due: nextDue("pee", now, catalog, random) };
  if (kind === "poop") {
    needs.poop = { last: now, due: nextDue("poop", now, catalog, random) };
    const item = catalog.needs.leafItem;
    if (--inventory[item] === 0) delete inventory[item];
  }
  return {
    ...state,
    needs,
    inventory,
    traces: appendTrace(state, kind, catalog, position, now),
  };
}
function appendTrace(state, kind, catalog, position, now = Date.now()) {
  const traces = cleanTraces(state.traces, catalog, now);
  traces.push({
    kind,
    scene: state.scene,
    x: position.x + (kind === "pee" ? 20 : -7),
    y: position.y + 3,
    expires: now + catalog.needs.traces[kind + "Seconds"] * 1000,
  });
  return traces.slice(-catalog.needs.traces.max);
}
function cleanTraces(value, catalog, now = Date.now()) {
  return (Array.isArray(value) ? value : [])
    .filter((t) => {
      const scene = catalog.scenes[t?.scene];
      return (
        scene &&
        ["pee", "poop"].includes(t.kind) &&
        Number.isFinite(t.x) &&
        Number.isFinite(t.y) &&
        t.x >= 0 &&
        t.y >= 0 &&
        t.x < scene.width * TILE &&
        t.y < scene.height * TILE &&
        Number.isSafeInteger(t.expires) &&
        t.expires > now &&
        t.expires <= now + catalog.needs.traces[t.kind + "Seconds"] * 1000
      );
    })
    .slice(-catalog.needs.traces.max)
    .map((t) => ({
      kind: t.kind,
      scene: t.scene,
      x: t.x,
      y: t.y,
      expires: t.expires,
    }));
}
module.exports = {
  HOUR,
  cleanNeeds,
  needStatus,
  reliefError,
  completeRelief,
  appendTrace,
  cleanTraces,
};
