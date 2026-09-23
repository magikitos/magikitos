"use strict";
/**
 * La etiqueta de interactuar (`prompt.js`): nada se abre por chocar; acercarse con flechas
 * enseña «E · verbo» sobre el elemento y E lo abre; ir tocando un destino no la enseña; y chocar
 * con un cartel ya no abre su diálogo.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const { enterWorld } = require("./browser-entry.cjs");
const { nearbyPosition, entityScreenPoint } = require("./browser-world.cjs");
const { cleanSave } = require("../public/assets/js/adventure/save");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw Error("Loopback only");
async function reachable() {
  try { return (await fetch(origin + "/bosque/explorar")).ok; } catch (_) { return false; }
}
(async () => {
  let preview = null;
  if (!(await reachable())) {
    if (!fs.existsSync(".local/build/world.json")) throw Error("Run npm run build first");
    preview = spawn(process.execPath, ["tools/preview.cjs", "--no-build", "--offline"], { stdio: "ignore" });
    for (let i = 0; i < 50 && !(await reachable()); i++) await new Promise((r) => setTimeout(r, 200));
  }
  const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
  const scene = world.scenes.overworld;
  const sign = scene.entities.find((e) => e.id === "forest-sign");
  const near = nearbyPosition(scene, {}, "forest-sign");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", (r) => r.fulfill({ status: 503, body: "{}" }));
    await page.addInitScript((s) => localStorage.setItem("magikitos.adventure", JSON.stringify(s)),
      cleanSave({ scene: "overworld", position: near, muted: true, flags: { welcomed: true } }, world));
    await page.goto(origin + "/bosque/explorar");
    await enterWorld(page);
    const prompt = () => page.evaluate(() => {
      const p = document.querySelector(".world-prompt");
      return p && !p.hidden ? p.textContent : null;
    });
    const talking = () => page.evaluate(() => Boolean(window.MagikitosAdventure.inspect().dialogue));
    assert.equal(await prompt(), null, "Nothing is offered before you steer");
    // Walk into the sign with the arrow keys: the bump must not open it any more.
    const dir = sign.y < near.y ? "ArrowUp" : "ArrowDown";
    await page.keyboard.down(dir);
    await page.waitForTimeout(900);
    await page.keyboard.up(dir);
    assert(!(await talking()), "Bumping into a sign does not open it");
    await page.waitForFunction(() => !document.querySelector(".world-prompt").hidden, null, { timeout: 3000 });
    assert.match(await prompt(), /^E · /, "Steering with keys shows the key");
    const box = await page.locator(".world-prompt").boundingBox();
    const art = await entityScreenPoint(page, scene, "forest-sign");
    assert(Math.abs(box.x + box.width / 2 - art.x) < 40, "The label sits over the sign");
    await page.keyboard.press("e");
    await page.waitForFunction(() => Boolean(window.MagikitosAdventure.inspect().dialogue), null, { timeout: 3000 });
    assert.equal(await prompt(), null, "Talking hides the label");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !window.MagikitosAdventure.inspect().dialogue);
    // A tapped destination never shows it.
    const canvas = await page.locator("#world-canvas").boundingBox();
    await page.mouse.click(canvas.x + canvas.width * 0.3, canvas.y + canvas.height * 0.7);
    await page.waitForTimeout(1500);
    assert.equal(await prompt(), null, "Walking to a tapped spot shows no label");
    assert.deepEqual(errors, []);
    console.log("PASS prompt: no bump opens, keys show «E · …» over the element, E opens, a tapped journey shows nothing.");
  } finally {
    await browser.close();
    preview?.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
