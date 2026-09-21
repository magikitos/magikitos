"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"),
  os = require("node:os"), path = require("node:path");
const { chromium } = require("playwright");
const { startStudio } = require("./browser-studio.cjs");
const { isTree } = require("../tools/adventure-studio/visibility");
const port = 47844, origin = "http://127.0.0.1:" + port;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "magikitos-studio-navigation-"));
const ownerFile = path.resolve(".local/adventure-studio/workspace.json");
const ownerState = fs.existsSync(ownerFile) ? fs.readFileSync(ownerFile, "utf8") : null;
const inspect = page => page.evaluate(() => window.MagikitosStudio.inspect());
let studio, browser;
(async () => {
  studio = await startStudio({ port, temp, timeoutMs: 600000 });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  fs.mkdirSync(".local/screenshots", { recursive: true });
  for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    await page.goto(origin);
    await page.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
    const context = await (await page.request.get(origin + "/api/context")).json();
    const tree = context.snapshot.scenery.overworld.find(isTree),
      plant = context.snapshot.scenery.overworld.find(e => !isTree(e));
    assert(tree && plant);
    const before = await inspect(page);
    assert.equal(await page.locator('[data-scene-target="river-willows"]').count(), 1);
    assert.match(await page.locator('[data-scene-target="river-willows"]').innerText(), /^↑ /);
    const initialDiff = await (await page.request.get(origin + "/api/diff")).json();
    await page.locator(`#elements [data-id="${tree.id}"]`).click();
    await page.locator("#fit").click();
    const canvas = page.locator("#map");
    const visible = await canvas.screenshot();
    await page.locator("#hide-trees").click();
    const hidden = await inspect(page);
    assert.equal(hidden.hideTrees, true);
    assert.equal(hidden.selected, null);
    assert(!hidden.visibleElements.some(e => e.id === tree.id));
    assert(hidden.visibleElements.some(e => e.id === plant.id));
    assert(hidden.visibleElements.length < before.visibleElements.length);
    assert.notDeepEqual(await canvas.screenshot(), visible, "Tree filter really repaints the canvas");
    await canvas.focus();
    await page.keyboard.press("Backspace");
    assert.deepEqual((await inspect(page)).changes, before.changes, "No hidden-tree deletion");
    assert.equal((await inspect(page)).revision, before.revision, "Filter never saves a scene mutation");
    assert.deepEqual(await (await page.request.get(origin + "/api/diff")).json(), initialDiff);

    /**
     * ⛔ EL STUDIO GUARDA A LA MILÉSIMA DE CASILLA, Y ESTA PRUEBA EXIGÍA CATORCE DECIMALES
     * (21-sep-2026). `scene-edits` redondea `x`/`y` a 1/1000 de casilla desde el primer commit
     * —0,016 px, para que el dato autorado salga limpio—, pero aquí se comparaba el valor guardado
     * con el float crudo del campo. Aguantó mientras el primer elemento no-árbol de la pradera
     * tenía una `x` corta; al cambiar la escena pasó a ser uno con `63.08948079217225` y se puso
     * roja sin que nadie hubiera tocado nada. Se compara con la precisión que el editor PROMETE,
     * que además es lo que hay que defender: no que el redondeo no exista.
     */
    const guardado = (n) => Math.round(n * 1000) / 1000;
    // Edit, leave BEFORE the autosave delay, edit the neighbour and come back.
    await page.locator(`#elements [data-id="${plant.id}"]`).click();
    const nextX = Number(await page.locator("#x").inputValue()) + 0.25;
    await page.locator("#x").fill(String(nextX));
    await page.locator("#x").press("Tab");
    await page.locator("#zoom-in").click();
    const framing = await inspect(page);
    await page.locator('[data-scene-target="river-willows"]').click();
    let next = await inspect(page);
    assert.equal(next.scene, "river-willows");
    assert.equal(next.hideTrees, true);
    assert.equal(next.changes.overworld.scenery[plant.id].x, guardado(nextX));
    const neighborPlant = context.snapshot.scenery["river-willows"].find(e => !isTree(e));
    await page.locator(`#elements [data-id="${neighborPlant.id}"]`).click();
    const neighborX = Number(await page.locator("#x").inputValue()) + 0.25;
    await page.locator("#x").fill(String(neighborX));
    await page.locator("#x").press("Tab");
    await page.locator('[data-scene-target="overworld"]').click();
    next = await inspect(page);
    assert.equal(next.zoom, framing.zoom);
    assert.deepEqual(next.camera, framing.camera, "Returning restores the zoom and framing");
    assert.equal(next.changes["river-willows"].scenery[neighborPlant.id].x, guardado(neighborX));
    await page.waitForFunction(() => !window.MagikitosStudio.inspect().dirty);
    await page.reload();
    await page.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
    const restored = await inspect(page);
    assert.equal(restored.hideTrees, true, "UI preference survives reload outside workspace data");
    assert.deepEqual(restored.changes, next.changes, "Edits in both scenes survived autosave/reload");
    const exported = await (await page.request.get(origin + "/api/diff")).json();
    assert(exported.scenes.some(s => s.scene === "overworld"));
    assert(exported.scenes.some(s => s.scene === "river-willows"));
    assert(!JSON.stringify(exported).includes('"hideTrees"'));
    await page.locator("#hide-trees").click();
    assert((await inspect(page)).visibleElements.some(e => e.id === tree.id));
    await page.locator('[data-scene-target="cottage"]').click();
    assert.equal((await inspect(page)).scene, "cottage");
    await page.locator('[data-scene-target="overworld"]').click();
    await page.selectOption("#scene", "river-roots");
    assert.match(await page.locator('[data-scene-target="human-hedge"]').innerText(), /^→ /);
    await page.locator('[data-scene-target="human-hedge"]').click();
    assert.equal((await inspect(page)).scene, "human-hedge");
    assert.match(await page.locator('[data-scene-target="river-roots"]').innerText(), /^← /);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator("#hide-trees").click();
    await page.locator("#viewport").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.local/screenshots/studio-navigation-${width}.png` });
    await page.close();
    console.log(`PASS Studio links/filter ${width}×${height}: rendered trees hidden, plants retained, no invisible edits, two-scene autosave, camera restore, directions, doors and no overflow.`);
  }
  assert.deepEqual(errors, []);
  assert.equal(fs.existsSync(ownerFile) ? fs.readFileSync(ownerFile, "utf8") : null, ownerState, "Owner workspace untouched");
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  studio?.kill("SIGTERM");
  await browser?.close();
});
