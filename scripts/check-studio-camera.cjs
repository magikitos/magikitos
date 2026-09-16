"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  cp = require("node:child_process"),
  crypto = require("node:crypto");
const { chromium } = require("playwright");
const { World, TILE } = require("../public/assets/js/adventure/model");
const { follow } = require("../public/assets/js/adventure/movement");
const {
  MODES,
  STOPS,
  makeScene,
  heightAt,
} = require("../tools/adventure-studio/experiments/camera/config");
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const root = path.resolve(__dirname, ".."),
  origin = "http://127.0.0.1:47846",
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), "magikitos-camera-test-"));
const shots = path.join(root, ".local/screenshots/camera");
fs.mkdirSync(shots, { recursive: true });
const hash = (file) =>
  fs.existsSync(file)
    ? crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
    : null;
const protectedFiles = [
  ".local/adventure-studio/workspace.json",
  ".local/build/current.json",
  "../magikitos/public/game/current.json",
  "public/assets/aventura/manifest.json",
].map((f) => path.resolve(root, f));
const beforeFiles = protectedFiles.map(hash),
  before = snapshot(root).baseHash;
const world = new World(makeScene());
for (const [id, a] of Object.entries(STOPS)) {
  assert(world.canStand(a.x * TILE, a.z * TILE), id);
  for (const [idb, b] of Object.entries(STOPS)) {
    const actor = { x: a.x * TILE, y: a.z * TILE },
      route = world.path(actor, { x: b.x * TILE, y: b.z * TILE });
    assert(route, id + " connects to " + idb);
    for (let i = 0; i < 3000 && route.length; i++)
      follow(world, actor, route, 1 / 60, 64);
    assert(
      Math.hypot(actor.x / TILE - b.x, actor.y / TILE - b.z) < 1,
      id + " physically reaches " + idb,
    );
  }
}
assert(!world.canStand(52 * TILE, 30 * TILE), "Cannot walk into river");
assert(world.canStand(52 * TILE, 39.5 * TILE), "Bridge is traversable");
assert(!world.canStand(8 * TILE, 20 * TILE), "Cannot walk through cliff");
assert.equal(heightAt(16, 24), 2.4);
assert(Math.abs(heightAt(16, 29) - 1.2) < 1e-9);
assert.equal(heightAt(52, 39.5), 0.3);
let browser, server;
const errors = [],
  requests = [],
  metrics = [];
