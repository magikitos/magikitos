"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  cp = require("node:child_process");
const { chromium } = require("playwright");
const { World } = require("../public/assets/js/adventure/model");
const {
  makeScene,
  PRESETS,
  STOPS,
} = require("../tools/adventure-studio/experiments/forest-scale/scene");
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const registry = require("../tools/adventure-studio/experiments/registry");
assert.equal(new Set(registry.map((e) => e.id)).size, registry.length);
assert(
  registry
    .filter((e) => e.id !== "duende-cast")
    .every((e) => e.status === "archived"),
  "Previous design experiments remain archived",
);
assert.equal(registry.find((e) => e.id === "duende-cast").status, "archived");
for (const preset of Object.keys(PRESETS)) {
  const world = new World(makeScene(preset));
  assert(
    world.data.entities.every(
      (e) =>
        !["human-house", "cottage", "tavern", "workshop"].includes(e.sprite),
    ),
  );
  for (const a of STOPS) {
    assert(
      world.canStand(a.position[0] * 16, a.position[1] * 16),
      preset + " " + a.id,
    );
    for (const b of STOPS)
      assert(
        world.path(
          { x: a.position[0] * 16, y: a.position[1] * 16 },
          { x: b.position[0] * 16, y: b.position[1] * 16 },
        ),
        "All stops connected",
      );
  }
  assert(world.waterAt(110, 50), "River continues off the eastern boundary");
}
const origin = "http://127.0.0.1:47844",
  temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "magikitos-experiments-test-"),
  );
const baseline = snapshot(process.cwd()).baseHash;
const workspaceFile = ".local/adventure-studio/workspace.json",
  saved = fs.existsSync(workspaceFile)
    ? fs.readFileSync(workspaceFile, "utf8")
    : null;
const archiveFile = ".local/adventure-studio/ui-lab/public/index.html",
  archive = fs.existsSync(archiveFile)
    ? fs.readFileSync(archiveFile, "utf8")
    : null;
const shots = path.resolve(".local/screenshots");
fs.mkdirSync(shots, { recursive: true });
let server, browser;
const errors = [],
  requests = [];
const inspect = (p) => p.evaluate(() => window.MagikitosStudio.inspect());
const ready = (p) =>
  p.waitForFunction(
    () =>
      window.MagikitosStudio?.inspect().shell.experiments?.current ===
        "forest-scale" &&
      window.MagikitosStudio?.inspect().shell.experiments?.forest?.ready,
    null,
    { timeout: 15000 },
  );
const wait = (p) =>
  p.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
