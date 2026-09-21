"use strict";
/**
 * ⛔ EL CUERPO Y LA ENTRADA SON DEL ELEMENTO (21-sep-2026, decisión del dueño: «esos valores deben
 * ser relativos a ese elemento, en TOOODAS sus instancias, no solo la que estoy editando»).
 *
 * Se abre el Studio en un directorio de trabajo temporal y se comprueba lo que el dueño pidió: que
 * el editor se abre sobre el elemento, que el mapa NO se desplaza mientras se dibuja, que una caja
 * se mueve y se redimensiona con el ratón, que la entrada de una puerta se ajusta igual, y que lo
 * guardado va a la VARIANTE de la familia —no a la copia— y de paso retira los cuerpos sueltos que
 * cada copia llevaba encima. Además: arrastrar un elemento de la galería lo deja donde se suelta.
 * Ninguna fuente del juego cambia.
 */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { chromium } = require("playwright");
const { startStudio } = require("./browser-studio.cjs");
const origin = "http://127.0.0.1:47841",
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "magikitos-bodies-browser-")),
  errors = [];
const shots = path.resolve(".local/screenshots");
fs.mkdirSync(shots, { recursive: true });
let studio, browser;
const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 12000 });
const inspect = (p) => p.evaluate(() => window.MagikitosStudio.inspect());
const scenesDir = path.resolve("data/aventura/scenes"),
  sources = () => ({
    scenes: Object.fromEntries(
      fs
        .readdirSync(scenesDir)
        .map((f) => [f, fs.readFileSync(path.join(scenesDir, f), "utf8")]),
    ),
    families: fs.readFileSync(
      path.resolve("data/aventura/element-families.json"),
      "utf8",
    ),
  });
