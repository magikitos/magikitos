"use strict";
const { el, button } = require("./dom");
const { activity, pieceView, galleryView } = require("./activities");
/** Native activity surface. API data never becomes HTML, CSS, scripts or URL-driven gameplay. */
class WorldSite {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.scales = new (require("./setometro").Setometro)(game);
    this.restaurant = new (require("./restaurant").Restaurant)(game);
    this.diary = new (require("./diary").Diary)(game);
    this.pending = null;
    this.body = document.getElementById("world-content-body");
    if (location.search || location.hash)
      history.replaceState(null, "", game.config.baseUrl);
  }
  /** A panel with no room (the welcome) frames your brownie: asking the rooms for an undefined
   * room would match the first entity without an id and send the camera to NaN. */
  focus() {
    return this.current ? this.game.rooms.focus(this.current.group) : null;
  }
  cancel() {
    this.pending?.abort();
    this.pending = null;
    document.getElementById("world-content").removeAttribute("aria-busy");
  }
  begin(group) {
    if (!this.game.rooms.contains(group)) {
      this.game.toast(this.game.text("contentInItsPlace"));
      return null;
    }
    this.cancel();
    this.pending = new AbortController();
    this.current = { group };
    this.game.pauseMovement();
    this.game.closeDialogue();
    return this.pending;
  }
  mount(root, request = this.pending) {
    if (
      !request ||
      request.signal.aborted ||
      request !== this.pending ||
      !this.game.rooms.contains(this.current.group)
    )
      return false;
    this.body.replaceChildren(root);
    document.getElementById("world-content").dataset.presentation =
      "experience";
    this.game.showContent();
    this.game.media.paint();
    this.body.scrollTop = 0;
    root.querySelector("h1")?.focus({ preventScroll: true });
    return true;
  }
  /** A panel that is not a content room (the welcome): same sheet, no room to walk to, so no
   * `current` — the rooms' guard closes any panel whose room is out of reach, and this one has
   * none. `held` keeps a stray tap on the map from closing it; only its own buttons or the exit do. */
  present(root) {
    this.cancel();
    this.current = null;
    this.body.replaceChildren(root);
    const sheet = document.getElementById("world-content");
    sheet.dataset.presentation = "experience";
    sheet.toggleAttribute("data-held", true);
    this.game.showContent();
    this.body.scrollTop = 0;
  }
  async load(group, title, task, retry) {
    const request = this.begin(group);
    if (!request) return;
    const root = activity(this.game, group, title);
    root.append(
      el("p", {
        class: "world-experience-byline",
        role: "status",
        text: this.game.text("findingContent"),
      }),
    );
    this.mount(root, request);
    document.getElementById("world-content").setAttribute("aria-busy", "true");
    try {
      await this.game.content.bootstrap();
      if (request.signal.aborted) return;
      const node = await task(request.signal, request);
      if (node) this.mount(node, request);
    } catch (error) {
      if (request.signal.aborted || request !== this.pending) return;
      const failed = activity(this.game, group, title);
      failed.append(
        el("p", { role: "status", text: this.game.text("contentUnavailable") }),
        button(this.game.text("retry"), retry, "world-primary"),
      );
      this.mount(failed, request);
    } finally {
      if (this.pending === request)
        document.getElementById("world-content").removeAttribute("aria-busy");
    }
  }
  showPiece(item, { play = false } = {}) {
    if (item.kind === "recipe") { this.restaurant.show(item); if (play) this.game.media.start(item); return; }
    const group = this.game.rooms.forKind(item.kind),
      request = this.begin(group);
    if (!request) return;
    this.current = { group, item, path: item.url };
    this.mount(pieceView(this.game, item), request);
    if (play) this.game.media.start(item);
  }
  open(group) {
    if (group === "restaurant") return this.restaurant.open();
    if (group === "diary") return this.diary.open();
    if (group === "setometro") return this.scales.open();
    if (group === "art") return this.art();
    const kind = this.game.catalog.contentRooms[group]?.kinds?.find((k) =>
      ["cuento", "chiste", "expresion"].includes(k),
    );
    if (!kind) return;
    return this.browse(kind);
  }
  empty(group, more) {
    const root = activity(this.game, group, this.game.text(group));
    root.append(el("p", { text: this.game.text("empty") }));
    if (more) root.append(button(this.game.text("choose"), more));
    return root;
  }
  browse(kind, filters = {}) {
    const group = this.game.rooms.forKind(kind),
      game = this.game;
    game.telemetry?.listen("index", kind);
    return this.load(
      group,
      game.text("index"),
      async (signal) => {
        const [data, index] = await Promise.all([
          game.api.request("browse", { kind, ...filters }, { signal }),
          game.api.request("index", { kind }, { signal }),
        ]);
        const root = activity(game, group, game.text("index"));
        root.classList.add("world-native-library");
        const input = el("input", {
          type: "search",
          value: filters.q || "",
          maxlength: 100,
          placeholder: game.text("searchHint"),
          "aria-label": game.text("search"),
        });
        const select = el(
          "select",
          {
            "aria-label": game.text(
              kind === "expresion" ? "regions" : "categories",
            ),
          },
          [el("option", { value: "", text: game.text("all") })],
        );
        for (const row of index.items || [])
          if (typeof row.id === "string" && typeof row.title === "string")
            select.append(el("option", { value: row.id, text: row.title }));
        select.value = filters.region || filters.category || "";
        select.onchange = () =>
          this.browse(
            kind,
            select.value
              ? { [kind === "expresion" ? "region" : "category"]: select.value }
              : {},
          );
        const submit = el("button", {
          type: "submit",
          text: game.text("search"),
        });
        const form = el(
          "form",
          {
            class: "world-native-search",
            on: {
              submit: (event) => {
                event.preventDefault();
                this.browse(
                  kind,
                  input.value.trim() ? { q: input.value.trim() } : {},
                );
              },
            },
          },
          [input, submit, select],
        );
        const list = el("div", { class: "world-native-list" });
        const append = (rows) => {
          for (const item of game.api.pieces(rows))
            list.append(button(item.title, () => this.showPiece(item)));
        };
        append(data);
        root.append(form, list);
        if (!data.items.length)
          root.append(
            el("p", { role: "status", text: game.text("noResults") }),
          );
        if (game.api.cursor(data) !== null) {
          let cursor = data.nextCursor,
            busy = false;
          const more = button(game.text("more"), async () => {
            if (busy || cursor === null) return;
            busy = true;
            more.disabled = true;
            try {
              const next = await game.api.request(
                "browse",
                { kind, ...filters, cursor },
                { signal },
              );
              append(next);
              cursor = game.api.cursor(next, cursor);
              more.hidden = cursor === null;
            } catch (_) {
              if (!signal.aborted) game.toast(game.text("contentUnavailable"));
            } finally {
              busy = false;
              more.disabled = false;
            }
          });
          root.append(more);
        }
        return root;
      },
      () => this.browse(kind, filters),
    );
  }
  art() {
    return this.load(
      "art",
      this.game.text("artSheets"),
      async (signal) =>
        galleryView(
          this.game,
          await this.game.content.catalogue("art", signal),
          (cursor) => this.game.content.catalogue("art", signal, cursor),
          signal,
        ),
      () => this.art(),
    );
  }
}
module.exports = { WorldSite };
