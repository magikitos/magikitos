"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const { chromium } = require("playwright");
const { nearbyPosition, entityScreenPoint } = require("./browser-world.cjs");
const world = JSON.parse(fs.readFileSync(".local/build/world.json"));
const origin = process.env.GAME_ORIGIN || "http://127.0.0.1:47834";
const readOnly = process.env.SETOMETRO_READ_ONLY === "1";
const scene = world.scenes.overworld;
const pair = [{id:12,title:"El sabor de una tortilla recién hecha",score:1400},
  {id:34,title:"La alegría de volver a casa",score:1390}];
const day = "2026-09-21";
const text = key => require("../data/aventura/locales/core.json")[key].es;
(async () => {
  const browser = await chromium.launch({channel:"chrome",headless:true});
  try {
    for (const [width,height] of [[1440,900],[768,1024],[390,844],[320,568],[844,390]]) {
      const page = await browser.newPage({viewport:{width,height},hasTouch:true,ignoreHTTPSErrors:true});
      page.setDefaultTimeout(20000);
      const errors=[], votes=[], reads=[];
      let failure=0, delay=0;
      page.on("pageerror",e=>errors.push(e.message));
      await page.route("**/*",async route=>{
        const url=new URL(route.request().url()), endpoint=url.pathname.split("/").at(-1);
        if(![new URL(origin).hostname,"magikitos.ddev.site"].includes(url.hostname)) return route.abort();
        if(readOnly && !["GET","HEAD"].includes(route.request().method()))
          return route.fulfill({status:503,json:{ok:false,error:"read_only_review"}});
        if(url.pathname.startsWith("/api/")) {
          if(readOnly) {
            if(route.request().method()==="GET" && ["bootstrap","setometro","setometro-ranking"].includes(endpoint))
              return route.continue();
            return route.fulfill({status:503,json:{ok:false,error:"read_only_review"}});
          }
          if(endpoint==="bootstrap") return route.fulfill({json:{ok:true,locale:"es",destinations:{},capabilities:{}}});
          if(endpoint==="setometro") return route.fulfill({json:{ok:true,day,pair}});
          if(endpoint==="csrf") return route.fulfill({json:{csrf_token:"fixture-only"}});
          if(endpoint==="setometro-ranking") {
            const offset=Number(url.searchParams.get("cursor")||0); reads.push(offset);
            return route.fulfill({json:{ok:true,offset,nextCursor:offset?null:24,
              items:Array.from({length:offset?1:24},(_,i)=>({id:offset+i+1,title:"Concepto "+(offset+i+1),score:2000-offset-i}))}});
          }
          if(endpoint==="setometro-vote") {
            const body=route.request().postDataJSON(); votes.push(body);
            if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
            if(failure) return route.fulfill({status:failure,json:{ok:false,error:failure===409?"daily_changed":"daily_limit"}});
            return route.fulfill({json:{success:true,winner:{id:body.winner_id,sta_value:1410},loser:{id:body.loser_id,sta_value:1380}}});
          }
          return route.fulfill({status:503,json:{ok:false,error:"isolated_test"}});
        }
        return route.continue();
      });
      await page.addInitScript(state=>localStorage.setItem("magikitos.adventure",JSON.stringify(state)),
        {scene:"overworld",position:nearbyPosition(scene,{},"setometro-balance"),muted:true,flags:{}});
      await page.goto(origin+"/bosque/explorar");
      await require("./browser-entry.cjs").enterWorld(page);
      const open=async()=>{
        const p=await entityScreenPoint(page,scene,"setometro-balance");
        await page.mouse.click(p.x,p.y); await page.locator(".world-scale-pan").first().waitFor();
      };
      await open();
      assert.equal(await page.locator(".world-scale-pan").count(),2);
      assert.equal(await page.locator("#world-content iframe,#world-content script").count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      fs.mkdirSync(".local/screenshots",{recursive:true});
      await page.screenshot({path:".local/screenshots/setometro-"+width+".png"});
      if(readOnly) {
        await page.getByRole("button",{name:text("setometroRanking"),exact:true}).click();
        await page.locator(".world-scale-ranking li").first().waitFor();
        assert((await page.locator(".world-scale-ranking li").count())<=24);
        assert(!await page.locator("#world-content iframe").count());
        await page.screenshot({path:".local/screenshots/setometro-ranking-live-"+width+".png"});
        await page.keyboard.press("Escape");
        assert(!await page.locator("#world-content").isVisible());
        assert.deepEqual(errors,[]);
        console.log("PASS read-only real Setómetro "+width+"×"+height+": real daily/ranking, no writes.");
        await page.close(); continue;
      }
      const before=await page.evaluate(()=>window.MagikitosAdventure.inspect().inventory);
      delay=300;
      await page.locator(".world-scale-pan").first().evaluate(b=>{b.click();b.click();});
      await page.waitForFunction(()=>document.querySelector('.world-scale-pan[aria-pressed="true"]'));
      assert.equal(votes.length,1,"Double click sends only one write");
      assert.deepEqual(votes[0],{lang:"es",day,winner_id:12,loser_id:34,csrf_token:"fixture-only",turnstile_token:""});
      assert.equal(await page.locator(".world-scale-pan:disabled").count(),2);
      assert.deepEqual(await page.evaluate(()=>window.MagikitosAdventure.inspect().inventory),before,"Voting never grants bag mushrooms");
      await page.getByRole("button",{name:text("setometroRanking"),exact:true}).click();
      await page.locator(".world-scale-ranking li").first().waitFor();
      assert.equal(await page.locator(".world-scale-ranking li").count(),24);
      await page.getByRole("button",{name:text("more"),exact:true}).click();
      await page.waitForFunction(()=>document.querySelectorAll(".world-scale-ranking li").length===25);
      assert.deepEqual(reads,[0,24]);
      await page.screenshot({path:".local/screenshots/setometro-ranking-"+width+".png"});
      await page.keyboard.press("Escape");
      assert(!await page.locator("#world-content").isVisible());
      await open();
      assert.equal(await page.locator(".world-scale-pan:disabled").count(),2,"Confirmed vote survives closing");
      if(width===1440) {
        await page.keyboard.press("Escape");
        await page.evaluate(()=>localStorage.removeItem("magikitos.setometro.daily"));
        failure=409; delay=0; await open();
        await page.locator(".world-scale-pan").first().click();
        await page.getByRole("button",{name:"Reintentar",exact:true}).waitFor();
        await page.getByRole("button",{name:"Reintentar",exact:true}).click();
        await page.locator(".world-scale-pan").first().waitFor();
        failure=429;
        await page.locator(".world-scale-pan").first().click();
        await page.waitForFunction(()=>document.querySelector(".world-scale-status").textContent.includes("mañana"));
        assert.equal(await page.locator(".world-scale-pan:disabled").count(),0,"Rejected vote cannot mark success");
        failure=0; delay=1500;
        await page.locator(".world-scale-pan").first().click();
        await page.waitForTimeout(100);
        await page.keyboard.press("Escape"); await open();
        await page.waitForFunction(()=>document.querySelector('.world-scale-pan[aria-pressed="true"]'));
        assert.equal(await page.locator(".world-scale-pan:disabled").count(),2,"Late receipt reaches a reopened surface");
      }
      assert.deepEqual(errors,[]);
      await page.keyboard.press("Escape");
      await page.screenshot({path:".local/screenshots/balance-world-"+width+".png"});
      console.log("PASS Setómetro "+width+"×"+height+": native daily/ranking, keyboard, pagination, one in-flight vote, receipt, unchanged inventory, no embedded HTML/overflow.");
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
