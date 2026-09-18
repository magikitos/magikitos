"use strict";
/** Installed authored map → actual DDEV HTTPS/WSS/PHP/SQL. Synthetic accounts only;
 * no mocked API, debug setter, replacement world or production writes. */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const { entityScreenPoint } = require("./browser-world.cjs");
const { World } = require("../public/assets/js/adventure/model");
const origin = "https://magikitos.ddev.site", website = path.resolve(__dirname, "../../magikitos");
const world = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../.local/build/world.json")));
const scene = "overworld", id = "clearing-willow-crate";
const authored = new World(world.scenes[scene]).entities.find(e => e.id === id);
const read = page => page.evaluate(() => window.MagikitosAdventure.inspect());
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  const deadline = Date.now() + 12000;
  while (!(await fn())) { if (Date.now() > deadline) throw Error(label); await pause(50); }
}
async function main() {
  const users = [], contexts = [], issues = [];
  function fixture(action, value) {
    const result = JSON.parse(execFileSync("ddev", ["exec", "php", "scripts/lib/forest-live-fixture.php", action],
      { cwd: website, encoding: "utf8", timeout: 30000, input: value ? JSON.stringify(value) : undefined }));
    if (action === "create-at") users.push(result);
    return result;
  }
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    async function open(position, viewport, touch = false) {
      const user = fixture("create-at", { scene, position });
      const context = await browser.newContext({ viewport, hasTouch: touch, ignoreHTTPSErrors: true });
      contexts.push(context);
      await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await context.addInitScript(({ bearer, origin }) => {
        if (location.origin === origin) localStorage.setItem("magikitos_session", bearer);
      }, { bearer: user.bearer, origin });
      const page = await context.newPage(), packets = [];
      page.setDefaultTimeout(20000);
      page.on("pageerror", error => issues.push(error.message));
      page.on("websocket", socket => socket.on("framereceived", ({ payload }) => {
        const packet = JSON.parse(String(payload));
        if (packet.type !== "objetos") return;
        packets.push(packet); if (packets.length > 64) packets.shift();
      }));
      await page.goto(origin + "/aventura"); await enterWorld(page);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.role === "player");
      try {
        await until(() => packets.some(p => p.scene === scene && p.objects.some(row => row[0] === id)), "Authored crate never reached real socket");
      } catch (error) {
        const state = await read(page);
        console.error({ live: state.live, scene: state.scene, player: state.player,
          camera: state.camera, view: state.view, objects: packets.at(-1), sync: state.sync });
        throw error;
      }
      return { page, user, packets };
    }
    const row = client => client.packets.at(-1)?.objects.find(row => row[0] === id);
    const mobile = await open({ x: authored.x, y: authored.y + 48 }, { width: 390, height: 844 }, true);
    const [, x, y] = row(mobile), [ox, oy, w, h] = authored.solid.map(n => n * 16);
    const desktop = await open({ x: x + ox - 6.25, y: y + oy + h / 2 }, { width: 1440, height: 900 });
    const tablet = await open({ x: x + ox + w + 6.25, y: y + oy + h / 2 }, { width: 820, height: 1180 }, true);
    await Promise.all([desktop.page.keyboard.down("ArrowRight"), tablet.page.keyboard.down("ArrowLeft")]);
    await until(async () => (await read(desktop.page)).player.pushing && (await read(tablet.page)).player.pushing,
      "Both real players must contact the actual shared body");
    await pause(600); const opposed = row(mobile)[1]; await pause(1100);
    assert(Math.abs(row(mobile)[1] - opposed) < 2, "Opposing players cancel on authored world geometry");
    await Promise.all([desktop.page.keyboard.up("ArrowRight"), tablet.page.keyboard.up("ArrowLeft")]);
    await tablet.page.keyboard.down("ArrowDown"); await pause(550); await tablet.page.keyboard.up("ArrowDown");
    await desktop.page.keyboard.down("ArrowRight");
    await until(() => row(mobile)[1] > opposed + 12, "Released opposition permits a server-owned push");
    await desktop.page.keyboard.up("ArrowRight"); await pause(350);
    const viewers = [desktop, tablet, mobile];
    await until(async () => {
      const states = await Promise.all(viewers.map(v => read(v.page))), current = row(mobile);
      return states.every(state => state.entities.find(e => e.id === id)?.x === current[1]);
    }, "Three real viewports must converge on authority");
    assert(row(mobile)[3] > 0, "Shared revision has advanced");
    console.log("PASS authored crate: real DDEV authority cancels opposing desktop/tablet pushes and updates all three viewports.");

    // Actual mobile artwork tap, not a synthetic call to interact(). The fixture
    // approaches from below, so it pushes upwards rather than following desktop.
    const current = row(mobile), data = structuredClone(world.scenes[scene]);
    Object.assign(data.entities.find(e => e.id === id), { x: current[1] / 16, y: current[2] / 16 });
    const point = await entityScreenPoint(mobile.page, data, id), beforeY = current[2];
    await mobile.page.touchscreen.tap(point.x, point.y);
    await until(() => row(mobile)[2] < beforeY - 6, "Mobile sprite tap must approach and push the same authored crate");
    await until(async () => !(await read(mobile.page)).travel.intent, "Shared tap journey must finish");
    await pause(350);
    assert(!(await read(mobile.page)).dialogue, "Pushing is not dialogue");
    const final = row(mobile).slice();
    for (const viewer of viewers) {
      const state = await read(viewer.page);
      assert(!Object.hasOwn(state.objects[scene] || {}, id), "Shared position never enters client private state");
      const response = await viewer.page.request.get(origin + "/api/world/game-state", {
        headers: { Authorization: "Bearer " + viewer.user.bearer } });
      assert.equal(response.status(), 200);
      assert(!Object.hasOwn((await response.json()).profile.state.objects?.[scene] || {}, id), "PHP private snapshot contains no shared position");
    }
    fs.mkdirSync(".local/forest-review", { recursive: true });
    for (const [name, viewer] of [["desktop", desktop], ["tablet", tablet], ["mobile", mobile]])
      await viewer.page.screenshot({ path: `.local/forest-review/authored-${name}.png` });
    await Promise.all(contexts.map(context => context.close()));
    contexts.length = 0;
    // Restart just this project's daemon: flushes real PHP storage and discards
    // presence. No Docker or unrelated project restart, and no seeded positions.
    execFileSync("ddev", ["exec", "supervisorctl", "restart", "webextradaemons:bosque-vivo"],
      { cwd: website, encoding: "utf8", timeout: 30000 });
    const returned = await open({ x: final[1], y: final[2] + 48 }, { width: 1024, height: 768 });
    const restored = row(returned);
    assert.equal(restored[0], final[0]); assert.equal(restored[3], final[3]);
    assert(Math.abs(restored[1] - final[1]) < 1e-8 && Math.abs(restored[2] - final[2]) < 1e-8,
      "Real daemon restart reloads committed position without perceptible drift (JSON/SQL double round-trip)");
    assert.deepEqual(issues, []);
    console.log("PASS actual authored map: mobile approach/push, no private positions, server SIGTERM/SQL/reload persistence. Synthetic accounts removed; local shared crate retains its test movement.");
  } finally {
    await browser.close();
    for (const user of users) fixture("remove", user);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
