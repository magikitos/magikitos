"use strict";
/** Pure world rules: conditions, item actions and atomic state effects. No DOM or scene names. */
const { cleanWallet, transact } = require("./economy");
function matches(state, when = {}, context = {}) {
  return (
    Object.entries(when.flags || {}).every(
      ([key, value]) => Boolean(state.flags[key]) === value,
    ) &&
    Object.entries(when.items || {}).every(
      ([key, count]) => (state.inventory[key] || 0) >= count,
    ) &&
    (!when.funds || (state.wallet?.balance || 0) >= when.funds) &&
    (!when.using ||
      (context.action !== "use" && !context.item) ||
      when.using.includes(context.item))
  );
}
function active(entity, state) {
  return (
    (!entity.hiddenWhen || !matches(state, entity.hiddenWhen)) &&
    (!entity.visibleWhen || matches(state, entity.visibleWhen))
  );
}
function actions(entity, state) {
  return (entity.actions || []).filter((action) => matches(state, action.when));
}
function planReaction(entity, state, catalog, context = {}) {
  if (!active(entity, state)) return null;
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
    inventory: { ...state.inventory },
  };
  for (const effect of rule.effects || []) {
    if (effect.type === "flag") {
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
      !["dialogue", "sound", "travel", "content"].includes(effect.type)
    )
      throw new Error("Unknown effect");
  }
  return {
    state: draft,
    effects: (rule.effects || []).filter(
      (e) => !["flag", "item", "spend", "reward"].includes(e.type),
    ),
  };
}
module.exports = { matches, active, actions, planReaction };
