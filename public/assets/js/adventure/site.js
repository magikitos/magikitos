"use strict";
/** Native experiences and deliberate reading/search. No route-driven spawn or URL history. */
class WorldSite {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.scripts = new Set(
      [...document.scripts].filter((s) => s.src).map((s) => s.src),
    );
    this.styles = new Set(
      [...document.querySelectorAll("link[href]")].map((s) => s.href),
    );
    if (location.search || location.hash)
      history.replaceState(null, "", game.config.baseUrl);
    document.addEventListener("click", (event) => {
      const a = event.target.closest("#world-content a[href]");
      if (
        !a ||
        a.hasAttribute("download") ||
        event.defaultPrevented ||
        event.button ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      if (a.target) return;
      const url = new URL(a.href);
      if (
        url.origin !== location.origin ||
        url.pathname.startsWith("/assets/") ||
        url.pathname.startsWith("/api/")
      )
        return;
      if (a.getAttribute("href").startsWith("#")) return;
      event.preventDefault();
      this.navigate(url.href);
    });
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (
        event.defaultPrevented ||
        form.method.toLowerCase() !== "get" ||
        !form.closest("#world-content")
      )
        return;
      const url = new URL(form.action);
      for (const [key, value] of new FormData(form))
        url.searchParams.set(key, value);
      if (!this.isContent(url)) return;
      event.preventDefault();
      this.navigate(url.href);
    });
    window.MagikitosWorld = Object.freeze({
      navigate: (url) => this.navigate(url),
    });
  }
  isContent(url) {
    const config = this.game.config,
      path = url.pathname;
    return (
      url.origin === location.origin &&
      !config.contentExits.some(
        (exit) => path === exit || path.startsWith(exit + "/"),
      ) &&
      (path === config.destinations.shop ||
        config.contentRoots.some(
          (root) => path === root || path.startsWith(root + "/"),
        ))
    );
  }
  focus() {
    return (
      this.game.world.entities.find(
        (e) => e.product?.url === this.current?.path,
      ) || this.game.rooms.focus(this.current?.group)
    );
  }
  cancel() {
    this.pending?.abort();
    document.getElementById("world-content").removeAttribute("aria-busy");
  }
  async navigate(value, options = {}) {
    const url = new URL(value, location.href),
      game = this.game;
    if (!this.isContent(url)) {
      game.save();
      location.assign(url.href);
      return false;
    }
    this.cancel();
    const request = new AbortController();
    this.pending = request;
    const sheet = document.getElementById("world-content");
    sheet.setAttribute("aria-busy", "true");
    game.pauseMovement();
    game.closeDialogue();
    try {
      const response = await fetch(
        game.config.contentEndpoint +
          "?" +
          new URLSearchParams({
            path: url.pathname + url.search,
            lang: game.config.locale,
            ...(options.piece?.voiceId ? { voice: options.piece.voiceId } : {}),
          }),
        { signal: request.signal },
      );
      if (!response.ok) throw new Error("Content unavailable");
      const page = await response.json();
      if (options.enter && page.entryPath && !request.signal.aborted)
        return await this.navigate(page.entryPath, {
          ...options,
          enter: false,
        });
      if (request.signal.aborted) return false;
      if (!game.rooms.contains(page.group)) {
        game.toast(game.s.contentInItsPlace);
        return false;
      }
      document.dispatchEvent(new CustomEvent("world:unmount"));
      const doc = new DOMParser().parseFromString(
        '<body><div id="fragment">' +
          page.body +
          '</div><div id="assets">' +
          page.assets +
          "</div></body>",
        "text/html",
      );
      for (const source of doc.querySelectorAll(
        'link[rel="stylesheet"],link[as="style"]',
      )) {
        if (this.styles.has(source.href)) continue;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = source.href;
        document.head.append(link);
        this.styles.add(source.href);
      }
      document.getElementById("world-route-style")?.remove();
      const style = document.createElement("style");
      style.id = "world-route-style";
      style.textContent = page.critical;
      document.head.append(style);
      const body = document.getElementById("world-content-body");
      body.innerHTML = page.experience || "";
      if (!page.experience)
        body.replaceChildren(...doc.getElementById("fragment").childNodes);
      this.detailDoc = doc;
      this.inDetails = !page.experience;
      this.experienceNode = page.experience ? body.firstElementChild : null;
      this.detailsNode = null;
      sheet.dataset.presentation = page.experience ? "experience" : "browse";
      document.getElementById("content-back").hidden = !this.inDetails;
      if (page.experience)
        this.lastExperience = { path: page.path, group: page.group };
      document.querySelector(".world-folio-path").innerHTML = page.navigation;
      for (const attr of [...document.body.attributes])
        if (attr.name.startsWith("data-"))
          document.body.removeAttribute(attr.name);
      for (const [key, value] of Object.entries(page.bodyAttributes || {}))
        document.body.setAttribute("data-" + key, value);
      this.current = page;
      sheet.dataset.worldView = page.view;
      await this.mountScripts(doc, request.signal);
      if (request.signal.aborted || !game.rooms.contains(page.group))
        return false;
      game.showContent();
      document.getElementById("world-content-body").scrollTop = 0;
      document.dispatchEvent(new CustomEvent("world:mount"));
      window.Magikitos?.initProductCarousels?.();
      window.magikitosCart?.updateCartUI?.();
      game.paintCards();
      if (options.play)
        await game.media.start(options.piece || game.media.fromPage());
      const title = sheet.querySelector("h1");
      if (title) {
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
      }
      return true;
    } catch (error) {
      if (error.name !== "AbortError") game.toast(game.s.loadError);
      return false;
    } finally {
      if (this.pending === request) sheet.removeAttribute("aria-busy");
    }
  }
  async details() {
    if (this.inDetails || !this.current?.experience) return;
    document.dispatchEvent(new CustomEvent("world:unmount"));
    this.inDetails = true;
    const body = document.getElementById("world-content-body");
    if (!this.detailsNode) {
      this.detailsNode = document.createElement("div");
      this.detailsNode.className = "world-reading-detail";
      if (this.current.view === "colorear-collection") {
        const gallery = this.experienceNode;
        const item = gallery.galleryItems[gallery.galleryIndex];
        const heading = document.createElement("h1");
        heading.textContent = item.alt;
        const image = document.createElement("img");
        image.src = item.src;
        image.alt = item.alt;
        image.className = "world-large-sheet";
        const actions = document.createElement("div");
        actions.className = "world-piece-actions";
        gallery
          .querySelectorAll(".js-colorear-print,.js-colorear-download")
          .forEach((b) => actions.append(b.cloneNode(true)));
        this.detailsNode.append(heading, image, actions);
      } else this.detailsNode.innerHTML = this.current.body;
      body.replaceChildren(this.detailsNode);
      await this.mountScripts(this.detailDoc, this.pending.signal);
      if (this.pending.signal.aborted) return;
    }
    body.replaceChildren(this.detailsNode);
    document.getElementById("world-content").dataset.presentation = "reading";
    document.getElementById("content-back").hidden = false;
    body.scrollTop = 0;
    document.dispatchEvent(new CustomEvent("world:mount"));
    const title = this.detailsNode.querySelector("h1");
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }
  back() {
    if (this.current?.experience && this.inDetails) {
      document.dispatchEvent(new CustomEvent("world:unmount"));
      this.inDetails = false;
      if (this.current.view === "colorear-collection") this.detailsNode = null;
      document
        .getElementById("world-content-body")
        .replaceChildren(this.experienceNode);
      document.getElementById("world-content").dataset.presentation =
        "experience";
      document.getElementById("content-back").hidden = true;
      this.experienceNode.querySelector("h1")?.focus({ preventScroll: true });
      document.dispatchEvent(new CustomEvent("world:mount"));
    } else if (this.lastExperience?.group === this.current?.group)
      this.navigate(this.lastExperience.path);
    else this.game.closeContent();
  }
  async mountScripts(doc, signal) {
    // Body scripts are retained in the live fragment but inert until explicitly mounted.
    for (const source of [
      ...document.querySelectorAll("#world-content-body script"),
      ...doc.querySelectorAll("#assets script"),
    ]) {
      if (signal.aborted) return;
      if (source.type && source.type !== "text/javascript") continue;
      if (source.src) {
        if (this.scripts.has(source.src)) continue;
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = source.src;
          script.onload = resolve;
          script.onerror = () => reject(new Error("Component unavailable"));
          document.body.append(script);
        });
        this.scripts.add(source.src);
      } else {
        const script = document.createElement("script");
        script.textContent = "(()=>{\n" + source.textContent + "\n})();";
        document.body.append(script);
        script.remove();
      }
    }
  }
}
module.exports = { WorldSite };
