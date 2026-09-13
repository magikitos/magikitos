"use strict";
const { fare, rewardAmount } = require("./economy");
/** Prices in copy follow catalog references; no quest names or amounts in the engine. */
function dialogueText(text, catalog) {
  return text.replace(/:([a-zA-Z]+)/g, (token, key) => {
    const reference = catalog.dialogueTokens?.[key];
    if (reference?.fare) return fare(catalog, reference.fare);
    if (reference?.reward) return rewardAmount(catalog, reference.reward);
    return token;
  });
}
module.exports = { dialogueText };
