"use strict";
/** Presentation of native activities only. The normal website never mounts inside this surface. */
class WorldExperience {
  constructor(game) {
    this.game = game;
    document
      .getElementById("content-exit")
      .addEventListener("click", () => game.closeContent());
  }
  focus(open) {
    this.game.renderer.resize(open ? 1.35 : 1);
    document.body.classList.toggle("world-reading-open", open);
    this.game.media?.paint();
    if (this.game.ready) {
      this.game.centerCamera();
      this.game.renderer.render(
        this.game,
        this.game.reducedMotion ? 0 : performance.now() / 1000,
      );
    }
  }
}
module.exports = { WorldExperience };
