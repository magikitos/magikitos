"use strict";
const { StudioShell } = require("./shell");
const { PathEditor } = require("./path-editor");
const { Gallery } = require("./gallery");
const {
  families,
  familyOf,
  frameName,
  makeElement,
} = require("../../public/assets/js/adventure/elements");
const { CropEditor } = require("./crop-editor");
const { validateSprites, spriteDiff, cropFor } = require("./sprite-edits");
const { MapViewport } = require("./viewport");
const {
  placement,
  validateChanges,
  renderScene,
  diff,
  removable,
} = require("./scene-edits");
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
  house: "Refugio de hojas",
  "human-house": "Refugio de hojas",
  cottage: "Hogar del tocón",
  "cottage-closed": "Casita de seta",
  "fisher-closed": "Refugio de la maceta",
  tavern: "Taberna de la bota",
  workshop: "Taller del tronco",
  islet: "Islote",
  attic: "Desván",
  cupboard: "Armario",
  stove: "Estufa",
  dresser: "Cómoda",
  armchair: "Sillón",
  "stairs-up": "Escalera para subir",
  "stairs-down": "Escalera para bajar",
  "window-arched": "Ventana",
  "kitchen-rack": "Utensilios de cocina",
  fountain: "Fuente",
  oak: "Roble",
  "ancient-root": "Roble del bosque",
  "forest-birch": "Abedul del bosque",
  "giant-fern": "Helecho grande",
  "giant-clover": "Trébol del bosque",
  "giant-bolete": "Seta para cortar",
  "scarlet-mushrooms": "Setas rojas",
  mushrooms: "Setitas silvestres",
  "picnic-blanket": "Manta del picnic",
  "picnic-smoker": "Humano fumando",
  "picnic-human-friend": "Humana merendando",
  "picnic-tortilla": "Tortilla de patatas",
  "picnic-basket": "Cesta de merienda",
  "picnic-knife": "Cuchillo del picnic",
  "picnic-hungry": "Brizno, con hambre",
  "picnic-happy": "Brizno, satisfecho",
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
  lantern: "Farol",
  "book-lectern": "Libro de expresiones",
  doorway: "Puerta",
};
let gallery,
  cropEditor,
  pathEditor,
  context,
  snapshot,
  workspace,
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
const label = (e) =>
  familyOf(e)?.label || names[e.sprite] || e.sprite.replaceAll("-", " ");
const count = () =>
  Object.values(workspace.changes).reduce(
    (n, s) =>
      n +
      Object.keys(s.entities || {}).length +
      Object.keys(s.scenery || {}).length +
      Object.keys(s.added || {}).length +
      (s.removed?.length || 0),
    0,
  );
const editsJSON = () =>
  JSON.stringify({ changes: workspace.changes, sprites: workspace.sprites });
