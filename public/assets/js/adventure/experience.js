"use strict";
/** Interaction presentation only. Media, ratings, cart and printable sheets retain their owners. */
class WorldExperience {
  constructor(game) {
    this.game = game;
    document
      .getElementById("content-back")
      .addEventListener("click", () => game.site.back());
    document
      .getElementById("content-exit")
      .addEventListener("click", () => game.closeContent());
    document.addEventListener("click", (event) => {
      const button = event.target.closest("#world-content button");
      if (!button) return;
      if (button.hasAttribute("data-world-detail")) game.site.details();
      if (button.hasAttribute("data-world-auto"))
        game.media.setAuto(!game.media.auto);
      if (button.hasAttribute("data-world-gallery-step"))
        this.step(
          button.closest("[data-world-gallery]"),
          Number(button.dataset.worldGalleryStep),
        );
    });
    document.addEventListener("input", (event) => {
      if (!event.target.matches("[data-world-seek]")) return;
      const duration = game.media.duration();
      if (duration)
        game.media.audio.currentTime =
          (Number(event.target.value) / 1000) * duration;
    });
    document.addEventListener("world:mount", () => this.mount());
  }
  mount() {
    document.querySelectorAll("[data-world-gallery]").forEach((root) => {
      if (root.dataset.galleryReady) return;
      root.dataset.galleryReady = "true";
      root.galleryItems = JSON.parse(
        root.querySelector("[data-world-gallery-items]").textContent,
      );
      root.galleryIndex = 0;
      this.step(root, 0);
      let start = null;
      const image = root.querySelector(".world-experience-image");
      image.addEventListener("pointerdown", (e) => {
        start = { x: e.clientX, y: e.clientY };
      });
      image.addEventListener("pointercancel", () => {
        start = null;
        root.swiped = false;
      });
      image.addEventListener("pointerup", (e) => {
        if (!start) return;
        const dx = e.clientX - start.x,
          dy = e.clientY - start.y;
        start = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
          this.step(root, dx < 0 ? 1 : -1);
          root.swiped = true;
        }
      });
      image.addEventListener("click", (e) => {
        if (root.swiped) {
          e.stopPropagation();
          root.swiped = false;
        }
      });
    });
    this.game.media.paint();
  }
  step(root, amount) {
    const items = root.galleryItems;
    if (!items?.length) return;
    root.galleryIndex =
      (root.galleryIndex + amount + items.length) % items.length;
    const item = items[root.galleryIndex],
      image = root.querySelector("[data-world-gallery-image]");
    image.src = item.src;
    image.alt = item.alt;
    root.querySelector("[data-world-gallery-count]").textContent =
      root.galleryIndex + 1 + " / " + items.length;
    root
      .querySelectorAll("[data-world-gallery-step]")
      .forEach((b) => (b.hidden = items.length < 2));
    root
      .querySelectorAll(".js-colorear-print,.js-colorear-download")
      .forEach((b) => {
        b.dataset.full = item.src;
        if (item.downloadName) b.dataset.name = item.downloadName;
      });
  }
  focus(open) {
    this.game.renderer.resize(open ? 1.35 : 1);
    document.body.classList.toggle("world-reading-open", open);
    this.game.media?.paint();
  }
}
module.exports = { WorldExperience };
