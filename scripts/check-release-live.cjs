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
function assertShell(actual, expected, headers, route) {
  if(actual===expected) return 'exact';
  // Cloudflare JavaScript Detections appends one security script at the edge.
  // Permit that insertion only: all application HTML/config must remain identical.
  const closing='</body>\n</html>\n', prefix=expected.slice(0,-closing.length);
  assert(expected.endsWith(closing));
  assert.equal(headers.get('server'),'cloudflare','Unexpected HTML transformer '+route);
  assert(actual.startsWith(prefix) && actual.endsWith(closing),'Application shell changed '+route);
  const inserted=actual.slice(prefix.length,-closing.length);
  assert(/^<script>[^]*<\/script>$/.test(inserted) && (inserted.match(/<script>/g)||[]).length===1 && (inserted.match(/<\/script>/g)||[]).length===1,'Unexpected edge markup '+route);
  assert(inserted.includes('window.__CF$cv$params=') && inserted.includes("a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js'"),'Unexpected edge script '+route);
  return 'exact application HTML + Cloudflare security insertion';
}
(async()=>{
  for(const [lang,route] of Object.entries(manifest.routes)) {
    const r=await response(route), text=await r.text();
    const mode=assertShell(text,fs.readFileSync(path.join(directory,'pages',lang+'.html'),'utf8'),r.headers,route);
    console.log('PASS live static shell '+route+' '+id+' ('+mode+')');
  }
  for(const file of ['assets/js/aventura.min.js','assets/css/aventura.min.css','assets/aventura/manifest.json','game-contract.json']) {
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
  const art=await (await response('/api/world/catalog?lang=es&kind=art')).json();
  assert(art.ok && Array.isArray(art.items) && !('collection' in art));
  assert(art.items.every(sheet=>sheet.image && sheet.thumb && !('slug' in sheet)));
  for(const zone of ['tocon-del-mirlo','remanso-del-musgo']) {
    const shared=await (await response('/api/world/community?zone='+zone)).json();
    assert(shared.ok && shared.zone===zone && Array.isArray(shared.objects) && shared.objects.length<=96);
    for(const object of shared.objects) {
      assert(!('creator_id' in object) && !('inventory' in object));
      if(object.author)assert.deepEqual(Object.keys(object.author).sort(),['handle','name']);
    }
  }
  // Rejected READS only: this smoke cannot mint identities or submit any save.
  for(const [endpoint,status] of [['game-state',401],['game-account',401],['game-save',405],['game-restore',405],['community-build',405],['community-use',405]]) {
    const r=await fetch(new URL('/api/world/'+endpoint,origin),{signal:AbortSignal.timeout(25000)});
    assert.equal(r.status,status,endpoint);
    assert.equal((await r.json()).ok,false,endpoint);
    assert.match(r.headers.get('cache-control'),/no-store/);
  }
  console.log('PASS live flat art, shared world DTOs and protected game API');
  for(const route of ['/','/cuentos','/chistes','/tienda']) {
    const r=await response(route), body=await r.text();
    assert(!/Fatal error|Deprecated:|<b>Warning<\/b>/.test(body));
    assert(!body.includes('id="world-canvas"'),'Website stays separate '+route);
  }
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const errors=[],writes=[],blockedSecurityRequests=[];
  try {
    for(const [width,height] of [[1440,900],[768,1024],[390,844]]) {
      const page=await browser.newPage({viewport:{width,height},hasTouch:true});
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/game/releases/') && r.status()>=400) errors.push(r.status()+' '+r.url());});
      await page.route('**/*',r=>{
        const url=new URL(r.request().url());
        if(!['GET','HEAD'].includes(r.request().method())) {
          // Observe but never send Cloudflare's injected challenge POST either.
          // It is infrastructure, not an application identity/vote/chat write.
          const target=url.origin===origin && url.pathname.startsWith('/cdn-cgi/challenge-platform/') ? blockedSecurityRequests : writes;
          target.push(url.href); return r.abort();
        }
        return url.origin===origin ? r.continue() : r.abort();
      });
      await page.addInitScript(()=>{
        const seed=sessionStorage.getItem('smoke-next') || JSON.stringify({flags:{},muted:true});
        localStorage.setItem('magikitos.adventure',seed);
      });
      await page.goto(origin+'/aventura');
      await page.waitForFunction(()=>window.MagikitosAdventure?.inspect().ready);
      const before=await page.evaluate(()=>window.MagikitosAdventure.inspect());
      await page.keyboard.down('ArrowDown'); await page.waitForTimeout(240); await page.keyboard.up('ArrowDown');
      const after=await page.evaluate(()=>window.MagikitosAdventure.inspect());
      assert(Math.hypot(after.player.x-before.player.x,after.player.y-before.player.y)>5);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert(!after.assets.loaded.includes('actor-0-bow'));
      const seed=async(state)=>{
        await page.evaluate(s=>sessionStorage.setItem('smoke-next',JSON.stringify(s)),{muted:true,...state});
        await page.reload();
        await page.waitForFunction(()=>window.MagikitosAdventure?.inspect().ready);
      };
      await seed({scene:'river-willows',position:{x:768,y:960},inventory:{boat:1},navigation:{mode:'boat',direction:'up'}});
      assert(await page.locator('#river-controls').isVisible());
      const riverBefore=await page.evaluate(()=>window.MagikitosAdventure.inspect());
      await page.locator('#world-canvas').focus();
      await page.keyboard.down('ArrowUp'); await page.waitForTimeout(750); await page.keyboard.up('ArrowUp');
      const riverAfter=await page.evaluate(()=>window.MagikitosAdventure.inspect());
      assert.equal(riverAfter.navigation.mode,'boat');
      assert(riverAfter.player.y<riverBefore.player.y-30);
      assert(riverAfter.assets.loaded.includes('actor-0-row'));
      await seed({scene:'home-garden',position:{x:384,y:680},inventory:{boat:1},navigation:{mode:'boat',direction:'up'}});
      await page.locator('#river-land').click();
      await page.waitForFunction(()=>window.MagikitosAdventure.inspect().navigation.mode==='foot');
      assert(await page.locator('#home-edit').isVisible());
      // Do not open the editor in a read-only smoke: it explicitly creates an
      // anonymous identity. Real builds use the separate labelled example run.
      assert.equal((await page.evaluate(()=>window.MagikitosAdventure.inspect())).community.zone,'tocon-del-mirlo');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.close();
      console.log('PASS live forest, rowing, shared landing, lazy assets and no overflow '+width+'×'+height);
    }
    assert.deepEqual(errors,[]); assert.deepEqual(writes,[]);
  } finally {await browser.close();}
  console.log('PASS live release '+id+': application bytes, six locales/API, website intact, zero writes sent; '+blockedSecurityRequests.length+' injected security POSTs blocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
