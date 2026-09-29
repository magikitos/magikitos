"use strict";
/** The painted restaurant stays a social corner, with no recipe UI or API. */
const assert = require("node:assert/strict"), fs = require("node:fs");
const { chromium } = require("playwright");
const { compileWorld } = require("../tools/world.cjs");
const { nearbyPosition, entityScreenPoint } = require("./browser-world.cjs");
const { enterWorld } = require("./browser-entry.cjs");
const world = compileWorld(), scene = world.scenes.overworld;
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }), errors = [];
  fs.mkdirSync(".local/restaurant-review", { recursive: true });
  try {
    for (const [width,height] of [[1440,900],[390,844],[844,390]]) {
      const page = await browser.newPage({ viewport: { width,height }, hasTouch: true });
      const requests = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("**/*", r => {
        const u = new URL(r.request().url());
        if (u.pathname.startsWith("/api/")) {
          requests.push(u.pathname);
          return r.fulfill({ status:503,json:{ok:false,error:"offline"} });
        }
        return r.continue();
      });
      const position = nearbyPosition(scene, { flags:{},inventory:{},resources:{} }, "restaurant-kitchen");
      await page.addInitScript(position => localStorage.setItem("magikitos.adventure", JSON.stringify({
        scene:"overworld",position,flags:{welcomed:true},muted:true,
      })),position);
      await page.goto(origin+"/bosque/explorar"); await enterWorld(page);
      const point = await entityScreenPoint(page,scene,"restaurant-kitchen");
      // The tall kitchen extends above a short landscape viewport. Its counter
      // remains visible: tap that visible part instead of the offscreen roof center.
      point.y = Math.max(44, point.y);
      assert(point.x > 0 && point.x < width && point.y < height, "Visible restaurant target");
      await page.touchscreen.tap(point.x,point.y);
      await page.waitForFunction(() => !!window.MagikitosAdventure.inspect().dialogue);
      assert(await page.locator("#world-content").isHidden(),"Scenery opens no recipe sheet");
      const state = await page.evaluate(() => window.MagikitosAdventure.inspect());
      for (const id of ["restaurant-kitchen","restaurant-table-west","restaurant-table-east"])
        assert(state.entities.some(e => e.id===id),"Painted restaurant remains: "+id);
      assert(!requests.some(p => /recipes?/.test(p)),"No retired API calls");
      assert.equal(await page.locator(".world-recipe-form,.world-experience--restaurant").count(),0);
      await page.screenshot({path:`.local/restaurant-review/scenery-${width}.png`});
      await page.close();
      console.log(`PASS restaurant scenery/dialogue, no recipe system ${width}×${height}`);
    }
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
