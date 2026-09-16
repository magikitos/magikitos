"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  cp = require("node:child_process");
const { chromium } = require("playwright");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "magikitos-selection-")),
  port = "47849",
  origin = "http://127.0.0.1:" + port;
const main = path.resolve(".local/adventure-studio/workspace.json"),
  before = fs.readFileSync(main, "utf8");
const read = (p) => p.evaluate(() => window.MagikitosStudio.inspect());
let server,
  browser,
  output = "";
(async () => {
  server = cp.spawn(process.execPath, ["tools/adventure-studio/server.cjs"], {
    env: { ...process.env, STUDIO_PORT: port, STUDIO_DATA_DIR: temp },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(output)), 120000);
    server.stdout.on("data", (b) => {
      output += b;
      if (output.includes("Magikitos Studio:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on("data", (b) => (output += b));
    server.on("exit", () => {
      clearTimeout(timer);
      reject(Error(output));
    });
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      hasTouch: true,
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
  );
  await page.goto(origin);
  await page.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
  async function save() {
    await page.locator("#save").click();
    await page.waitForFunction(() => !window.MagikitosStudio.inspect().dirty);
  }
  await page.locator("#gallery summary").click();
  const card = page.locator('[data-family="canopy-tree"]');
  assert(await card.locator('option[value="chestnut"]').count());
  assert(await card.locator('option[value="willow"]').count());
  const ids = [];
  for (const [x, y] of [
    [132, 70],
    [136, 70],
  ]) {
    const pot = page.locator('[data-family="planter"]');
    await pot.getByRole("button").click();
    ids.push((await read(page)).selected.id);
    for (const [key, value] of [
      ["x", x],
      ["y", y],
    ]) {
      await page.locator("#" + key).fill(String(value));
      await page.locator("#" + key).press("Tab");
    }
  }
  await page.locator(`#elements button[data-id="${ids[0]}"]`).click();
  await page
    .locator(`#elements button[data-id="${ids[1]}"]`)
    .click({ modifiers: ["Shift"] });
  assert.equal((await read(page)).selection.length, 2);
  const positions = ids.map((id) =>
    read(page).then((s) => s.changes.overworld.added[id]),
  );
  const originals = await Promise.all(positions);
  await page.locator("#map").focus();
  await page.keyboard.press("ArrowRight");
  let s = await read(page);
  assert.equal(s.changes.overworld.added[ids[0]].x - originals[0].x, 0.25);
  assert.equal(s.changes.overworld.added[ids[1]].x - originals[1].x, 0.25);
  const canvas = await page.locator("#map").boundingBox();
  const at = (x, y, state) => ({
    x: canvas.x + (x * 16 - state.camera.x) * state.zoom,
    y: canvas.y + (y * 16 - state.camera.y) * state.zoom,
  });
  await page.keyboard.press("Escape");
  const a = at(131, 66, s),
    b = at(138, 72, s);
  await page.keyboard.down("Shift");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  assert.deepEqual(
    (await read(page)).selection.map((e) => e.id).sort(),
    [...ids].sort(),
    "Rectangle selects both complete objects",
  );
  await page.locator("#multi-select").click();
  let p = at(132.25, 69.9, s);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 45, p.y + 20, { steps: 8 });
  await page.mouse.up();
  s = await read(page);
  assert.equal(
    s.selection.length,
    2,
    JSON.stringify({
      selected: s.selected,
      selection: s.selection,
      positions: s.changes.overworld.added,
    }),
  );
  assert.equal(
    s.changes.overworld.added[ids[1]].x - s.changes.overworld.added[ids[0]].x,
    4,
  );
  assert.equal(
    s.changes.overworld.added[ids[1]].y - s.changes.overworld.added[ids[0]].y,
    0,
  );
  await page.locator("#multi-select").click();
  await page.locator("#map").focus();
  await page.keyboard.press("Backspace");
  s = await read(page);
  assert(
    !s.changes.overworld?.added?.[ids[0]] &&
      !s.changes.overworld?.added?.[ids[1]],
  );
  await page.locator("#undo").click();
  s = await read(page);
  assert(
    s.changes.overworld.added[ids[0]] && s.changes.overworld.added[ids[1]],
  );
  await page.locator(`#elements button[data-id="${ids[0]}"]`).click();
  await page.locator("#x").fill("51");
  await page.locator("#x").press("Backspace");
  assert(
    (await read(page)).changes.overworld.added[ids[0]],
    "Typing never deletes objects",
  );
  await page.locator("#x").fill("51");
  await page.locator("#x").press("Tab");
  await page.locator('#elements button[data-id="picnic-knife"]').click();
  await page.locator("#map").focus();
  await page.keyboard.press("Backspace");
  assert(
    !(await read(page)).changes.overworld.removed?.some(
      (e) => e.id === "picnic-knife",
    ),
  );
  // Continuous fence creation, diagonal/vertical spans, then editing and reload.
  await page.locator("#fit").click();
  await page.locator("#fences-mode").click();
  s = await read(page);
  const area = await page.locator("#map").boundingBox();
  for (const [x, y] of [
    [42, 72],
    [49, 72],
    [54, 77],
    [54, 84],
  ]) {
    await page.mouse.click(
      area.x + (x * 16 - s.camera.x) * s.zoom,
      area.y + (y * 16 - s.camera.y) * s.zoom,
    );
  }
  assert.equal((await read(page)).fencePoints.length, 4);
  await page.keyboard.press("Enter");
  s = await read(page);
  const id = s.selected.id;
  assert.equal(s.changes.overworld.added[id].fence.points.length, 4);
  await page.locator("#fence-edit").click();
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  assert.equal(
    (await read(page)).changes.overworld.added[id].fence.points.length,
    3,
  );
  await page.locator("#undo").click();
  assert.equal(
    (await read(page)).changes.overworld.added[id].fence.points.length,
    4,
  );
  await save();
  await page.reload();
  await page.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
  assert.equal(
    (await read(page)).changes.overworld.added[id].fence.points.length,
    4,
  );
  fs.mkdirSync(".local/studio-selection-review", { recursive: true });
  await page.locator(`#elements button[data-id="${id}"]`).click();
  await page.screenshot({
    path: ".local/studio-selection-review/fence-desktop.png",
  });
  for (const [width, height] of [
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.locator("#fit").click();
    await page.locator("#multi-select").click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: `.local/studio-selection-review/studio-${width}.png`,
    });
  }
  assert.deepEqual(errors, []);
  assert.equal(
    fs.readFileSync(main, "utf8"),
    before,
    "Owner workspace stays intact",
  );
  console.log(
    "PASS Studio multi-selection, group drag/nudge, Backspace/undo, protected objects and inputs, continuous fence create/edit/reload, tree variants and 3 viewports.",
  );
})()
  .catch((e) => {
    console.error(e, output);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server?.kill();
  });
