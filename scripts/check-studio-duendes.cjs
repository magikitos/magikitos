"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { chromium } = require("playwright");
const { snapshot } = require("../tools/adventure-studio/snapshot.cjs");
const {
  plan,
  totalPoses,
} = require("../tools/adventure-studio/experiments/duende-cast/plan");
const root = path.resolve(__dirname, ".."),
  origin = process.env.STUDIO_ORIGIN || "http://127.0.0.1:47832";
const protectedFiles = [
  ".local/adventure-studio/workspace.json",
  ".local/build/current.json",
  "../magikitos/public/game/current.json",
  "public/assets/aventura/manifest.json",
];
const hashes = () =>
  protectedFiles.map((p) =>
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.resolve(root, p)))
      .digest("hex"),
  );
const before = hashes(),
  world = snapshot(root).baseHash;
const out = path.join(root, ".local/screenshots/duende-cast");
fs.mkdirSync(out, { recursive: true });
assert.equal(new Set(plan.actions.map((a) => a.id)).size, plan.actions.length);
for (const action of plan.actions) {
  assert(plan.groups.some((g) => g.id === action.group));
  assert(
    action.frames > 0 &&
      action.directions.length > 0 &&
      action.brief &&
      action.anchor,
  );
}
assert.equal(totalPoses(plan.actions), 1076);
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [],
    writes = [],
    reports = [];
  try {
    for (const [width, height] of [
      [1440, 1000],
      [1024, 768],
      [768, 1024],
      [390, 844],
      [844, 390],
      [320, 568],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        reducedMotion: "reduce",
      });
      const requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 400) errors.push(r.status() + " " + r.url());
      });
      await page.route("**/*", (route) => {
        const req = route.request(),
          u = new URL(req.url());
        requests.push(u.pathname);
        if (req.method() !== "GET")
          writes.push(req.method() + " " + u.pathname);
        return u.hostname === "127.0.0.1" ? route.continue() : route.abort();
      });
      await page.goto(origin);
      await page.waitForFunction(() => window.MagikitosStudio?.inspect().ready);
      assert(
        !requests.some((p) => p.includes("/duende-cast/")),
        "Study resources are lazy",
      );
      await page.locator('[data-studio-tab="experiments"]').click();
      const handle = await page.locator(".cast-frame").elementHandle(),
        frame = await handle.contentFrame();
      await frame.waitForFunction(
        () => window.MagikitosDuendeLab?.inspect().ready,
      );
      await frame.locator(".card-image img").first().waitFor();
      await frame.waitForFunction(() =>
        [...document.querySelectorAll(".card-image img")].every(
          (i) => i.complete && i.naturalWidth,
        ),
      );
      assert.equal(await frame.locator("[data-design]").count(), 4);
      assert(
        !requests.some((p) => p.includes("/duende-cast/sources/")),
        "High-resolution sources require explicit opening",
      );
      assert(
        !requests.some((p) => p.includes("-sprite.png")),
        "Native comparison waits for entry",
      );
      const overflow = async () =>
        frame.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
      assert.equal(await overflow(), false, "No horizontal overflow");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        "Studio shell fits",
      );
      await page.screenshot({
        path: path.join(out, "designs-" + width + "x" + height + ".png"),
      });
      for (const id of ["zarzal", "trasto", "candil", "ascua"]) {
        await frame.locator('[data-design="' + id + '"]').click();
        assert.equal(
          await frame.evaluate(
            () => window.MagikitosDuendeLab.inspect().selected,
          ),
          id,
        );
        await frame.waitForFunction(() =>
          [...document.querySelectorAll("#family-portraits img")].every(
            (i) => i.complete && i.naturalWidth,
          ),
        );
      }
      await frame.locator(".context-button").click();
      await frame.waitForFunction(
        () => window.MagikitosDuendeLab.inspect().scene?.ready,
      );
      await frame.locator("#family-select").selectOption("zarzal");
      await frame.locator("#light").selectOption("dusk");
      await frame.locator("#silhouette").check();
      await frame.locator("#silhouette").uncheck();
      await frame.locator("#light").selectOption("day");
      for (const zoom of ["2", "4", "3"]) {
        await frame.locator("#zoom").selectOption(zoom);
        const bounds = await frame.evaluate(
          () => window.MagikitosDuendeLab.inspect().scene,
        );
        for (const a of bounds.actorBounds) {
          assert(
            a.left >= 0 &&
              a.top >= 0 &&
              a.left + a.width <= bounds.width &&
              a.top + a.height <= bounds.height,
            "Entire character visible at zoom " +
              zoom +
              ": " +
              JSON.stringify(a),
          );
        }
      }
      const scene = await frame.evaluate(
        () => window.MagikitosDuendeLab.inspect().scene,
      );
      assert.equal(scene.loaded, 12);
      assert.equal(scene.raf, 0);
      await page.waitForTimeout(200);
      assert.equal(
        (await frame.evaluate(() => window.MagikitosDuendeLab.inspect().scene))
          .drawCount,
        scene.drawCount,
        "Static study has no idle redraws",
      );
      await frame.locator("#scene").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(out, "forest-" + width + "x" + height + ".png"),
      });
      assert.equal(await overflow(), false);
      await frame.locator('[data-tab="poses"]').click();
      assert.equal(await frame.locator(".pose-row").count(), 46);
      await frame.locator("#pose-search").fill("empujar");
      assert.equal(await frame.locator('[data-action="push"]').count(), 1);
      assert((await frame.locator(".pose-row").count()) < 46);
      await frame.locator("#pose-search").fill("");
      await frame.locator("#pose-group").selectOption("tools");
      assert.equal(await frame.locator(".pose-row").count(), 6);
      const download = page.waitForEvent("download");
      await frame.locator("#export-poses").click();
      assert.equal(
        (await download).suggestedFilename(),
        "magikitos-plan-poses.json",
      );
      await page.screenshot({
        path: path.join(out, "poses-" + width + "x" + height + ".png"),
      });
      assert.equal(
        await frame.evaluate(() =>
          Object.keys(localStorage).some((k) => k.includes("adventure")),
        ),
        false,
      );
      await page.locator('[data-studio-tab="map"]').click();
      await page.locator(".cast-frame").waitFor({ state: "detached" });
      await page.locator('[data-studio-tab="experiments"]').click();
      const fresh = await (
        await page.locator(".cast-frame").elementHandle()
      ).contentFrame();
      await fresh.waitForFunction(
        () => window.MagikitosDuendeLab?.inspect().ready,
      );
      assert.equal(
        await fresh.evaluate(
          () => window.MagikitosDuendeLab.inspect().selected,
        ),
        "ascua",
      );
      assert.equal(
        await fresh.evaluate(() => window.MagikitosDuendeLab.inspect().scene),
        null,
        "Leaving releases comparison assets",
      );
      reports.push({ width, height, scene });
      await page.close();
      console.log(
        "PASS duende designs, scale, poses, lazy assets and lifecycle " +
          width +
          "x" +
          height,
      );
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    assert.deepEqual(hashes(), before);
    assert.equal(snapshot(root).baseHash, world);
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(
        { reports, errors, writes, protectedFilesUnchanged: true },
        null,
        2,
      ),
    );
    console.log(
      "PASS protected game artifacts, scene snapshot and Studio workspace unchanged",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
