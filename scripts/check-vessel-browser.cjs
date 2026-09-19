"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs");
const playwright = require("playwright"), esbuild = require("esbuild");
const browserName = process.argv.find(arg => arg.startsWith("--browser="))?.split("=")[1] || "chromium";
assert(["chromium", "webkit", "firefox"].includes(browserName));
const origin = "http://127.0.0.1:47834";
const variant = Number(process.argv.find(arg => arg.startsWith("--variant="))?.split("=")[1] || 100);
const vessel = process.argv.find(arg => arg.startsWith("--vessel="))?.split("=")[1] || "bottle";
assert(Object.hasOwn(require("../data/aventura/rowing.json").vessels, vessel), "Choose a registered hull");
const label = process.argv.find(arg => arg.startsWith("--label="))?.split("=")[1] || "current";
assert(/^[a-z0-9-]+$/.test(label));
const reviewDir = `.local/vessel-art-reviews/${variant}/${label}`;
const rowSheet = require("../data/aventura/art/residents/actions/catalog.json").sheets.find(s => s.variant === variant && s.action === "row");
assert(rowSheet, "Choose a rower with accepted art");
// These are authored visual occlusions, not exemptions from clipping correctness:
// an occluded oar must have NO wood outside the protected body; a blade crossing
// the transom must overlap real hull pixels, never fake immersion over plastic.
const occludedOars = rowSheet.occludedOars || {}, hullSupportedOars = rowSheet.hullSupportedOars || {};
// A concurrent Studio/agent build may advance current.json during art review.
// Pin the immutable artifact so the atlas under test cannot silently change.
const id = process.argv.find(arg => arg.startsWith("--release="))?.split("=")[1] ||
  JSON.parse(fs.readFileSync(".local/build/current.json")).id;
