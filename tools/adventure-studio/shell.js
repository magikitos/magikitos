"use strict";
const { Experiments } = require("./experiments/panel");
/** Shared shell; hashes select Studio tools, never a game route or game save. */
class StudioShell {
  constructor(view) {
    this.view = view;
    this.experiments = null;
    this.navigate = () => {
      const parts = location.hash.slice(1).split("/"),
        lab = parts[0] === "experiments";
      document.getElementById("map-panel").hidden = lab;
      document.getElementById("map-project-bar").hidden = lab;
      document.getElementById("experiments-panel").hidden = !lab;
      document.body.dataset.studioView = lab ? "experiments" : "map";
      for (const a of document.querySelectorAll("[data-studio-tab]"))
        a.setAttribute(
          "aria-current",
          a.dataset.studioTab === (lab ? "experiments" : "map")
            ? "page"
            : "false",
        );
      this.view.active = !lab;
      if (lab) {
        this.experiments ||= new Experiments(
          document.getElementById("experiments-panel"),
        );
        this.experiments.show(parts[1]);
      } else {
        this.experiments?.suspend();
        this.view.resize();
        this.view.dirty = true;
      }
    };
    window.addEventListener("hashchange", this.navigate);
    this.navigate();
  }
  inspect() {
    return {
      tab: document.body.dataset.studioView,
      experiments: this.experiments?.inspect(),
    };
  }
}
module.exports = { StudioShell };
