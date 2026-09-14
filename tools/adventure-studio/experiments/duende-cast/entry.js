"use strict";
const catalog = require("./catalog.json");
const { plan, totalPoses, renderPlan } = require("./plan");
const { CastPreview } = require("./preview");
const base = "/experiments/duende-cast/",
  $ = (id) => document.getElementById(id);
const abort = new AbortController();
let manifest,
  preview,
  previewTask,
  disposed = false,
  ready = false,
  selected = catalog.designs[0].id,
  tab = "designs";
const on = (el, event, fn) =>
  el.addEventListener(event, fn, { signal: abort.signal });
const asset = (id, role, kind) =>
  base + "art/" + manifest.designs[id].roles[role].variants[kind].image;
function img(id, role, kind) {
  const image = document.createElement("img");
  image.src = asset(id, role, kind);
  image.alt =
    catalog.designs.find((d) => d.id === id).name +
    " · " +
    { hero: "protagonista", "neighbor-a": "vecina", "neighbor-b": "vecino" }[
      role
    ];
  image.decoding = "async";
  return image;
}
function family(id) {
  selected = id;
  const d = catalog.designs.find((d) => d.id === id);
  for (const card of document.querySelectorAll("[data-design]"))
    card.setAttribute("aria-pressed", String(card.dataset.design === id));
  $("family-select").value = id;
  const copy = $("family-copy");
  copy.replaceChildren();
  const k = document.createElement("p");
  k.className = "eyebrow";
  k.textContent =
    "PROPUESTA " + (catalog.designs.indexOf(d) + 1) + " / NOMBRE PROVISIONAL";
  const h = document.createElement("h2");
  h.textContent = d.name + " · " + d.subtitle;
  const p = document.createElement("p");
  p.textContent = d.pitch;
  const s = document.createElement("p");
  s.className = "signature";
  s.textContent = d.signature;
  const w = document.createElement("p");
  w.textContent = "A vigilar al reducir: " + d.watch;
  const a = document.createElement("a");
  a.href = base + d.source;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = "Ver lámina original a máxima resolución ↗";
  const b = document.createElement("button");
  b.textContent = "Ver esta familia en el bosque";
  b.className = "context-button";
  copy.append(k, h, p, s, w, a, document.createElement("br"), b);
  $("family-portraits").replaceChildren(
    ...d.roles.map((role, i) => {
      const f = document.createElement("figure"),
        cap = document.createElement("figcaption");
      cap.textContent = [
        "Protagonista · silueta propia",
        "Vecina · misma familia",
        "Vecino · otra edad y proporción",
      ][i];
      f.append(img(id, role, "portrait"), cap);
      return f;
    }),
  );
  if (preview) {
    preview.design = id;
    preview.draw();
  }
}
async function show(id) {
  tab = id;
  const intro = document.querySelector(".intro");
  window.scrollTo(
    0,
    Math.min(window.scrollY, intro.offsetTop + intro.offsetHeight),
  );
  for (const key of ["designs", "forest", "poses"]) $(key).hidden = key !== id;
  for (const b of document.querySelectorAll("[data-tab]"))
    b.setAttribute("aria-pressed", String(b.dataset.tab === id));
  if (preview) preview.active = id === "forest";
  if (id === "forest") {
    miniatures();
    if (!previewTask) {
      preview = new CastPreview($("scene"), manifest, abort.signal);
      preview.design = selected;
      preview.active = true;
      previewTask = preview.init();
    }
    try {
      await previewTask;
      if (disposed) return;
      preview.active = tab === "forest";
      preview.draw();
    } catch (e) {
      fail(e);
    }
  }
}
function fail(e) {
  if (!disposed && e.name !== "AbortError") {
    $("status").textContent = e.message;
    console.error(e);
  }
}
async function init() {
  const response = await fetch(base + "art/manifest.json", {
    signal: abort.signal,
  });
  if (!response.ok) throw Error("No se pudo leer el catálogo de duendes.");
  manifest = await response.json();
  if (disposed) return;
  for (const [i, d] of catalog.designs.entries()) {
    const card = document.createElement("button");
    card.className = "design-card";
    card.dataset.design = d.id;
    card.style.setProperty("--tint", d.color + "40");
    const art = document.createElement("span");
    art.className = "card-image";
    art.append(img(d.id, "hero", "portrait"));
    const copy = document.createElement("span");
    copy.className = "card-copy";
    const small = document.createElement("small");
    small.textContent = "FAMILIA 0" + (i + 1);
    const name = document.createElement("strong");
    name.textContent = d.name;
    const desc = document.createElement("span");
    desc.textContent = d.subtitle;
    copy.append(small, name, desc);
    card.append(art, copy);
    on(card, "click", () => family(d.id));
    $("design-grid").append(card);
    const option = document.createElement("option");
    option.value = d.id;
    option.textContent = d.name;
    $("family-select").append(option);
    const figure = document.createElement("figure"),
      cap = document.createElement("figcaption");
    cap.textContent = d.name;
    // Defer miniature requests until the comparison is opened.
    figure.dataset.scaleDesign = d.id;
    figure.append(cap);
    $("scale-strip").append(figure);
  }
  for (const group of plan.groups) {
    const actions = plan.actions.filter((a) => a.group === group.id),
      card = document.createElement("div"),
      n = document.createElement("strong"),
      label = document.createElement("span");
    n.textContent = totalPoses(actions);
    label.textContent = group.label + " · " + actions.length + " acciones";
    card.append(n, label);
    $("pose-counts").append(card);
    const opt = document.createElement("option");
    opt.value = group.id;
    opt.textContent = group.label;
    $("pose-group").append(opt);
  }
  const filter = () => {
    $("pose-results").textContent = renderPlan(
      $("pose-list"),
      $("pose-group").value,
      $("pose-search").value,
    );
  };
  filter();
  on($("pose-group"), "change", filter);
  on($("pose-search"), "input", filter);
  on($("family-copy"), "click", (event) => {
    if (event.target.closest(".context-button")) show("forest");
  });
  for (const b of document.querySelectorAll("[data-tab]"))
    on(b, "click", () => {
      show(b.dataset.tab);
    });
  on($("family-select"), "change", () => family($("family-select").value));
  for (const id of ["zoom", "light", "silhouette"])
    on($(id), "change", () => {
      if (!preview) return;
      preview[id] =
        id === "zoom"
          ? Number($(id).value)
          : id === "silhouette"
            ? $(id).checked
            : $(id).value;
      preview.draw();
    });
  on($("export-poses"), "click", () => {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "magikitos-plan-poses.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  family(selected);
  $("status").textContent = "";
  ready = true;
}
function miniatures() {
  for (const el of document.querySelectorAll("[data-scale-design]"))
    if (!el.querySelector("img"))
      el.prepend(img(el.dataset.scaleDesign, "hero", "sprite"));
}
on(window, "pagehide", dispose);
function dispose() {
  disposed = true;
  abort.abort();
  preview?.dispose();
}
window.MagikitosDuendeLab = {
  inspect: () => ({
    ready,
    disposed,
    selected,
    tab,
    actions: plan.actions.length,
    poses: totalPoses(plan.actions),
    scene: preview?.inspect() || null,
  }),
  dispose,
};
init().catch(fail);
