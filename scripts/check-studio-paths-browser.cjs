"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { chromium } = require("playwright");
const { startStudio } = require("./browser-studio.cjs");
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const origin = "http://127.0.0.1:47840",
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "magikitos-path-browser-"));
const sourceHash = snapshot(process.cwd()).baseHash,
  errors = [];
const shots = path.resolve(".local/screenshots");
fs.mkdirSync(shots, { recursive: true });
let studio, browser;
const wait = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 12000 });
const inspect = (p) => p.evaluate(() => window.MagikitosStudio.inspect());
async function point(p, [x, y]) {
  await p.locator("#map").scrollIntoViewIfNeeded();
  const s = await inspect(p),
    r = await p.locator("#map").boundingBox();
  return {
    x: r.x + (x * 16 - s.camera.x) * s.zoom,
    y: r.y + (y * 16 - s.camera.y) * s.zoom,
  };
}
async function click(p, xy) {
  const q = await point(p, xy);
  await p.mouse.click(q.x, q.y);
}
async function ready(p) {
  await wait(p, () => window.MagikitosStudio?.inspect().ready);
}
async function saved(p) {
  await p.locator("#save").click();
  await wait(p, () => !window.MagikitosStudio.inspect().dirty);
}
async function pathsMode(p) {
  await p.locator("#paths-mode").click();
}
(async () => {
  studio = await startStudio({ port: 47840, temp });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    hasTouch: true,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await ready(page);
  assert.equal(await page.locator("#rotation").count(), 0);
  await pathsMode(page);
  const initial = structuredClone((await inspect(page)).paths);
  await page.locator('[data-path="0"]').click();
  // Zoom into the selected polyline before dragging native nodes.
  for (let i = 0; i < 3; i++) await page.locator("#zoom-in").click();
  let start = initial[0][Math.floor(initial[0].length / 2)],
    index = Math.floor(initial[0].length / 2);
  const q = await point(page, start);
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.mouse.move(q.x + 24, q.y + 12, { steps: 5 });
  await page.mouse.up();
  await wait(
    page,
    () => !!window.MagikitosStudio.inspect().changes.overworld?.paths,
  );
  let moved = structuredClone((await inspect(page)).paths);
  assert.notDeepEqual(moved, initial, "Node drag commits a new polyline");
  assert.deepEqual((await inspect(page)).pathSelection, {
    path: 0,
    point: index,
  });
  await page.locator("#undo").click();
  assert.deepEqual((await inspect(page)).paths, initial);
  await page.locator("#redo").click();
  assert.deepEqual((await inspect(page)).paths, moved);
  await saved(page);
  await page.reload();
  await ready(page);
  assert.deepEqual((await inspect(page)).paths, moved);
  await pathsMode(page);
  // Insert an intermediate vertex, remove it, undo; numeric inspector is also supported.
  await page.locator('[data-path="0"]').click();
  for (let i = 0; i < 2; i++) await page.locator("#zoom-in").click();
  let points = moved[0],
    segment = Math.max(0, Math.floor(points.length / 2) - 1);
  const mid = [
    (points[segment][0] + points[segment + 1][0]) / 2,
    (points[segment][1] + points[segment + 1][1]) / 2,
  ];
  await page.locator("#path-insert").click();
  await click(page, mid);
  let inserted = structuredClone((await inspect(page)).paths);
  assert.equal(inserted[0].length, moved[0].length + 1);
  await page.locator("#path-delete-point").click();
  assert.deepEqual((await inspect(page)).paths, moved);
  await page.locator("#undo").click();
  assert.deepEqual((await inspect(page)).paths, inserted);
  await page.locator("#path-x").fill("-1");
  await page.locator("#path-x").press("Tab");
  assert.deepEqual(
    (await inspect(page)).paths,
    inserted,
    "Invalid coordinate does not corrupt edits",
  );
  // Draw and delete a complete path; no game source changes.
  await page.locator("#fit").click();
  await page.locator("#path-new").click();
  await click(page, [28, 24]);
  await click(page, [35, 26]);
  await click(page, [41, 24]);
  await page.locator("#path-finish").click();
  let created = structuredClone((await inspect(page)).paths);
  assert.equal(created.length, initial.length + 1);
  assert.equal(created.at(-1).length, 3);
  await page.locator("#path-delete").click();
  assert.equal((await inspect(page)).paths.length, initial.length);
  await page.locator("#undo").click();
  assert.deepEqual((await inspect(page)).paths, created);
  await saved(page);
  await page.locator("#review").click();
  assert((await page.locator("#modal-body").textContent()).includes("Caminos"));
  await page.locator("#modal-close").click();
  const exported = await (await page.request.get(origin + "/api/diff")).json();
  assert.deepEqual(exported.scenes[0].paths, {
    before: initial,
    after: created,
  });
  assert.deepEqual(exported.scenes[0].placements, []);
  assert.equal(exported.conflicts.length, 0);
  await page.locator('[data-path="0"]').click();
  await page.screenshot({ path: path.join(shots, "studio-paths-desktop.png") });
  // Cancelling a draft and changing modes never inserts a partial road.
  await page.locator("#path-new").click();
  await click(page, [30, 20]);
  await page.locator("#map").press("Escape");
  assert.deepEqual((await inspect(page)).paths, created);
  await page.selectOption("#scene", "house");
  assert(await page.locator("#paths-mode").isDisabled());
  assert.equal((await inspect(page)).pathMode, false);
  await page.locator('[data-id="human-bed"]').click();
  assert(await page.locator("#crop-preview").isVisible());
  for (const [width, height] of [
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.selectOption("#scene", "overworld");
    await pathsMode(page);
    await page.locator("#path-new").click();
    await page.locator("#map").scrollIntoViewIfNeeded();
    const r = await page.locator("#map").boundingBox(),
      cdp = await page.context().newCDPSession(page);
    const x = r.x + r.width * 0.5,
      y = r.y + r.height * 0.55;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 0, x: x - 30, y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { id: 0, x: x - 30, y },
        { id: 1, x: x + 30, y },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { id: 0, x: x - 50, y },
        { id: 1, x: x + 50, y },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
    assert(
      await page.locator("#path-finish").isDisabled(),
      "Pinch does not add an accidental draft point",
    );
    assert.deepEqual((await inspect(page)).paths, created);
    await page.locator("#path-cancel").click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "No narrow screen overflow",
    );
    await page.locator("#map").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(shots, "studio-paths-" + width + ".png"),
      fullPage: true,
    });
  }
  assert.equal(
    snapshot(process.cwd()).baseHash,
    sourceHash,
    "Editor only writes its isolated workspace",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS Studio paths: visual drag, insert/delete, create/remove, numeric validation, undo/redo, autosave/reload, review export, no game writes, desktop/tablet/mobile and pinch cancellation.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    studio?.kill("SIGTERM");
  });
