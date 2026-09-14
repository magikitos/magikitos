"use strict";
const registry = require("./registry");
const { ForestPanel } = require("./forest-scale/panel");
const FRAMES = {
  "duende-cast": {
    slot: "cast",
    api: "MagikitosDuendeLab",
    title: "Duendes: diseños, escala y plan de poses",
  },
  "definition-motion": {
    slot: "definition",
    api: "MagikitosDefinitionLab",
    title: "Trazo y vida: definición y movimiento ambiental",
  },
  camera: {
    slot: "camera",
    api: "MagikitosCameraLab",
    title: "Cámara libre: comparar tres formas de construir el mundo",
  },
};
/** One Studio workspace, isolated experiments inside it. Archived media never becomes game data. */
class Experiments {
  constructor(host) {
    this.host = host;
    this.current = null;
    this.active = false;
    host.innerHTML = `<header class="experiments-bar"><div><span class="experiment-kicker">LABORATORIO</span><strong>Una decisión cada vez. El juego sigue intacto.</strong></div><nav aria-label="Experimentos">${registry.map((e) => '<a href="#experiments/' + e.id + '" data-experiment="' + e.id + '"><span>' + e.label + "</span><small>" + (e.status === "active" ? "En curso" : "Archivado") + "</small></a>").join("")}</nav></header><div id="experiment-content"></div>`;
  }
  show(id) {
    const entry = registry.find((e) => e.id === id) || registry[0];
    this.active = true;
    for (const a of this.host.querySelectorAll("[data-experiment]"))
      a.setAttribute(
        "aria-current",
        a.dataset.experiment === entry.id ? "page" : "false",
      );
    if (this.current === entry.id) {
      this.forest?.setActive(entry.id === "forest-scale");
      return;
    }
    this.forest?.setActive(false);
    this.releaseFrame();
    this.archive?.remove();
    this.archive = null;
    const body = this.host.querySelector("#experiment-content");
    body.replaceChildren();
    this.current = entry.id;
    if (FRAMES[entry.id]) {
      const spec = FRAMES[entry.id];
      const frame = document.createElement("iframe");
      frame.className = spec.slot + "-frame";
      frame.title = spec.title;
      frame.src = "/experiments/" + entry.id + "/view";
      // Same-origin trusted source: the iframe isolates lifecycle, not security.
      // Read-only server routes/CSP enforce the local resource boundary.
      body.append(frame);
      this[spec.slot] = frame;
    } else if (entry.id === "forest-scale") {
      if (!this.forestHost) {
        this.forestHost = document.createElement("div");
        this.forestHost.className = "forest-host";
        body.append(this.forestHost);
        this.forest = new ForestPanel(this.forestHost);
      } else body.append(this.forestHost);
      this.forest.setActive(true);
    } else {
      const intro = document.createElement("div");
      intro.className = "archive-intro";
      intro.innerHTML =
        '<div><span class="experiment-kicker">EXPERIMENTO CERRADO</span><h1>Conversar / Acercarse</h1><p>' +
        entry.description +
        '</p></div><span class="archive-badge">Archivo · no es la propuesta actual</span>';
      const frame = document.createElement("iframe");
      frame.className = "archive-frame";
      frame.title = "Experimento archivado Conversar / Acercarse";
      frame.src = "/experiments/conversation/view";
      frame.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-downloads",
      );
      body.append(intro, frame);
      this.archive = frame;
    }
  }
  releaseFrame() {
    for (const { slot, api } of Object.values(FRAMES)) {
      if (!this[slot]) continue;
      // Dispose synchronously before removing the trusted same-origin document.
      this[slot].contentWindow?.[api]?.dispose();
      this[slot].remove();
      this[slot] = null;
    }
  }
  suspend() {
    this.active = false;
    if (FRAMES[this.current]) {
      this.releaseFrame();
      this.current = null;
    }
    this.forest?.setActive(false);
    if (this.archive) {
      this.archive.remove();
      this.archive = null;
      this.current = null;
    }
  }
  inspect() {
    return {
      active: this.active,
      current: this.current,
      cast: this.cast?.contentWindow?.MagikitosDuendeLab?.inspect(),
      forest: this.forest?.inspect(),
      camera: this.camera?.contentWindow?.MagikitosCameraLab?.inspect(),
      definition:
        this.definition?.contentWindow?.MagikitosDefinitionLab?.inspect(),
      archived: registry
        .filter((e) => e.status === "archived")
        .map((e) => e.id),
    };
  }
}
module.exports = { Experiments };
