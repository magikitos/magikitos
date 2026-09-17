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
  // One way back out (the index) and one invitation, earned. "See it on the
  // website" sent you out of the game to read the same piece, and the autoplay
  // toggle asked you to configure listening before you had listened to anything.
  const links = el("div", { class: "world-experience-links" }, [
    button(game.text("index"), () => game.site.browse(item.kind)),
  ]);
  const contributeKey =
    item.kind === "cuento"
      ? "recordStory"
      : item.kind === "chiste"
        ? "recordJoke"
        : "sendExpression";
  // Asking for your own story before you have heard three is asking a stranger
  // to sing. media.paint() reveals it the moment the third one ends.
  const contribute = websiteLink(
    game,
    game.text(item.kind === "expresion" ? "sayItBetter" : contributeKey),
    game.config.destinations[contributeKey],
  );
  if (contribute) {
    contribute.dataset.worldContribute = item.kind;
    contribute.hidden = !game.media.earned(item.kind);
    // The one jump out of the game that is worth knowing about: it is the whole
    // point of the room, and the earned invitation lives or dies by this number.
    contribute.addEventListener("click", () =>
      game.telemetry?.contribute(item.kind),
    );
    links.append(contribute);
  }
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
/** One flat catalogue. Thumbnails are the grid; a master is requested only for a chosen sheet. */
function galleryView(game, data, onNextPage, signal) {
  const root = activity(game, "art", game.text("artSheets"));
  root.classList.add("world-experience--art");
  const grid = el("div", { class: "world-native-catalogue" });
  const image = el("img", { alt: "", width: 300, height: 350 });
  const count = el("figcaption", { "data-world-gallery-count": "" });
  const imageBox = el("div", { class: "world-experience-image" }, [image]);
  let index = 0,
    busy = false,
    nextCursor = data.nextCursor;
  const items = [],
    ids = new Set();
  const title = root.querySelector("h1");
  const paint = () => {
    const item = items[index];
    if (!item) return;
    image.src = item.image;
    image.alt = title.textContent = item.title;
    count.textContent =
      index + 1 + " / " + items.length + (nextCursor !== null ? " +" : "");
    prev.hidden = items.length < 2;
    next.hidden = items.length < 2 && nextCursor === null;
  };
  const select = (i) => {
    index = i;
    grid.hidden = more.hidden = true;
    figure.hidden = back.hidden = false;
    paint();
    title.focus({ preventScroll: true });
  };
  const append = (rows) => {
    for (const item of rows) {
      if (ids.has(item.id)) continue;
      ids.add(item.id);
      const i = items.length;
      items.push(item);
      const card = button("", () => select(i), "world-native-card");
      card.append(
        el("img", {
          src: item.thumb,
          alt: "",
          width: 120,
          height: 120,
          loading: "lazy",
        }),
        el("strong", { text: item.title }),
      );
      grid.append(card);
    }
  };
  const loadPage = async () => {
    if (busy || nextCursor === null || signal?.aborted) return false;
    busy = true;
    more.disabled = next.disabled = true;
    try {
      const page = await onNextPage(nextCursor);
      if (signal?.aborted) return false;
      append(page.items);
      nextCursor = page.nextCursor;
      more.hidden = !figure.hidden || nextCursor === null;
      return true;
    } catch (_) {
      if (!signal?.aborted) game.toast(game.text("contentUnavailable"));
      return false;
    } finally {
      busy = false;
      more.disabled = next.disabled = false;
    }
  };
  const step = async (delta) => {
    if (busy || !items.length) return;
    if (delta > 0 && index === items.length - 1 && nextCursor !== null)
      if (!(await loadPage())) return;
    index = (index + delta + items.length) % items.length;
    paint();
  };
  const prev = button("‹", () => step(-1)),
    next = button("›", () => step(1));
  prev.setAttribute("aria-label", game.text("previous"));
  next.setAttribute("aria-label", game.text("next"));
  const figure = el(
    "figure",
    { class: "world-experience-object", hidden: true },
    [prev, imageBox, next, count],
  );
  const more = button(game.text("more"), loadPage);
  more.hidden = nextCursor === null;
  const back = button(game.text("artSheets"), () => {
    figure.hidden = back.hidden = true;
    grid.hidden = false;
    more.hidden = nextCursor === null;
    title.textContent = game.text("artSheets");
    grid.children[index]?.focus({ preventScroll: true });
  });
  back.hidden = true;
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
  append(data.items);
  root.append(
    figure,
    grid,
    more,
    el("p", { class: "world-experience-byline", text: game.text("paperArt") }),
    el("div", { class: "world-experience-actions" }, [
      websiteLink(
        game,
        game.text("printOnWebsite") + " ↗",
        game.config.destinations.art,
        "world-primary",
      ),
    ]),
    el("div", { class: "world-experience-links" }, [back]),
  );
  if (!items.length) root.append(el("p", { text: game.text("empty") }));
  return root;
}
module.exports = { activity, pieceView, galleryView };
