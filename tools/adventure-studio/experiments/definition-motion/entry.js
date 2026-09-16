"use strict";
const { DefinitionStudy } = require("./runtime");
const config = require("./assets.json");
const { DETAIL } = require("./scene");
const $ = (id) => document.getElementById(id),
  kb = (n) => (n / 1024).toFixed(1) + " KiB";
const abort = new AbortController();
let study;
function on(target, event, fn) {
  target.addEventListener(event, fn, { signal: abort.signal });
}
function settings(open) {
  document.body.classList.toggle("settings-open", open);
  $("settings-toggle").setAttribute("aria-expanded", String(open));
  (open ? $("settings-close") : $("scene")).focus({ preventScroll: true });
}
const notes = {
  still: "Sin movimiento. Úsala para juzgar primero el trazo y la definición.",
  selective:
    "Personas y algunas plantas. Pausas largas y fases independientes; objetos rígidos quietos.",
  all: "Prueba de exceso: también respiran cuchillo, comida, manta y casa. Observa si distrae o parece gelatina.",
};
function update(s) {
  if (s.error) {
    $("notice").textContent = s.error + " Cambia de opción para reintentar.";
    return;
  }
  if (!s.ready) {
    $("notice").textContent = "Preparando solo los objetos de esta vista…";
    return;
  }
  $("notice").textContent = s.pending ? "Preparando esta comparación…" : "";
  document.body.dataset.view = s.view;
  document.body.dataset.compare = String(s.compare);
  document.body.dataset.detailStack = String(s.detailStack);
  $("profile").value = s.profile;
  $("subject").value = s.subject;
  $("compare").checked = s.compare;
  $("wipe-label").hidden = s.view !== "scene" || !s.compare;
  $("subject").disabled = s.view !== "detail";
  $("a-label").hidden = !s.compare;
  $("divider").style.left = s.wipe + "%";
  const profile = config.profiles.find((p) => p.id === s.shownProfile);
  $("b-label").lastChild.textContent = " " + profile.label;
  $("profile-note").textContent = config.profiles.find(
    (p) => p.id === s.profile,
  ).note;
  $("play").textContent = s.playing ? "Pausar" : "Animar";
  $("play").setAttribute("aria-pressed", String(s.playing));
  $("zoom-value").textContent = s.zoom.toFixed(1) + "×";
  $("time-value").textContent = s.time.toFixed(1) + " s";
  if (document.activeElement !== $("timeline")) {
    $("timeline").max = Math.max(30, Math.ceil(s.time / 30) * 30);
    $("timeline").value = s.time;
  }
  $("motion-note").textContent = notes[s.mode];
  $("motion-badge").textContent = {
    still: "Sin movimiento",
    selective: "Vida selectiva",
    all: "Todo en movimiento",
  }[s.mode];
  $("subject-note").textContent =
    s.view === "scene"
      ? "Arrastra para recorrer · rueda o pellizco para el zoom · mismo encuadre A/B"
      : s.logical
        ? "Huella fija: " +
          s.logical.w +
          " × " +
          s.logical.h +
          " · duende y objeto a la misma escala en A y B."
        : "";
  for (const b of document.querySelectorAll("[data-view]"))
    b.setAttribute("aria-pressed", String(b.dataset.view === s.view));
  for (const b of document.querySelectorAll("[data-motion]"))
    b.setAttribute("aria-pressed", String(b.dataset.motion === s.mode));
  $("verdict-title").textContent =
    profile.label +
    " · " +
    {
      still: "escena quieta",
      selective: "vida selectiva",
      all: "todo animado",
    }[s.mode];
  $("png-budget").textContent =
    kb(s.baseline.pngBytes) + " / " + kb(s.candidate.pngBytes);
  $("rgba-budget").textContent =
    kb(s.baseline.rgbaBytes) + " / " + kb(s.candidate.rgbaBytes);
  $("active-budget").textContent = s.active + " / " + s.total;
  $("draw-budget").textContent = s.calls;
  $("cpu-budget").textContent = s.cpu95.toFixed(2) + " ms";
  $("fps-budget").textContent = s.measuredFps
    ? s.measuredFps.toFixed(1) + " fps"
    : "En pausa";
}
for (const a of config.assets.filter((a) => DETAIL.includes(a.name))) {
  const o = document.createElement("option");
  o.value = a.name;
  o.textContent = a.label;
  $("subject").append(o);
}
for (const p of config.profiles) {
  const o = document.createElement("option");
  o.value = p.id;
  o.textContent = p.label;
  $("profile").append(o);
}
study = new DefinitionStudy($("scene"), update);
for (const b of document.querySelectorAll("[data-view]"))
  on(b, "click", () => study.setView(b.dataset.view));
for (const b of document.querySelectorAll("[data-motion]"))
  on(b, "click", () => {
    study.setMotion(b.dataset.motion);
    update(study.inspect());
  });
for (const b of document.querySelectorAll("[data-stop]"))
  on(b, "click", () => {
    study.stop(b.dataset.stop);
    settings(false);
  });
on($("subject"), "change", () => study.setSubject($("subject").value));
on($("profile"), "change", () => study.setProfile($("profile").value));
on($("compare"), "change", () => {
  study.compare = $("compare").checked;
  study.invalidate();
  update(study.inspect());
});
on($("wipe"), "input", () => {
  study.wipe = +$("wipe").value;
  study.invalidate();
  update(study.inspect());
});
on($("fps"), "change", () => {
  study.fps = +$("fps").value;
  study.resetMetrics();
  study.invalidate();
});
on($("timeline"), "input", () => {
  study.scrub(+$("timeline").value);
  update(study.inspect());
});
on($("play"), "click", () => {
  study.play(!study.playing);
  update(study.inspect());
});
on($("zoom-in"), "click", () => study.setZoom(study.zoom * 1.2));
on($("zoom-out"), "click", () => study.setZoom(study.zoom / 1.2));
on($("reset"), "click", () => study.reset());
on($("settings-toggle"), "click", () =>
  settings(!document.body.classList.contains("settings-open")),
);
on($("settings-close"), "click", () => settings(false));
on($("scene"), "pointerdown", () => {
  if (document.body.classList.contains("settings-open")) settings(false);
});
on(document, "keydown", (e) => {
  if (e.key === "Escape") settings(false);
});
on($("proposal"), "click", () => {
  study.setProfile("2-area");
  study.setMotion("selective");
  study.fps = 24;
  $("fps").value = "24";
  study.compare = true;
  study.wipe = 50;
  $("wipe").value = "50";
  study.stop("garden");
  update(study.inspect());
  settings(false);
});
on($("export"), "click", () => {
  const s = study.inspect();
  const decision = {
    experiment: "definition-motion",
    status: "candidate-not-approved",
    profile: s.profile,
    motion: s.mode,
    targetFps: s.fps,
    subject: s.subject,
    view: s.view,
    logicalBounds: "unchanged",
    actorArtwork: "unchanged",
    note: "Referencia para conversar; no aplica cambios ni define todavía el estándar del juego.",
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(decision, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "magikitos-trazo-y-vida.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
window.MagikitosDefinitionLab = {
  inspect: () => study.inspect(),
  dispose: () => {
    abort.abort();
    study.dispose();
  },
};
on(window, "pagehide", () => window.MagikitosDefinitionLab.dispose());
study.init().catch((e) => {
  if (e.name !== "AbortError") {
    $("notice").textContent = e.message;
  }
});
