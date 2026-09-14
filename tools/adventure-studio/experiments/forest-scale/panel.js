"use strict";
const { ForestRuntime, PRESETS, STOPS } = require("./runtime");
const TITLES = {
  "boot-inn": "Posada del Cordón",
  "stump-home": "Casa entre raíces",
  "leaf-home": "Refugio de hojas",
  "mushroom-home": "Casa con esporas",
  "log-workshop": "Taller de corteza",
  "pot-home": "Maceta al revés",
  "ancient-root": "Raíces monumentales",
  "giant-fern": "Helechos enormes",
  "giant-clover": "Trébol con rocío",
  "giant-bolete": "Parasol de seta",
  "root-arch": "Arco de raíces",
  "scarlet-mushrooms": "Setas escarlata",
};
class ForestPanel {
  constructor(host) {
    this.host = host;
    this.active = false;
    this.mode = "walk";
    host.innerHTML = `<div class="forest-study">
   <aside class="forest-rail"><p class="experiment-kicker">ESTUDIO DE ESCALA · ARCHIVO</p><h1>Somos pequeños.<br> El mundo, no.</h1>
    <p>Sin casitas humanas. Un bosque construido con lo que encuentra un duende.</p>
    <div class="forest-mode" role="group" aria-label="Vista del experimento"><button data-forest-view="walk" aria-pressed="true">Recorrer</button><button data-forest-view="art" aria-pressed="false">Arte y escala</button></div>
    <section><h2>¿Cómo de pequeños?</h2><div class="forest-presets" role="group" aria-label="Proporción del entorno">${Object.entries(
      PRESETS,
    )
      .map(
        ([id, p]) =>
          '<button data-scale="' +
          id +
          '" aria-pressed="' +
          (id === "tiny") +
          '">' +
          p.label +
          "</button>",
      )
      .join("")}</div>
     <p id="forest-proportion" class="note"></p><p class="note">Cambia la proporción del entorno, no el zoom ni el tamaño del protagonista.</p></section>
    <section><h2>Rincones para comparar</h2><div class="forest-stops">${STOPS.map((s, i) => '<button data-stop="' + s.id + '"><small>0' + (i + 1) + "</small><span>" + s.title + "</span></button>").join("")}</div></section>
    <details class="forest-notes"><summary>Qué estamos probando</summary><p>Escala, siluetas y materiales encontrados. No son nuevas misiones ni interiores funcionales.</p><p>El botón de cada rincón te coloca allí solo en esta prueba. El juego y tu progreso quedan fuera.</p><p>Las hojas hacen de tejados, las raíces de muros y una sola orilla basta para sentir el río inmenso.</p></details>
   </aside>
   <div class="forest-area">
    <div id="forest-walk" class="forest-walk"><canvas id="forest-canvas" tabindex="0" aria-label="Bosque experimental. Flechas o WASD para caminar, clic para ir, arrastrar para observar, rueda o pellizco para zoom."></canvas>
     <div class="forest-toolbar"><span class="forest-stamp">ESCENA DE PRUEBA</span><div><button id="forest-center">Encontrarme</button><button id="forest-out" aria-label="Alejar">−</button><button id="forest-in" aria-label="Acercar">+</button><button id="forest-overview">Plano</button></div></div>
     <label class="forest-mobile-scale">Proporción<select id="forest-scale-compact" aria-label="Proporción del entorno"><option value="near">Cercana</option><option value="tiny" selected>Diminuta</option><option value="micro">Minúscula</option></select></label>
     <div class="forest-caption"><div><small id="forest-location-kicker">LA POSADA DEL CORDÓN</small><p id="forest-location">Antes olía a pie. Ahora sirven infusiones.</p></div><span id="forest-zoom">175%</span></div>
     <p class="forest-controls">Clic / flechas: caminar · arrastrar: observar · rueda / pellizco: zoom · espacio: rodar</p>
     <div id="forest-message" role="status" hidden></div>
     <div id="forest-start" role="status"><span>Preparando el experimento…</span><button id="forest-retry" hidden>Reintentar</button></div>
    </div>
    <section id="forest-art" class="forest-art" hidden><header><p class="experiment-kicker">DIRECCIÓN ARTÍSTICA</p><h2>Un bosque de cosas encontradas.</h2><p>Ilustración de intención y doce piezas nuevas. La ilustración no es una captura del escenario recorrible.</p></header><div id="forest-art-content"></div></section>
   </div></div>`;
    const q = (id) => host.querySelector("#" + id);
    this.q = q;
    this.runtime = new ForestRuntime(
      q("forest-canvas"),
      q("forest-walk"),
      () => this.paint(),
      (text) => this.notice(text),
    );
    for (const b of host.querySelectorAll("[data-scale]"))
      b.onclick = () => {
        if (this.runtime.ready) this.runtime.setPreset(b.dataset.scale);
      };
    for (const b of host.querySelectorAll("[data-stop]"))
      b.onclick = () => {
        this.setView("walk");
        this.runtime.visit(b.dataset.stop);
        const s = STOPS.find((s) => s.id === b.dataset.stop);
        q("forest-location-kicker").textContent = s.title;
        q("forest-location").textContent = s.subtitle;
      };
    for (const b of host.querySelectorAll("[data-forest-view]"))
      b.onclick = () => this.setView(b.dataset.forestView);
    q("forest-center").onclick = () => {
      this.runtime.followCamera = true;
      this.runtime.center(true);
      q("forest-canvas").focus({ preventScroll: true });
    };
    q("forest-in").onclick = () => this.runtime.zoomAt(1.2);
    q("forest-out").onclick = () => this.runtime.zoomAt(1 / 1.2);
    q("forest-overview").onclick = () =>
      this.runtime.zoomAt(0.55 / this.runtime.zoom);
    q("forest-scale-compact").onchange = () => {
      if (this.runtime.ready)
        this.runtime.setPreset(q("forest-scale-compact").value);
    };
    q("forest-retry").onclick = () => this.initialize();
    this.paint();
    this.initialize();
  }
  async initialize() {
    this.q("forest-retry").hidden = true;
    try {
      await this.runtime.initialize();
      this.q("forest-start").hidden = true;
      if (this.active && this.mode === "walk") this.runtime.setActive(true);
    } catch (e) {
      this.q("forest-start").querySelector("span").textContent =
        "No se ha podido preparar el arte local. " + e.message;
      this.q("forest-retry").hidden = false;
    }
  }
  paint() {
    this.q("forest-scale-compact").value = this.runtime.preset;
    for (const b of this.host.querySelectorAll(
      "[data-scale],[data-forest-view=art],#forest-scale-compact",
    ))
      b.disabled = !this.runtime.ready;
    for (const b of this.host.querySelectorAll("[data-scale]"))
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.scale === this.runtime.preset),
      );
    this.q("forest-proportion").textContent =
      PRESETS[this.runtime.preset].description;
    this.q("forest-zoom").textContent =
      Math.round(this.runtime.zoom * 100) + "%";
  }
  notice(text) {
    this.q("forest-message").textContent = text;
    this.q("forest-message").hidden = false;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(
      () => (this.q("forest-message").hidden = true),
      4500,
    );
  }
  setView(mode) {
    this.mode = mode;
    this.q("forest-walk").hidden = mode !== "walk";
    this.q("forest-art").hidden = mode !== "art";
    for (const b of this.host.querySelectorAll("[data-forest-view]"))
      b.setAttribute("aria-pressed", String(b.dataset.forestView === mode));
    if (mode === "art" && !this.gallery) {
      this.gallery = true;
      const content = this.q("forest-art-content");
      content.innerHTML =
        '<figure class="forest-concept"><img src="/experiments/forest-scale/art/concept.png" alt="Ilustración de intención: duendes diminutos entre enormes raíces, una posada en un zapato y un río sin otra orilla visible." loading="lazy"><figcaption>Intención visual · no es una captura del juego</figcaption></figure><div class="forest-art-grid"></div><p class="note">Arte generado con la herramienta integrada de imágenes. Originales y prompts conservados en este experimento; no sustituyen los assets del juego.</p>';
      for (const [name, title] of Object.entries(TITLES)) {
        const card = document.createElement("figure"),
          icon = this.runtime.art.icon(name);
        if (icon) card.append(icon);
        const caption = document.createElement("figcaption");
        caption.textContent = title;
        card.append(caption);
        content.querySelector(".forest-art-grid").append(card);
      }
    }
    this.runtime.setActive(this.active && mode === "walk");
  }
  setActive(active) {
    this.active = active;
    this.runtime.setActive(active && this.mode === "walk");
  }
  inspect() {
    return { ...this.runtime.inspect(), mode: this.mode };
  }
}
module.exports = { ForestPanel };
