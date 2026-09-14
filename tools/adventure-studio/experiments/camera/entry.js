import { CameraStudy } from "./runtime.js";
import config from "./config.js";
const { MODES, STOPS } = config,
  $ = (id) => document.getElementById(id),
  kb = (n) => Math.round(n / 1024) + " KiB";
let study,
  noticeTimer,
  pendingMode = null;
const abort = new AbortController(),
  signal = abort.signal;
function listen(node, event, fn) {
  node.addEventListener(event, fn, { signal });
}
function settings(open) {
  document.body.classList.toggle("settings-open", open);
  $("settings-toggle").setAttribute("aria-expanded", String(open));
  if (open) $("settings-close").focus();
  else $("scene").focus({ preventScroll: true });
}
function update(s) {
  if (s.error) {
    $("failure").hidden = false;
    $("failure-text").textContent = s.error;
    return;
  }
  if (s.notice) {
    $("notice").textContent = s.notice;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      noticeTimer = null;
      $("notice").textContent = "";
    }, 4500);
  }
  if ("pending" in s) pendingMode = s.pending;
  if (pendingMode && !noticeTimer)
    $("notice").textContent = "Preparando esta variante…";
  if (!s.ready) return;
  if (!noticeTimer && !pendingMode) $("notice").textContent = "";
  for (const b of $("modes").children)
    b.setAttribute("aria-pressed", String(b.dataset.mode === s.mode));
  const m = MODES[s.mode];
  $("mode-title").textContent = m.title;
  $("mode-description").textContent = m.description;
  $("mode-effort").textContent = m.effort;
  for (const [id, v] of [
    ["elevation", s.elevation],
    ["yaw", s.yaw],
  ]) {
    if (document.activeElement !== $(id)) $(id).value = Math.round(v);
    $(id + "-value").textContent = Math.round(v) + "°";
  }
  $("projection").value = s.projection;
  $("orbit").setAttribute("aria-pressed", String(s.auto));
  $("image-bytes").textContent = kb(s.imageBytes);
  $("draw-budget").textContent =
    s.calls + " / " + Math.round(s.triangles / 1000) + "k";
  $("frame-budget").textContent = s.frameMs
    ? s.frameMs.toFixed(1) + " / " + s.cpuMs.toFixed(1) + " ms"
    : "Midiendo…";
}
for (const [id, m] of Object.entries(MODES)) {
  const b = document.createElement("button");
  b.dataset.mode = id;
  b.setAttribute("aria-pressed", String(id === "hybrid"));
  b.innerHTML =
    "<b>" +
    m.letter +
    '</b><span><strong class="long">' +
    m.title +
    '</strong><strong class="short">' +
    m.short +
    "</strong><small>" +
    m.short +
    "</small></span>";
  listen(b, "click", () => study?.ready && study.setMode(id));
  $("modes").append(b);
}
for (const [id, p] of Object.entries(STOPS)) {
  const b = document.createElement("button");
  b.dataset.stop = id;
  b.textContent = p.label;
  listen(b, "click", () => study?.ready && study.stop(id));
  $("stops").append(b);
}
listen($("settings-toggle"), "click", () =>
  settings(!document.body.classList.contains("settings-open")),
);
listen($("settings-close"), "click", () => settings(false));
listen($("scene"), "pointerdown", () => {
  if (document.body.classList.contains("settings-open")) settings(false);
});
listen(document, "keydown", (e) => {
  if (e.key === "Escape") settings(false);
});
for (const id of ["elevation", "yaw"])
  listen($(id), "input", () => study?.setView({ [id]: Number($(id).value) }));
for (const b of document.querySelectorAll("[data-angle]"))
  listen(b, "click", () =>
    study?.setView({ elevation: Number(b.dataset.angle) }),
  );
listen($("projection"), "change", () =>
  study?.projection($("projection").value),
);
listen($("economy"), "change", () => study?.quality($("economy").checked));
listen($("reset-camera"), "click", () => {
  if (study) {
    study.camera.zoom = 1;
    study.camera.updateProjectionMatrix();
    study.setView({ elevation: 52, yaw: -18, distance: 34 });
  }
});
for (const [id, factor] of [
  ["zoom-out", 1.18],
  ["zoom-in", 1 / 1.18],
])
  listen($(id), "click", () => {
    if (!study) return;
    if (study.camera.isPerspectiveCamera)
      study.setView({ distance: study.inspect().distance * factor });
    else {
      study.camera.zoom = Math.max(
        0.65,
        Math.min(2.8, study.camera.zoom / factor),
      );
      study.camera.updateProjectionMatrix();
    }
  });
listen($("orbit"), "click", () => {
  if (study) {
    study.auto = !study.auto;
    study.report();
  }
});
listen($("retry"), "click", () => location.reload());
async function start() {
  try {
    study = new CameraStudy($("scene"), update);
    window.MagikitosCameraLab = {
      inspect: () => study.inspect(),
      setView: (options) => study.setView(options),
      setMode: (id) => study.setMode(id),
      goTo: (x, z) => study.goTo(x, z),
      stop: (id) => study.stop(id),
      dispose,
    };
    await study.initialize();
    const response = await fetch("/experiments/camera/budget.json", { signal });
    if (response.ok) {
      const b = await response.json();
      $("js-bytes").textContent = kb(b.javascriptBytes);
      $("js-bytes").title =
        "Sin compresión en Studio; " + kb(b.javascriptGzipBytes) + " con gzip.";
    }
  } catch (error) {
    if (signal.aborted) return;
    study?.dispose();
    $("notice").textContent = "";
    $("failure").hidden = false;
    $("failure-text").textContent =
      "No se pudo iniciar: " +
      (error.message || "WebGL 2 no disponible") +
      ". Prueba Chrome o Safari actualizado con aceleración gráfica.";
  }
}
function dispose() {
  clearTimeout(noticeTimer);
  abort.abort();
  study?.dispose();
}
listen(window, "pagehide", dispose);
start();
