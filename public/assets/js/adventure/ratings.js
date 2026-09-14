"use strict";
const { el, button } = require("./dom");
/** The existing website rating service owns validation, deduplication and reputation accounting. */
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
  const paint = () => {
    for (const node of choices.children) {
      node.disabled = busy;
      node.setAttribute(
        "aria-pressed",
        String(Number(node.dataset.value) === chosen),
      );
    }
  };
  for (let n = 1; n <= 5; n++) {
    const choice = button("", async () => {
      if (
        busy ||
        (item.kind === "expresion" && !game.media.completed.has(item.audio))
      )
        return;
      clearTimeout(game.media.advanceTimer);
      busy = true;
      paint();
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
        note.textContent = game.text("rated");
        if (
          game.media.item?.audio === item.audio &&
          (n <= 2 || game.media.audio.ended)
        )
          game.media.scheduleNext();
      } catch (_) {
        note.textContent = game.text("voteError");
      } finally {
        busy = false;
        paint();
      }
    });
    choice.dataset.value = String(n);
    choice.setAttribute(
      "aria-label",
      game.text("ratingCount").replace(":count", n),
    );
    const icon = game.renderer.sprites.icon("mushroom");
    if (icon) {
      icon.setAttribute("aria-hidden", "true");
      choice.append(icon);
    }
    choice.append(el("span", { text: n }));
    choices.append(choice);
  }
  root.append(
    el("p", { class: "world-rating-label", text: game.text("rate") }),
    choices,
    note,
  );
  paint();
  return root;
}
module.exports = { ratingView };