/** Un punto del mundo (en casillas) en coordenadas de la pantalla. */
async function point(p, x, y) {
  const s = await inspect(p),
    r = await p.locator("#map").boundingBox();
  return {
    x: r.x + (x * 16 - s.camera.x) * s.zoom,
    y: r.y + (y * 16 - s.camera.y) * s.zoom,
  };
}
async function openEditor(p, id) {
  await p.evaluate((target) => window.MagikitosStudio.select(target), id);
  await wait(p, () => !document.getElementById("body-section").hidden);
  await p.locator("#body-edit").click();
  await wait(p, () => window.MagikitosStudio.inspect().bodyEditing);
}
(async () => {
  const before = sources();
  studio = await startStudio({ port: 47841, temp });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await wait(page, () => window.MagikitosStudio?.inspect().ready);

  // 1. La cabecera y el botón de exportar se fueron; queda una sola franja de escenas.
  assert.equal(await page.locator(".studio-header, .project-bar, #export").count(), 0,
    "La cabecera, la barra de proyecto y el exportar diff ya no existen");
  assert(await page.locator(".scene-bar #scene").isVisible(), "El selector de escena vive en la franja");
  assert((await page.locator(".scene-neighbors button").count()) > 0, "Y las vecinas, al lado");

  // 2. El editor se abre sobre un elemento, con su alcance contado.
  await openEditor(page, "home-one");
  const scope = await inspect(page);
  assert.equal(scope.bodyScope, "log-home/redondo", "Se edita la VARIANTE del elemento");
  assert.deepEqual(scope.bodySolids, [[-3, -1, 7, 1.2]], "Con el cuerpo que hereda hoy");
  assert.match(
    (await page.locator("#body-instances").textContent()).trim(),
    /copia/,
    "Y dice a cuántas copias afecta antes de tocar nada",
  );
  assert(
    (await inspect(page)).zoom >= 1.5,
    "La vista se acerca al elemento: un cuerpo no se dibuja al 35 %",
  );

  // 3. ⛔ EL MAPA NO SE MUEVE MIENTRAS SE DIBUJA. Arrastrar fuera de toda caja no desplaza nada.
  const camera = (await inspect(page)).camera;
  const empty = await point(page, 20, 20);
  await page.mouse.move(empty.x, empty.y);
  await page.mouse.down();
  await page.mouse.move(empty.x + 120, empty.y + 90, { steps: 6 });
  await page.mouse.up();
  assert.deepEqual((await inspect(page)).camera, camera, "El fondo no arrastra el mapa");

  // 4. La caja se mueve arrastrando por dentro.
  const box = (await inspect(page)).bodySolids[0];
  // El pie del elemento sale de la escena propuesta; con él se calcula el centro de la caja.
  const place = await page.evaluate(async () => {
    const response = await fetch("/api/workspace");
    const { snapshot } = await response.json();
    const e = snapshot.world.scenes.overworld.entities.find((r) => r.id === "home-one");
    return { x: e.x, y: e.y };
  });
  const inside = await point(page, place.x + box[0] + box[2] / 2, place.y + box[1] + box[3] / 2);
  const zoom = (await inspect(page)).zoom;
  await page.mouse.move(inside.x, inside.y);
  await page.mouse.down();
  await page.mouse.move(inside.x + 16 * zoom, inside.y, { steps: 6 });
  await page.mouse.up();
  const moved = (await inspect(page)).bodySolids[0];
  assert.equal(moved[0], box[0] + 1, "Arrastrar por dentro mueve la caja una casilla: " + JSON.stringify(moved));
  assert.equal(moved[2], box[2], "Y no cambia su ancho");

  // 5. Y se redimensiona tirando de una esquina.
  const corner = await point(page, place.x + moved[0] + moved[2], place.y + moved[1] + moved[3]);
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x + 16 * zoom, corner.y + 16 * zoom, { steps: 6 });
  await page.mouse.up();
  const sized = (await inspect(page)).bodySolids[0];
  // El tirador redondea al paso elegido (¼ de casilla por defecto), así que se pide el crecimiento
  // con esa tolerancia y no una igualdad falsa.
  assert(Math.abs(sized[2] - (moved[2] + 1)) <= 0.25, "La esquina estira el ancho: " + JSON.stringify(sized));
  assert(Math.abs(sized[3] - (moved[3] + 1)) <= 0.25, "Y el alto: " + JSON.stringify(sized));
  await page.screenshot({ path: path.join(shots, "studio-body-editor.png") });

  // 6. Guardar escribe en el ELEMENTO, no en la copia.
  await page.keyboard.press("Enter");
  await wait(page, () => !window.MagikitosStudio.inspect().bodyEditing);
  const saved = await inspect(page);
  assert.deepEqual(saved.elements["log-home"].redondo.solids, [sized], "La propuesta es del elemento");
  assert.equal(saved.changes.overworld?.entities?.["home-one"]?.solid, undefined,
    "Y la copia no guarda un cuerpo suyo que pisaría al del elemento");

  // 7. El diff dice qué fichero se escribe y qué había antes.
  await page.locator("#save").click();
  await wait(page, () => !window.MagikitosStudio.inspect().dirty);
  const diff = await (await page.request.get(origin + "/api/diff")).json();
  const entry = diff.elements.find((b) => b.family === "log-home" && b.variant === "redondo");
  assert(entry, "El diff lleva el cuerpo del elemento");
  /**
   * ⛔ EL DIFF APUNTA AL FICHERO DONDE ESA VARIANTE EXISTE DE VERDAD. `log-home` es una de las 39
   * familias que `build-woodland-kit.cjs` rehace desde el manifiesto de arte: su entrada en
   * `element-families.json` NO tiene `variants` (solo rótulo, categoría, plantilla y entrada), y
   * el generador arranca cada una de esas familias con `variants: []`. Escribir ahí el cuerpo de
   * `redondo` sería escribirlo donde nadie lo lee, y el siguiente `art:catalog` lo borraría sin
   * decir nada. Va a `elements.json`, que es el fichero que ese generador conserva. Las familias
   * AUTORADAS —las 38 que sí llevan sus variantes escritas a mano— van al otro, y esa mitad la
   * cubre `check-element-bodies.cjs`.
   */
  assert.equal(entry.file, "data/aventura/elements.json");
  assert.deepEqual(entry.before.solids, [[-3, -1, 7, 1.2]]);
  assert.deepEqual(entry.after.solids, [sized]);

  // 8. La entrada de una puerta se dibuja en el mismo editor y con sus límites.
  await openEditor(page, "home-one");
  await page.locator("#body-entrance").click();
  await wait(page, () => !!window.MagikitosStudio.inspect().bodyEntrance);
  await page.locator("#body-w").fill("9");
  await page.locator("#body-w").press("Tab");
  const entrance = (await inspect(page)).bodyEntrance;
  assert.equal(entrance[2], 2, "Una franja de nueve casillas se recorta al máximo de dos");
  // Enter dentro del número también cierra: el atajo del documento no llega hasta un input.
  await page.locator("#body-h").press("Enter");
  await wait(page, () => !window.MagikitosStudio.inspect().bodyEditing);
  assert.deepEqual((await inspect(page)).elements["log-home"].redondo.entrance, entrance);

  // 9. Arrastrar desde la galería deja el elemento donde se suelta.
  await page.locator("#gallery summary").click();
  await page.locator("[data-gallery-search]").fill("seta");
  await wait(page, () => document.querySelectorAll(".gallery-card").length > 0);
  const card = page.locator(".gallery-card").first();
  assert.equal(await card.getAttribute("draggable"), "true", "La tarjeta se arrastra");
  const drop = await point(page, 40, 40);
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await card.dispatchEvent("dragstart", { dataTransfer: transfer });
  await page.locator("#viewport").dispatchEvent("dragover", { dataTransfer: transfer });
  await page.locator("#viewport").dispatchEvent("drop", {
    dataTransfer: transfer,
    clientX: drop.x,
    clientY: drop.y,
  });
  await wait(page, () => Object.keys(window.MagikitosStudio.inspect().changes.overworld?.added || {}).length === 1);
  const added = Object.values((await inspect(page)).changes.overworld.added)[0];
  assert(Math.abs(added.x - 40) <= 0.5 && Math.abs(added.y - 40) <= 0.5,
    "Cae donde se suelta, no en el centro: " + JSON.stringify(added));
  assert.equal(added.solid, undefined, "Y sin copiarse el cuerpo del elemento encima");

  assert.deepEqual(errors, []);
  assert.deepEqual(sources(), before, "El Studio no toca ninguna fuente del juego");
  console.log(
    "PASS studio bodies: el cuerpo y la entrada se dibujan sobre el elemento con el mapa quieto, se guardan en su variante para todas sus copias, el diff dice qué fichero se escribe, y la galería se arrastra hasta su sitio.",
  );
})()
  .catch((e) => {
    console.error(e, studio?.log?.());
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    studio?.kill();
    fs.rmSync(temp, { recursive: true, force: true });
  });
