"use strict";
// Real browser + real loopback seat authority; HTTP mutations are an isolated fixture.
// PHP/SQL authority and single-use/replay validation live in check-forest-live-api.cjs.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { build } = require("esbuild");
const fs = require("node:fs");
const { liveContract } = require("../tools/live-contract.cjs");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { catalogGround } = require("../public/assets/js/adventure/construction-ground");
const { freeSpot } = require("./community-spot.cjs");
const { liveDaemon, routeLiveWebsite } = require("./browser-live.cjs");
const { enterWorld } = require("./browser-entry.cjs");
const { protocol } = require("../public/assets/js/adventure/forest-connection");
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) throw Error("Loopback only");
const daemon = liveDaemon();
if (!daemon) { console.log("SKIP: adjacent private live authority absent"); process.exit(0); }
(async () => {
  const world = JSON.parse(fs.readFileSync(".local/build/world.json")), scene = "river-willows";
  const zone = Object.keys(world.construction.zones).find(k => world.construction.zones[k].scene === scene);
  const kind = "twig-fence", variant = world.construction.definitions[kind].variants[0].id;
  const spot = freeSpot({ catalog: world.construction, zone, ground: catalogGround(world, scene),
    make: (x,y) => ({ id: "nueva", kind, variant, x, y, rotation: 0, points: [[0,0],[2,0]] }) });
  assert(spot);
  const secret = "construction-browser-only-synthetic-secret";
  const bundled = await build({ entryPoints: ["public/assets/js/aventura.js"], bundle: true, write: false });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  try {
    for (const [width,height] of [[1440,900],[390,844]]) {
      const service = daemon.createLiveServer({ secret, scenes: liveContract(world).scenes,
        origins: [origin], limits: { ...protocol.limits, players: 1 } });
      const { port } = await service.listen(0);
      const context = await browser.newContext({ viewport: { width,height }, hasTouch: width < 900 });
      await context.grantPermissions(["local-network-access"], { origin });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      page.on("pageerror", e => errors.push(e.message));
      let saved = cleanSave({ scene, position: { x: spot.x*16,y:(spot.y+3)*16 }, muted: true }, world);
      let revision = 1, grants = 0, writes = 0;
      const bank = { revision: 1, inventory: { twig: 100, rake: 1 }, setines: 0, progress: { flags: {} }, resources: {} };
      let snapshot = { zone, revision: 0, now: Date.now(), objects: [], clock: 0 };
      const permit = "a".repeat(32);
      const profile = () => ({ id: "1".padStart(32,"0"), revision, state: saved });
      try {
        await page.addInitScript(s => {
          localStorage.setItem("magikitos_session","synthetic-construction-browser");
          localStorage.setItem("magikitos.adventure",JSON.stringify(s));
        }, saved);
        await routeLiveWebsite(page, { origin, port, bundled, user: 1, secret,
          state: { saved: () => saved, profile, account: () => bank, needs: () => ({}),
            save: state => { saved=state; revision++; return { profile:profile(), acknowledgedRevision:revision }; } },
          async extra(endpoint,route) {
            if (endpoint === "community") return snapshot;
            if (endpoint === "community-access") return { allowed: service.presence.seats.role(1) === "player" };
            if (endpoint === "community-permit") {
              if (service.presence.seats.role(1) !== "player") {
                await route.fulfill({ status:403,contentType:"application/json",body:JSON.stringify({ok:false,error:"live_player_required"}) });
                return "handled";
              }
              grants++; return { permit };
            }
            if (endpoint === "community-build") {
              const request=route.request().postDataJSON();
              assert.equal(service.presence.seats.role(1),"spectator","Finish occurs AFTER demotion");
              assert.equal(request.permit,permit); assert.equal(grants,1);
              writes++; bank.revision++; bank.inventory.twig-=4;
              snapshot={ ...snapshot, revision:snapshot.revision+1, objects:[{...request.object,id:"b".repeat(32),revision:1,mine:true,createdAt:Date.now(),author:{name:"Test"}}] };
              return {...snapshot,account:bank};
            }
          } });
        await page.goto(origin+"/bosque/explorar"); await enterWorld(page);
        await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.role === "player");
        await page.locator("#build-toggle").click();
        await page.locator("#home-palette button").filter({hasText:"Vallita de ramitas"}).first().click();
        await page.waitForFunction(() => window.MagikitosAdventure.inspect().community.editing && !document.getElementById("build-dialog").open);
        const tap = async (x,y) => {
          const p=await page.evaluate(({x,y}) => {
            const s=window.MagikitosAdventure.inspect(),r=document.getElementById("world-canvas").getBoundingClientRect();
            return {x:r.x+(x*16-s.camera.x)*r.width/s.view.width,y:r.y+(y*16-s.camera.y)*r.height/s.view.height};
          },{x,y});
          if(width<900) await page.touchscreen.tap(p.x,p.y); else await page.mouse.click(p.x,p.y);
        };
        await tap(spot.x,spot.y); await tap(spot.x+2,spot.y);
        assert(await page.locator("#home-save").isEnabled());
        service.presence.seats.connect(2,scene,100);
        await page.waitForFunction(() => window.MagikitosAdventure.inspect().live.role === "spectator");
        assert(await page.locator("#home-save").isEnabled(),"Demotion keeps the current fence editable");
        assert(await page.locator("#dialogue").isHidden(),"No premature queue notice");
        await page.locator("#home-save").click();
        await page.waitForFunction(() => window.MagikitosAdventure.inspect().community.objects.length === 1 && !!window.MagikitosAdventure.inspect().dialogue);
        assert.equal(writes,1); assert.equal(bank.inventory.twig,96);
        assert.match(await page.locator("#dialogue-text").textContent(),/setines|reputaci/i);
        assert(!(await page.evaluate(() => window.MagikitosAdventure.inspect().community.editing)),"No new action after the saved fence");
        assert.equal(grants,1);
        console.log(`PASS construction permit ${width}×${height}: draw → demote → save → deny next; one debit`);
      } catch (error) {
        console.error(error);
        console.error(await page.evaluate(() => ({ community:window.MagikitosAdventure?.inspect().community,
          notice:document.getElementById("world-toast")?.textContent })).catch(() => null));
        throw error;
      } finally { await context.close(); await service.close(); }
    }
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
