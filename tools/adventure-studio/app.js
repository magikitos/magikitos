"use strict";
const { PathEditor } = require("./path-editor");
const { Gallery } = require("./gallery");
const selectionTools = require("./selection");
const { thumbnail } = require("./thumbnail");
const { sceneLinks } = require("./scene-links");
const {
  families,
  familyOf,
  frameName,
  makeElement,
  variantOptions,
} = require("./catalog");
const { CropEditor } = require("./crop-editor");
const { validateSprites, spriteDiff, cropFor } = require("./sprite-edits");
const { MapViewport } = require("./viewport");
const {
  placement,
  familyIdOf,
  validateChanges,
  renderScene,
  diff,
  removable,
} = require("./scene-edits");
const { BodyEditor } = require("./body-editor");
const {
  proposedBody,
  validateElements,
  elementDiff,
} = require("./element-edits");
const { capabilities } = require("../../public/assets/js/adventure/entity-art");
const { doorGeometry } = require("../../public/assets/js/adventure/portals");
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
/**
 * Nombres de SPRITE, para que el inspector y la galería no enseñen un slug. Los de las PANTALLAS
 * ya no viven aquí: los resuelve el snapshot desde los textos del juego (`snapshot.nombres`), que
 * es lo que el bosque anuncia al llegar. Las casas aparecen igualmente porque desde fuera son un
 * sprite, y ese sí es un nombre de esta lista.
 */
