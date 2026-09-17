"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const origin = process.env.GAME_ORIGIN || 'http://127.0.0.1:47834';
const key = 'magikitos.adventure';
(async () => {
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  const errors = [];
  fs.mkdirSync('.local/ascua-review', { recursive:true });
  try {
    for (const [width,height] of [[1440,900],[768,1024],[390,844]]) {
      for (const reducedMotion of ['no-preference','reduce']) {
        const page = await browser.newPage({ viewport:{width,height}, hasTouch:true, reducedMotion });
        await page.addInitScript(() => {
          const seed=sessionStorage.getItem('ascua-seed');
          if(seed) {localStorage.setItem('magikitos.adventure',seed);sessionStorage.removeItem('ascua-seed');}
        });
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => ['127.0.0.1','magikitos.ddev.site'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
        await page.goto(origin+'/aventura');
        const inspect = () => page.evaluate(() => window.MagikitosAdventure.inspect());
        const stored = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
        /**
         * ⛔ LAS POSICIONES SE DERIVAN DEL MAPA, NO SE ESCRIBEN A MANO. El dueño redibuja el
         * bosque en el Studio y las coordenadas cableadas se quedan apuntando a un claro que ya
         * no existe: la prueba deja de tocar nada y se cae por tiempo treinta segundos después,
         * diciendo que falla un gesto cuando lo que falla es que el sitio se movió. `junto(id)`
         * pone a Ascua al lado de la cosa, esté donde esté hoy.
         */
        const world = JSON.parse(require("node:fs").readFileSync(".local/build/world.json"));
        const junto = (id, dx = 0, dy = 2) => {
          const e = world.scenes.overworld.entities.find(x => x.id === id);
          assert(e, "El mapa ya no tiene " + id);
          return { x: (e.x + dx) * 16, y: (e.y + dy) * 16 };
        };
        async function seed(extra = {}) {
          await page.evaluate(({key,state}) => sessionStorage.setItem('ascua-seed',JSON.stringify(state)), {
            key, state:{ scene:'overworld', position: junto('fountain'), flags:{}, muted:true, ...extra },
          });
          await page.reload();
          await require("./browser-entry.cjs").enterWorld(page);
        }
        async function touchEntity(id, dy = 4) {
          const s = await inspect(), entity = s.entities.find(e => e.id===id);
          assert(entity,id);
          const r = await page.locator('#world-canvas').boundingBox();
          const x = r.x+(entity.x-s.camera.x)*r.width/s.view.width;
          const y = r.y+(entity.y-dy-s.camera.y)*r.height/s.view.height;
          await page.touchscreen.tap(x,y);
        }
        const dialogue = () => page.waitForFunction(() => !!window.MagikitosAdventure.inspect().dialogue);
        const gesture = kind => page.waitForFunction(k => window.MagikitosAdventure.inspect().sequence?.data.kind===k, kind);
        // ⛔ La fuente no cobra ni tiene botón: se toca, se pide un deseo y la partida no se
        // entera (17-sep-2026, decisión del dueño). Lo que se comprueba aquí es lo que ve quien
        // juega: una frase, ningún control y el monedero clavado.
        await seed({wallet:{balance:7}});
        await touchEntity('fountain',28); await dialogue();
        assert.equal(await page.locator('[data-action="wish"]').count(),0,'Sin botón de deseo');
        assert.equal((await inspect()).wallet.balance,7,'Pedir un deseo no cuesta');
        await page.keyboard.press('Enter');
        assert.equal((await inspect()).dialogue,null);
        assert.equal((await inspect()).wallet.balance,7);
        assert(!((await stored()).keepsakes?.overworld?.fountain),'Y no cae nada al agua');

        await seed({ position: junto('picnic-mushroom'), inventory:{knife:1} });
        await touchEntity('picnic-mushroom',20); await gesture('discover');
        assert.equal((await inspect()).entities.find(e=>e.id==='picnic-mushroom').presented,false,'Ground source is hidden before the first overhead pose');
        assert.equal((await inspect()).player.direction,'down');
        assert.equal((await inspect()).sequence.data.sprite,'giant-bolete');
        await dialogue();
        assert.equal((await inspect()).inventory.mushroom,1);
        assert.equal((await inspect()).inventory.knife,1);

        await seed({position: junto('picnic-barbecue'),flags:{fireLit:true},inventory:{knife:1,lighter:1,mushroom:1,twig:1}});
        await touchEntity('picnic-barbecue'); await dialogue();
        await page.locator('[data-action="cook"]').click(); await gesture('work');
        assert.equal((await inspect()).inventory.mushroom,1,'Ingredients remain until commit');
        assert.equal((await inspect()).sequence.data.props.length,3);
        if(reducedMotion==='no-preference') {
          await page.waitForTimeout(700);
          await page.screenshot({path:'.local/ascua-review/prepare-'+width+'.png'});
        }
        await gesture('discover'); await dialogue();
        const cooked=await inspect();
        assert.equal(cooked.inventory.skewer,1); assert.equal(cooked.inventory.knife,1); assert.equal(cooked.inventory.lighter,1);
        assert(!cooked.inventory.mushroom && !cooked.inventory.twig);
        assert(!cooked.assets.loaded.includes('actor-0-bow'),'Future weapon stays lazy');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
        await page.close();
        console.log('PASS Ascua touch/keyboard, discovery, cooking, local fountain/reload/interruption '+width+'×'+height+' '+reducedMotion);
      }
    }
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
