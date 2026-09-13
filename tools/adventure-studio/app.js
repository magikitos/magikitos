"use strict";
const { MapViewport } = require("./viewport");
const { placement, validateChanges, renderScene, diff } = require("./draft");
const { capabilities } = require("../../public/assets/js/adventure/entity-art");
const {
  TILE,
  collisionBounds,
  overlaps,
} = require("../../public/assets/js/adventure/model");
const $ = (id) => document.getElementById(id),
  escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const names = {
  overworld: "Bosque y pueblo",
  house: "Casa humana",
  cottage: "Casita de la fuente",
  tavern: "Taberna",
  workshop: "Taller",
  islet: "Islote",
  fountain: "Fuente",
  oak: "Roble",
  hornbeam: "Carpe",
  birch: "Abedul",
  pine: "Pino",
  bench: "Banco",
  fire: "Hoguera",
  fern: "Helecho",
  bush: "Arbusto",
  "crooked-oak": "Roble torcido",
  rocks: "Rocas",
  berries: "Bayas",
  table: "Mesa",
  "flower-pot": "Maceta",
  "bedside-table": "Mesita",
  bed: "Cama",
  lighter: "Mechero",
  "flower-vase": "Florero",
};
let context,
  snapshot,
  draft,
  sceneId = "overworld",
  selected = null,
  layer = "all",
  undo = [],
  redo = [],
  savedJSON = "",
  savePromise = null,
  saveTimer,
  dragBefore = null,
  dragLinked = null;
const label = (e) => names[e.sprite] || e.sprite.replaceAll("-", " ");
const count = () =>
  Object.values(draft.changes).reduce(
    (n, s) =>
      n +
      Object.keys(s.entities || {}).length +
      Object.keys(s.scenery || {}).length,
    0,
  );
