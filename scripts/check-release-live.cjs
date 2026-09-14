"use strict";
/** Read-only smoke of an explicitly supplied host. Fresh profiles; never writes to APIs. */
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const {verify}=require('../tools/artifact.cjs');
const [host,directory]=process.argv.slice(2);
if(!host || !directory) throw Error('Usage: node check-release-live.cjs ORIGIN RELEASE_DIRECTORY');
const origin=new URL(host).origin, id=path.basename(directory), manifest=verify(directory,id);
async function response(url) {
  const r=await fetch(new URL(url,origin),{signal:AbortSignal.timeout(25000),cache:'no-store'});
  assert.equal(r.status,200,url); return r;
}
(async()=>{
  for(const [lang,route] of Object.entries(manifest.routes)) {
    const r=await response(route), text=await r.text();
    assert.equal(text,fs.readFileSync(path.join(directory,'pages',lang+'.html'),'utf8'),'Exact static shell '+route);
    console.log('PASS live static shell '+route+' '+id);
  }
  for(const file of ['assets/js/aventura.min.js','assets/css/aventura.min.css','assets/aventura/manifest.json']) {
    const r=await response('/game/releases/'+id+'/'+file);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),manifest.files[file]);
  }
  for(const lang of Object.keys(manifest.routes)) {
    const r=await response('/api/world/bootstrap?lang='+lang), body=await r.json();
    assert(body.ok); assert.equal(body.locale,lang); assert(body.destinations.stories);
  }
  for(const kind of ['cuento','chiste','expresion']) {
    const r=await response('/api/world/discover?lang=es&kind='+kind), body=await r.json();
    assert(body.ok && Array.isArray(body.items));
    assert(body.items.every(p=>p.kind===kind && p.audio && !('html' in p)));
  }
  for(const route of ['/','/cuentos','/chistes','/tienda']) {
    const r=await response(route), body=await r.text();
    assert(!/Fatal error|Deprecated:|<b>Warning<\/b>/.test(body));
    assert(!body.includes('id="world-canvas"'),'Website stays separate '+route);
  }
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const errors=[],writes=[];
  try {
    for(const [width,height] of [[1440,900],[768,1024],[390,844]]) {
      const page=await browser.newPage({viewport:{width,height},hasTouch:true});
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/game/releases/') && r.status()>=400) errors.push(r.status()+' '+r.url());});
      await page.route('**/*',r=>{
        if(!['GET','HEAD'].includes(r.request().method())) {writes.push(r.request().url());return r.abort();}
        return new URL(r.request().url()).origin===origin ? r.continue() : r.abort();
      });
      await page.addInitScript(()=>localStorage.setItem('magikitos.adventure',JSON.stringify({flags:{introSeen:true},muted:true})));
      await page.goto(origin+'/aventura');
      await page.waitForFunction(()=>window.MagikitosAdventure?.inspect().ready);
      const before=await page.evaluate(()=>window.MagikitosAdventure.inspect());
      await page.keyboard.down('ArrowDown'); await page.waitForTimeout(240); await page.keyboard.up('ArrowDown');
      const after=await page.evaluate(()=>window.MagikitosAdventure.inspect());
      assert(Math.hypot(after.player.x-before.player.x,after.player.y-before.player.y)>5);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert(!after.assets.loaded.includes('actor-0-bow'));
      await page.close();
      console.log('PASS live game ready/movement/assets/no overflow '+width+'×'+height);
    }
    assert.deepEqual(errors,[]); assert.deepEqual(writes,[]);
  } finally {await browser.close();}
  console.log('PASS live release '+id+': exact bytes, six locales/API, website intact, zero write requests.');
})().catch(e=>{console.error(e);process.exitCode=1;});
