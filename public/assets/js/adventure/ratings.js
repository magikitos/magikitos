"use strict";
const { el, button } = require("./dom");
/** The existing website rating service owns validation, deduplication and reputation accounting.
 *
 * A voting bar, not a scoreboard: five mushrooms that fill up to wherever the
 * pointer is, and the average only once you have voted. Printing 1..5 next to
 * each one turned a gesture into a form, and showing an average before your own
 * vote is an anchor nobody asked for. */
function ratingView(game, item) {
  const ratingId = item.kind === "expresion" ? item.voiceId : item.id;
  if (!ratingId) return null;
  const type = item.kind === "expresion" ? "voz" : item.kind;
  const key = `${type}:${item.lang}:${ratingId}`;
  const saved = () => {
    try {
      const data = JSON.parse(localStorage.getItem("magikitos.setas") || "{}");
      return data && typeof data === "object" && !Array.isArray(data)
        ? data
        : {};
    } catch (_) {
      return {};
    }
  };
  const root = el("section", {
    class: "world-native-rating",
    "aria-label": game.text("rate"),
  });
  root.dataset.worldRating = "";
  const note = el("p", { role: "status", class: "world-experience-byline" });
  const choices = el("div", { class: "world-rating-choices" });
  let chosen = 0,
    busy = false;
  chosen = Number(saved()[key]) || 0;
  /** Fill up to `upto`, or back to your own vote when the pointer leaves. */
  const fill = (upto) => {
    const level = upto || chosen;
    for (const node of choices.children) {
      node.disabled = busy;
      const value = Number(node.dataset.value);
      node.classList.toggle("is-on", value <= level);
      node.setAttribute("aria-pressed", String(value === chosen));
    }
  };
  const average = (value) => {
    if (!Number.isFinite(value) || value <= 0) return;
    note.textContent = game
      .text("ratingAverage")
      .replace(
        ":value",
        new Intl.NumberFormat(game.config.locale, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(value),
      );
  };
  for (let n = 1; n <= 5; n++) {
    const choice = button("", async () => {
      if (
        busy ||
        (item.kind === "expresion" && !game.media.completed.has(item.audio))
      )
        return;
      busy = true;
      fill(n);
      note.textContent = game.text("sending");
      try {
        const token = await game.proof.request();
        const result = await game.api.request(
          "vote",
          {
            tipo: type,
            id: ratingId,
            lang: item.lang,
            setas: n,
            device_id: game.deviceId,
            turnstile_token: token,
          },
          { auth: true },
        );
        if (!result.ok) throw Error("vote_failed");
        chosen = n;
        try {
          localStorage.setItem(
            "magikitos.setas",
            JSON.stringify({ ...saved(), [key]: n }),
          );
        } catch (_) {}
        // The one number worth showing, and only now: what everyone else made of it.
        note.textContent = game.text("rated");
        average(Number(result.media));
      } catch (_) {
        note.textContent = game.text("voteError");
      } finally {
        busy = false;
        fill(0);
      }
    });
    choice.dataset.value = String(n);
    choice.setAttribute(
      "aria-label",
      game.text("ratingCount").replace(":count", n),
    );
    // Pointer and keyboard fill the same way; the bar reads identically to both.
    choice.addEventListener("pointerenter", () => !busy && fill(n));
    choice.addEventListener("focus", () => !busy && fill(n));
    choice.addEventListener("blur", () => !busy && fill(0));
    const icon = game.renderer.sprites.icon("mushroom");
    if (icon) {
      icon.setAttribute("aria-hidden", "true");
      choice.append(icon);
    }
    choices.append(choice);
  }
  choices.addEventListener("pointerleave", () => !busy && fill(0));
  root.append(
    el("p", { class: "world-rating-label", text: game.text("rate") }),
    choices,
    note,
  );
  fill(0);
  return root;
}
module.exports = { ratingView };