assert(/^[a-f0-9]{20}$/.test(id), "Choose an immutable local release");
const code = esbuild.buildSync({ bundle: true, write: false, platform: "browser", stdin: {
  resolveDir: process.cwd(), contents: `
    const {SpriteLibrary}=require('./public/assets/js/adventure/sprites');
    const {VesselArt,vesselLayers,definition}=require('./public/assets/js/adventure/vessel-art');
    const {rowingRigs}=require('./public/assets/js/adventure/player-art');
    window.review={SpriteLibrary,VesselArt,vesselLayers,definition,rowingRigs};`
} }).outputFiles[0].text;
(async () => {
  const browser = await playwright[browserName].launch({
    ...(browserName === "chromium" ? { channel: "chrome" } : {}), headless: true,
  });
  fs.mkdirSync(".local/vessel-art-reviews", { recursive: true });
  fs.mkdirSync(reviewDir, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1728, height: 860 } });
    await page.route("**/review-vessels", r => r.fulfill({ contentType: "text/html", body:
      '<html><body style="margin:0;background:#5b8a8f"><canvas id="review" width="1728" height="860"></canvas></body></html>' }));
    await page.goto(origin + "/review-vessels"); await page.addScriptTag({ content: code });
    const result = await page.evaluate(async ({id,variant,vessel}) => {
      const {SpriteLibrary,VesselArt,vesselLayers,definition,rowingRigs}=window.review;
      const sprites = new SpriteLibrary();
      await sprites.initialize('/game/releases/'+id+'/assets/aventura/manifest.json');
      const packs=await sprites.prepare([],[definition.vessels[vessel].pack,'actor-'+variant+'-row']); sprites.activate(packs);
      const art=new VesselArt(sprites), canvas=document.querySelector('#review'), c=canvas.getContext('2d');
      const rigCanvas=document.createElement('canvas');rigCanvas.id='rigs';rigCanvas.width=1728;rigCanvas.height=860;
      document.body.append(rigCanvas);const rc=rigCanvas.getContext('2d');
      const directions=Object.keys(definition.vessels[vessel].views), comparisons=[];
      const sample=document.createElement('canvas'); sample.width=sample.height=160;
      const sc=sample.getContext('2d',{willReadFrequently:true});
      const capture=(layers,options)=>{
        sc.clearRect(0,0,160,160); sc.save();sc.scale(2,2);
        art.draw(sc,{x:40,y:40},layers,options); sc.restore();
        return sc.getImageData(0,0,160,160).data;
      };
      const rowerSurface=layers=>{
        const b=art.bounds(layers);
        sc.clearRect(0,0,160,160);sc.save();sc.scale(2,2);sc.imageSmoothingEnabled=false;
        sc.drawImage(art.canvas,0,0,b.w*2,b.h*2,40+b.x,40+b.y,b.w,b.h);sc.restore();
        return sc.getImageData(0,0,160,160).data;
      };
      let stable=true, allocations=0;
      let floorOpaque=true;
      for(let phase=0;phase<4;phase++) for(let col=0;col<8;col++) {
        const direction=directions[col],layers=vesselLayers({variant,direction},phase,vessel);
        sc.clearRect(0,0,160,160);sc.save();sc.scale(2,2);
        const hullFrame=sprites.frame(layers.hull);
        sprites.draw(sc,layers.hull,40-hullFrame.anchor[0],40-hullFrame.anchor[1]);sc.restore();
        const hullPixels=sc.getImageData(0,0,160,160).data;
        if(phase===0) {
          sc.clearRect(0,0,160,160);sc.save();sc.scale(2,2);
          const f=sprites.frame(layers.hull);
          sprites.draw(sc,layers.hull,40-f.anchor[0],40-f.anchor[1]);sc.restore();
          const rgba=sc.getImageData(0,0,160,160).data;
          for(const [x,y] of [[80,80],[74,80],[86,80],[80,88],[74,88],[86,88]])
            floorOpaque &&= rgba[(y*160+x)*4+3]>=242;
        }
        c.save();c.translate(col*216+108,phase*215+128);c.scale(3,3);
        art.draw(c,{x:0,y:0},layers);c.restore();
        c.fillStyle='#f2e9cb';c.font='12px monospace';c.fillText(direction+' / '+phase,col*216+12,(phase+1)*215-18);
        const full=capture(layers),wetRower=rowerSurface(layers),
          dry=capture(layers,{water:false}),dryRower=rowerSurface(layers),
          unmasked=capture(layers,{occlusion:false,water:false}),unmaskedRower=rowerSurface(layers);
        let water=0,hidden=0,head=0;
        for(let i=0;i<full.length;i+=4) {
          const x=(i/4)%160,y=Math.floor(i/4/160);
          if(full.slice(i,i+4).some((v,k)=>v!==dry[i+k])) water++;
          // Far blades legitimately project above the body's screen baseline.
          // Protect the actual dry character outside blade caps, not an arbitrary y band.
          if(wetRower.slice(i,i+4).some((v,k)=>v!==dryRower[i+k]) &&
            !art.masks(layers).blades.some(b=>[-.5,0,.5].some(dx=>[-.5,0,.5].some(dy=>
              sc.isPointInPath(b.cap,x/2-40+dx,y/2-40+dy))))) head++;
          if(dry.slice(i,i+4).some((v,k)=>v!==unmasked[i+k])) hidden++;
        }
        // Check each measured blade against the original character pixels, not just the
        // composed hull. A mask in empty water could otherwise pass on its ripple alone.
        sc.clearRect(0,0,160,160); sc.save(); sc.scale(2,2);
        const rower=sprites.frame(layers.rower);
        sc.translate(40,40); art.drawRower(sc,layers); sc.restore();
        const original=sc.getImageData(0,0,160,160).data;
        const masks=art.masks(layers);
        let bodyDamaged=0, unprotectedDamage=0;
        if(masks.body) {
          const outside=masks.outsideBody;
          masks.outsideBody=null;
          capture(layers,{water:false});
          const unprotected=rowerSurface(layers);
          masks.outsideBody=outside;
          for(let y=0;y<74;y++) for(let x=0;x<160;x++) {
            const i=(y*160+x)*4,wx=x/2-40,wy=y/2-40;
            if(unmaskedRower[i+3]!==255 || ![-1,0,1].every(dx=>[-1,0,1].every(dy=>sc.isPointInPath(masks.body,wx+dx,wy+dy)))) continue;
            if(unmaskedRower.slice(i,i+4).some((v,k)=>v!==dryRower[i+k])) bodyDamaged++;
            if(unmaskedRower.slice(i,i+4).some((v,k)=>v!==unprotected[i+k])) unprotectedDamage++;
          }
        }
        const bladeContact=art.masks(layers).blades.map(blade=>{
          let ink=0, outsideBodyInk=0, hullInk=0, waterInk=0, hullWater=0, submerged=0, blurredInterior=0, dryChanged=0;
          for(let y=0;y<160;y++) for(let x=0;x<160;x++) {
            const i=(y*160+x)*4;
            if(original[i+3]>220 && original[i]>80 && original[i+1]>40 &&
              original[i+2]<original[i+1]*0.85 && sc.isPointInPath(blade.path,x/2-40,y/2-40)) {
              ink++;
              if(!masks.body || !sc.isPointInPath(masks.body,x/2-40,y/2-40)) outsideBodyInk++;
              if(hullPixels[i+3]>220) hullInk++;
              const depth=(y/2-40-blade.waterline)*blade.waterSide;
              if (depth >= 0 && hullPixels[i+3]<24) waterInk++;
              // Exclude the one texture-pixel antialiased boundary, never accept a
              // broad semi-transparent patch inside a submerged wooden blade.
              // Brown skin/cloth beneath a projected far blade is not submerged wood.
              // Body integrity is asserted separately above; exclude its antialiased edge too.
              const outsideBody = !masks.body || [-.5,0,.5].every(dx=>[-.5,0,.5].every(dy=>
                !sc.isPointInPath(masks.body,x/2-40+dx,y/2-40+dy)));
              if(depth>1 && hullPixels[i+3]===0 && dryRower[i+3]>250 && outsideBody) {
                submerged++;
                if(wetRower[i+3]!==0) blurredInterior++;
              }
              if(depth < -1 &&
                wetRower.slice(i,i+4).some((v,k)=>v!==dryRower[i+k])) dryChanged++;
            }
            if(hullPixels[i+3]===255 && full.slice(i,i+4).some((v,k)=>v!==dry[i+k])) hullWater++;
          }
          return {ink,outsideBodyInk,hullInk,waterInk,hullWater,submerged,blurredInterior,dryChanged};
        });
        const bladeInk=bladeContact.map(p=>p.ink);
        rc.save();rc.translate(col*216+108,phase*215+128);rc.scale(3,3);
        art.drawRower(rc,layers);
        art.masks(layers).blades.forEach((blade,i)=>{rc.strokeStyle=i?'#00ffff':'#ff6677';rc.lineWidth=.35;rc.stroke(blade.path);});
        rc.restore();rc.fillStyle='#f2e9cb';rc.font='12px monospace';
        rc.fillText(direction+' / '+phase,col*216+12,(phase+1)*215-18);
        // Offline authoring aid only: locate the gold blade near its authored landmark.
        // It never changes runtime masks or the atlas; proposed points still need visual review.
        const measured=definition.rigs[rowingRigs[variant]][direction][phase].map(([gx,gy,tx,ty,radius,length])=>{
          const {scale,offset}=art.masks(layers).placement;
          gx=gx*scale+offset[0];gy=gy*scale+offset[1];tx=tx*scale+offset[0];ty=ty*scale+offset[1];
          const half=length*scale/2,angle=Math.atan2(ty-gy,tx-gx),cx=tx-Math.cos(angle)*half,cy=ty-Math.sin(angle)*half;
          let sx=0,sy=0,weight=0;
          for(let y=0;y<160;y++) for(let x=0;x<160;x++){
            const wx=x/2-40,wy=y/2-40,i=(y*160+x)*4,r=original[i],g=original[i+1],b=original[i+2];
            const body=art.masks(layers).body;
            if(original[i+3]>220 && r>145 && g>70 && b<g*.62 &&
              (wx-gx)*(tx-gx)+(wy-gy)*(ty-gy)>0 && (!body || !sc.isPointInPath(body,wx,wy)) &&
              Math.hypot(wx-cx,wy-cy)<8 && Math.hypot(wx-gx,wy-gy)>6){
              const w=(r-80)**2;sx+=wx*w;sy+=wy*w;weight+=w;
            }
          }
          if(!weight)return null;
          const x=sx/weight,y=sy/weight,a=Math.atan2(y-gy,x-gx);
          return [gx,gy,x+Math.cos(a)*half,y+Math.sin(a)*half]
            .map((v,i)=>Math.round((v-offset[i%2])/scale*2)/2).concat([radius,length]);
        });
        comparisons.push({direction,phase,water,hidden,head,bodyDamaged,unprotectedDamage,bladeInk,bladeContact,far:art.masks(layers).far,measured});
        stable&&=art.masks(layers)===art.masks(layers);
      }
      const scratch=art.canvas;
      const layers=vesselLayers({variant,direction:'right'},2,vessel),start=performance.now();
      for(let i=0;i<500;i++) art.draw(sc,{x:40,y:40},layers);
      allocations += art.canvas !== scratch;
      window.vesselReview={art,sprites,directions,vesselLayers,variant,vessel};
      return {comparisons,stable,allocations,floorOpaque,scratchBytes:scratch.width*scratch.height*4,
        waterScratchBytes:art.waterCanvas.width*art.waterCanvas.height*4,
        ms500:performance.now()-start,bytes:sprites.residency.bytes};
    }, { id, variant, vessel });
    await page.locator('#review').screenshot({path:'.local/vessel-art-reviews/'+vessel+'-'+variant+'-clipped.png'});
    await page.locator('#rigs').screenshot({path:reviewDir+'/rig.png'});
    await page.locator('#review').screenshot({path:reviewDir+'/all-32.png'});
    const directions=Object.keys(require('../data/aventura/rowing.json').vessels[vessel].views);
    for(let phase=0;phase<4;phase++) for(let col=0;col<8;col++)
      await page.screenshot({path:`${reviewDir}/${directions[col]}-${phase}.png`,
        clip:{x:col*216,y:phase*215,width:216,height:215}});
    fs.writeFileSync(reviewDir+'/measurements.json',JSON.stringify(result,null,2)+'\n');
    if(process.argv.includes('--measure')) {
      console.log(JSON.stringify(result.comparisons.map(p=>({direction:p.direction,phase:p.phase,measured:p.measured}))));
      return;
    }
    assert(result.stable && result.allocations === 0);
    assert(result.floorOpaque,"All eight real atlas hulls have a closed solid floor");
    assert.equal(result.scratchBytes,256*1024);
    assert.equal(result.waterScratchBytes,256*1024);
    for(const p of result.comparisons) {
      for(let i=0;i<2;i++) {
        if(occludedOars[p.direction]?.[p.phase]?.includes(i)) {
          assert([0,3].includes(p.phase), 'Full head occlusion belongs to the dry catch/recovery');
          assert.equal(p.far,i,'Only the far oar may be hidden behind the head');
          assert.equal(p.bladeContact[i].outsideBodyInk,0,`No exposed wood from the occluded oar ${p.direction}/${p.phase}/${i}`);
        } else assert(p.bladeInk[i]>=48,`Visible blade mask covers actual wood ${p.direction}/${p.phase}/${i}: ${p.bladeInk[i]}`);
      }
      assert.equal(p.head,0,`Immersion must not affect head/body ${p.direction}/${p.phase}`);
      assert.equal(p.bodyDamaged,0,`Rear paddle cannot erase the neck/body ${p.direction}/${p.phase}`);
      if([0,3].includes(p.phase)) assert.equal(p.water,0,'Dry stroke remains identical');
      else assert(p.water>0,`Water mask actually affects paddle ${p.direction}/${p.phase}`);
      if([1,2].includes(p.phase)) for(let i=0;i<2;i++) {
        if(i!==p.far) {
          if(hullSupportedOars[p.direction]?.[p.phase]?.includes(i))
            assert(p.bladeContact[i].hullInk>=48,`Authored transom-crossing blade overlaps real hull ${p.direction}/${p.phase}/${i}`);
          else assert(p.bladeContact[i].waterInk>=12,
            `Visible blade actually enters WATER outside the hull ${p.direction}/${p.phase}/${i}: ${p.bladeContact[i].waterInk}`);
        }
        assert.equal(p.bladeContact[i].hullWater,0,`No fake water over opaque hull ${p.direction}/${p.phase}`);
        assert.equal(p.bladeContact[i].blurredInterior,0,`Submerged blade is cut completely ${p.direction}/${p.phase}/${i}`);
        assert.equal(p.bladeContact[i].dryChanged,0,`Dry blade preserves its original pixels ${p.direction}/${p.phase}/${i}`);
      }
    }
    assert(result.comparisons.some(p=>p.direction==='right'&&p.hidden>10),'Profile hull really occludes its far paddle');
    assert(result.comparisons.some(p=>p.direction==='left'&&p.hidden>10),'Both profiles are tested');
    if(require('../data/aventura/rowing.json').bodies?.[require('../data/aventura/player-art.json').rowingRigs[variant]])
      assert(result.comparisons.some(p=>p.unprotectedDamage>0),'Negative test reproduces missing body protection');
    console.log(JSON.stringify({variant,vessel,compositions:result.comparisons.length,
      minimumVisibleBladeInk:Math.min(...result.comparisons.flatMap(p=>p.bladeInk.filter((n,i)=>!occludedOars[p.direction]?.[p.phase]?.includes(i)))),
      floorOpaque:result.floorOpaque,scratchBytes:result.scratchBytes+result.waterScratchBytes,bytes:result.bytes,ms500:result.ms500}));
    console.log('PASS: 32 real atlas compositions, hull/paddle occlusion, phase-specific water, unaffected head, reused paths and bounded scratch.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
