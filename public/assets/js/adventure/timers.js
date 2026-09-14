"use strict";
/** Persistent real-world deadlines; scene rules name timers, never hard-code quests. */
function cleanTimers(value, catalog, now = Date.now()) {
  const timers = {};
  for (const key of Object.keys(catalog.timers || {})) {
    const deadline = value?.[key];
    if (
      Number.isSafeInteger(deadline) &&
      deadline > now &&
      deadline <= now + catalog.timers[key].hours * 3600000
    )
      timers[key] = deadline;
  }
  return timers;
}
function expireTimers(state, now = Date.now()) {
  let changed = false;
  for (const [key, deadline] of Object.entries(state.timers || {}))
    if (deadline <= now) {
      delete state.timers[key];
      changed = true;
    }
  return changed;
}
function startTimer(state, key, catalog, now) {
  const hours = catalog.timers?.[key]?.hours;
  if (!Number.isFinite(hours) || hours <= 0 || hours > 8760)
    throw new Error("Unknown or invalid timer: " + key);
  state.timers[key] = now + Math.round(hours * 3600000);
}
module.exports = { cleanTimers, expireTimers, startTimer };
