"use strict";
/** Pure world rules: conditions, item actions and atomic state effects. No DOM or scene names. */
const { cleanWallet, transact } = require("./economy");
const { startTimer } = require("./timers");
const { remember } = require("./keepsakes");
const { collected, collect } = require("./resources");
function matches(state, when = {}, context = {}) {
  return (
    (!when.navigation ||
      (state.navigation?.mode || "foot") === when.navigation) &&
    (!when.landing || state.navigation?.landing === when.landing) &&
    Object.entries(when.flags || {}).every(
      ([key, value]) => Boolean(state.flags[key]) === value,
    ) &&
    Object.entries(when.items || {}).every(
      ([key, count]) => (state.inventory[key] || 0) >= count,
    ) &&
    Object.entries(when.maxItems || {}).every(
      ([key, count]) => (state.inventory[key] || 0) <= count,
    ) &&
    Object.entries(when.timers || {}).every(
      ([key, running]) =>
        (state.timers?.[key] || 0) > (context.now ?? Date.now()) === running,
    ) &&
    (!when.funds || (state.wallet?.balance || 0) >= when.funds) &&
    (!when.using ||
      (context.action !== "use" && !context.item) ||
      when.using.includes(context.item))
  );
}
function active(entity, state, context = {}) {
  return (
    entity.liveHidden !== true &&
    (entity.resource?.keepVisible || !collected(state, entity.resource, context.now ?? Date.now())) &&
    (!entity.hiddenWhen || !matches(state, entity.hiddenWhen, context)) &&
    (!entity.visibleWhen || matches(state, entity.visibleWhen, context))
  );
}
function actions(entity, state, context = {}) {
  return (entity.actions || []).filter((action) =>
    matches(state, action.when, context),
  );
}
function planReaction(entity, state, catalog, context = {}) {
  context = { ...context, now: context.now ?? Date.now() };
  if (!active(entity, state, context)) return null;
  if (collected(state, entity.resource, context.now)) return {state, effects:[{type:"dialogue",key:entity.resource.empty}]};
  const action = context.action || "interact";
  if (context.item && !(state.inventory[context.item] > 0)) return null;
  const rule = (entity.rules || []).find(
    (rule) =>
      (Array.isArray(rule.action)
        ? rule.action
        : [rule.action || "interact"]
      ).includes(action) && matches(state, rule.when, context),
  );
  if (!rule) return null;
  const draft = {
    ...state,
    wallet: cleanWallet(state.wallet, catalog),
    flags: { ...state.flags },
    timers: { ...state.timers },
    inventory: { ...state.inventory },
  };
  for (const effect of rule.effects || []) {
    if (effect.type === "collect") {
      collect(draft, entity.resource, context.now);
    } else if (effect.type === "keepsake") {
      remember(draft, entity);
    } else if (effect.type === "timer") {
      startTimer(draft, effect.timer, catalog, context.now);
    } else if (effect.type === "flag") {
      if (!catalog.flags.includes(effect.flag))
        throw new Error("Unknown flag: " + effect.flag);
      draft.flags[effect.flag] = effect.value !== false;
    } else if (effect.type === "item") {
      const definition = catalog.items[effect.item];
      if (!definition || !Number.isInteger(effect.amount))
        throw new Error("Invalid item effect");
      const count = (draft.inventory[effect.item] || 0) + effect.amount;
      if (count < 0 || count > (definition.max || 99))
        throw new Error("Inventory bounds");
      if (effect.amount < 0 && definition.reusable)
        throw new Error("Reusable tools cannot be consumed");
      if (count) draft.inventory[effect.item] = count;
      else delete draft.inventory[effect.item];
    } else if (["spend", "reward"].includes(effect.type)) {
      transact(draft.wallet, effect, catalog);
    } else if (
      ![
        "dialogue",
        "sound",
        "travel",
        "content",
        "presentation",
      ].includes(effect.type)
    )
      throw new Error("Unknown effect");
  }
  return {
    rule,
    state: draft,
    effects: (rule.effects || []).filter(
      (e) =>
        !["flag", "item", "spend", "reward", "timer", "keepsake", "collect"].includes(
          e.type,
        ),
    ),
  };
}
module.exports = { matches, active, actions, planReaction };
