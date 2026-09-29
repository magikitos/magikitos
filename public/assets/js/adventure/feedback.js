"use strict";
const { el } = require("./dom");

/** A draft belongs to this visit, survives closing the sheet, and is never sent automatically. */
class Feedback {
  constructor(game) { this.game = game; this.draft = ""; this.operation = null; this.sent = false; }
  render(signal) {
    const g = this.game, form = el("form", { class: "world-feedback" });
    const status = el("p", { class: "world-feedback-status", role: "status", "aria-live": "polite" });
    form.append(el("p", { class: "world-feedback-invitation", text: g.text("challengeFeedbackInvitation") }));
    if (this.sent) {
      form.append(el("p", { role: "status", text: g.text("feedbackSent") }));
      return form;
    }
    const input = el("textarea", {
      id: "world-feedback-text", name: "feedback", rows: 4, maxlength: 2000,
      minlength: 3, required: "", placeholder: g.text("feedbackPlaceholder"),
      "aria-describedby": "world-feedback-privacy",
    });
    input.value = this.draft;
    input.addEventListener("input", () => { this.draft = input.value; });
    const submit = el("button", { type: "submit", class: "world-primary", text: g.text("feedbackSend") });
    form.append(el("label", { for: input.id, text: g.text("feedbackLabel") }), input,
      el("p", { id: "world-feedback-privacy", class: "world-challenge-note", text: g.text("feedbackPrivacy") }),
      submit, status);
    let busy = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || signal.aborted) return;
      const text = input.value.trim();
      if (Array.from(text).length < 3) { status.textContent = g.text("feedbackTooShort"); input.focus(); return; }
      // Reuse the receipt id after an uncertain network response; an edit starts a new submission.
      if (this.operation?.text !== text) this.operation = { text, id: crypto.randomUUID() };
      const operation = this.operation;
      busy = true; submit.disabled = true; input.readOnly = true;
      submit.textContent = g.text("feedbackSending"); status.textContent = "";
      try {
        const token = await g.proof.request({ action: "game_feedback", signal, required: true });
        signal.throwIfAborted();
        const result = await g.api.request("feedback", {
          lang: g.config.locale, text, operationId: operation.id, turnstile_token: token,
        }, { signal, timeout: 25000 });
        if (result.sent !== true) throw Error("invalid_response");
        this.sent = true; this.draft = "";
        if (!signal.aborted) form.replaceChildren(el("p", { role: "status", text: g.text("feedbackSent") }));
      } catch (error) {
        if (!signal.aborted) status.textContent = g.text(
          error.status === 429 ? "feedbackTooMany" :
          /proof_|turnstile/.test(error.code || error.message) ? "feedbackProofError" : "feedbackError");
      } finally {
        busy = false; submit.disabled = false; input.readOnly = false;
        submit.textContent = g.text("feedbackSend");
      }
    });
    return form;
  }
}
module.exports = { Feedback };
