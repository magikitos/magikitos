"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { chromium } = require("playwright");
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const root = path.resolve(__dirname, ".."),
  origin = process.env.STUDIO_ORIGIN || "http://127.0.0.1:47832";
const files = [
  ".local/adventure-studio/workspace.json",
  ".local/build/current.json",
  "../magikitos/public/game/current.json",
  "public/assets/aventura/manifest.json",
];
const hash = (p) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.resolve(root, p)))
    .digest("hex");
const before = files.map(hash),
  worldBefore = snapshot(root).baseHash;
const out = path.join(root, ".local/screenshots/definition-motion");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    reports = [],
    errors = [],
    writes = [];
  try {
    for (const [width, height] of [
      [1440, 1000],
      [1024, 768],
      [768, 1024],
      [390, 844],
      [844, 390],
      [320, 568],
    ]) {
      const p = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
      });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.route("**/*", (r) => {
        const u = new URL(r.request().url());
        if (r.request().method() !== "GET")
          writes.push([r.request().method(), u.pathname]);
        return u.hostname === "127.0.0.1" ? r.continue() : r.abort();
      });
      await p.goto(origin);
      await p.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
      assert.equal(
        await p.locator(".definition-frame").count(),
        0,
        "Lab code starts only on entry",
      );
      await p.locator('[data-studio-tab="experiments"]').click();
      await p.locator('[data-experiment="definition-motion"]').click();
      await p.waitForSelector(".definition-frame");
      let f = await (
        await p.locator(".definition-frame").elementHandle()
      ).contentFrame();
      const read = () =>
        f.evaluate(() => window.MagikitosDefinitionLab.inspect());
      await f.waitForFunction(
        () =>
          window.MagikitosDefinitionLab?.inspect().ready &&
          !window.MagikitosDefinitionLab.inspect().pending,
      );
      const initial = await read(),
        logical = initial.logical;
      assert.equal(
        initial.assets.loaded,
        3,
        "Only knife A/B and reference hero initially",
      );
      assert(
        initial.height > 140 && initial.width > 250,
        "Usable responsive stage",
      );
      const controls = async () => {
        if (!(await f.locator("#settings").isVisible()))
          await f.locator("#settings-toggle").click();
      };
      const closeControls = async () => {
        if (await f.locator("#settings-close").isVisible())
          await f.locator("#settings-close").click();
      };
      for (const id of [
        "1-area",
        "2-nearest",
        "3-nearest",
        "3-area",
        "1-nearest",
        "2-area",
      ]) {
        await controls();
        await f.locator("#profile").selectOption(id);
        await f.waitForFunction(
          (id) =>
            window.MagikitosDefinitionLab.inspect().shownProfile === id &&
            !window.MagikitosDefinitionLab.inspect().pending,
          id,
        );
        assert.deepEqual(
          (await read()).logical,
          logical,
          "No object resizing between density profiles",
        );
      }
      await closeControls();
      await p.screenshot({
        path: path.join(out, "detail-" + width + "x" + height + ".png"),
      });
      await controls();
      await f.locator("#subject").selectOption("giant-fern");
      await f.waitForFunction(
        () => !window.MagikitosDefinitionLab.inspect().pending,
      );
      await f.locator("#timeline").fill("3");
      await f.locator("#timeline").dispatchEvent("input");
      assert.equal(
        (await read()).playing,
        false,
        "Scrubbing freezes the shared clock",
      );
      await closeControls();
      const frozen = (await read()).renderCount;
      await p.waitForTimeout(200);
      assert(
        (await read()).renderCount <= frozen + 1,
        "Paused view has no perpetual render loop",
      );
      await controls();
      await f.locator("#timeline").fill("13.7");
      await f.locator("#timeline").dispatchEvent("input");
      await closeControls();
      await p.waitForTimeout(80);
      const foliage = await f.locator("#scene").evaluate((c) => c.toDataURL());
      await controls();
      await f.locator('[data-motion="still"]').click();
      await closeControls();
      await p.waitForTimeout(80);
      assert.notEqual(
        await f.locator("#scene").evaluate((c) => c.toDataURL()),
        foliage,
        "Foliage movement changes actual rendered pixels",
      );
      await controls();
      await f.locator("#timeline").fill("3");
      await f.locator("#timeline").dispatchEvent("input");
      await controls();
      await f.locator('[data-motion="still"]').click();
      await f.locator('[data-stop="garden"]').click();
      await f.waitForFunction(
        () =>
          window.MagikitosDefinitionLab.inspect().view === "scene" &&
          !window.MagikitosDefinitionLab.inspect().pending,
      );
      await p.waitForTimeout(80);
      assert.equal((await read()).active, 0);
      await controls();
      await f.locator('[data-motion="selective"]').click();
      await closeControls();
      await p.waitForTimeout(80);
      const selective = (await read()).active;
      assert(selective > 0);
      await controls();
      await f.locator('[data-motion="all"]').click();
      await closeControls();
      await p.waitForTimeout(80);
      assert(
        (await read()).active > selective,
        "All mode animates more visible props than selective",
      );
      await controls();
      await f.locator('[data-motion="selective"]').click();
      await closeControls();
      const z = (await read()).zoom;
      await f.locator("#zoom-in").click();
      await p.waitForTimeout(60);
      assert((await read()).zoom > z);
      const rect = await f.locator("#scene").boundingBox();
      await p.mouse.move(rect.x + rect.width / 2, rect.y + rect.height * 0.3);
      await p.mouse.wheel(0, 150);
      await p.waitForTimeout(80);
      const beforePan = (await read()).center;
      await p.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.3);
      await p.mouse.down();
      await p.mouse.move(
        rect.x + rect.width * 0.4,
        rect.y + rect.height * 0.3,
        { steps: 5 },
      );
      await p.mouse.up();
      assert.notDeepEqual(
        (await read()).center,
        beforePan,
        "Pointer panning works",
      );
      await f.locator("#play").click();
      await p.waitForTimeout(600);
      const live = await read();
      assert(live.playing && live.time > 3);
      await p.screenshot({
        path: path.join(out, "scene-" + width + "x" + height + ".png"),
      });
      await controls();
      const download = p.waitForEvent("download");
      await f.locator("#export").click();
      const d = await download;
      assert.equal(d.suggestedFilename(), "magikitos-trazo-y-vida.json");
      await d.delete();
      await closeControls();
      const cdp = await p.context().newCDPSession(p);
      const cx = rect.x + rect.width / 2,
        cy = rect.y + rect.height * 0.3;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: cx - 25, y: cy, id: 1 },
          { x: cx + 25, y: cy, id: 2 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: cx - 45, y: cy, id: 1 },
          { x: cx + 45, y: cy, id: 2 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
      assert((await read()).zoom > live.zoom, "Native two-pointer pinch zoom");
      const camera = await read();
      assert(
        camera.center.x - camera.width / camera.zoom / 2 >= -0.001,
        "No empty world border",
      );
      await p.locator('[data-studio-tab="map"]').click();
      await p.locator(".definition-frame").waitFor({ state: "detached" });
      assert.equal(
        await p.locator(".definition-frame").count(),
        0,
        "Leaving destroys experiment iframe",
      );
      await p.locator('[data-studio-tab="experiments"]').click();
      await p.locator('[data-experiment="definition-motion"]').click();
      await p.locator(".definition-frame").waitFor();
      f = await (
        await p.locator(".definition-frame").elementHandle()
      ).contentFrame();
      await f.waitForFunction(
        () => window.MagikitosDefinitionLab?.inspect().ready,
      );
      assert.equal(
        (await read()).profile,
        "2-area",
        "Reentry starts a clean experiment, no persisted decision",
      );
      const storage = await f.evaluate(() => Object.keys(localStorage));
      assert(
        !storage.some((k) => k.includes("adventure")),
        "No game save created",
      );
      reports.push({ ...live, viewport: { width, height } });
      await p.close();
      console.log(
        "PASS density, motion, pause, pointer/pinch, export and lifecycle " +
          width +
          "x" +
          height,
      );
    }
    const stress = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    stress.on("pageerror", (e) => errors.push(e.message));
    await stress.goto(origin + "/#experiments/definition-motion");
    await stress.waitForSelector(".definition-frame");
    const sf = await (
      await stress.locator(".definition-frame").elementHandle()
    ).contentFrame();
    await sf.waitForFunction(
      () =>
        window.MagikitosDefinitionLab?.inspect().ready &&
        !window.MagikitosDefinitionLab.inspect().pending,
    );
    await stress.route(
      "**/picnic-knife--3-area.png",
      (r) => r.fulfill({ status: 503, body: "Expected local QA failure" }),
      { times: 1 },
    );
    await sf.locator("#profile").selectOption("3-area");
    await sf.waitForFunction(() =>
      Boolean(window.MagikitosDefinitionLab.inspect().error),
    );
    assert(
      await sf.locator("#notice").isVisible(),
      "Asset failure is visible and recoverable",
    );
    await sf.locator("#profile").selectOption("2-nearest");
    await sf.waitForFunction(
      () =>
        !window.MagikitosDefinitionLab.inspect().pending &&
        !window.MagikitosDefinitionLab.inspect().error,
    );
    await stress.route(
      "**/picnic-knife--3-area.png",
      async (r) => {
        await new Promise((resolve) => setTimeout(resolve, 160));
        await r.continue();
      },
      { times: 1 },
    );
    for (const id of ["3-area", "1-area", "3-nearest", "2-area"])
      await sf.locator("#profile").selectOption(id);
    await sf.waitForFunction(
      () =>
        window.MagikitosDefinitionLab.inspect().shownProfile === "2-area" &&
        !window.MagikitosDefinitionLab.inspect().pending,
    );
    await stress.waitForTimeout(300);
    assert.equal(
      await sf.evaluate(
        () => window.MagikitosDefinitionLab.inspect().assets.loaded,
      ),
      3,
      "Late requests cannot grow the retained cache",
    );
    await stress.close();
    console.log(
      "PASS failed-asset recovery and rapid profile-switch race/cache cleanup",
    );
    const p = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await p.goto(origin + "/#experiments/definition-motion");
    await p.waitForSelector(".definition-frame");
    const f = await (
      await p.locator(".definition-frame").elementHandle()
    ).contentFrame();
    await f.waitForFunction(
      () => window.MagikitosDefinitionLab?.inspect().ready,
    );
    assert.equal(
      await f.evaluate(() => window.MagikitosDefinitionLab.inspect().playing),
      false,
      "Reduced motion starts paused",
    );
    const disposed = await f.evaluate(() => {
      window.MagikitosDefinitionLab.dispose();
      return window.MagikitosDefinitionLab.inspect();
    });
    assert(
      disposed.disposed && disposed.assets.loaded === 0,
      "Dispose releases decoded textures",
    );
    await p.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(
      writes,
      [],
      "No write endpoints called by this experiment",
    );
    assert.deepEqual(
      files.map(hash),
      before,
      "User workspace and installed game untouched",
    );
    assert.equal(
      snapshot(root).baseHash,
      worldBefore,
      "Game scenes, art definitions and manifest unchanged",
    );
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(reports, null, 2),
    );
    console.log(
      "PASS reduced motion, decoded-image cleanup, exact game/workspace isolation. " +
        out,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
