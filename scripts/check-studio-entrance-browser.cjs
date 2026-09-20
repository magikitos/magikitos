"use strict";
/**
 * LA ENTRADA DE UNA CASA SE DIBUJA EN EL STUDIO (20-sep-2026, decisión del dueño). Se abre el Studio
 * en un directorio de trabajo temporal, se selecciona el hogar del tocón, aparece la sección
 * «Entrada», se cambia ΔX desde el inspector, se arrastra la franja azul en el mapa, se deshace, se
 * guarda, y la propuesta lleva `entrance` y nada de geometría derivada. La escalera y la cama no
 * enseñan la sección. Ninguna fuente del juego cambia.
 */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { chromium } = require("playwright");
const { startStudio } = require("./browser-studio.cjs");
const origin = "http://127.0.0.1:47841",
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "magikitos-entrance-browser-")),
  errors = [];
const shots = path.resolve(".local/screenshots");
fs.mkdirSync(shots, { recursive: true });
let studio, browser;
const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 12000 });
const inspect = (p) => p.evaluate(() => window.MagikitosStudio.inspect());
const entranceOf = async (p) => (await inspect(p)).changes.overworld?.entities?.["home-one"]?.entrance ?? null;
async function point(p, [x, y]) {
  await p.locator("#map").scrollIntoViewIfNeeded();
  const s = await inspect(p),
    r = await p.locator("#map").boundingBox();
  return { x: r.x + (x * 16 - s.camera.x) * s.zoom, y: r.y + (y * 16 - s.camera.y) * s.zoom };
}
const scenesDir = path.resolve("data/aventura/scenes"),
  sceneFiles = () => Object.fromEntries(fs.readdirSync(scenesDir).map((f) => [f, fs.readFileSync(path.join(scenesDir, f), "utf8")]));
(async () => {
  const before = sceneFiles();
  studio = await startStudio({ port: 47841, temp });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await wait(page, () => window.MagikitosStudio?.inspect().ready);
  // Una cama no tiene entrada; una casa sí.
  await page.selectOption("#scene", "house");
  await page.locator('[data-id="human-bed"]').click();
  assert(await page.locator("#entrance-section").isHidden(), "Una cama no enseña entrada");
  await page.selectOption("#scene", "overworld");
  await page.locator('[data-id="home-one"]').click();
  await wait(page, () => !document.getElementById("entrance-section").hidden);
  const auto = await page.evaluate(() => ["entrance-dx", "entrance-dy", "entrance-w", "entrance-h"].map((id) => Number(document.getElementById(id).value)));
  assert.deepEqual(auto.slice(2), [1, 0.375], "La entrada automática mide una casilla por seis píxeles");
  assert.equal(auto[0], -0.5, "La automática arranca media casilla a la izquierda del pie");
  assert(await page.locator("#entrance-auto").isDisabled(), "Sin entrada dibujada no hay nada que restablecer");
  // Desde el inspector: la franja se desplaza una casilla y cuarto a la izquierda.
  await page.locator("#entrance-dx").fill("-1.75");
  await page.locator("#entrance-dx").press("Tab");
  await wait(page, () => !!window.MagikitosStudio.inspect().changes.overworld?.entities?.["home-one"]?.entrance);
  assert.deepEqual(await entranceOf(page), [-1.75, auto[1], 1, 0.375]);
  assert(!(await page.locator("#entrance-auto").isDisabled()));
  const cottage = await page.evaluate(() => {
    const s = window.MagikitosStudio.inspect();
    return s.changes.overworld.entities["home-one"];
  });
  // Arrastrando la franja azul en el mapa: se mueve la entrada, no la casa.
  for (let i = 0; i < 2; i++) await page.locator("#zoom-in").click();
  await page.locator('[data-id="home-one"]').click();
  const strip = await point(page, [cottage.x + cottage.entrance[0] + 0.5, cottage.y + cottage.entrance[1] + 0.19]);
  const zoom = (await inspect(page)).zoom;
  await page.mouse.move(strip.x, strip.y);
  await page.mouse.down();
  await page.mouse.move(strip.x + 16 * zoom, strip.y + 8 * zoom, { steps: 6 });
  await page.mouse.up();
  await wait(page, (dx) => window.MagikitosStudio.inspect().changes.overworld?.entities?.["home-one"]?.entrance?.[0] !== dx, -1.75);
  const dragged = await entranceOf(page);
  assert.equal(dragged[0], -0.75, "Un arrastre de una casilla mueve ΔX una casilla: " + JSON.stringify(dragged));
  assert.equal(dragged[1], auto[1] + 0.5, "Y ΔY media casilla");
  const after = (await inspect(page)).changes.overworld.entities["home-one"];
  assert.equal(after.x, cottage.x, "La casa no se ha movido");
  assert.equal(after.y, cottage.y);
  await page.screenshot({ path: path.join(shots, "studio-entrance.png") });
  // Deshacer devuelve el valor del inspector; rehacer, el arrastre.
  await page.locator("#undo").click();
  assert.deepEqual(await entranceOf(page), [-1.75, auto[1], 1, 0.375]);
  await page.locator("#redo").click();
  assert.deepEqual(await entranceOf(page), dragged);
  // Un valor fuera de rango no corrompe nada.
  await page.locator("#entrance-w").fill("3");
  await page.locator("#entrance-w").press("Tab");
  await page.waitForTimeout(300);
  assert.deepEqual(await entranceOf(page), dragged, "Una franja de tres casillas se rechaza");
  // Guardado y propuesta: `entrance` en la escena, sin geometría derivada.
  await page.locator("#save").click();
  await wait(page, () => !window.MagikitosStudio.inspect().dirty);
  const exported = await (await page.request.get(origin + "/api/diff")).json();
  const placement = exported.scenes.find((s) => s.scene === "overworld").placements.find((p) => p.id === "home-one");
  assert.deepEqual(placement.after.entrance, dragged);
  assert.equal(placement.before.entrance, undefined);
  // El mismo diff que lee el agente (`review.cjs` solo le quita `proposedScene` a su salida).
  const proposed = exported.scenes.find((s) => s.scene === "overworld").proposedScene.entities.find((e) => e.id === "home-one");
  assert.deepEqual(proposed.entrance, dragged, "La escena propuesta lleva entrance");
  assert(!("threshold" in proposed) && !("arrival" in proposed), "Y ninguna geometría derivada");
  // Volver a la automática la borra.
  await page.locator("#entrance-auto").click();
  await wait(page, () => !window.MagikitosStudio.inspect().changes.overworld?.entities?.["home-one"]);
  assert.equal(await entranceOf(page), null);
  assert(await page.locator("#entrance-auto").isDisabled());
  // Una escalera tampoco enseña entrada.
  const stairs = await page.evaluate(() => [...document.querySelectorAll("#scene option")].map((o) => o.value));
  for (const id of ["house", "tavern", "workshop"]) {
    if (!stairs.includes(id)) continue;
    await page.selectOption("#scene", id);
    const stair = await page.locator('[data-id^="stairs"]').first();
    if (await stair.count()) {
      await stair.click();
      assert(await page.locator("#entrance-section").isHidden(), "Una escalera no enseña entrada");
      break;
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(sceneFiles(), before, "El Studio no toca ninguna escena del árbol");
  console.log("PASS studio entrance: la franja de la puerta se ajusta desde el inspector y arrastrando, con deshacer, guardado, propuesta con `entrance` y sin geometría derivada; camas y escaleras no la enseñan.");
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    studio?.kill();
    fs.rmSync(temp, { recursive: true, force: true });
  });
