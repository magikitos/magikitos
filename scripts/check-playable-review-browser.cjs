"use strict";
/** Offline art review through the REAL sprite/vessel renderer; never registers or deploys. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..');
const key=process.argv.find(v=>v.startsWith('--character='))?.slice(12);
assert(/^[a-z]+-[a-z]+$/.test(key),'Use --character=profile-key');
const name=process.argv.includes('--webkit')?'webkit':'chrome';
const dir=path.join(root,'data/aventura/art/playable-cast',key,'review');
const report=JSON.parse(fs.readFileSync(path.join(dir,'review.json')));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/assets/aventura/manifest.json')));
for(const value of Object.values(manifest.packs))for(const f of ['image','metadata'])value[f]='/public/assets/aventura/'+value[f];
for(const [id,value]of Object.entries(report.packs))manifest.packs[id]={...value,image:'/review/'+value.image,metadata:'/review/'+value.metadata};
const code=esbuild.buildSync({bundle:true,write:false,platform:'browser',stdin:{resolveDir:root,contents:`
const {SpriteLibrary}=require('./public/assets/js/adventure/sprites');
const {VesselArt,definition,vesselLayers}=require('./public/assets/js/adventure/vessel-art');
const {rowingRigs}=require('./public/assets/js/adventure/player-art');
window.artReview={SpriteLibrary,VesselArt,definition,vesselLayers,rowingRigs};`}}).outputFiles[0].text;
(async()=>{
 const browser=await(name==='webkit'?webkit:chromium).launch({headless:true,...(name==='chrome'?{channel:'chrome'}:{})});
 const results=[];const output=path.join(dir,'browser-'+name);fs.mkdirSync(output,{recursive:true});
 try {
  const page=await browser.newPage({viewport:{width:1728,height:864}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://art-review.local/**',async route=>{
   const pathname=decodeURIComponent(new URL(route.request().url()).pathname);
   if(pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#466e65"><canvas id="art" width="1728" height="832"></canvas></body></html>'});
   if(pathname==='/manifest.json')return route.fulfill({json:manifest});
   const file=pathname.startsWith('/review/')?path.resolve(dir,pathname.slice(8)):path.resolve(root,'.'+pathname);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Missing local art'});
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'application/json'});
  });
  await page.goto('http://art-review.local/');await page.addScriptTag({content:code});
  await page.evaluate(async report=>{
   const r=window.artReview;
   r.definition.rigs[report.key]=report.rowingRig;r.definition.bodies[report.key]=report.rowingBody;r.rowingRigs[report.variant]=report.key;
   const sprites=new r.SpriteLibrary();await sprites.initialize('/manifest.json');
   const packs=await sprites.prepare([],Object.keys(report.packs));sprites.activate(packs);
   window.r={...r,sprites,art:new r.VesselArt(sprites),variant:report.variant,packs:Object.keys(report.packs)};
  },report);
  const vessels=await page.evaluate(()=>Object.keys(window.r.definition.vessels));
  for(const vessel of vessels){
   const result=await page.evaluate(async vessel=>{
    const r=window.r,packs=await r.sprites.prepare([],[...r.packs,r.definition.vessels[vessel].pack]);r.sprites.activate(packs);
    const canvas=document.querySelector('#art'),c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
    const headings=Object.keys(r.definition.vessels[vessel].views);let count=0,wetPhases=0;
    const scratch=document.createElement('canvas');scratch.width=scratch.height=160;const sc=scratch.getContext('2d',{willReadFrequently:true});
    const capture=(layers,water)=>{sc.clearRect(0,0,160,160);sc.save();sc.scale(2,2);r.art.draw(sc,{x:40,y:40},layers,{water});sc.restore();return sc.getImageData(0,0,160,160).data;};
    for(let phase=0;phase<4;phase++)for(let col=0;col<8;col++){
     const direction=headings[col],layers=r.vesselLayers({variant:r.variant,direction},phase,vessel);
     c.save();c.translate(col*216+108,phase*208+125);c.scale(3,3);
     if(!r.art.draw(c,{x:0,y:0},layers))throw Error('Missing vessel composition');c.restore();
     const wet=capture(layers,true),dry=capture(layers,false);let changed=0;
     for(let i=0;i<wet.length;i++)if(wet[i]!==dry[i])changed++;
     if(changed)wetPhases++;
     const bounds=r.art.bounds(layers);if(bounds.w>128||bounds.h>128)throw Error('Vessel overflow');
     c.font='13px monospace';c.fillStyle='#f9e7c1';c.fillText(direction+' / '+phase,col*216+8,(phase+1)*208-12);count++;
    }
    return {vessel,count,wetPhases,scratchBytes:r.art.canvas.width*r.art.canvas.height*8};
   },vessel);
   assert.equal(result.count,32);assert(result.wetPhases>0,'Measured paddles must actually reach water');assert.equal(result.scratchBytes,524288);
   results.push(result);await page.locator('#art').screenshot({path:path.join(output,vessel+'.png')});
  }
  for(const [label,width,height]of [['desktop',1440,900],['tablet',768,1024],['mobile',390,844]]){
   await page.setViewportSize({width,height});
   const result=await page.evaluate(async({width,height})=>{
    const r=window.r,packs=await r.sprites.prepare([],[...r.packs,r.definition.vessels.bottle.pack]);r.sprites.activate(packs);
    const canvas=document.querySelector('#art');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');let rendered=0;
    const headings=Object.keys(r.definition.vessels.bottle.views);
    for(let phase=0;phase<4;phase++)for(let i=0;i<8;i++){
     c.clearRect(0,0,width,height);c.fillStyle='#638f8b';c.fillRect(0,0,width,height);
     c.save();c.translate(width/2,height/2);c.scale(3,3);r.art.draw(c,{x:0,y:0},r.vesselLayers({variant:r.variant,direction:headings[i]},phase,'bottle'));c.restore();rendered++;
     await new Promise(requestAnimationFrame);
    }
    let poses=0;for(const pack of r.packs)for(const frame of Object.keys(r.sprites.packs.get(pack).frames)){
     const f=r.sprites.frame(frame);c.clearRect(0,0,width,height);r.sprites.draw(c,frame,width/2-f.w*1.5,height/2-f.h*1.5,f.w*3,f.h*3);poses++;
    }
    return {rendered,poses,overflow:document.documentElement.scrollWidth>width};
   },{width,height});
   assert.equal(result.rendered,32);assert.equal(result.poses,156);assert.equal(result.overflow,false);results.push({label,...result});
   await page.screenshot({path:path.join(output,label+'.png')});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify({key,browser:name,results,errors},null,2)+'\n');
  console.log(JSON.stringify({key,browser:name,boats:vessels.length,compositions:vessels.length*32,posesPerViewport:156,viewports:3,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
