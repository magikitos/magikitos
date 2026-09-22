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
  // La landing de la web (19-sep-2026): `/bosque` y sus traducciones son una página normal de la
  // casa que enlaza al artefacto con «Explorar el bosque». Sin ese enlace el juego no tiene puerta.
  for(const route of Object.values(manifest.routes)) {
    const landing=route.replace(/\/[^/]+$/,''), text=await (await response(landing)).text();
    assert(text.includes('href="'+route+'"'),'La landing '+landing+' enlaza al juego en '+route);
    assert(text.includes('id="bosque-host"'),'La landing '+landing+' lleva el hueco del iframe');
    console.log('PASS live landing '+landing+' → '+route);
  }
  for(const file of ['assets/js/aventura.min.js','assets/css/aventura.min.css','assets/aventura/manifest.json','game-contract.json']) {
    const r=await response('/game/releases/'+id+'/'+file);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),manifest.files[file]);
  }
  for(const lang of Object.keys(manifest.routes)) {
    const r=await response('/api/world/bootstrap?lang='+lang), body=await r.json();
    assert(body.ok); assert.equal(body.locale,lang); assert(body.destinations.stories);
  }
  // Website-owned recipes: public reading is never gated by a game identity or ingredients.
  const recipeRoutes={es:'/recetas',en:'/en/recipes',de:'/de/rezepte',fr:'/fr/recettes',it:'/it/ricette',pt:'/pt/receitas'};
  for(const [lang,route] of Object.entries(recipeRoutes)) {
    const data=await (await response('/api/world/recipes?lang='+lang)).json();
    assert(data.ok && Array.isArray(data.items) && Array.isArray(data.ingredients));
    assert(data.labels.title && data.limits.audioSeconds[1]===600);
    const html=await (await response(route)).text();
    assert(html.includes(data.labels.title) && !/Fatal error|Deprecated:|<b>Warning<\/b>/.test(html));
    assert(!html.includes('id="world-canvas"'),'Recipes are normal SSR website content');
    if(data.items.length) {
      const item=await (await response('/api/world/recipe?lang='+lang+'&id='+data.items[0].id)).json();
      assert(item.ok && item.recipe.kind==='recipe' && !('user_id' in item.recipe));
    }
  }
  console.log('PASS live recipes: six public SSR routes and JSON lists, no identity or inventory required');
  for(const kind of ['cuento','chiste','expresion']) {
    const r=await response('/api/world/discover?lang=es&kind='+kind), body=await r.json();
    assert(body.ok && Array.isArray(body.items));
    assert(body.items.every(p=>p.kind===kind && p.audio && !('html' in p)));
  }
  const art=await (await response('/api/world/catalog?lang=es&kind=art')).json();
  assert(art.ok && Array.isArray(art.items) && !('collection' in art));
  assert(art.items.every(sheet=>sheet.image && sheet.thumb && !('slug' in sheet)));
  // Las zonas salen del CONTRATO de la release que se está comprobando, no de una lista a mano:
  // un claro se puede mudar de pantalla y esta comprobación no tiene por qué enterarse.
  const zones=Object.keys(JSON.parse(fs.readFileSync(path.join(directory,'game-contract.json'))).construction.zones);
  assert(zones.length,'The release declares at least one shared plot');
  for(const zone of zones) {
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
  fs.mkdirSync('.local/production-controls',{recursive:true});
  const errors=[],writes=[],blockedSecurityRequests=[],measurements=[];
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
          // ⛔ Y el medidor de la casa tampoco es una escritura del jugador:
          // `/api/world/telemetry` es anónimo, sale solo y no toca ninguna partida, así que
          // cuenta aparte. Lo que esta prueba vigila es que mirar el bosque no mande NADA que
          // cambie a nadie; sin la separación, encender el medidor tumbaba el smoke entero.
          const target=url.origin===origin && url.pathname.startsWith('/cdn-cgi/challenge-platform/')
            ? blockedSecurityRequests
            : url.origin===origin && url.pathname==='/api/world/telemetry'
              ? measurements
              : writes;
          target.push(url.href); return r.abort();
        }
        return url.origin===origin ? r.continue() : r.abort();
      });
      await page.addInitScript(()=>{
        const seed=sessionStorage.getItem('smoke-next') || JSON.stringify({flags:{},muted:true});
        localStorage.setItem('magikitos.adventure',seed);
      });
      await page.goto(origin+'/bosque/explorar');
      await require("./browser-entry.cjs").enterWorld(page);
      const before=await page.evaluate(()=>window.MagikitosAdventure.inspect());
      await page.keyboard.down('ArrowDown'); await page.waitForTimeout(240); await page.keyboard.up('ArrowDown');
      const after=await page.evaluate(()=>window.MagikitosAdventure.inspect());
      assert(Math.hypot(after.player.x-before.player.x,after.player.y-before.player.y)>5);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await require('./browser-art.cjs').assertRetiredActionsAbsent(page);
      const seed=async(state)=>{
        await page.evaluate(s=>sessionStorage.setItem('smoke-next',JSON.stringify(s)),{muted:true,...state});
        await page.reload();
        await require("./browser-entry.cjs").enterWorld(page);
      };
      await seed({scene:'river-willows',position:{x:1792,y:960},inventory:{boat:1},navigation:{mode:'boat',direction:'up'}});
      assert.equal(await page.locator('#world-joystick').count(),0,'El joystick ya no existe en el artefacto vivo');
      assert.equal(await page.locator('#world-boost').count(),0,'Ni su botón de turbo');
      const riverBefore=await page.evaluate(()=>window.MagikitosAdventure.inspect());
      await page.locator('#world-canvas').focus();
      await page.keyboard.down('ArrowUp'); await page.waitForTimeout(750); await page.keyboard.up('ArrowUp');
      const riverAfter=await page.evaluate(()=>window.MagikitosAdventure.inspect());
      assert.equal(riverAfter.navigation.mode,'boat');
      assert(riverAfter.player.y<riverBefore.player.y-30);
      assert(riverAfter.assets.loaded.includes('actor-100-row'));
      assert(riverAfter.assets.loaded.includes('vessel-bottle'));
      // ⛔ Y EL MANDO TÁCTIL ES UN JOYSTICK INVISIBLE (19-sep-2026): se apoya el dedo donde sea, se
      // mueve, y la barca va hacia donde tira. Aquí el dedo sube sesenta píxeles, así que sube.
      const cdp=await page.context().newCDPSession(page);
      const dedo=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y])=>({id:1,x,y}))});
      await dedo('touchStart',[[width/2,height*0.6]]);
      for(let i=1;i<=6;i++) await dedo('touchMove',[[width/2,height*0.6-i*10]]);
      await page.waitForTimeout(600);
      await dedo('touchEnd',[]);
      await cdp.detach();
      const accelerated=await page.evaluate(()=>window.MagikitosAdventure.inspect());
      assert(accelerated.player.y<riverAfter.player.y-20,'Mover el dedo rema la barca en el artefacto vivo');
      await page.screenshot({path:'.local/production-controls/river-'+width+'.png'});
      // El claro compartido vive en la pradera de los sauces y su embarcadero mira al oeste, así
      // que se desembarca hacia la derecha. Se llega remando desde el agua del amarre.
      await seed({scene:'river-willows',position:{x:120*16,y:58*16},inventory:{boat:1,oars:1},navigation:{mode:'boat',direction:'right'}});
      await page.locator('#world-canvas').focus();
      await page.keyboard.down('ArrowRight');
      await page.waitForFunction(()=>window.MagikitosAdventure.inspect().navigation.mode==='foot');
      await page.keyboard.up('ArrowRight');
      // ⛔ EL RASTRILLO APARECE EN EL SIGUIENTE PINTADO, NO EN EL MISMO TIC. Soltar la tecla
      // devuelve el control antes de que el motor repinte el mando, así que leer el DOM aquí
      // mide el estado de ANTES de desembarcar: medido contra producción, tarda 17 ms. Se
      // espera a que aparezca —con margen corto, que un segundo entero sí sería un defecto—.
      await page.waitForFunction(()=>!document.getElementById('build-toggle').hidden,null,{timeout:3000});
      // Do not open the editor in a read-only smoke: it explicitly creates an
      // anonymous identity. Real builds use the separate labelled example run.
      assert.equal((await page.evaluate(()=>window.MagikitosAdventure.inspect())).community.zone,'claro-de-los-sauces');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.close();
      console.log('PASS live forest, rowing, shared landing, lazy assets and no overflow '+width+'×'+height);
    }
    assert.deepEqual(errors,[]);
    assert.deepEqual(writes,[],'Mirar el bosque no escribe nada del jugador');
  } finally {await browser.close();}
  console.log('PASS live release '+id+': application bytes, six locales/API, website intact, zero player writes sent; '+measurements.length+' anonymous telemetry and '+blockedSecurityRequests.length+' injected security POSTs blocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
