"use strict";
const { build } = require("esbuild");
const { chromium } = require("playwright");
const fs = require("node:fs");
(async () => {
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
    const {SpriteLibrary}=require('./public/assets/js/adventure/sprites');
    const {drawArtwork}=require('./public/assets/js/adventure/entity-art');
    const {CatEncounters}=require('./public/assets/js/adventure/cat-encounters');
    window.reviewCats=async(manifest)=>{
      const sprites=new SpriteLibrary();await sprites.initialize(manifest);
      const packs=await sprites.prepare([],['cat-ginger','actor-0-carried']);sprites.activate(packs);
      const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
      ctx.fillStyle='#778956';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.scale(3,3);
      ['down','down-right','right','up-right','up','up-left','left','down-left'].forEach((direction,i)=>{
        const cat={x:65+(i%4)*125,y:75+Math.floor(i/4)*125,direction,elapsed:0};
        const carried=CatEncounters.prototype.carried.call({carrier:cat});
        const figures=[{...cat,sprite:'cat-ginger-'+direction+'-2'},carried].sort((a,b)=>(a.depth??a.y)-(b.depth??b.y));
        for(const e of figures)drawArtwork(ctx,sprites,e,e.sprite);
        ctx.fillStyle='#172d21';ctx.font='9px sans-serif';ctx.fillText(direction,cat.x-25,cat.y+45);
      });
    };` }, bundle: true, write: false });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 750 } });
    await page.goto("http://127.0.0.1:47834/aventura");
    const manifest = await page.evaluate(() => JSON.parse(document.querySelector("#adventure-config").textContent).assetManifest);
    await page.setContent('<canvas width="1500" height="750"></canvas><style>body{margin:0}</style>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(url => window.reviewCats(url), new URL(manifest, "http://127.0.0.1:47834").href);
    fs.mkdirSync(".local/cat-review", { recursive: true });
    await page.screenshot({ path: ".local/cat-review/registration.png" });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
