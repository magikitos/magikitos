"use strict";
/**
 * EL ALMACÉN DEL CONSTRUCTOR, EN NAVEGADOR (19-sep-2026, decisión del dueño): se entra en la regadera,
 * se habla con Cebolino, salen los tres trueques en setas, cinco setas se convierten en un saco de
 * diez gravillas en el propio saco, y se vuelve a la pradera por la rampa. Sin setines por ningún
 * lado. La API va simulada como caída: la regla se aplica en local y se anota en la cola, que es lo
 * que hace el juego cuando la red no está.
 */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }), errors = [];
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 800, isMobile: width < 800, deviceScaleFactor: 1 });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false,"error":"offline"}' });
        return route.continue();
      });
      await page.addInitScript(() => localStorage.setItem("magikitos.adventure", JSON.stringify({ scene: "almacen", position: { x: 15 * 16, y: 21.5 * 16 }, muted: true, inventory: { mushroom: 7 } })));
      await page.goto(origin + "/bosque/explorar");
      await require("./browser-entry.cjs").enterWorld(page);
      const inspect = () => page.evaluate(() => window.MagikitosAdventure.inspect());
      const world = (x, y) => page.evaluate(([x, y]) => {
        const i = window.MagikitosAdventure.inspect(), r = document.getElementById("world-canvas").getBoundingClientRect();
        return [r.left + (x * 16 - i.camera.x) * r.width / i.view.width, r.top + (y * 16 - i.camera.y) * r.height / i.view.height];
      }, [x, y]);
      const tap = async (x, y) => { const [sx, sy] = await world(x, y); if (width < 800) await page.touchscreen.tap(sx, sy); else await page.mouse.click(sx, sy); };
      let s = await inspect();
      assert.equal(s.scene, "almacen", "Se entra en el almacén");
      assert.equal(s.inventory?.mushroom ?? (await page.evaluate(() => window.MagikitosAdventure.inspect().inventory?.mushroom)), 7);
      // Tocar el mostrador habla con el constructor (interactAs).
      await tap(16.9, 14.4);
      await page.waitForFunction(() => Boolean(window.MagikitosAdventure.inspect().dialogue), null, { timeout: 15000 });
      await page.waitForTimeout(300);
      const buttons = await page.evaluate(() => [...document.querySelectorAll("#dialogue-actions button")].map((b) => b.textContent.trim()));
      assert.deepEqual(buttons, ["5 setas → saco de gravilla", "6 setas → bombita", "2 setas → tenaza"], "Los tres trueques, en setas");
      assert(!(await page.evaluate(() => document.getElementById("dialogue").textContent)).includes("setin"), "Sin setines en la conversación");
      await page.locator("#dialogue-actions button", { hasText: "saco de gravilla" }).click();
      await page.waitForFunction(() => (window.MagikitosAdventure.inspect().inventory?.gravilla || 0) >= 10, null, { timeout: 15000 });
      s = await inspect();
      assert.equal(s.inventory.gravilla, 10, "Un saco son diez gravillas");
      assert.equal(s.inventory.mushroom, 2, "Cinco setas menos");
      assert.equal(s.wallet?.balance ?? 0, 0, "Los setines no se tocan");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      // La bombita cuesta seis y ya no llegan: el botón no la da y el saco no cambia.
      await tap(16.9, 14.4);
      await page.waitForFunction(() => Boolean(window.MagikitosAdventure.inspect().dialogue), null, { timeout: 15000 });
      await page.waitForTimeout(300);
      await page.locator("#dialogue-actions button", { hasText: "bombita" }).click();
      await page.waitForTimeout(500);
      s = await inspect();
      assert(!s.inventory.bomba && s.inventory.mushroom === 2, "Sin setas suficientes no hay bombita");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      // La rampa lleva a la pradera, junto a la regadera.
      await tap(15, 27.2);
      await page.waitForFunction(() => window.MagikitosAdventure.inspect().scene === "overworld", null, { timeout: 25000 });
      s = await inspect();
      assert(Math.abs(s.player.x - 104 * 16) < 40 && s.player.y > 105 * 16, "Se sale por la puerta de la regadera " + JSON.stringify(s.player));
      await page.screenshot({ path: `.local/warehouse-review/outside-${width}.png` }).catch(() => {});
      await page.close();
      console.log(`PASS warehouse ${width}×${height}: entrar, tres trueques en setas, un saco de diez por cinco setas, sin bombita sin setas, salida a la pradera.`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
