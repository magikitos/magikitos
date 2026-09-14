"use strict";
const { el, button, websiteLink } = require("./dom");
const { ratingView } = require("./ratings");
const { format } = require("./media");
function activity(game, group, title) {
  const root = el("article", {
    class: "world-experience world-experience--" + group,
  });
  root.append(
    el("p", { class: "world-experience-eyebrow", text: game.text(group) }),
    el("h1", { text: title, tabindex: "-1" }),
  );
  return root;
}
function pieceView(game, item) {
  const group = game.rooms.forKind(item.kind),
    root = activity(game, group, item.title);
  const byline = el("p", { class: "world-experience-byline" });
  if (item.name)
    byline.append(
      websiteLink(game, item.name, item.authorUrl) ||
        document.createTextNode(item.name),
    );
  if (item.region) byline.append(document.createTextNode(" · " + item.region));
  root.append(byline);
  if (item.kind === "expresion" && item.summary)
    root.append(el("p", { class: "world-native-summary", text: item.summary }));
  const play = button(
    game.text("listen"),
    () => game.media.start(item, true),
    "world-primary",
  );
  play.dataset.worldPlay = "";
  play.disabled = !item.audio;
  const next = button(game.text("another") + " ↠", () =>
    game.media.next(item.kind),
  );
  next.dataset.worldNext = item.kind;
  const actions = el("div", { class: "world-experience-actions" }, [
    play,
    next,
  ]);
  root.append(actions);
  if (item.audio) {
    const seek = el("input", {
      type: "range",
      min: 0,
      max: 1000,
      value: 0,
      "data-world-seek": "",
      "aria-label": game.text("playbackPosition"),
      on: { input: (e) => game.media.seek(e.target.value) },
    });
    root.append(
      el("div", { class: "world-experience-progress" }, [
        el("time", { "data-world-elapsed": "", text: "0:00" }),
        seek,
        el("time", { "data-world-duration": "", text: format(item.duration) }),
      ]),
      ratingView(game, item),
    );
  }
  const auto = button(game.text("auto"), () =>
    game.media.setAuto(!game.media.auto),
  );
  auto.dataset.worldAuto = "";
  const links = el("div", { class: "world-experience-links" }, [
    button(game.text("choose"), () => game.site.browse(item.kind)),
    auto,
    websiteLink(game, game.text("openWebsite") + " ↗", item.url),
    websiteLink(
      game,
      game.text(
        item.kind === "cuento"
          ? "recordStory"
          : item.kind === "chiste"
            ? "recordJoke"
            : "sendExpression",
      ),
      game.config.destinations[
        item.kind === "cuento"
          ? "recordStory"
          : item.kind === "chiste"
            ? "recordJoke"
            : "sendExpression"
      ],
    ),
  ]);
  if (item.kind === "expresion")
    links.append(
      button(game.text("helpGuardian"), () => game.guardianChat.summon(item)),
    );
  if (game.media.historyIndex > 0)
    links.prepend(
      button("↞ " + game.text("previous"), () => game.media.previous()),
    );
  root.append(links);
  return root;
}
function productView(game, item) {
  const root = activity(game, "shop", item.name);
  root.prepend(
    el("figure", { class: "world-experience-object" }, [
      el(
        "div",
        { class: "world-experience-image" },
        item.image
          ? [
              el("img", {
                src: item.image,
                alt: item.name,
                width: 300,
                height: 300,
              }),
            ]
          : [],
      ),
    ]),
  );
  root.classList.add("world-experience--product");
  root.append(
    el("p", {
      class: "world-experience-price",
      text: new Intl.NumberFormat(game.config.locale, {
        style: "currency",
        currency: "EUR",
      }).format(item.price / 100),
    }),
  );
  root.append(
    el("p", {
      class: "world-experience-byline",
      text: game.text("physicalPiece"),
    }),
  );
  root.append(
    el("div", { class: "world-experience-actions" }, [
      websiteLink(
        game,
        game.text("buyOnWebsite") + " ↗",
        item.url,
        "world-primary",
      ),
    ]),
  );
  root.append(
    el("div", { class: "world-experience-links" }, [
      button(game.text("catalogue"), () => game.site.open("shop")),
    ]),
  );
  return root;
}
function galleryView(game, data, onNextPage, choose) {
  const root = activity(game, "art", data.collection.title);
  root.classList.add("world-experience--art");
  const image = el("img", { alt: "", width: 300, height: 350 });
  const count = el("figcaption", { "data-world-gallery-count": "" });
  const imageBox = el("div", { class: "world-experience-image" }, [image]);
  let index = 0,
    busy = false,
    nextCursor = data.nextCursor,
    items = data.items;
  const paint = () => {
    const item = items[index];
    if (!item) return;
    image.src = item.image;
    image.alt = item.title;
    count.textContent =
      index + 1 + " / " + items.length + (nextCursor !== null ? " +" : "");
    prev.hidden = items.length < 2;
    next.hidden = items.length < 2 && nextCursor === null;
  };
  const step = async (delta) => {
    if (busy) return;
    if (delta > 0 && index === items.length - 1 && nextCursor !== null) {
      busy = true;
      next.disabled = true;
      try {
        const more = await onNextPage(nextCursor);
        items = items.concat(more.items);
        nextCursor = more.nextCursor;
      } catch (_) {
        game.toast(game.text("contentUnavailable"));
        return;
      } finally {
        busy = false;
        next.disabled = false;
      }
    }
    index = (index + delta + items.length) % items.length;
    paint();
  };
  const prev = button("‹", () => step(-1)),
    next = button("›", () => step(1));
  prev.setAttribute("aria-label", game.text("previous"));
  next.setAttribute("aria-label", game.text("next"));
  root.prepend(
    el("figure", { class: "world-experience-object" }, [
      prev,
      imageBox,
      next,
      count,
    ]),
  );
  let start;
  imageBox.addEventListener("pointerdown", (e) => {
    start = { x: e.clientX, y: e.clientY };
  });
  imageBox.addEventListener("pointercancel", () => {
    start = null;
  });
  imageBox.addEventListener("pointerup", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x,
      dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  });
  root.append(
    el("p", { class: "world-experience-byline", text: game.text("paperArt") }),
    el("div", { class: "world-experience-actions" }, [
      websiteLink(
        game,
        game.text("printOnWebsite") + " ↗",
        data.collection.url,
        "world-primary",
      ),
    ]),
    el("div", { class: "world-experience-links" }, [
      button(game.text("collections"), choose),
    ]),
  );
  if (items.length) paint();
  else root.append(el("p", { text: game.text("empty") }));
  return root;
}
module.exports = { activity, pieceView, productView, galleryView };
