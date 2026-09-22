"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), {execFileSync} = require("node:child_process");
const {chromium} = require("playwright");
const {nearbyPosition,entityScreenPoint} = require("./browser-world.cjs");
const {cleanSave} = require("../public/assets/js/adventure/save");
const world = JSON.parse(fs.readFileSync(".local/build/world.json")), scene = world.scenes.overworld;
const origin = "http://127.0.0.1:47834";
const catalogue = JSON.parse(execFileSync("curl",["-ksS","https://magikitos.ddev.site/api/world/recipes?lang=es"],{encoding:"utf8"}));
const item = {id:123,kind:"recipe",lang:"es",title:"Setas al rescoldo",instructions:"Dora las setas despacito.\n<script>no se ejecuta</script>",
  ingredients:[{id:"mushroom",quantity:250,unit:"g"}],audio:null,duration:0,revision:1,url:"/recetas/123",author:{name:"Duende de prueba",handle:"fixture"},rating:null};
(async()=>{
 const browser=await chromium.launch({channel:"chrome",headless:true,args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]});
 try {
  for(const [width,height] of [[1440,900],[768,1024],[390,844],[320,568],[844,390]]) {
   const page=await browser.newPage({viewport:{width,height},hasTouch:true}),errors=[],votes=[],publications=[];
   const signed=width!==320, saved=cleanSave({scene:"overworld",position:nearbyPosition(scene,{},"restaurant-kitchen"),muted:true},world);
   const profile={id:"a".repeat(32),revision:1,state:saved};
   page.on("pageerror",e=>errors.push(e.message));
   await page.route("**/*",async route=>{
    const u=new URL(route.request().url()),endpoint=u.pathname.split("/").at(-1);
    if(!["127.0.0.1","magikitos.ddev.site"].includes(u.hostname)) return route.abort();
    if(u.pathname.startsWith("/api/")) {
     if(endpoint==="bootstrap") return route.fulfill({json:{ok:true,locale:"es",destinations:{},capabilities:{}}});
     if(endpoint==="identity") return route.fulfill({json:{user:signed?{id:999,name:"Fixture",handle:"fixture"}:null}});
     if(endpoint==="game-state") return route.fulfill({json:{profile,recoveries:[]}});
     if(endpoint==="game-save") return route.fulfill({json:{profile,acknowledgedRevision:1}});
     if(endpoint==="game-account") return route.fulfill({json:{account:{revision:1,avatar:100,inventory:{},setines:0,trust:0,progress:{flags:{}},resources:{}}}});
     if(endpoint==="recipe-publish") {
       const req=route.request(), multipart=req.headers()["content-type"].startsWith("multipart/");
       const payload=multipart?req.postData():req.postDataJSON();publications.push(payload);
       return publications.length===1?route.fulfill({status:503,json:{ok:false,error:"temporarily_unavailable"}}):
         route.fulfill({json:{ok:true,recipe:{...item,title:"Mi receta de prueba"}}});
     }
     if(endpoint==="recipes") return route.fulfill({json:{...catalogue,items:[item],nextCursor:null}});
     if(endpoint==="csrf") return route.fulfill({json:{csrf_token:"fixture"}});
     if(endpoint==="vote") {votes.push(route.request().postDataJSON());return route.fulfill({json:{ok:true,media:5,n:1}});}
     return route.fulfill({status:503,json:{ok:false,error:"isolated_test"}});
    }
    return route.continue();
   });
   await page.addInitScript(({saved,signed})=>{localStorage.setItem("magikitos.adventure",JSON.stringify(saved));
     if(signed)localStorage.setItem("magikitos_session","synthetic-recipe-session");},{saved,signed});
   await page.goto(origin+"/bosque/explorar"); await require("./browser-entry.cjs").enterWorld(page);
   fs.mkdirSync(".local/restaurant-review",{recursive:true});
   await page.screenshot({path:`.local/restaurant-review/world-${width}.png`});
   const p=await entityScreenPoint(page,scene,"restaurant-kitchen"); await page.mouse.click(p.x,Math.max(95,p.y));
   await page.getByRole("button",{name:item.title,exact:true}).click();
   await page.locator(".world-recipe-instructions").waitFor();
   assert.equal(await page.locator(".world-recipe-instructions").textContent(),item.instructions);
   assert.equal(await page.locator("#world-content iframe,#world-content script").count(),0);
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
   await page.locator('.world-rating-choices button[data-value="5"]').click();
   await page.waitForFunction(()=>document.querySelector('.world-rating-choices [aria-pressed="true"]'));
   assert.equal(votes.length,1); assert.equal(votes[0].tipo,"recipe");
   await page.screenshot({path:`.local/restaurant-review/recipe-${width}.png`});
   if(signed) {
     await page.getByRole("button",{name:catalogue.labels.title,exact:true}).click();
     await page.getByRole("button",{name:catalogue.labels.publish,exact:true}).click();
     await page.getByLabel(catalogue.labels.dish,{exact:true}).fill("Mi receta de prueba");
     await page.getByRole("checkbox",{name:"Setas",exact:true}).check();
     await page.getByLabel(catalogue.labels.preparation,{exact:true}).fill("Dora las setas poco a poco.");
     if(width===390) {
       await page.getByRole("button",{name:catalogue.labels.record,exact:true}).click();
       await page.getByRole("button",{name:catalogue.labels.stop,exact:true}).waitFor();
       await new Promise(resolve=>setTimeout(resolve,2300));
       await page.getByRole("button",{name:catalogue.labels.stop,exact:true}).click();
       await page.locator('.world-recipe-form audio[src^="blob:"]').waitFor();
     }
     await page.screenshot({path:`.local/restaurant-review/composer-${width}.png`});
     const publish=page.getByRole("button",{name:catalogue.labels.send,exact:true});
     await publish.click();
     await page.getByText(catalogue.labels.error,{exact:true}).waitFor();
     assert(await page.getByLabel(catalogue.labels.dish,{exact:true}).isDisabled(),"Ambiguous publication freezes its exact draft");
     await publish.click(); await page.getByRole("heading",{name:"Mi receta de prueba",exact:true}).waitFor();
     assert.equal(publications.length,2);
     if(width!==390) assert.deepEqual(publications[0],publications[1],"Retry retains operation and complete payload");
     else {
       const ids=publications.map(p=>p.match(/"operationId":"([a-f0-9]+)"/)[1]);
       assert.equal(ids[0],ids[1],"Multipart audio retry retains operation");
       assert(publications.every(p=>p.includes('name="audio"')),"Real browser recording is uploaded");
     }
   }
   await page.keyboard.press("Escape"); assert(!await page.locator("#world-content").isVisible());
   assert.deepEqual(errors,[]);
   console.log(`PASS restaurant ${width}×${height}: real artwork, native card, ingredient-free reading/voting, safe text, no overflow, dismissal.`);
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