const dirty = () =>
  JSON.stringify({ name: draft.name, changes: draft.changes }) !== savedJSON;
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 5000);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Studio-Token": context?.token || "",
      ...options.headers,
    },
  });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || "Error local");
  return value;
}
const view = new MapViewport(
  $("map"),
  $("viewport"),
  (value) => {
    selected = value ? { id: value.e.id, layer: value.layer } : null;
    paintInspector();
    paintSelection();
  },
  drag,
  () => {
    $("zoom").textContent = Math.round(view.zoom * 100) + "%";
  },
);
function baseEntity(selection = selected) {
  return (
    selection &&
    (selection.layer === "entities"
      ? snapshot.world.scenes[sceneId].entities
      : snapshot.scenery[sceneId]
    ).find((e) => e.id === selection.id)
  );
}
function currentEntity() {
  return (
    selected &&
    (selected.layer === "entities"
      ? view.world.entities
      : view.world.props
    ).find((e) => e.id === selected.id)
  );
}
function newDraft() {
  return {
    id:
      "mapa-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7),
    name: "Composición del bosque",
    baseHash: snapshot.baseHash,
    revision: 0,
    changes: {},
  };
}
function rebuild(fit = false, keep = selected) {
  view.setScene(renderScene(snapshot, sceneId, draft.changes), fit);
  if (keep) view.select(keep.id, keep.layer);
  paintList();
  paintInspector();
  paintStatus();
}
function history(before) {
  if (before === JSON.stringify(draft.changes)) return;
  undo.push(before);
  if (undo.length > 100) undo.shift();
  redo = [];
  changed();
}
function changed() {
  paintStatus();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(
    () => save().catch((error) => toast(error.message)),
    1400,
  );
}
function paintStatus() {
  $("undo").disabled = !undo.length;
  $("redo").disabled = !redo.length;
  $("diff-count").textContent = count()
    ? count() +
      " elementos ajustados en " +
      Object.keys(draft.changes).length +
      " escena(s)."
    : "No has movido nada todavía.";
  $("save-status").textContent = dirty()
    ? "Cambios pendientes de guardar"
    : draft.revision
      ? "Guardado local · edición " + draft.revision
      : "Borrador nuevo · juego intacto";
}
function setChanges(entries) {
  const data = JSON.parse(JSON.stringify(draft.changes)),
    groups = (data[sceneId] ||= { entities: {}, scenery: {} });
  for (const { selection, value } of entries)
    groups[selection.layer][selection.id] = value;
  draft.changes = validateChanges(snapshot, data);
}
function adjust(value) {
  if (!selected) return;
  const before = JSON.stringify(draft.changes),
    source = baseEntity();
  try {
    const current = currentEntityInTiles(),
      next = { ...placement(current), ...value },
      entries = [{ selection: selected, value: next }];
    if (
      $("linked").checked &&
      (value.x !== undefined || value.y !== undefined)
    ) {
      for (const { e, layer: memberLayer } of view.elements()) {
        if (
          e === currentEntity() ||
          Math.hypot(e.x / TILE - current.x, e.y / TILE - current.y) > 0.001
        )
          continue;
        entries.push({
          selection: { id: e.id, layer: memberLayer },
          value: {
            ...placement({ ...e, x: e.x / TILE, y: e.y / TILE }),
            x: e.x / TILE + next.x - current.x,
            y: e.y / TILE + next.y - current.y,
          },
        });
      }
    }
    setChanges(entries);
    rebuild();
    history(before);
  } catch (error) {
    toast(error.message);
    paintInspector();
  }
}
function currentEntityInTiles() {
  const e = currentEntity();
  return { ...e, x: e.x / TILE, y: e.y / TILE };
}
function drag(info, position, commit, cancel) {
  if (!dragBefore) {
    dragBefore = JSON.stringify(draft.changes);
    dragLinked = [];
    const sources = [
      ...view.world.entities.map((e) => ({ e, layer: "entities" })),
      ...view.world.props.map((e) => ({ e, layer: "scenery" })),
    ];
    if ($("linked").checked)
      dragLinked = sources
        .filter(
          (p) =>
            p.e.id !== info.id &&
            Math.hypot(p.e.x - info.entity.x, p.e.y - info.entity.y) < 1,
        )
        .map((p) => ({
          selection: { id: p.e.id, layer: p.layer },
          x: p.e.x / TILE,
          y: p.e.y / TILE,
        }));
  }
  if (cancel) {
    draft.changes = JSON.parse(dragBefore);
    dragBefore = null;
    dragLinked = null;
    rebuild();
    return;
  }
  if (position) {
    const step = Number($("snap").value),
      s = snapshot.world.scenes[sceneId],
      x = Math.max(
        0,
        Math.min(s.width - 0.0625, Math.round(position.x / step) * step),
      ),
      y = Math.max(
        0,
        Math.min(s.height - 0.0625, Math.round(position.y / step) * step),
      );
    const entries = [
      {
        selection: { id: info.id, layer: info.layer },
        value: { ...placement(currentEntityInTiles()), x, y },
      },
    ];
    for (const member of dragLinked) {
      const original = (
        member.selection.layer === "entities"
          ? snapshot.world.scenes[sceneId].entities
          : snapshot.scenery[sceneId]
      ).find((e) => e.id === member.selection.id);
      entries.push({
        selection: member.selection,
        value: {
          ...placement(original),
          ...(draft.changes[sceneId]?.[member.selection.layer]?.[
            member.selection.id
          ] || {}),
          x: member.x + x - info.entity.x / TILE,
          y: member.y + y - info.entity.y / TILE,
        },
      });
    }
    try {
      setChanges(entries);
      for (const row of entries) {
        const target = (
          row.selection.layer === "entities"
            ? view.world.entities
            : view.world.props
        ).find((e) => e.id === row.selection.id);
        Object.assign(target, row.value, {
          x: row.value.x * TILE,
          y: row.value.y * TILE,
        });
      }
      $("x").value = x;
      $("y").value = y;
      view.dirty = true;
    } catch (error) {
      toast(error.message);
    }
  }
  if (commit) {
    const before = dragBefore;
    dragBefore = null;
    dragLinked = null;
    rebuild();
    history(before);
  }
}
function paintSelection() {
  for (const b of $("elements").children)
    b.setAttribute(
      "aria-pressed",
      String(
        b.dataset.id === selected?.id && b.dataset.layer === selected?.layer,
      ),
    );
}
function paintList() {
  const query = $("search").value.toLocaleLowerCase(),
    rows = view
      .elements()
      .filter(
        (p) =>
          (layer === "all" || layer === p.layer) &&
          (label(p.e) + " " + p.e.id).toLocaleLowerCase().includes(query),
      );
  $("count").textContent =
    rows.length + " elementos · ordenados por profundidad";
  $("elements").replaceChildren();
  for (const { e, layer: rowLayer } of rows) {
    const b = document.createElement("button");
    b.dataset.id = e.id;
    b.dataset.layer = rowLayer;
    b.innerHTML =
      '<canvas width="40" height="44" aria-hidden="true"></canvas><span><strong>' +
      escape(label(e)) +
      "</strong><small>" +
      escape(e.id) +
      "</small></span>";
    const c = b.querySelector("canvas").getContext("2d"),
      f = view.renderer.sprites.frame(e.sprite);
    c.imageSmoothingEnabled = false;
    if (f) {
      const k = Math.min(36 / f.w, 40 / f.h);
      view.renderer.sprites.draw(
        c,
        e.sprite,
        (40 - f.w * k) / 2,
        (44 - f.h * k) / 2,
        f.w * k,
        f.h * k,
      );
    }
    b.onclick = () => view.select(e.id, rowLayer, true);
    $("elements").append(b);
  }
  paintSelection();
}
function warnings(entity) {
  const messages = [];
  if (sceneId === "workshop")
    messages.push(
      "Plano base del taller. Los expositores de venta y la altura del interior se generan desde el catálogo; sus cambios requieren revisar ese distribuidor, no solo este plano.",
    );
  if (entity.portal || entity.threshold)
    messages.push(
      "Puerta: al aplicar el diff hay que comprobar umbral, salida y llegada. La orientación y escala quedan protegidas.",
    );
  if (view.world.waterAt(entity.x / TILE, entity.y / TILE))
    messages.push(
      "El ancla está sobre agua. Revisa si la colocación es intencionada.",
    );
  if (entity.solid) {
    const r = collisionBounds(entity);
    if (
      [...view.world.entities, ...view.world.props].some(
        (e) => e !== entity && e.solid && overlaps(r, collisionBounds(e)),
      )
    )
      messages.push(
        "Su colisión se solapa con otro elemento; puede ser una mesa con un objeto encima o un paso bloqueado.",
      );
  }
  if (
    entity.interactAs ||
    view.world.entities.some((e) => e.interactAs === entity.id)
  )
    messages.push(
      "Comparte una interacción con otro objeto. Mantén las piezas juntas.",
    );
  if (entity.id === "story-fire")
    messages.push(
      "La luz nocturna y la zona de cuentos tienen anclas propias: habrá que recolocarlas junto al fuego al aplicar.",
    );
  if (entity.product)
    messages.push(
      "Expositor dinámico del catálogo; el juego lo distribuye al entrar.",
    );
  return messages;
}
function paintInspector() {
  $("properties").hidden = !selected;
  $("selection-help").hidden = !!selected;
  if (!selected) return;
  const e = currentEntity();
  if (!e) return;
  const cap = capabilities(baseEntity());
  $("selected-name").textContent = label(e);
  $("selected-id").textContent = sceneId + " / " + e.id;
  $("x").value = e.x / TILE;
  $("y").value = e.y / TILE;
  for (const [id, values, suffix] of [
    ["scale", cap.scales, "×"],
    ["rotation", cap.rotations, "°"],
  ]) {
    $(id).replaceChildren(
      ...values.map((v) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v + suffix;
        return o;
      }),
    );
    $(id).value = id === "scale" ? (e.scale ?? 1) : e.rotation || 0;
    $(id).disabled = values.length === 1;
  }
  $("flip").checked = !!e.flip;
  $("flip").disabled = !cap.mirror;
  $("transform-help").textContent =
    cap.rotations.length > 1
      ? "Arte plano: giros de 90° y escala por pasos, sin interpolación."
      : "La perspectiva de este sprite no admite giro libre. Reflejo y escala solo cuando no rompen su función.";
  const c = $("preview").getContext("2d"),
    f = view.renderer.sprites.frame(e.sprite);
  c.clearRect(0, 0, 160, 140);
  c.imageSmoothingEnabled = false;
  if (f) {
    const k = Math.min(130 / f.w, 115 / f.h);
    c.save();
    c.translate(80, 70);
    c.rotate(((e.rotation || 0) * Math.PI) / 180);
    c.scale(e.flip ? -1 : 1, 1);
    view.renderer.sprites.draw(
      c,
      e.sprite,
      (-f.w * k) / 2,
      (-f.h * k) / 2,
      f.w * k,
      f.h * k,
    );
    c.restore();
  }
  $("warnings").innerHTML = warnings(e)
    .map((m) => "<p>" + escape(m) + "</p>")
    .join("");
}
async function save() {
  clearTimeout(saveTimer);
  if (savePromise) {
    await savePromise;
    if (dirty()) return save();
    return;
  }
  if (!dirty() && draft.revision) return;
  const sending = JSON.parse(JSON.stringify(draft));
  $("save-status").textContent = "Guardando…";
  savePromise = api("/api/drafts", {
    method: "POST",
    body: JSON.stringify(sending),
  });
  try {
    const result = await savePromise;
    draft.revision = result.revision;
    savedJSON = JSON.stringify({
      name: sending.name,
      changes: sending.changes,
    });
    paintStatus();
  } finally {
    savePromise = null;
  }
}
function modal(title, body) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = body;
  if (!$("modal").open) $("modal").showModal();
}
function exportDiff() {
  const payload = {
    purpose: "review-only",
    draft: draft.name,
    baseHash: snapshot.baseHash,
    scenes: diff(snapshot, draft.changes),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = draft.id + "-diff.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("scene").onchange = () => {
  sceneId = $("scene").value;
  selected = null;
  rebuild(true);
};
$("search").oninput = paintList;
for (const b of document.querySelectorAll("[data-layer]"))
  b.onclick = () => {
    layer = b.dataset.layer;
    for (const n of document.querySelectorAll(".layer-tabs button"))
      n.setAttribute("aria-pressed", String(n === b));
    paintList();
  };
for (const key of ["x", "y", "scale", "rotation"])
  $(key).onchange = () => adjust({ [key]: Number($(key).value) });
$("flip").onchange = () => adjust({ flip: $("flip").checked });
$("name").oninput = () => {
  draft.name = $("name").value;
  changed();
};
$("grid").onchange = () => {
  view.grid = $("grid").checked;
  view.dirty = true;
};
$("bodies").onchange = () => {
  view.bodies = $("bodies").checked;
  view.dirty = true;
};
$("hand").onclick = () => {
  view.hand = !view.hand;
  $("hand").setAttribute("aria-pressed", String(view.hand));
};
$("zoom-in").onclick = () => view.zoomAt(view.zoom * 1.25);
$("zoom-out").onclick = () => view.zoomAt(view.zoom / 1.25);
$("fit").onclick = () => view.fit();
$("undo").onclick = () => {
  if (!undo.length) return;
  redo.push(JSON.stringify(draft.changes));
  draft.changes = JSON.parse(undo.pop());
  rebuild();
  changed();
};
$("redo").onclick = () => {
  if (!redo.length) return;
  undo.push(JSON.stringify(draft.changes));
  draft.changes = JSON.parse(redo.pop());
  rebuild();
  changed();
};
$("revert").onclick = () => {
  if (!selected) return;
  adjust(placement(baseEntity()));
};
$("save").onclick = () =>
  save()
    .then(() => toast("Borrador guardado. El juego sigue intacto."))
    .catch((e) => toast(e.message));
$("export").onclick = () =>
  save()
    .then(exportDiff)
    .catch((e) => toast(e.message));
$("new").onclick = async () => {
  try {
    await save();
    context = await api("/api/context");
    snapshot = context.snapshot;
    draft = newDraft();
    savedJSON = JSON.stringify({ name: draft.name, changes: draft.changes });
    undo = [];
    redo = [];
    $("name").value = draft.name;
    rebuild(true, null);
    toast("Nuevo borrador desde el mapa actual.");
  } catch (e) {
    toast(e.message);
  }
};
$("load").onclick = async () => {
  try {
    const { drafts } = await api("/api/drafts");
    modal(
      "Borradores locales",
      drafts.length
        ? drafts
            .map(
              (d) =>
                '<div class="draft-row"><span>' +
                escape(d.name) +
                "<small> · " +
                escape(new Date(d.updatedAt).toLocaleString()) +
                '</small></span><button data-load="' +
                d.id +
                '">Abrir</button></div>',
            )
            .join("")
        : "<p>Todavía no hay borradores guardados.</p>",
    );
  } catch (e) {
    toast(e.message);
  }
};
$("modal-body").onclick = async (e) => {
  const id = e.target.closest("[data-load]")?.dataset.load;
  if (!id) return;
  try {
    await save();
    const result = await api("/api/drafts/" + id);
    snapshot = result.snapshot;
    draft = result.draft;
    selected = null;
    undo = [];
    redo = [];
    savedJSON = JSON.stringify({ name: draft.name, changes: draft.changes });
    $("name").value = draft.name;
    rebuild(true, null);
    $("modal").close();
    if (result.stale)
      toast(
        "Base anterior conservada. No se mezcla automáticamente con el mapa nuevo.",
      );
  } catch (error) {
    toast(error.message);
  }
};
$("review").onclick = () => {
  const scenes = diff(snapshot, draft.changes);
  modal(
    "Diff de colocaciones",
    scenes.length
      ? "<p>Solo propuesta. No se ha escrito ningún JSON de las escenas del juego.</p>" +
          scenes
            .map(
              (s) =>
                "<h3>" +
                escape(names[s.scene] || s.scene) +
                "</h3><pre>" +
                escape(
                  s.placements
                    .map(
                      (p) =>
                        p.layer +
                        " / " +
                        p.id +
                        "\n  antes " +
                        JSON.stringify(p.before) +
                        "\n  ahora " +
                        JSON.stringify(p.after),
                    )
                    .join("\n\n"),
                ) +
                "</pre>",
            )
            .join("") +
          "<p>La propuesta conserva las reglas de cada objeto y fija la vegetación generada para que mover una mesa no redistribuya el bosque. Puertas, zonas de contenido, luces y pasajes requieren revisión de sus referencias antes de aplicar.</p>"
      : "<p>No hay cambios que revisar.</p>",
  );
};
$("modal-close").onclick = () => $("modal").close();
$("modal").onclick = (e) => {
  if (e.target === $("modal")) {
    const r = $("modal").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      $("modal").close();
  }
};
document.addEventListener("keydown", (e) => {
  if ($("modal").open) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    save().catch((error) => toast(error.message));
    return;
  }
  if (e.target.closest("input,select,textarea")) return;
  if ((e.metaKey || e.ctrlKey) && ["z", "y"].includes(e.key.toLowerCase())) {
    e.preventDefault();
    $(e.shiftKey || e.key.toLowerCase() === "y" ? "redo" : "undo").click();
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    view.space = true;
  }
  if (e.key === "Escape") {
    view.select(null, null);
    return;
  }
  const v = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }[e.key];
  if (v && selected) {
    e.preventDefault();
    const step = Number($("snap").value) * (e.shiftKey ? 4 : 1),
      p = currentEntityInTiles();
    adjust({ x: p.x + v[0] * step, y: p.y + v[1] * step });
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") view.space = false;
});
window.addEventListener("blur", () => (view.space = false));
window.addEventListener("beforeunload", (e) => {
  if (draft && dirty()) {
    e.preventDefault();
    e.returnValue = "";
  }
});
(async () => {
  try {
    context = await api("/api/context");
    snapshot = context.snapshot;
    draft = newDraft();
    savedJSON = JSON.stringify({ name: draft.name, changes: draft.changes });
    $("scene").replaceChildren(
      ...Object.keys(snapshot.world.scenes).map((id) => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = names[id] || id;
        return option;
      }),
    );
    $("scene").value = sceneId;
    await view.initialize();
    rebuild(true, null);
    $("loading").hidden = true;
  } catch (error) {
    $("loading").textContent = error.message;
    console.error(error);
  }
})();
window.MagikitosStudio = Object.freeze({
  inspect: () => ({
    ready: !!view.world,
    scene: sceneId,
    selected,
    changes: draft?.changes,
    baseHash: snapshot?.baseHash,
    dirty: draft ? dirty() : false,
    revision: draft?.revision,
    zoom: view.zoom,
    camera: { ...view.camera },
  }),
});
