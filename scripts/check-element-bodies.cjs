"use strict";
/**
 * ⛔ EL CUERPO DE UN ELEMENTO ES UN DATO DEL JUEGO, NO UN ADORNO DEL STUDIO (21-sep-2026, repaso).
 *
 * El editor del mapa escribe `solids` y `entrance` en la VARIANTE de una familia, y de ahí lo
 * heredan todas sus copias. Esta prueba cubre lo que un repaso encontró sin cubrir: que una
 * propuesta se valide con sus límites, que quitar la entrada se pueda DECIR, que un elemento sin
 * cuerpo sea legítimo y no reviente la escena, que el diff apunte al fichero donde esa variante
 * existe de verdad, y que hornear el arte otra vez no se lleve por delante la física.
 */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { execFileSync } = require("node:child_process");
const { collisionBodies } = require("../public/assets/js/adventure/collision-grid");
const { TILE } = require("../public/assets/js/adventure/geometry");

const file = path.resolve("data/aventura/elements.json");
const original = fs.readFileSync(file, "utf8");
/** Se prueba sobre una copia con un cuerpo y una entrada puestos; al terminar se devuelve tal cual. */
function conElemento(edit, run) {
  const data = JSON.parse(original);
  const variant = data.families["log-home"].variants.find((v) => v.id === "redondo");
  Object.assign(variant, edit);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  for (const key of Object.keys(require.cache))
    if (/adventure\/(elements|element-appearance)|adventure-studio\/(catalog|element-edits)|aventura\/elements\.json/.test(key))
      delete require.cache[key];
  try {
    return run(require("../tools/adventure-studio/element-edits"));
  } finally {
    fs.writeFileSync(file, original);
  }
}

// 1. Lo que hay hoy se lee como lista de cajas, venga de la variante o de la plantilla.
conElemento({}, (e) => {
  assert.deepEqual(e.bodyOf("log-home", "redondo").solids, [[-3, -1, 7, 1.2]], "Hereda el cuerpo de la plantilla");
  assert.equal(e.bodyOf("log-home", "auto").solids.length, 1, "Con la variante sin fijar, la plantilla");
  assert.equal(e.bodyOf("familia-que-no-existe", "x"), null);
});

// 2. Los límites se respetan y lo que no cambia no se propone.
conElemento({}, (e) => {
  assert.deepEqual(e.validateElements({ "log-home": { redondo: { solids: [[-3, -1, 7, 1.2]] } } }), {},
    "Proponer lo mismo que ya hay no es una propuesta");
  assert.throws(() => e.validateElements({ "no-existe": {} }), /Familia desconocida/);
  assert.throws(() => e.validateElements({ "log-home": { fantasma: { solids: [] } } }), /Variante desconocida/);
  assert.throws(() => e.validateElements({ "log-home": { redondo: { color: 1 } } }), /Campo desconocido/);
  assert.throws(() => e.validateElements({ "log-home": { redondo: { solids: [[0, 0, 99, 1]] } } }), /fuera de límites/);
  assert.throws(() => e.validateElements({ "log-home": { redondo: { solids: [[0, 0, 0.01, 1]] } } }), /fuera de límites/);
  assert.throws(() => e.validateElements({ "log-home": { redondo: { solids: Array(7).fill([0, 0, 1, 1]) } } }), /fuera de límites/);
  assert.throws(() => e.validateElements({ "log-home": { redondo: { entrance: [0, 0, 9, 1] } } }), /Entrada fuera de límites/);
});

// 3. Un elemento SIN cuerpo es legítimo y la escena se construye igual.
conElemento({}, (e) => {
  const vacio = e.validateElements({ "log-home": { redondo: { solids: [] } } });
  assert.deepEqual(vacio["log-home"].redondo.solids, [], "Quitarle todas las cajas es una decisión");
  assert.deepEqual(collisionBodies({ id: "x", solids: [], x: 0, y: 0 }), [],
    "Y el motor lo entiende como «no estorba», no como un error");
});

// 4. Quitar la entrada se puede decir, y el mapa la deja de dibujar.
conElemento({ entrance: [0.5, 0, 1, 0.1875] }, (e) => {
  assert.deepEqual(e.bodyOf("log-home", "redondo").entrance, [0.5, 0, 1, 0.1875]);
  const quitada = e.validateElements({ "log-home": { redondo: { solids: [[-3, -1, 7, 1.2]], entrance: null } } });
  assert.equal(quitada["log-home"].redondo.entrance, null, "El null viaja: es «quítala», no «no la toqué»");
  assert.equal(e.proposedBody("log-home", "redondo", quitada).entrance, undefined,
    "Y la vista previa deja de pintarla");
});

// 5. El diff dice el fichero donde esa variante existe de verdad.
conElemento({}, (e) => {
  const kit = e.elementDiff({ "log-home": { redondo: { solids: [[-3, -1, 7, 1.9]] } } })[0];
  assert.equal(kit.file, "data/aventura/elements.json", "Las familias del kit viven en el generado");
  assert.equal(kit.sprite, "cottage");
  assert.deepEqual(kit.before.solids, [[-3, -1, 7, 1.2]]);
  const autorada = e.elementDiff({ "studio-delimiter-rock-horizontal": { long: { solids: [[-11, -2, 22, 5]] } } })[0];
  assert.equal(autorada.file, "data/aventura/element-families.json", "Las autoradas, en el suyo");
});