const restoreEdits = (text) => Object.assign(workspace, JSON.parse(text));
const dirty = () => editsJSON() !== savedJSON;
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
  if (!selection) return null;
  return (
    (selection &&
      (selection.layer === "entities"
        ? snapshot.world.scenes[sceneId].entities
        : snapshot.scenery[sceneId]
      ).find((e) => e.id === selection.id)) ||
    (selection.layer === "entities" && addedEntity(selection.id))
  );
}
function addedEntity(id) {
  const value = workspace.changes[sceneId]?.added?.[id];
  return value
    ? {
        ...makeElement(value.family, id, value.x, value.y, value.artVariant),
        ...value,
      }
    : null;
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
function rebuild(fit = false, keep = selected) {
  cropEditor?.apply(snapshot, workspace.sprites);
  view.setScene(renderScene(snapshot, sceneId, workspace.changes), fit);
  if (keep) view.select(keep.id, keep.layer);
  else {
    selected = null;
  }
  paintList();
  paintInspector();
  paintStatus();
  pathEditor?.refresh();
  gallery?.sceneChanged(view.world.data);
}
function history(before) {
  if (before === editsJSON()) return;
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
  const pathScenes = Object.values(workspace.changes).filter((s) =>
    Object.hasOwn(s, "paths"),
  ).length;
  $("diff-count").textContent =
    count() || pathScenes
      ? count() +
        " elementos ajustados" +
        (pathScenes ? " · caminos en " + pathScenes + " escena(s)" : "") +
        "."
      : "Sin cambios de mapa.";
  if (Object.keys(workspace.sprites).length)
    $("diff-count").textContent +=
      " · " + Object.keys(workspace.sprites).length + " sprites recortados.";
  $("save-status").textContent = dirty()
    ? "Cambios pendientes de guardar"
    : workspace.revision
      ? "Guardado automático · juego intacto"
      : "Tu versión del estudio";
}
function setChanges(entries) {
  const data = JSON.parse(JSON.stringify(workspace.changes)),
    groups = (data[sceneId] ||= { entities: {}, scenery: {} });
  for (const { selection, value } of entries) {
    if (selection.layer === "entities" && groups.added?.[selection.id])
      groups.added[selection.id] = { ...groups.added[selection.id], ...value };
    else (groups[selection.layer] ||= {})[selection.id] = value;
  }
  workspace.changes = validateChanges(snapshot, data);
}
function adjust(value) {
  if (!selected) return;
  const before = editsJSON(),
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
    dragBefore = editsJSON();
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
    restoreEdits(dragBefore);
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
      const original = baseEntity(member.selection);
      entries.push({
        selection: member.selection,
        value: {
          ...placement(original),
          ...(workspace.changes[sceneId]?.[member.selection.layer]?.[
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
      f = view.renderer.sprites.frame(frameName(e));
    c.imageSmoothingEnabled = false;
    if (f) {
      const k = Math.min(36 / f.w, 40 / f.h);
      view.renderer.sprites.draw(
        c,
        frameName(e),
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
  $("properties").hidden = !selected || pathEditor?.enabled;
  $("selection-help").hidden = !!selected || pathEditor?.enabled;
  if (!selected || pathEditor?.enabled) return;
  const e = currentEntity();
  if (!e) return;
  const cap = capabilities(baseEntity());
  $("selected-name").textContent = label(e);
  $("selected-id").textContent = sceneId + " / " + e.id;
  $("x").value = e.x / TILE;
  $("y").value = e.y / TILE;
  for (const [id, values, suffix] of [["scale", cap.scales, "×"]]) {
    $(id).replaceChildren(
      ...values.map((v) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v + suffix;
        return o;
      }),
    );
    $(id).value = e.scale ?? 1;
    $(id).disabled = values.length === 1;
  }
  const family = familyOf(e);
  $("variant-field").hidden = !family;
  $("variant").replaceChildren(
    ...(family
      ? [
          { id: "auto", label: "Variada · fija para este objeto" },
          ...family.variants,
        ].map((v) => {
          const option = document.createElement("option");
          option.value = v.id;
          option.textContent = v.label;
          return option;
        })
      : []),
  );
  $("variant").value = e.artVariant || "auto";
  const added = !!workspace.changes[sceneId]?.added?.[e.id];
  $("remove").disabled =
    !added && !removable(snapshot, sceneId, selected.layer, e.id);
  $("remove").title = $("remove").disabled
    ? "Elemento funcional protegido: se modifica con revisión de sus reglas."
    : "Retirar del estudio; puedes deshacerlo.";
  $("revert").disabled = added;
  $("flip").checked = !!e.flip;
  $("flip").disabled = !cap.mirror;
  $("transform-help").textContent =
    "Reflejo y escala solo cuando no rompen su función. No se ofrece giro: no genera otra vista del objeto.";
  const sprite = frameName(e),
    record = snapshot.sprites?.[sprite];
  $("crop-section").hidden = !record;
  cropEditor?.select(sprite, record, workspace.sprites[sprite]);
  $("sprite-scope").textContent = record
    ? "Recorte compartido: afecta a todas las piezas “" +
      label(e) +
      " · " +
      sprite +
      "”. No cambia el punto de apoyo ni la colisión."
    : "";
  const editableBody = !!e.solid && !e.portal && !e.threshold && !e.actor;
  $("collision-section").hidden = !e.solid;
  for (const [index, id] of [
    "body-x",
    "body-y",
    "body-w",
    "body-h",
  ].entries()) {
    $(id).value = e.solid?.[index] * TILE || 0;
    $(id).disabled = !editableBody;
  }
  $("collision-help").textContent = editableBody
    ? "Cuerpo físico en píxeles, relativo al pie naranja. Independiente del recorte; azul en el mapa."
    : "Umbral protegido: su geometría se calcula desde la puerta o escalera.";
  const c = $("preview").getContext("2d"),
    f = view.renderer.sprites.frame(frameName(e));
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
      frameName(e),
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
  if (!dirty() && workspace.revision) return;
  const sending = JSON.parse(JSON.stringify(workspace));
  $("save-status").textContent = "Guardando…";
  savePromise = api("/api/workspace", {
    method: "POST",
    body: JSON.stringify(sending),
  });
  try {
    const result = await savePromise;
    workspace.revision = result.revision;
    savedJSON = JSON.stringify({
      changes: sending.changes,
      sprites: sending.sprites,
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
    baseHash: snapshot.baseHash,
    scenes: diff(snapshot, workspace.changes),
    sprites: spriteDiff(snapshot, workspace.sprites),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "magikitos-studio-diff.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function adjustCrop(crop) {
  const e = currentEntity();
  if (!e) return;
  const before = editsJSON();
  try {
    const next = validateSprites(snapshot, {
      ...workspace.sprites,
      [frameName(e)]: { crop },
    });
    cropEditor.apply(snapshot, next);
    workspace.sprites = next;
    view.renderer.terrain.chunks.clear();
    rebuild();
    history(before);
  } catch (error) {
    toast(error.message);
    paintInspector();
  }
}
$("collision-section").ontoggle = () => {
  if ($("collision-section").open) {
    view.bodies = true;
    $("bodies").checked = true;
    view.dirty = true;
  }
};
$("crop-auto").onclick = () => cropEditor.auto();
$("crop-reset").onclick = () => {
  const record = snapshot.sprites[frameName(currentEntity() || {})];
  if (record) adjustCrop(cropFor(record));
};
for (const id of ["crop-x", "crop-y", "crop-w", "crop-h"])
  $(id).onchange = () =>
    adjustCrop(
      ["crop-x", "crop-y", "crop-w", "crop-h"].map((k) => Number($(k).value)),
    );
for (const id of ["body-x", "body-y", "body-w", "body-h"])
  $(id).onchange = () =>
    adjust({
      solid: ["body-x", "body-y", "body-w", "body-h"].map(
        (k) => Number($(k).value) / TILE,
      ),
    });
$("scene").onchange = () => {
  sceneId = $("scene").value;
  selected = null;
  rebuild(true);
  pathEditor.sceneChanged();
};
$("search").oninput = paintList;
for (const b of document.querySelectorAll("[data-layer]"))
  b.onclick = () => {
    layer = b.dataset.layer;
    for (const n of document.querySelectorAll(".layer-tabs button"))
      n.setAttribute("aria-pressed", String(n === b));
    paintList();
  };
for (const key of ["x", "y", "scale"])
  $(key).onchange = () => adjust({ [key]: Number($(key).value) });
$("variant").onchange = () => adjust({ artVariant: $("variant").value });
$("flip").onchange = () => adjust({ flip: $("flip").checked });
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
  pathEditor.cancel();
  redo.push(editsJSON());
  restoreEdits(undo.pop());
  rebuild();
  changed();
};
$("redo").onclick = () => {
  if (!redo.length) return;
  pathEditor.cancel();
  undo.push(editsJSON());
  restoreEdits(redo.pop());
  rebuild();
  changed();
};
$("revert").onclick = () => {
  if (!selected) return;
  adjust(placement(baseEntity()));
};
$("remove").onclick = () => {
  if (!selected || $("remove").disabled) return;
  const before = editsJSON(),
    next = JSON.parse(JSON.stringify(workspace.changes)),
    group = (next[sceneId] ||= { entities: {}, scenery: {} });
  if (group.added?.[selected.id]) delete group.added[selected.id];
  else (group.removed ||= []).push({ ...selected });
  try {
    workspace.changes = validateChanges(snapshot, next);
    selected = null;
    rebuild(false, null);
    history(before);
  } catch (error) {
    toast(error.message);
  }
};
function addFromGallery(family, artVariant) {
  const before = editsJSON(),
    id = "studio-" + crypto.randomUUID();
  const scene = snapshot.world.scenes[sceneId],
    center = {
      x: (view.camera.x + view.renderer.width / 2) / TILE,
      y: (view.camera.y + view.renderer.height / 2) / TILE,
    };
  const x = Math.max(
      1,
      Math.min(scene.width - 1, Math.round(center.x * 4) / 4),
    ),
    y = Math.max(1, Math.min(scene.height - 1, Math.round(center.y * 4) / 4));
  const next = JSON.parse(JSON.stringify(workspace.changes)),
    group = (next[sceneId] ||= { entities: {}, scenery: {} });
  (group.added ||= {})[id] = {
    family,
    ...placement(makeElement(family, id, x, y, artVariant)),
  };
  try {
    workspace.changes = validateChanges(snapshot, next);
    selected = { id, layer: "entities" };
    rebuild();
    history(before);
    toast(
      "Colocado en el centro de la vista. Arrástralo a su sitio; solo cambia el estudio.",
    );
  } catch (error) {
    toast(error.message);
  }
}
$("save").onclick = () =>
  save()
    .then(() => toast("Estudio guardado. El juego sigue intacto."))
    .catch((e) => toast(e.message));
$("export").onclick = () =>
  save()
    .then(exportDiff)
    .catch((e) => toast(e.message));
$("review").onclick = () => {
  const scenes = diff(snapshot, workspace.changes),
    sprites = spriteDiff(snapshot, workspace.sprites);
  const art = sprites.length
    ? "<h3>Recortes de sprites</h3><pre>" +
      escape(
        JSON.stringify(
          sprites.map(({ sprite, before, after }) => ({
            sprite,
            before,
            after,
          })),
          null,
          2,
        ),
      ) +
      "</pre>"
    : "";
  modal(
    "Cambios del estudio",
    art +
      (scenes.length
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
                    .join("\n\n") +
                    (s.added
                      ? "\n\nAñadidos\n" + JSON.stringify(s.added, null, 2)
                      : "") +
                    (s.removed
                      ? "\n\nRetirados\n" + JSON.stringify(s.removed, null, 2)
                      : "") +
                    (s.paths
                      ? "\n\nCaminos\n" + JSON.stringify(s.paths, null, 2)
                      : ""),
                ) +
                "</pre>",
            )
            .join("") +
          "<p>La propuesta conserva las reglas de cada objeto y conserva la vegetación de la escena para que mover una mesa no redistribuya el bosque. Puertas, zonas de contenido, luces y pasajes requieren revisión de sus referencias antes de aplicar.</p>"
        : "<p>No hay cambios de colocación que revisar.</p>"),
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
  if ($("modal").open || $("map-panel").hidden) return;
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
  if (pathEditor.key(e)) {
    e.preventDefault();
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
  if (workspace && dirty()) {
    e.preventDefault();
    e.returnValue = "";
  }
});
function setPaths(paths) {
  const before = editsJSON();
  try {
    const data = JSON.parse(JSON.stringify(workspace.changes));
    (data[sceneId] ||= { entities: {}, scenery: {} }).paths = paths;
    workspace.changes = validateChanges(snapshot, data);
    rebuild(false, null);
    history(before);
    return true;
  } catch (error) {
    toast(error.message);
    return false;
  }
}
pathEditor = new PathEditor(
  view,
  () =>
    workspace?.changes[sceneId]?.paths ??
    snapshot?.world.scenes[sceneId].paths ??
    [],
  setPaths,
  () => paintInspector(),
);
const shell = new StudioShell(view);
(async () => {
  try {
    context = await api("/api/context");
    snapshot = context.snapshot;
    workspace = context.workspace;
    savedJSON = editsJSON();
    if (context.conflicts.length)
      toast(
        "Cambios en conflicto conservados: " + context.conflicts.join(", "),
      );
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
    cropEditor = new CropEditor(
      $("crop-preview"),
      view.renderer.sprites,
      adjustCrop,
    );
    rebuild(true, null);
    gallery = new Gallery($("gallery"), view.renderer.sprites, addFromGallery);
    gallery.sceneChanged(view.world.data);
    $("loading").hidden = true;
  } catch (error) {
    $("loading").textContent = error.message;
    console.error(error);
  }
})();
window.MagikitosStudio = Object.freeze({
  inspect: () => ({
    ready: !!view.world,
    shell: shell.inspect(),
    scene: sceneId,
    selected,
    pathMode: pathEditor.enabled,
    pathSelection: pathEditor.selected,
    paths: view.world?.data.paths,
    changes: workspace?.changes,
    sprites: workspace?.sprites,
    baseHash: snapshot?.baseHash,
    dirty: workspace ? dirty() : false,
    revision: workspace?.revision,
    zoom: view.zoom,
    camera: { ...view.camera },
  }),
});