const names = {
  "human-house": "Refugio de hojas",
  cottage: "Hogar del tocón",
  "home-mushroom-canela": "Casita de seta",
  "home-pot-terracotta": "Refugio de la maceta",
  tavern: "Taberna de la bota",
  workshop: "Taller del tronco",
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
  "mushroom-bolete-leaning": "Seta del bosque",
  "scarlet-mushrooms": "Setas rojas",
  mushrooms: "Setitas silvestres",
  "picnic-blanket": "Manta del picnic",
  "picnic-smoker": "Humano fumando",
  "picnic-human-friend": "Humana merendando",
  "picnic-tortilla": "Tortilla de patatas",
  "picnic-basket": "Cesta de merienda",
  "picnic-knife": "Cuchillo del picnic",
  "person-12-down-right-sit-0": "Brizno, con hambre",
  "person-12-down-right-sit-2": "Brizno, satisfecho",
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
  fenceEditor,
  bodyEditor,
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
  dragMembers = null;
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
  JSON.stringify({
    changes: workspace.changes,
    sprites: workspace.sprites,
    elements: workspace.elements,
  });
const restoreEdits = (text) => Object.assign(workspace, JSON.parse(text));
const dirty = () => editsJSON() !== savedJSON;
const sceneViews = new Map();
const TREE_FILTER_KEY = "magikitos.studio.hideTrees";
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
function rebuild(fit = false, keep) {
  const selections =
    keep === null
      ? []
      : keep
        ? [keep]
        : view.selection.map(selectionTools.identifies);
  cropEditor?.apply(snapshot, workspace.sprites);
  view.setScene(
    renderScene(snapshot, sceneId, workspace.changes, workspace.elements),
    fit,
  );
  view.setSelection(selections);
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
  const elements = Object.values(workspace.elements || {}).reduce(
    (n, variants) => n + Object.keys(variants).length,
    0,
  );
  const total =
    count() +
    pathScenes +
    elements +
    Object.keys(workspace.sprites).length;
  $("diff-count").textContent = String(total);
  $("review").disabled = !total;
  $("review").title = total
    ? count() +
      " elementos movidos · " +
      elements +
      " cuerpos de elemento · " +
      Object.keys(workspace.sprites).length +
      " recortes · caminos en " +
      pathScenes +
      " escena(s)"
    : "Nada que revisar todavía";
  // Un punto, no un párrafo: el guardado es automático y solo interesa cuando aún no ha ocurrido.
  $("save-status").textContent = dirty() ? "● sin guardar" : "guardado";
  $("save-status").dataset.state = dirty() ? "pending" : "saved";
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
      (view.selection.length > 1 || $("linked").checked) &&
      (value.x !== undefined || value.y !== undefined)
    ) {
      entries.length = 0;
      const rows = selectionTools.members(
        view.elements(),
        view.selection,
        $("linked").checked,
      );
      const delta = selectionTools.translation(
        rows.map(({ e }) => ({ x: e.x / TILE, y: e.y / TILE, fence: e.fence })),
        next.x - current.x,
        next.y - current.y,
        view.world,
      );
      for (const { e, layer: memberLayer } of rows) {
        entries.push({
          selection: { id: e.id, layer: memberLayer },
          value: {
            ...placement({ ...e, x: e.x / TILE, y: e.y / TILE }),
            x: e.x / TILE + delta.x,
            y: e.y / TILE + delta.y,
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
/**
 * ⛔ EL CUERPO Y LA ENTRADA SON DEL ELEMENTO, NO DE LA COPIA (21-sep-2026, decisión del dueño).
 *
 * De un elemento con familia se edita su VARIANTE, y desde ahí vale para todas sus copias, las
 * puestas y las que se pongan mañana. De uno sin familia —un cartel, un saco— no hay dónde
 * guardarlo más que en las copias, así que se escriben TODAS las de ese mismo dibujo, en todas las
 * pantallas: el resultado que se ve es el mismo, y el dueño no tiene que repetir el trabajo doce
 * veces. Lo que no se hace nunca es tocar solo la que está seleccionada.
 */
function bodyScope(row) {
  const e = row?.e;
  if (!e || e.fence || e.actor || e.neighbor) return null;
  const sprite = frameName(e),
    family = familyOf(e),
    familyId = family && familyIdOf(e),
    variant = e.artVariant;
  const portal = !!e.portal && e.portal !== "stairs";
  if (familyId && variant && family.variants.some((v) => v.id === variant)) {
    const instances = countInstances((row) => familyIdOf(row) === familyId && row.artVariant === variant);
    return {
      kind: "element",
      key: familyId + "/" + variant,
      family: familyId,
      variant,
      sprite,
      portal,
      label: family.label + " · " + (family.variants.find((v) => v.id === variant)?.label || variant),
      reach:
        "Vale para " +
        copies(instances) +
        " de este elemento en el bosque, y para las que pongas después.",
      body: proposedBody(familyId, variant, workspace.elements) || {},
    };
  }
  const instances = countInstances((row) => frameName(row) === sprite);
  return {
    kind: "sprite",
    key: "sprite:" + sprite,
    sprite,
    portal,
    label: label(e) + " · " + sprite,
    reach:
      "Este dibujo no tiene familia todavía, así que se escribe en " +
      copies(instances) +
      " del bosque, todas a la vez.",
    body: {
      solids: e.solids ? clone(e.solids) : e.solid ? [clone(e.solid)] : [],
      ...(e.entrance ? { entrance: clone(e.entrance) } : {}),
    },
  };
}
/** Cómo se cuentan las copias en el aviso: una es una, y ninguna se dice sin rodeos. */
const copies = (n) =>
  n === 0 ? "ninguna copia" : n === 1 ? "la única copia" : "las " + n + " copias";
/** Cuántas copias hay en TODO el bosque, que es el alcance que se anuncia antes de tocar nada. */
function countInstances(matches) {
  let n = 0;
  for (const scene of Object.values(snapshot.world.scenes))
    for (const e of scene.entities) if (matches(e)) n++;
  for (const props of Object.values(snapshot.scenery))
    for (const e of props) if (matches(e)) n++;
  return n;
}
const clone = (value) => JSON.parse(JSON.stringify(value));
/**
 * Guarda el cuerpo del elemento y, de paso, RETIRA los cuerpos sueltos que cada copia llevaba
 * encima: si no, la copia antigua seguiría ganando y el dueño vería que su cambio no hace nada.
 */
function applyBody(scope, body) {
  const before = editsJSON();
  try {
    if (scope.kind === "element") {
      const elements = JSON.parse(JSON.stringify(workspace.elements));
      (elements[scope.family] ||= {})[scope.variant] = body;
      workspace.elements = validateElements(elements);
      clearOwnBodies((e) => familyIdOf(e) === scope.family && e.artVariant === scope.variant);
    } else {
      writeOwnBodies((e) => frameName(e) === scope.sprite, body);
    }
    rebuild();
    history(before);
    return true;
  } catch (error) {
    restoreEdits(before);
    toast(error.message);
    return false;
  }
}
/** Recorre TODAS las pantallas: un elemento no vive solo en la que se está mirando. */
function eachInstance(matches, write) {
  const data = JSON.parse(JSON.stringify(workspace.changes));
  for (const [scene, source] of Object.entries(snapshot.world.scenes)) {
    for (const layer of ["entities", "scenery"]) {
      const rows = layer === "entities" ? source.entities : snapshot.scenery[scene];
      for (const e of rows || []) {
        if (!matches(e)) continue;
        const group = (data[scene] ||= { entities: {}, scenery: {} });
        const current = group[layer]?.[e.id] ||
          (layer === "entities" ? group.added?.[e.id] : null) ||
          placement(e);
        const next = write({ ...placement(e), ...current });
        if (group.added?.[e.id]) group.added[e.id] = { ...group.added[e.id], ...next };
        else (group[layer] ||= {})[e.id] = next;
      }
    }
  }
  workspace.changes = validateChanges(snapshot, data);
}
const clearOwnBodies = (matches) =>
  eachInstance(matches, (value) => {
    const next = { ...value };
    delete next.solid;
    delete next.entrance;
    return next;
  });
const writeOwnBodies = (matches, body) =>
  eachInstance(matches, (value) => ({
    ...value,
    ...(body.solids?.length ? { solid: body.solids[0] } : { solid: undefined }),
    ...(body.entrance ? { entrance: body.entrance } : { entrance: undefined }),
  }));
function currentEntityInTiles() {
  const e = currentEntity();
  return { ...e, x: e.x / TILE, y: e.y / TILE };
}
function drag(info, position, commit, cancel) {
  if (!dragBefore) {
    dragBefore = editsJSON();
    dragMembers = selectionTools
      .members(view.elements(), view.selection, $("linked").checked)
      .map((p) => ({
        selection: selectionTools.identifies(p),
        value: placement({ ...p.e, x: p.e.x / TILE, y: p.e.y / TILE }),
      }));
  }
  if (cancel) {
    restoreEdits(dragBefore);
    dragBefore = null;
    dragMembers = null;
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
    const delta = selectionTools.translation(
      dragMembers.map((p) => p.value),
      x - info.entity.x / TILE,
      y - info.entity.y / TILE,
      s,
    );
    const entries = dragMembers.map(({ selection, value }) => ({
      selection,
      value: { ...value, x: value.x + delta.x, y: value.y + delta.y },
    }));
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
    dragMembers = null;
    rebuild();
    history(before);
  }
}
function paintSelection() {
  for (const b of $("elements").children)
    b.setAttribute(
      "aria-pressed",
      String(
        view.selection.some(
          (p) => b.dataset.id === p.e.id && b.dataset.layer === p.layer,
        ),
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
    rows.length + " elementos · ordenados por profundidad" +
    (view.hideTrees ? " · árboles ocultos" : "");
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
    thumbnail(b.querySelector("canvas"), view.renderer.sprites, e, 2);
    b.onclick = (event) =>
      view.select(
        e.id,
        rowLayer,
        !event.shiftKey && !event.metaKey && !event.ctrlKey && !view.multi,
        event.shiftKey || event.metaKey || event.ctrlKey || view.multi,
      );
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
  if (entity.threshold && view.world) {
    const [tx, ty, tw, th] = entity.threshold;
    if (!view.world.canStand((tx + tw / 2) * TILE, (ty + th / 2) * TILE, { actor: true }))
      messages.push(
        "El umbral de la entrada cae sobre un cuerpo o sobre agua: nadie podrá pisarlo. Muévelo a suelo libre.",
      );
  }
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
  return messages;
}
/**
 * La entrada de una puerta en el inspector: la franja que la abre, relativa al pie, tal y como la
 * escribirá el compilador (`entrance`). Automática si nadie la ha dibujado.
 */
function paintInspector() {
  const multi = view.selection.length > 1;
  if (fenceEditor?.enabled || bodyEditor?.enabled) {
    $("properties").hidden = true;
    $("multi-properties").hidden = true;
    $("selection-help").hidden = true;
    return;
  }
  $("multi-properties").hidden = !multi || pathEditor?.enabled;
  $("multi-count").textContent =
    view.selection.length + " elementos seleccionados";
  $("properties").hidden = !selected || pathEditor?.enabled || multi;
  $("selection-help").hidden = !!selected || pathEditor?.enabled;
  if (!selected || pathEditor?.enabled || multi) return;
  const e = currentEntity();
  if (!e) return;
  const cap = capabilities(baseEntity());
  $("fence-edit").hidden = !e.fence;
  $("selected-name").textContent = label(e);
  $("selected-id").textContent = sceneId + " / " + e.id;
  $("x").value = e.x / TILE;
  $("y").value = e.y / TILE;
  for (const [id, multiplier] of [
    ["scale", 1],
    ["scale-percent", 100],
  ]) {
    $(id).min = cap.scale.min * multiplier;
    $(id).max = cap.scale.max * multiplier;
    $(id).value = (Math.round((e.scale ?? 1) * 100) / 100) * multiplier;
    $(id).disabled = cap.scale.min === cap.scale.max;
  }
  $("scale-reset").disabled = cap.scale.min === cap.scale.max;
  const family = familyOf(e);
  $("variant-field").hidden = !family;
  $("variant").replaceChildren(
    ...(family
      ? variantOptions(family).map((v) => {
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
  $("transform-help").textContent = family?.boundary
    ? "Extremos naturales: solapa un poco las puntas para alargar; para doblar, elige una esquina propia. Sus cuerpos físicos siguen la variante y la escala."
    : e.fence
    ? "Ajusta longitud y ángulos con Editar trazado de valla. Los postes y la colisión siguen el trazado."
    : "Reflejo y escala solo cuando no rompen su función. No se ofrece giro: no genera otra vista del objeto.";
  const sprite = frameName(e),
    record = snapshot.sprites?.[sprite];
  $("crop-section").hidden = !record || !!e.fence;
  cropEditor?.select(sprite, record, workspace.sprites[sprite]);
  $("sprite-scope").textContent = record
    ? "Recorte compartido: afecta a todas las piezas “" +
      label(e) +
      " · " +
      sprite +
      "”. No cambia el punto de apoyo ni la colisión."
    : "";
  const scope = bodyScope({ e, layer: selected.layer });
  $("body-section").hidden = !scope || bodyEditor?.enabled;
  $("body-scope").textContent = scope ? scope.reach : "";
  thumbnail($("preview"), view.renderer.sprites, e, 15);
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
    // La MISMA forma que `editsJSON`: si se escribe dos veces, un campo nuevo deja el estudio
    // «sin guardar» para siempre y el guardado automático no para nunca.
    savedJSON = JSON.stringify({
      changes: sending.changes,
      sprites: sending.sprites,
      elements: sending.elements,
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
function paintSceneLinks() {
  const links = sceneLinks(snapshot.world.scenes, sceneId);
  $("scene-neighbors").replaceChildren(...links.map((link) => {
    const button = document.createElement("button"),
      name = context.nombres[link.scene] || link.scene,
      arrow = { up: "↑", right: "→", down: "↓", left: "←" }[link.direction] || "⌂";
    button.type = "button";
    button.dataset.sceneTarget = link.scene;
    button.textContent = arrow + " " + name;
    button.title = "Editar " + name;
    button.addEventListener("click", () => switchScene(link.scene));
    return button;
  }));
  $("scene-neighbors").hidden = !links.length;
}
function switchScene(next) {
  if (!view.world || !Object.hasOwn(snapshot.world.scenes, next) || next === sceneId) return;
  sceneViews.set(sceneId, { zoom: view.zoom, camera: { ...view.camera } });
  fenceEditor?.stop();
  sceneId = next;
  $("scene").value = next;
  selected = null;
  const previous = sceneViews.get(next);
  rebuild(!previous, null);
  if (previous) view.restoreView(previous);
  pathEditor.sceneChanged();
  paintSceneLinks();
}
$("scene").onchange = () => switchScene($("scene").value);
$("hide-trees").onclick = () => {
  view.setTreesHidden(!view.hideTrees);
  paintTreeFilter();
  if (view.world) paintList();
  try { localStorage.setItem(TREE_FILTER_KEY, String(view.hideTrees)); } catch {}
};
function paintTreeFilter() {
  $("hide-trees").setAttribute("aria-pressed", String(view.hideTrees));
  $("hide-trees").textContent = view.hideTrees ? "Mostrar árboles" : "Ocultar árboles";
}
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
$("scale").oninput = () => {
  $("scale-percent").value = Math.round(Number($("scale").value) * 100);
};
$("scale-percent").onchange = () =>
  adjust({ scale: Number($("scale-percent").value) / 100 });
$("scale-reset").onclick = () => adjust({ scale: baseEntity().scale ?? 1 });
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
$("multi-select").onclick = () => {
  view.multi = !view.multi;
  view.hand = false;
  $("hand").setAttribute("aria-pressed", "false");
  $("multi-select").setAttribute("aria-pressed", String(view.multi));
};
$("zoom-in").onclick = () => view.zoomAt(view.zoom * 1.25);
$("zoom-out").onclick = () => view.zoomAt(view.zoom / 1.25);
$("fit").onclick = () => view.fit();
$("undo").onclick = () => {
  if (!undo.length) return;
  pathEditor.cancel();
  fenceEditor?.stop();
  redo.push(editsJSON());
  restoreEdits(undo.pop());
  rebuild();
  changed();
};
$("redo").onclick = () => {
  if (!redo.length) return;
  pathEditor.cancel();
  fenceEditor?.stop();
  undo.push(editsJSON());
  restoreEdits(redo.pop());
  rebuild();
  changed();
};
$("revert").onclick = () => {
  if (!selected) return;
  adjust(placement(baseEntity()));
};
function removeSelection() {
  if (!selected) return;
  const before = editsJSON(),
    next = JSON.parse(JSON.stringify(workspace.changes)),
    group = (next[sceneId] ||= { entities: {}, scenery: {} });
  const protectedRows = [];
  for (const row of view.selection.map(selectionTools.identifies)) {
    if (group.added?.[row.id]) delete group.added[row.id];
    else if (removable(snapshot, sceneId, row.layer, row.id))
      (group.removed ||= []).push(row);
    else protectedRows.push(row);
  }
  try {
    workspace.changes = validateChanges(snapshot, next);
    selected = null;
    rebuild(false, null);
    view.setSelection(protectedRows);
    history(before);
    if (protectedRows.length)
      toast(
        "Se conservan " +
          protectedRows.length +
          " objetos funcionales protegidos.",
      );
  } catch (error) {
    toast(error.message);
  }
}
$("remove").onclick = removeSelection;
$("multi-remove").onclick = removeSelection;
/**
 * Coloca un elemento de la galería. Sin punto, cae en el centro de la vista (el botón); con punto,
 * justo donde se ha soltado, que es lo que se pidió: nada de aparecer en el centro y arrastrar.
 */
function addFromGallery(family, artVariant, point = null) {
  const before = editsJSON(),
    id = "studio-" + crypto.randomUUID();
  const scene = snapshot.world.scenes[sceneId],
    center = point || {
      x: (view.camera.x + view.renderer.width / 2) / TILE,
      y: (view.camera.y + view.renderer.height / 2) / TILE,
    };
  const step = Number($("snap").value) || 0.25;
  const round = (v) => Math.round(v / step) * step;
  const x = Math.max(1, Math.min(scene.width - 1, round(center.x))),
    y = Math.max(1, Math.min(scene.height - 1, round(center.y)));
  const next = JSON.parse(JSON.stringify(workspace.changes)),
    group = (next[sceneId] ||= { entities: {}, scenery: {} });
  // El cuerpo y la entrada NO se copian en la copia nueva: son del elemento, y de ahí los hereda.
  const { solid, entrance, ...where } = placement(
    makeElement(family, id, x, y, artVariant),
  );
  (group.added ||= {})[id] = { family, ...where };
  try {
    workspace.changes = validateChanges(snapshot, next);
    selected = { id, layer: "entities" };
    rebuild(false, selected);
    history(before);
    toast(
      point
        ? "Colocado donde lo has soltado. Solo cambia el estudio."
        : "Colocado en el centro de la vista. Arrástralo a su sitio; solo cambia el estudio.",
    );
  } catch (error) {
    toast(error.message);
  }
}
$("save").onclick = () =>
  save()
    .then(() => toast("Estudio guardado. El juego sigue intacto."))
    .catch((e) => toast(e.message));
$("review").onclick = () => {
  const scenes = diff(snapshot, workspace.changes),
    sprites = spriteDiff(snapshot, workspace.sprites);
  const bodies = elementDiff(workspace.elements || {});
  const cuerpos = bodies.length
    ? "<h3>Cuerpo y entrada de elementos</h3><p>Se escriben en <code>data/aventura/element-families.json</code> y valen para todas sus copias.</p><pre>" +
      escape(
        bodies
          .map(
            (b) =>
              b.familyLabel +
              " · " +
              b.variantLabel +
              " (" +
              b.sprite +
              ")\n  antes " +
              JSON.stringify(b.before) +
              "\n  ahora " +
              JSON.stringify(b.after),
          )
          .join("\n\n"),
      ) +
      "</pre>"
    : "";
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
    cuerpos +
      art +
      (scenes.length
        ? "<p>Solo propuesta. No se ha escrito ningún JSON de las escenas del juego.</p>" +
          scenes
            .map(
              (s) =>
                "<h3>" +
                escape(context.nombres[s.scene] || s.scene) +
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
  // El mapa es lo único que hay: la pestaña del laboratorio se fue con los experimentos
  // archivados, así que ya no puede estar escondido detrás de nada.
  if ($("modal").open) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    save().catch((error) => toast(error.message));
    return;
  }
  if (
    e.target.closest(
      "input,select,textarea,[contenteditable]:not([contenteditable=false])",
    )
  )
    return;
  if ((e.metaKey || e.ctrlKey) && ["z", "y"].includes(e.key.toLowerCase())) {
    e.preventDefault();
    $(e.shiftKey || e.key.toLowerCase() === "y" ? "redo" : "undo").click();
    return;
  }
  if (bodyEditor?.key(e) || fenceEditor?.key(e) || pathEditor.key(e)) {
    e.preventDefault();
    return;
  }
  if (["Backspace", "Delete"].includes(e.key) && !pathEditor.enabled) {
    e.preventDefault();
    removeSelection();
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
bodyEditor = new BodyEditor(
  view,
  { scopeOf: bodyScope, apply: applyBody },
  () => {
    pathEditor?.stop?.();
    fenceEditor?.stop();
    paintInspector();
  },
  () => {
    paintInspector();
    paintSelection();
  },
);
pathEditor = new PathEditor(
  view,
  () =>
    workspace?.changes[sceneId]?.paths ??
    snapshot?.world.scenes[sceneId].paths ??
    [],
  setPaths,
  (enabled) => {
    if (enabled) fenceEditor?.stop();
    paintInspector();
  },
);
fenceEditor = new (require("./fence-editor").FenceEditor)(
  view,
  (target, points) => {
    const before = editsJSON(),
      [x, y] = points[0];
    const fence = { points: points.map((p) => [p[0] - x, p[1] - y]) };
    try {
      const id = target?.id || "studio-" + crypto.randomUUID();
      if (target) {
        const e = view
          .elements()
          .find((p) => p.e.id === target.id && p.layer === target.layer).e;
        setChanges([
          { selection: target, value: { ...placement({ ...e, x, y }), fence } },
        ]);
      } else {
        const changes = structuredClone(workspace.changes),
          group = (changes[sceneId] ||= { entities: {}, scenery: {} });
        (group.added ||= {})[id] = {
          family: "fence-line",
          ...placement(makeElement("fence-line", id, x, y, "ramas")),
          fence,
        };
        workspace.changes = validateChanges(snapshot, changes);
      }
      rebuild(false, target || { id, layer: "entities" });
      history(before);
      return true;
    } catch (e) {
      toast(e.message);
      return false;
    }
  },
  () => pathEditor.enable(false),
  () => {
    view.editor = pathEditor;
    paintInspector();
  },
);
/** El mapa recibe lo que se arrastra desde la galería y lo deja en el punto exacto del suelo. */
const DROP_TYPE = "application/x-magikitos-element";
const dropPayload = (event) => {
  if (!event.dataTransfer?.types.includes(DROP_TYPE)) return null;
  try {
    return JSON.parse(event.dataTransfer.getData(DROP_TYPE));
  } catch {
    return null;
  }
};
for (const type of ["dragenter", "dragover"])
  $("viewport").addEventListener(type, (event) => {
    if (!event.dataTransfer?.types.includes(DROP_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    $("viewport").classList.add("dropping");
  });
$("viewport").addEventListener("dragleave", (event) => {
  if (event.target === $("viewport")) $("viewport").classList.remove("dropping");
});
$("viewport").addEventListener("drop", (event) => {
  const payload = dropPayload(event);
  $("viewport").classList.remove("dropping");
  if (!payload) return;
  event.preventDefault();
  const point = view.point(event.clientX, event.clientY);
  addFromGallery(payload.family, payload.artVariant, {
    x: point.x / TILE,
    y: point.y / TILE,
  });
});
$("objects-mode").addEventListener("click", () => fenceEditor.stop());
$("river-topology").addEventListener("change", () => {
  view.dirty = true;
});
(async () => {
  try {
    context = await api("/api/context");
    snapshot = context.snapshot;
    workspace = context.workspace;
    workspace.elements ||= {};
    savedJSON = editsJSON();
    if (context.conflicts.length)
      toast(
        "Cambios en conflicto conservados: " + context.conflicts.join(", "),
      );
    $("scene").replaceChildren(
      ...Object.keys(snapshot.world.scenes).map((id) => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = context.nombres[id] || id;
        return option;
      }),
    );
    $("scene").value = sceneId;
    try { view.hideTrees = localStorage.getItem(TREE_FILTER_KEY) === "true"; } catch {}
    paintTreeFilter();
    await view.initialize();
    cropEditor = new CropEditor(
      $("crop-preview"),
      view.renderer.sprites,
      adjustCrop,
    );
    rebuild(true, null);
    paintSceneLinks();
    gallery = new Gallery($("gallery"), view.renderer.sprites, addFromGallery);
    gallery.sceneChanged(view.world.data);
    $("loading").hidden = true;
  } catch (error) {
    $("loading").textContent = error.message;
    console.error(error);
  }
})();
window.MagikitosStudio = Object.freeze({
  /** Seleccionar sin apuntar con el ratón: lo usan las pruebas y el teclado. */
  select: (id, layer = "entities") => view.select(id, layer, true),
  inspect: () => ({
    ready: !!view.world,
    scene: sceneId,
    sceneLinks: snapshot ? sceneLinks(snapshot.world.scenes, sceneId) : [],
    hideTrees: view.hideTrees,
    visibleElements: view.world ? view.elements().map(selectionTools.identifies) : [],
    selected,
    selection: view.selection.map(selectionTools.identifies),
    fenceEditing: fenceEditor.enabled,
    fencePoints: fenceEditor.points,
    pathMode: pathEditor.enabled,
    pathSelection: pathEditor.selected,
    paths: view.world?.data.paths,
    changes: workspace?.changes,
    sprites: workspace?.sprites,
    elements: workspace?.elements,
    bodyEditing: bodyEditor?.enabled || false,
    bodyScope: bodyEditor?.enabled ? bodyEditor.scope.key : null,
    bodySolids: bodyEditor?.enabled ? bodyEditor.solids : null,
    bodyEntrance: bodyEditor?.enabled ? bodyEditor.entrance : null,
    // Para que la prueba de navegador pueda ver el rechazo, no solo el color.
    bodyUnreachable: bodyEditor?.enabled ? Boolean(bodyEditor.unreachable) : false,
    baseHash: snapshot?.baseHash,
    dirty: workspace ? dirty() : false,
    revision: workspace?.revision,
    zoom: view.zoom,
    camera: { ...view.camera },
  }),
});
