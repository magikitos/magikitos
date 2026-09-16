"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  cp = require("node:child_process");
const { chromium } = require("playwright");
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const temp = fs.mkdtempSync(
    path.join(os.tmpdir(), "magikitos-gallery-browser-"),
  ),
  port = process.env.STUDIO_TEST_PORT || "47846",
  origin = "http://127.0.0.1:" + port;
const initialHash = snapshot(process.cwd()).baseHash;
const errors = [];
let server,
  browser,
  output = "";
const read = (p) => p.evaluate(() => window.MagikitosStudio.inspect());
async function ready(p) {
  await p.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
}
async function saved(p) {
  await p.locator("#save").click();
  await p.waitForFunction(() => !window.MagikitosStudio.inspect().dirty);
}
async function openGallery(p) {
  if (!(await p.locator("#gallery").evaluate((e) => e.open)))
    await p.locator("#gallery summary").click();
}
(async () => {
  server = cp.spawn(process.execPath, ["tools/adventure-studio/server.cjs"], {
    env: { ...process.env, STUDIO_PORT: port, STUDIO_DATA_DIR: temp },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Studio startup timeout: " + output)),
      120000,
    );
    server.stdout.on("data", (b) => {
      output += b;
      if (output.includes("Magikitos Studio:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on("data", (b) => (output += b));
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(Error("Studio exited " + code + ": " + output));
    });
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    hasTouch: true,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
  await page.goto(origin);
  await ready(page);
  assert.equal(
    await page.locator('[data-studio-tab="experiments"]').innerText(),
    "Laboratorio",
  );
  await page.locator("#gallery summary").click();
  const card = page.locator('[data-family="forest-tree"]');
  await page.locator("[data-gallery-category]").selectOption("Vegetación");
  await card.locator("select").selectOption("pine");
  await card
    .getByRole("button", { name: "Colocar Árboles del bosque" })
    .click();
  let s = await read(page),
    id = s.selected.id;
  assert.equal(s.changes.overworld.added[id].family, "forest-tree");
  assert.equal(s.changes.overworld.added[id].artVariant, "pine");
  await page.locator("#x").fill("50.25");
  await page.locator("#x").press("Tab");
  await page.locator("#variant").selectOption("birch");
  s = await read(page);
  assert.equal(s.changes.overworld.added[id].x, 50.25);
  assert.equal(s.changes.overworld.added[id].artVariant, "birch");
  await page.locator("#scale-percent").fill("137");
  await page.locator("#scale-percent").press("Tab");
  assert.equal((await read(page)).changes.overworld.added[id].scale, 1.37);
  assert.equal(await page.locator("#scale").inputValue(), "1.37");
  await saved(page);
  await page.reload();
  await ready(page);
  assert.equal((await read(page)).changes.overworld.added[id].scale, 1.37);
  assert.equal(
    (await read(page)).changes.overworld.added[id].artVariant,
    "birch",
    "Variant survives autosave/reload",
  );
  await page.locator("#search").fill(id);
  await page.locator('[data-id="' + id + '"]').click();
  assert.equal(await page.locator("#variant").inputValue(), "birch");
  await page.locator("#remove").click();
  assert(!(await read(page)).changes.overworld?.added?.[id]);
  await page.locator("#undo").click();
  assert((await read(page)).changes.overworld.added[id]);
  await page.locator("#redo").click();
  assert(!(await read(page)).changes.overworld?.added?.[id]);
  await page.locator("#search").fill("");
  // Functional pickups are source proposals, never writes to the live world.
  await openGallery(page);
  await page.locator("[data-gallery-category]").selectOption("Recogibles");
  for (const family of ["ground-twig", "toilet-leaves", "ground-bottle"]) {
    await page.locator('[data-family="' + family + '"] button').click();
    const placed = await read(page), pickup = placed.selected.id;
    assert.equal(placed.changes.overworld.added[pickup].family, family);
    await saved(page);
    await page.reload();
    await ready(page);
    assert.equal((await read(page)).changes.overworld.added[pickup].family, family);
    await openGallery(page);
    await page.locator("[data-gallery-category]").selectOption("Recogibles");
  }
  // The complete resident library is editable through the same family/variant UI.
  await openGallery(page);
  await page
    .locator("[data-gallery-category]")
    .selectOption("Duendes · vecinas");
  assert.equal(await page.locator('[data-family^="resident-"]').count(), 10);
  const resident = page.locator('[data-family="resident-menta"]');
  assert.equal(await resident.locator('option:not([value="auto"])').count(), 5);
  assert.equal(
    await page
      .locator('[data-family^="resident-"] option:not([value="auto"])')
      .count(),
    50,
  );
  await resident.locator("select").selectOption("menta-noche");
  await resident.getByRole("button", { name: "Colocar Menta" }).click();
  s = await read(page);
  assert.equal(
    s.changes.overworld.added[s.selected.id].artVariant,
    "menta-noche",
  );
  await saved(page);
  await page
    .locator("[data-gallery-category]")
    .selectOption("Duendes · vecinos");
  assert.equal(await page.locator('[data-family^="resident-"]').count(), 10);
  assert.equal(
    await page
      .locator('[data-family^="resident-"] option:not([value="auto"])')
      .count(),
    50,
  );
  await page
    .locator("[data-gallery-category]")
    .selectOption("Isla · huerto y descanso");
  await page.locator('[data-family="garden-trellis"] button').click();
  s = await read(page);
  assert.equal(
    s.changes.overworld.added[s.selected.id].family,
    "garden-trellis",
  );
  await saved(page);
  await page.locator("[data-gallery-category]").selectOption("");
  await page.locator("#scene").selectOption("house");
  await openGallery(page);
  assert.equal(
    await page.locator('[data-family="log-home"]').count(),
    0,
    "Gallery does not place houses inside houses",
  );
  await page.locator('[data-family="planter"] button').click();
  let indoor = await read(page),
    pot = indoor.selected.id;
  assert.equal(indoor.changes.house.added[pot].family, "planter");
  await page.locator("#review").click();
  assert((await page.locator("#modal-body").innerText()).includes("Añadidos"));
  await page.locator("#modal-close").click();
  await saved(page);
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.locator("#map").scrollIntoViewIfNeeded();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "No horizontal overflow at " + width,
    );
    const map = await page.locator("#map").boundingBox();
    assert(map.width > 250 && map.height > 250, "Usable viewport at " + width);
    await page.screenshot({
      path: path.join(temp, "gallery-" + width + "x" + height + ".png"),
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  assert.equal(
    snapshot(process.cwd()).baseHash,
    initialHash,
    "Studio never writes scene sources",
  );
  console.log(
    "PASS gallery placement, explicit variants, edit/remove/undo/redo, reload, review, closed archive, five viewports and source isolation. Screenshots: " +
      temp,
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server?.kill();
  });