// 6. ⛔ Y HORNEAR EL ARTE NO SE LLEVA LA FÍSICA. Es el camino por el que se perdía en silencio.
{
  const data = JSON.parse(original);
  const variant = data.families["log-home"].variants.find((v) => v.id === "redondo");
  variant.solids = [[-3, -1, 7, 1.55]];
  variant.entrance = [0.25, 0, 1, 0.1875];
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  try {
    execFileSync(process.execPath, ["scripts/build-woodland-kit.cjs"], { stdio: "pipe" });
    const after = JSON.parse(fs.readFileSync(file, "utf8")).families["log-home"].variants.find((v) => v.id === "redondo");
    assert.deepEqual(after.solids, [[-3, -1, 7, 1.55]], "El cuerpo sobrevive a `art:catalog`");
    assert.deepEqual(after.entrance, [0.25, 0, 1, 0.1875], "Y la entrada también");
    assert.equal(after.sprite, "cottage", "Sin dejar de rehacer lo que sí manda el manifiesto");
  } finally {
    fs.writeFileSync(file, original);
  }
}
assert.equal(fs.readFileSync(file, "utf8"), original, "La prueba deja el catálogo como estaba");
/**
 * ⛔ UN CUERPO DONDE NO HAY DIBUJO ES UN MURO INVISIBLE (21-sep-2026, repaso).
 *
 * Cuatro colocaciones del bosque —la taberna, el taller, la casa del pescador y el almacén—
 * arrastraban un cuerpo escrito cuando su lámina tenía el ancla pegada al borde izquierdo. El arte
 * se recortó y se volvió a anclar al centro; los cuerpos se quedaron donde estaban, empujados al
 * este. El del almacén medía 17 celdas para un dibujo de 8,25: **56 casillas de suelo libre
 * tapiadas** contra las que el jugador choca sin ver nada. No lo cazaba nadie porque ninguna prueba
 * comparaba la física con el dibujo REAL; se midió sobre el atlas horneado, que es lo que se pinta.
 *
 * El límite es asimétrico a propósito. Un cuerpo MÁS ESTRECHO que su lámina es correcto y común:
 * el tronco de un árbol, la base de una casa por la que se pasa por detrás. Lo que no puede pasar
 * es que sobresalga: ahí no hay nada que chocar. 1,5 celdas deja vivir el margen deliberado de los
 * setos (1,09) y de la escalera del desván (1,36), que sí tienen motivo, y caza cualquier muro.
 */
{
  const assets = path.resolve("public/assets/aventura");
  const manifest = JSON.parse(fs.readFileSync(path.join(assets, "manifest.json"), "utf8"));
  /** La tinta de cada lámina, en celdas y relativa a su ancla: el rectángulo que de verdad se pinta. */
  const ink = new Map();
  for (const pack of Object.values(manifest.packs)) {
    const meta = path.join(assets, pack.metadata);
    if (!fs.existsSync(meta)) continue;
    for (const [name, frame] of Object.entries(JSON.parse(fs.readFileSync(meta, "utf8")).frames || {})) {
      if (!frame.ink || !frame.anchor) continue;
      const [ax, ay] = frame.anchor,
        [ix, iy, iw, ih] = frame.ink,
        r = frame.pixelRatio || 1;
      ink.set(name, {
        x0: (ix - ax) / r / TILE,
        x1: (ix + iw - ax) / r / TILE,
        y0: (iy - ay) / r / TILE,
        y1: (iy + ih - ay) / r / TILE,
      });
    }
  }
  assert(ink.size > 100, "El atlas horneado tiene que estar ahí para poder comparar");

  const LIMIT = 1.5;
  /** Cuánto sobresale el cuerpo del dibujo por su lado peor, en celdas. */
  const overhang = (body, art) =>
    Math.max(art.x0 - body[0], body[0] + body[2] - art.x1, art.y0 - body[1], body[1] + body[3] - art.y1);
  const rect = (b) => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite);
  const walls = [];
  let measured = 0;
  const scenes = path.resolve("data/aventura/scenes");
  for (const name of fs.readdirSync(scenes).filter((f) => f.endsWith(".json"))) {
    const scene = JSON.parse(fs.readFileSync(path.join(scenes, name), "utf8"));
    for (const list of Object.values(scene)) {
      if (!Array.isArray(list)) continue;
      for (const entity of list) {
        const art = entity && ink.get(entity.sprite);
        if (!art) continue;
        const bodies = Array.isArray(entity.solids) ? entity.solids : rect(entity.solid) ? [entity.solid] : [];
        for (const body of bodies.filter(rect)) {
          measured++;
          const out = overhang(body, art);
          if (out > LIMIT)
            walls.push(
              name + "/" + entity.id + " (" + entity.sprite + "): " + out.toFixed(2) + " celdas de muro invisible",
            );
        }
      }
    }
  }
  assert.deepEqual(walls, [], "Cuerpos que sobresalen del dibujo:\n  " + walls.join("\n  "));

  // Y la prueba sabe ponerse roja: el cuerpo que tenía el almacén hasta hoy.
  const warehouse = ink.get("warehouse-watering-can");
  assert(warehouse, "La regadera del almacén sigue en el atlas");
  assert(
    overhang([-8.5, -7.5, 17, 7.7], warehouse) > LIMIT,
    "El muro de 17 celdas del almacén tiene que seguir siendo un fallo",
  );
  assert(overhang([-5, -7.5, 9.3, 7.7], warehouse) <= LIMIT, "Y el cuerpo corregido, correcto");
  console.log("  " + measured + " cuerpos comparados con su lámina horneada; ninguno tapia lo que no dibuja.");
}

console.log(
  "PASS cuerpo y entrada de elemento: herencia, límites, cuerpo vacío, entrada quitada, fichero de destino por familia, supervivencia a `art:catalog` y ningún muro invisible.",
);
