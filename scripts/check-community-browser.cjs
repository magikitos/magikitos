"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const { chromium, request } = require("playwright");
const {
  validateConstruction,
} = require("../public/assets/js/adventure/construction-layout");
const web = process.env.GAME_WEB_REPO || path.resolve("..", "magikitos"),
  origin = "https://magikitos.ddev.site";
const fixture = (...args) =>
  execFileSync(
    "ddev",
    ["exec", "php", "scripts/community-browser-fixture.php", ...args],
    { cwd: web, encoding: "utf8" },
  );
(async () => {
  const users = [],
    browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [];
  fs.mkdirSync(".local/community-review", { recursive: true });
  const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
  try {
    const identity = JSON.parse(fixture("create"));
    users.push(identity.id);
    const http = await request.newContext({
      baseURL: origin,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Authorization: "Bearer " + identity.token,
        Origin: origin,
      },
    });
    async function action(scene, entity, action = "interact") {
      const a = await (await http.get("/api/world/game-account")).json();
      const r = await http.post("/api/world/game-action", {
          data: {
            operationId: crypto.randomUUID().replaceAll("-", ""),
            baseRevision: a.account.revision,
            scene,
            entity,
            action,
          },
        }),
        data = await r.json();
      assert.equal(r.status(), 200, JSON.stringify({ entity, data }));
      return data.account;
    }
    for (const id of world.resourceRegions.overworld.nodes)
      await action("overworld", id);
    for (const id of [
      "picnic-bin",
      "picnic-knife",
      "picnic-lighter",
      "picnic-mushroom",
    ])
      await action("overworld", id);
    await action("overworld", "picnic-barbecue", "light");
    await action("overworld", "picnic-barbecue", "cook");
    await action("overworld", "picnic-neighbor", "give");
    await action("overworld", "river-dock", "craft");
    await action("river-willows", "bank-twig-0");
    const account = await action("human-hedge", "cat-water-bowl");
    assert.equal(account.inventory.oars, 1);
    assert.equal(account.setines, 10);
    assert(account.knowledge.includes("bowl-pool"));
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        isMobile: width < 800,
        ignoreHTTPSErrors: true,
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (r) =>
        new URL(r.request().url()).hostname === "magikitos.ddev.site"
          ? r.continue()
          : r.abort(),
      );
      await page.addInitScript(
        ({ token, account }) => {
          localStorage.setItem("magikitos_session", token);
          if (!localStorage.getItem("magikitos.adventure"))
            localStorage.setItem(
              "magikitos.adventure",
              JSON.stringify({
                scene: "home-garden",
                position: { x: 24 * 16, y: 30 * 16 },
                flags: account.progress.flags,
                inventory: account.inventory,
                muted: true,
                resources: account.resources,
                wallet: {
                  balance: account.setines,
                  claimed: account.progress.rewards,
                },
              }),
            );
        },
        { token: identity.token, account },
      );
      await page.goto(origin + "/aventura");
      await require("./browser-entry.cjs").enterWorld(page);
      await page.locator("#home-edit").click();
      await page.waitForFunction(
        () => window.MagikitosAdventure.inspect().community.editing,
      );
      await page.locator("#home-palette button").first().click();
      const snapshot = await (
        await http.get("/api/world/community?zone=tocon-del-mirlo")
      ).json();
      let point;
      for (let y = 24; y <= 31 && !point; y += 0.5)
        for (let x = 12; x < 37 && !point; x += 0.5) {
          const ghost = {
            kind: "twig-fence",
            variant: "hazel",
            rotation: 0,
            x,
            y,
          };
          if (
            !validateConstruction(
              [...snapshot.objects, ghost],
              snapshot.zone,
              world.construction,
            )
          )
            point = { x, y };
        }
      assert(point, "At least one legal plot position");
      const inspect = () =>
        page.evaluate(() => window.MagikitosAdventure.inspect());
      let s = await inspect();
      const c = await page.context().newCDPSession(page),
        cy = height * 0.4;
      const uiBefore = await page.locator("#home-save").boundingBox();
      await c.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: 80, y: cy, id: 1 },
          { x: width - 80, y: cy, id: 2 },
        ],
      });
      await c.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: 110, y: cy, id: 1 },
          { x: width - 110, y: cy, id: 2 },
        ],
      });
      await c.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await c.detach();
      assert.equal(
        await page.evaluate(() => visualViewport.scale),
        1,
        "Pinch never scales browser UI",
      );
      const uiAfter = await page.locator("#home-save").boundingBox();
      assert(Math.abs(uiAfter.width - uiBefore.width) < 1);
      // Mobile panning remains available while placing. Bring the legal point into view.
      s = await inspect();
      const box = await page.locator("#world-canvas").boundingBox();
      let sx = box.x + ((point.x * 16 - s.camera.x) * box.width) / s.view.width,
        sy = box.y + ((point.y * 16 - s.camera.y) * box.height) / s.view.height;
      if (sx < 30 || sx > width - 30 || sy < 90 || sy > height * 0.55) {
        await page.mouse.move(width * 0.5, height * 0.35);
        await page.mouse.down();
        await page.mouse.move(
          width * 0.5 + (width * 0.5 - sx),
          height * 0.35 + (height * 0.35 - sy),
          { steps: 8 },
        );
        await page.mouse.up();
        s = await inspect();
        sx = box.x + ((point.x * 16 - s.camera.x) * box.width) / s.view.width;
        sy = box.y + ((point.y * 16 - s.camera.y) * box.height) / s.view.height;
      }
      await page.touchscreen.tap(sx, sy);
      await page.waitForFunction(() => {
        const s = window.MagikitosAdventure.inspect();
        return s.community.ghost && !s.community.invalid;
      });
      await page.screenshot({
        path: `.local/community-review/placement-${width}.png`,
      });
      await page.locator("#home-save").click();
      await page.waitForFunction(
        () => !window.MagikitosAdventure.inspect().community.editing,
      );
      const after = await (
        await http.get("/api/world/community?zone=tocon-del-mirlo")
      ).json();
      assert.equal(after.objects.length, snapshot.objects.length + 1);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.close();
      console.log(
        `PASS shared placement, real API, fixed UI pinch ${width}x${height}`,
      );
    }
    assert.deepEqual(errors, []);
    await http.dispose();
  } finally {
    await browser.close();
    for (const id of users) fixture("dispose", String(id));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
