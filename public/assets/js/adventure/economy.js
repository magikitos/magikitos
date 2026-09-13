"use strict";
/** Local preview wallet. Intentionally separate from website reputation and its SQL ledger.
 * Real account money requires a server-authoritative adapter; this state is NOT proof of funds.
 */
function fare(catalog, id) {
  const amount = catalog.economy.fares[id];
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("Unknown fare: " + id);
  return amount;
}
function rewardAmount(catalog, id) {
  const reward = catalog.economy.rewards[id],
    trips = reward?.trips ?? 1;
  const amount = reward?.fare
    ? fare(catalog, reward.fare) * trips
    : reward?.amount;
  if (
    !reward ||
    !Number.isSafeInteger(trips) ||
    trips <= 0 ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  )
    throw new Error("Invalid reward");
  return amount;
}
function cleanWallet(value, catalog) {
  const balance =
    Number.isSafeInteger(value?.balance) && value.balance >= 0
      ? Math.min(value.balance, catalog.economy.maxBalance)
      : 0;
  const claimed = {};
  for (const [id, reward] of Object.entries(catalog.economy.rewards))
    if (reward.once && value?.claimed?.[id] === true) claimed[id] = true;
  return { balance, claimed };
}
function transact(wallet, effect, catalog) {
  if (catalog.economy.scope !== "local-preview")
    throw new Error("No authoritative wallet adapter configured");
  if (effect.type === "spend") {
    const amount = fare(catalog, effect.fare);
    if (wallet.balance < amount) throw new Error("Insufficient setines");
    wallet.balance -= amount;
  } else {
    const reward = catalog.economy.rewards[effect.reward];
    const amount = rewardAmount(catalog, effect.reward);
    if (reward.once && wallet.claimed[effect.reward])
      throw new Error("Reward already claimed");
    if (wallet.balance + amount > catalog.economy.maxBalance)
      throw new Error("Wallet limit");
    wallet.balance += amount;
    if (reward.once) wallet.claimed[effect.reward] = true;
  }
}
module.exports = { fare, rewardAmount, cleanWallet, transact };