async function camera(p) {
  await p.waitForSelector(".camera-frame");
  const frame = await p
    .locator(".camera-frame")
    .elementHandle()
    .then((e) => e.contentFrame());
  await frame.waitForFunction(
    () =>
      window.MagikitosCameraLab?.inspect().ready &&
      !window.MagikitosCameraLab?.inspect().disposed,
    null,
    { timeout: 15000 },
  );
  return frame;
}
const inspect = (f) => f.evaluate(() => window.MagikitosCameraLab.inspect());
async function settle(p) {
  await p.waitForTimeout(220);
}
async function clickCanvas(p, f, x = 0.5, y = 0.65) {
  const r = await f.locator("#scene").boundingBox();
  await p.mouse.click(r.x + r.width * x, r.y + r.height * y);
}
async function overflow(p, f) {
  assert(
    !(await p.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )),
    "No Studio horizontal overflow",
  );
  assert(
    !(await f.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )),
    "No experiment horizontal overflow",
  );
  const r = await f.locator("#scene").boundingBox();
  assert(r.width >= 300 && r.height >= 160, "Usable visible canvas");
}
(async () => {
  server = cp.spawn(process.execPath, ["tools/adventure-studio/server.cjs"], {
    cwd: root,
    env: { ...process.env, STUDIO_PORT: "47846", STUDIO_DATA_DIR: temporary },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  await new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(Error("Studio start timeout: " + logs)),
      30000,
    );
    server.stderr.on("data", (b) => (logs += b));
    server.stdout.on("data", (b) => {
      logs += b;
      if (logs.includes("Magikitos Studio:")) {
        clearTimeout(t);
        resolve();
      }
    });
    server.once("exit", (code) => {
      clearTimeout(t);
      reject(Error("Studio exit " + code + ": " + logs));
    });
  });
  const budget = JSON.parse(
    fs.readFileSync(path.join(temporary, "experiments/camera/budget.json")),
  );
  assert(
    budget.javascriptBytes < 720 * 1024,
    "Separate renderer bounded below 720 KiB raw",
  );
  assert(budget.imageBytes < 320 * 1024, "Only necessary native packs");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(temporary, "experiments/camera/bundle.json")),
  );
  assert(
    !Object.keys(manifest.inputs).some((s) =>
      /adventure\/(game|save|session|api|account|site)\.js$/.test(s),
    ),
    "No game bootstrap, save, API or account dependencies",
  );
  assert(
    !fs
      .readFileSync(path.join(temporary, "build/studio.js"), "utf8")
      .includes("WebGLRenderer"),
    "Three is not in main Studio bundle",
  );
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const [width, height] of [
    [1440, 1000],
    [768, 1024],
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      deviceScaleFactor: width === 390 ? 3 : 1,
    });
    const p = await context.newPage(),
      seen = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => {
      seen.push(r.url());
      requests.push({ url: r.url(), method: r.method() });
    });
    await p.route("**/*", (r) =>
      new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
    );
    await p.goto(origin + "/");
    await p.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
    assert(
      !seen.some((url) => url.includes("/experiments/camera/")),
      "No camera requests in map",
    );
    const studioBefore = await p.evaluate(() =>
      window.MagikitosStudio.inspect(),
    );
    await p.locator('[data-studio-tab="experiments"]').click();
    let f = await camera(p);
    await settle(p);
    await overflow(p, f);
    const initial = await inspect(f);
    assert.equal(initial.mode, "hybrid");
    assert(initial.imageBytes < 40 * 1024, "Hybrid requests actors only");
    assert(initial.pixelRatio <= 1.5, "DPR capped even on high-density mobile");
    // Camera preserves pose between A/B/C, loading prop art only on the first A visit.
    for (const id of ["illustration", "volume", "hybrid"]) {
      await f.locator('[data-mode="' + id + '"]').click();
      await f.waitForFunction(
        (id) => window.MagikitosCameraLab.inspect().mode === id,
        id,
      );
      const s = await inspect(f);
      assert(Math.abs(s.yaw - initial.yaw) < 0.01);
      assert(Math.abs(s.elevation - initial.elevation) < 0.01);
      if (id === "illustration") assert(s.imageBytes === budget.imageBytes);
      if (width === 1440)
        await p.screenshot({ path: path.join(shots, id + ".png") });
    }
    // A real mouse orbit changes both yaw/elevation, without click-to-walk leakage.
    const box = await f.locator("#scene").boundingBox(),
      pre = await inspect(f);
    await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.6, {
      steps: 12,
    });
    await p.mouse.up();
    await settle(p);
    const turned = await inspect(f);
    assert(Math.abs(turned.yaw - pre.yaw) > 2, "Drag changes yaw");
    assert.equal(turned.path, 0, "Drag does not walk");
    await p.mouse.wheel(0, 200);
    await settle(p);
    assert((await inspect(f)).distance > turned.distance, "Wheel zoom");
    // Presets and controls are available at all sizes; narrow UI uses a drawer.
    if (await f.locator("#settings-toggle").isVisible())
      await f.locator("#settings-toggle").click();
    assert(await f.locator("#settings").isVisible());
    await f.locator('[data-angle="25"]').click();
    await settle(p);
    assert(Math.abs((await inspect(f)).elevation - 25) < 0.1);
    await f.locator("#projection").selectOption("orthographic");
    await settle(p);
    assert.equal((await inspect(f)).projection, "orthographic");
    await f.locator("#zoom-in").click();
    assert((await inspect(f)).zoom > 1);
    await f.locator("#economy").check();
    assert.equal((await inspect(f)).pixelRatio, 1);
    await f.locator("#projection").selectOption("perspective");
    await f.locator("#reset-camera").click();
    await f.locator("#economy").uncheck();
    if (await f.locator("#settings-close").isVisible())
      await f.locator("#settings-close").click();
    // Repeated keyboard directions are screen-relative, including after a 90° orbit.
    await f.evaluate(() => {
      window.MagikitosCameraLab.stop("plaza");
      window.MagikitosCameraLab.setView({ yaw: 90 });
    });
    await f.locator("#scene").focus();
    const at = await inspect(f);
    await p.keyboard.down("w");
    await p.waitForTimeout(450);
    await p.keyboard.up("w");
    const walked = await inspect(f);
    assert(
      walked.actor.x < at.actor.x - 0.5,
      "At 90°, up walks west in world space",
    );
    assert(Math.abs(walked.actor.z - at.actor.z) < 0.1);
    assert(walked.actor.frame.includes("-up"), "Sprite faces screen-up");
    // Live pathfinding climbs the ramp; use the nearby stop to avoid a long test walk.
    await f.evaluate(() => {
      window.MagikitosCameraLab.stop("lookout");
      window.MagikitosCameraLab.goTo(16, 27);
    });
    await f.waitForFunction(
      () => window.MagikitosCameraLab.inspect().path === 0,
      null,
      { timeout: 5000 },
    );
    assert(
      (await inspect(f)).actor.height < 2.35,
      "Actor descends real height field",
    );
    // Tap/click-to-walk really raycasts against the ground.
    await f.evaluate(() => {
      window.MagikitosCameraLab.stop("plaza");
      window.MagikitosCameraLab.setView({
        yaw: 0,
        elevation: 62,
        distance: 34,
      });
    });
    const tapBefore = await inspect(f);
    await clickCanvas(p, f, 0.55, 0.65);
    await p.waitForTimeout(500);
    const tapAfter = await inspect(f);
    assert(
      Math.hypot(
        tapAfter.actor.x - tapBefore.actor.x,
        tapAfter.actor.z - tapBefore.actor.z,
      ) > 0.1,
      "Click walks",
    );
    if (width === 390) {
      // Native multi-touch sent through Chrome, not synthetic mouse events.
      await f.evaluate(() => window.MagikitosCameraLab.stop("plaza"));
      const cdp = await context.newCDPSession(p),
        r = await f.locator("#scene").boundingBox(),
        cx = r.x + r.width * 0.5,
        cy = r.y + r.height * 0.48;
      const state = await inspect(f);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: cx - 35, y: cy, id: 1 },
          { x: cx + 35, y: cy, id: 2 },
        ],
      });
      for (let i = 1; i <= 8; i++)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            { x: cx - 35 - i * 4, y: cy - i * 2, id: 1 },
            { x: cx + 35 + i * 4, y: cy - i * 2, id: 2 },
          ],
        });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await settle(p);
      const pinch = await inspect(f);
      assert(pinch.distance < state.distance - 1, "Pinch zooms");
      assert.equal(pinch.path, 0, "Pinch never triggers movement");
      await cdp.detach();
    }
    await f.evaluate(() => {
      window.MagikitosCameraLab.stop("plaza");
      window.MagikitosCameraLab.setView({
        yaw: 25,
        elevation: 25,
        distance: 34,
      });
    });
    await settle(p);
    metrics.push({ width, height, ...(await inspect(f)) });
    await p.screenshot({
      path: path.join(shots, width + "x" + height + ".png"),
    });
    await p.locator('[data-studio-tab="map"]').click();
    await p.locator(".camera-frame").waitFor({ state: "detached" });
    assert.equal(
      await p.locator(".camera-frame").count(),
      0,
      "Leaving destroys camera frame",
    );
    const studioAfter = await p.evaluate(() =>
      window.MagikitosStudio.inspect(),
    );
    assert.equal(studioAfter.baseHash, studioBefore.baseHash);
    await p.locator('[data-studio-tab="experiments"]').click();
    f = await camera(p);
    assert.equal(
      (await inspect(f)).mode,
      "hybrid",
      "Re-entry creates a clean, independent experiment",
    );
    await f.evaluate(async () => {
      await Promise.all([
        window.MagikitosCameraLab.setMode("illustration"),
        window.MagikitosCameraLab.setMode("volume"),
        window.MagikitosCameraLab.setMode("hybrid"),
      ]);
    });
    assert.equal(
      (await inspect(f)).mode,
      "hybrid",
      "Last mode wins an async race",
    );
    await f.evaluate(() => window.MagikitosCameraLab.dispose());
    assert((await inspect(f)).disposed);
    await context.close();
    console.log("Camera study:", width + "×" + height, "passed");
  }
  // Honest unsupported-GPU state, no frozen black canvas or game fallback mutation.
  const unavailable = await browser.newPage();
  await unavailable.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind === "webgl2" ? null : get.call(this, kind, ...args);
    };
  });
  await unavailable.goto(origin + "/#experiments/camera");
  await unavailable.waitForSelector(".camera-frame");
  const blocked = await unavailable
    .locator(".camera-frame")
    .elementHandle()
    .then((e) => e.contentFrame());
  await blocked.locator("#failure").waitFor({ state: "visible" });
  assert((await blocked.locator("#failure").textContent()).includes("WebGL 2"));
  await unavailable.close();
  assert.equal(errors.length, 0, errors.join("\n"));
  assert(
    requests.every((r) => r.method === "GET"),
    "Experiments never write",
  );
  assert(
    requests.every((r) => new URL(r.url).origin === origin),
    "No outside traffic",
  );
  assert.equal(snapshot(root).baseHash, before, "Game data unchanged");
  assert.deepEqual(
    protectedFiles.map(hash),
    beforeFiles,
    "Workspace and installed game unchanged",
  );
  fs.writeFileSync(
    path.join(shots, "measurements.json"),
    JSON.stringify({ budget, metrics }, null, 2),
  );
  console.log(
    "Camera isolation, lazy loading, three modes, navigation, touch, WebGL fallback and five viewports: PASS",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    server?.kill("SIGTERM");
    await browser?.close();
  });
