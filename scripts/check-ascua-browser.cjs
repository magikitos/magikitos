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
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => ['127.0.0.1','magikitos.ddev.site'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
        await page.goto(origin+'/aventura');
        const inspect = () => page.evaluate(() => window.MagikitosAdventure.inspect());
        const stored = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
        async function seed(extra = {}) {
          await page.evaluate(({key,state}) => localStorage.setItem(key,JSON.stringify(state)), {
            key, state:{ scene:'overworld', position:{x:64*16,y:44*16}, flags:{introSeen:true}, muted:true, ...extra },
          });
          await page.reload();
          await page.waitForFunction(() => window.MagikitosAdventure?.inspect().ready);
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
        await seed({wallet:{balance:0}});
        await touchEntity('fountain',28); await dialogue();
        assert(await page.locator('[data-action="wish"]').isDisabled());
        assert.equal((await inspect()).wallet.balance,0);
        await page.keyboard.press('Enter');
        assert.equal((await inspect()).dialogue,null);

        await seed({wallet:{balance:2}});
        await touchEntity('fountain',28); await dialogue();
        await page.locator('[data-action="wish"]').click(); await gesture('toss');
        assert.equal((await inspect()).wallet.balance,2,'No debit before presentation commits');
        if (reducedMotion==='no-preference') {
          const before=(await inspect()).player;
          await page.keyboard.down('ArrowRight');
          await page.waitForTimeout(160);
          await page.keyboard.up('ArrowRight');
          const after=(await inspect()).player;
          assert.equal(after.x,before.x); assert.equal(after.y,before.y);
          await page.screenshot({path:'.local/ascua-review/toss-'+width+'.png'});
        } else assert.equal((await inspect()).sequence.duration,.35);
        await dialogue();
        assert.equal((await inspect()).wallet.balance,1);
        assert.equal((await stored()).keepsakes.overworld.fountain,1);
        await page.reload(); await page.waitForFunction(() => window.MagikitosAdventure?.inspect().ready);
        assert.equal((await inspect()).wallet.balance,1);
        assert.equal((await stored()).keepsakes.overworld.fountain,1);

        // A browser interruption before commit cannot charge for an unseen action.
        await seed({wallet:{balance:2}});
        await touchEntity('fountain',28); await dialogue();
        await page.locator('[data-action="wish"]').click(); await gesture('toss');
        await page.reload(); await page.waitForFunction(() => window.MagikitosAdventure?.inspect().ready);
        assert.equal((await inspect()).wallet.balance,2);
        assert(!((await stored()).keepsakes?.overworld?.fountain));

        await seed({ position:{x:33*16,y:70.5*16} });
        await touchEntity('picnic-mushroom',20); await gesture('discover');
        assert.equal((await inspect()).player.direction,'down');
        assert.equal((await inspect()).sequence.data.sprite,'giant-bolete');
        await dialogue();
        assert.equal((await inspect()).inventory.mushroom,1);
        assert(!(await inspect()).inventory.knife);

        await seed({position:{x:25*16,y:74*16},flags:{introSeen:true,fireLit:true},inventory:{knife:1,lighter:1,mushroom:1,twig:1}});
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
