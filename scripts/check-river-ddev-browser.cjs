"use strict";
/** Real authenticated embark, not just local seeded navigation. Synthetic DDEV identity only. */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process"), { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const { docks } = require("../public/assets/js/adventure/docks");
const origin = "https://magikitos.ddev.site", website = path.resolve(__dirname, "../../magikitos");
const world = JSON.parse(fs.readFileSync(".local/build/world.json")), dock = docks(world.scenes.overworld)[0];
function fixture(action, data) {
  return JSON.parse(execFileSync("ddev", ["exec", "php", "scripts/lib/forest-live-fixture.php", action],
    { cwd: website, encoding: "utf8", input: JSON.stringify(data), timeout: 30000 }));
}
(async () => {
  for (const scenario of ["legacy-boat", "pending-boat"]) {
  let user, browser;
  const errors = [], apiErrors = [], crossings = [];
  try {
    user = fixture("create-at", { scene: "overworld", position: dock.dry, scenario });
    user.scenario = scenario;
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
    page.setDefaultTimeout(20000);
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      return route.continue();
    });
    page.on("pageerror", e => errors.push(e.message));
    page.on("response", async r => {
      if (r.url().includes("/api/world/") && r.status() >= 400)
        apiErrors.push({ endpoint: new URL(r.url()).pathname, status: r.status(), body: await r.text().catch(() => "") });
    });
    page.on("websocket", socket => socket.on("framereceived", ({ payload }) => {
      const p = JSON.parse(String(payload));
      if (["cruce", "renovado"].includes(p.type)) crossings.push(p);
    }));
    await page.addInitScript(user => {
      localStorage.setItem("magikitos_session", user.bearer);
      // A previous offline adventure can leave a late-zone command ahead of
      // the first authoritative account. It must not deadlock tool recovery.
      const queue = user.scenario === "pending-boat" ? [
        ["picnic-mushroom", "interact"], ["picnic-knife", "interact"], ["picnic-lighter", "interact"],
        ["picnic-twig", "interact"], ["picnic-barbecue", "light"], ["picnic-barbecue", "cook"],
        ["picnic-neighbor", "give"], ["picnic-bin", "interact"], ["river-dock", "craft"],
      ].map(([entity, action], i) => ({ operationId: crypto.randomUUID().replaceAll("-", ""),
        scene: "overworld", entity, action, ...(i === 0 ? { baseRevision: 13 } : {}) })) : [{
          operationId: crypto.randomUUID().replaceAll("-", ""), baseRevision: 0,
          scene: "human-hedge", entity: "cat-water-bowl", action: "interact",
        }];
      if (!localStorage.getItem("magikitos.adventure.actions"))
        localStorage.setItem("magikitos.adventure.actions", JSON.stringify({ owner: user.user, queue }));
    }, user);
    await page.goto(origin + "/aventura"); await enterWorld(page);
    await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.role === "player");
    const outward = Math.abs(dock.outward.x) > Math.abs(dock.outward.y)
      ? dock.outward.x > 0 ? "ArrowRight" : "ArrowLeft"
      : dock.outward.y > 0 ? "ArrowDown" : "ArrowUp";
    const inward = { ArrowRight: "ArrowLeft", ArrowLeft: "ArrowRight", ArrowUp: "ArrowDown", ArrowDown: "ArrowUp" }[outward];
    await page.locator("#world-canvas").focus();
    await page.keyboard.down(outward);
    try {
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().navigation.mode === "boat");
    } catch (error) {
      console.error({ game: await page.evaluate(() => {
        const g = window.MagikitosAdventure.inspect();
        return { live: g.live, inventory: g.inventory, player: g.player, travelFailure: g.travelFailure,
          materials: g.materialSync, toast: document.getElementById("world-toast").textContent };
      }), apiErrors, crossings });
      throw error;
    } finally { await page.keyboard.up(outward); }
    await page.waitForTimeout(300);
    await page.keyboard.down(inward);
    await page.waitForFunction(() => window.MagikitosAdventure.inspect().navigation.mode === "foot");
    await page.keyboard.up(inward);
    assert.equal(crossings.filter(p => p.type === "cruce" && p.ok).length, 2);
    assert.deepEqual(errors, []);
    if (scenario === "pending-boat") {
      const saved = await page.evaluate(() => ({
        pending: JSON.parse(localStorage.getItem("magikitos.adventure.actions")),
        rejected: JSON.parse(localStorage.getItem("magikitos.adventure.actions.rejected")),
        inventory: window.MagikitosAdventure.inspect().inventory,
      }));
      assert.equal(saved.pending.queue.length, 0);
      assert(saved.rejected.length >= 2, "Retired pickup and already-completed recipe actions are archived");
      assert.equal(saved.rejected[0].entry.entity, "picnic-mushroom");
      assert.equal(saved.rejected[0].error, "unknown_action");
      assert(saved.rejected.some(e => e.error === "requirements_not_met"));
      assert.equal(saved.inventory.boat, 1); assert.equal(saved.inventory.oars, 1);
      const account = await page.evaluate(async bearer => {
        const response = await fetch("/api/world/game-account", { headers: { Authorization: "Bearer " + bearer } });
        return (await response.json()).account;
      }, user.bearer);
      assert.equal(account.setines, 7, "Existing money is not reset or replayed as another reward");
      assert.equal(account.inventory.leaf, 2);
      assert.equal(account.inventory.knife, 1);
      assert.equal(account.inventory.lighter, 1);
      assert.equal(apiErrors.filter(e => e.status === 404).length, 1);
      await page.reload(); await enterWorld(page);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.role === "player");
      assert.equal(apiErrors.filter(e => e.status === 404).length, 1, "Reload never retries the archived command");
    }
    fs.mkdirSync(".local/river-review", { recursive: true });
    await page.screenshot({ path: ".local/river-review/ddev-online-dock.png" });
    console.log(`PASS real DDEV ${scenario} → durable queue recovery → signed boat entitlement → online embark and disembark; synthetic fixture removed.`);
  } finally {
    if (browser) await browser.close();
    if (user) fixture("remove", user);
  }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