async function clickWorld(p, dx, dy) {
  const s = (await inspect(p)).shell.experiments.forest,
    r = await p.locator("#forest-canvas").boundingBox();
  await p.mouse.click(
    r.x + (s.player.x + dx - s.camera.x) * s.zoom,
    r.y + (s.player.y + dy - s.camera.y) * s.zoom,
  );
}
(async () => {
  server = cp.spawn(process.execPath, ["tools/adventure-studio/server.cjs"], {
    env: { ...process.env, STUDIO_PORT: "47844", STUDIO_DATA_DIR: temporary },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    let startupLog = "";
    server.stderr.on("data", (b) => {
      startupLog = (startupLog + b).slice(-6000);
    });
    const timer = setTimeout(
      () => reject(Error("Studio start timeout\n" + startupLog)),
      60000,
    );
    server.stdout.on("data", (b) => {
      startupLog = (startupLog + b).slice(-6000);
      if (b.toString().includes("Magikitos Studio:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(Error("Studio exit " + code));
    });
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const [width, height] of [
    [1440, 1000],
    [768, 1024],
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    const requestStart = requests.length;
    const p = await browser.newPage({
      viewport: { width, height },
      hasTouch: true,
    });
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => requests.push({ url: r.url(), method: r.method() }));
    await p.route("**/*", (r) =>
      new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
    );
    await p.goto(origin + "/");
    await wait(p);
    assert.equal(
      await p.locator('[data-studio-tab="experiments"]').getAttribute("target"),
      null,
    );
    assert(
      !requests
        .slice(requestStart)
        .some((r) => r.url.endsWith("/art/concept.png")),
      "Concept not fetched with map",
    );
    const before = await inspect(p);
    await p.locator('[data-studio-tab="experiments"]').click();
    await p.locator('[data-experiment="forest-scale"]').click();
    await ready(p);
    assert(await p.locator("#map-panel").isHidden());
    assert.equal(await p.locator(".studio-header").count(), 1);
    const start = (await inspect(p)).shell.experiments.forest;
    assert.deepEqual(start.assets.loaded.sort(), ["habitats", "nature"]);
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await p.locator("#forest-canvas").focus();
    await p.keyboard.down("ArrowRight");
    await p.waitForTimeout(230);
    await p.keyboard.up("ArrowRight");
    const walking = (await inspect(p)).shell.experiments.forest;
    assert(walking.player.x > start.player.x + 5, "Walk uses actual movement");
    assert(walking.player.walkDistance > 0, "Feet animation tracks distance");
    await clickWorld(p, 30, 0);
    await p.waitForTimeout(400);
    assert(
      (await inspect(p)).shell.experiments.forest.player.x > walking.player.x,
      "Click walks",
    );
    const canvas = await p.locator("#forest-canvas").boundingBox();
    await p.mouse.move(
      canvas.x + canvas.width * 0.6,
      canvas.y + canvas.height * 0.5,
    );
    await p.mouse.wheel(0, 180);
    await p.waitForTimeout(80);
    const zoom = (await inspect(p)).shell.experiments.forest.zoom;
    assert(zoom < start.zoom, "Wheel zoom is separate from proportions");
    if (width < 741) await p.selectOption("#forest-scale-compact", "micro");
    else await p.locator('[data-scale="micro"]').click();
    const micro = (await inspect(p)).shell.experiments.forest;
    assert.equal(micro.preset, "micro");
    assert(
      Math.abs(micro.zoom - zoom) < 0.001,
      "Changing relative scale does not zoom",
    );
    assert(
      micro.entities.find((e) => e.id === "giant-bolete").scale >
        start.entities.find((e) => e.id === "giant-bolete").scale,
    );
    assert.equal(micro.player.actor, true);
    for (const stop of STOPS)
      await p.locator('[data-stop="' + stop.id + '"]').click();
    await p.locator('[data-stop="boot"]').click();
    if (width < 741) await p.selectOption("#forest-scale-compact", "tiny");
    else await p.locator('[data-scale="tiny"]').click();
    await p.locator("#forest-center").click();
    await p.locator("#forest-canvas").scrollIntoViewIfNeeded();
    await p.screenshot({
      path: path.join(shots, "studio-forest-" + width + ".png"),
      fullPage: true,
    });
    if (width === 390) {
      const r = await p.locator("#forest-canvas").boundingBox(),
        session = await p.context().newCDPSession(p);
      const x = r.x + r.width / 2,
        y = r.y + r.height * 0.45,
        pre = (await inspect(p)).shell.experiments.forest;
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ id: 0, x: x - 25, y }],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { id: 0, x: x - 25, y },
          { id: 1, x: x + 25, y },
        ],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { id: 0, x: x - 45, y },
          { id: 1, x: x + 45, y },
        ],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await session.detach();
      const post = (await inspect(p)).shell.experiments.forest;
      assert(post.zoom > pre.zoom);
      assert.equal(post.pathLength, 0);
      assert.deepEqual(post.player, pre.player);
    }
    await p.locator('[data-forest-view="art"]').click();
    await p.locator(".forest-concept img").scrollIntoViewIfNeeded();
    await p.waitForFunction(
      () => document.querySelector(".forest-concept img")?.naturalWidth > 0,
    );
    assert.equal(await p.locator(".forest-art-grid canvas").count(), 12);
    assert.equal(
      (await inspect(p)).shell.experiments.forest.active,
      false,
      "Art view suspends animation",
    );
    if (width === 1440)
      await p.screenshot({ path: path.join(shots, "studio-forest-art.png") });
    await p.locator('[data-experiment="conversation"]').click();
    await p.locator(".archive-intro").waitFor({ state: "visible" });
    assert(await p.locator(".archive-intro").isVisible());
    assert.equal((await inspect(p)).shell.experiments.forest.active, false);
    if (archive) {
      const frame = p.frameLocator(".archive-frame");
      await frame
        .locator("#loading")
        .waitFor({ state: "hidden", timeout: 15000 });
      await frame.locator('[data-mode="ritual"]').click();
      assert.equal(
        await frame.locator("#stage").getAttribute("data-mode"),
        "ritual",
      );
      if (width === 1440)
        await p.screenshot({
          path: path.join(shots, "studio-experiment-archive.png"),
        });
    }
    await p.locator('[data-studio-tab="map"]').click();
    await p.locator("#map-panel").waitFor({ state: "visible" });
    assert.equal(
      await p.locator(".archive-frame").count(),
      0,
      "Leaving archive stops its audio and animation",
    );
    assert(await p.locator("#map-panel").isVisible());
    const after = await inspect(p);
    assert.deepEqual(after.changes, before.changes);
    assert.equal(after.revision, before.revision);
    assert.equal(after.dirty, false);
    await p.locator('[data-studio-tab="experiments"]').click();
    await p.locator('[data-experiment="forest-scale"]').click();
    await ready(p);
    assert.equal((await inspect(p)).shell.experiments.current, "forest-scale");
    await p.close();
    console.log("PASS integrated Studio / scale / archive", width, height);
  }
  // A real unsaved map edit survives entering the experiment and its normal autosave.
  {
    const p = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await p.goto(origin + "/");
    await wait(p);
    await p.selectOption("#scene", "house");
    await p.locator('[data-id="human-bed"]').click();
    const x = Number(await p.locator("#x").inputValue());
    await p.locator("#x").fill(String(x + 0.25));
    await p.locator("#x").press("Tab");
    const edited = await inspect(p);
    assert(edited.dirty);
    await p.locator('[data-studio-tab="experiments"]').click();
    await p.locator('[data-experiment="forest-scale"]').click();
    await ready(p);
    await p.waitForFunction(() => !window.MagikitosStudio.inspect().dirty);
    await p.locator('[data-studio-tab="map"]').click();
    await p.locator("#map-panel").waitFor({ state: "visible" });
    assert.deepEqual((await inspect(p)).changes, edited.changes);
    await p.reload();
    await wait(p);
    assert.deepEqual(
      (await inspect(p)).changes,
      edited.changes,
      "Reload retains the same single map version",
    );
    await p.close();
    console.log(
      "PASS unsaved map edit survives experiment, autosave, return and reload",
    );
  }
  assert.equal(
    snapshot(process.cwd()).baseHash,
    baseline,
    "Game source unchanged",
  );
  if (saved !== null)
    assert.equal(
      fs.readFileSync(workspaceFile, "utf8"),
      saved,
      "User workspace unchanged",
    );
  if (archive !== null)
    assert.equal(
      fs.readFileSync(archiveFile, "utf8"),
      archive,
      "Archived original unchanged",
    );
  assert(
    requests.every((r) => r.method === "GET"),
    "Experiment issues no writes",
  );
  assert(
    requests.every((r) => !r.url.includes("/api/world/")),
    "No website API, account or events",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS independent scale data, 75 connected routes, one shell, isolated lifecycle, lazy art, five viewports, pointer/keyboard/pinch, preserved map edits and archive.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    server?.kill("SIGTERM");
    await browser?.close();
  });
