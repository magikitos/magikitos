"use strict";
const assert = require("node:assert/strict");
const { compileWorld } = require("../tools/world.cjs");
const { gameContract } = require("../tools/game-contract.cjs");
const { resolveHarvestYields } = require("../tools/harvest-yields.cjs");
const appearance = require("../public/assets/js/adventure/elements");
const { cleanSave } = require("../public/assets/js/adventure/save");
const { planReaction, active, actions } = require("../public/assets/js/adventure/rules");
const { daily, ranking, concept } = require("../public/assets/js/adventure/setometro");
const world = compileWorld(), contract = gameContract(world);
const family = require("../data/aventura/elements.json").families["ground-mushrooms"];
const source = world.scenes.overworld.entities.find(e => e.id === "forest-mushrooms-fern");
assert.equal(family.variants.length, 6);
for (const variant of family.variants) {
  const specimen = { ...source, artVariant: variant.id };
  const fixture = structuredClone({ ...world, scenes: { overworld: { ...world.scenes.overworld, entities: [specimen] } } });
  const resolved = resolveHarvestYields(fixture, appearance).scenes.overworld.entities[0];
  const count = variant.yield.mushroom;
  assert([2,3].includes(count));
  assert(resolved.artSprite.endsWith("-"+count), "Visible cap count equals harvest count");
  let state = cleanSave(null, world); state.inventory.knife = 1;
  const plan = planReaction(resolved, state, world);
  assert.equal(plan.state.inventory.mushroom, count);
  assert(!active(resolved, plan.state));
  assert.equal(plan.state.inventory.knife,1);
  state.inventory.mushroom = 100-count;
  assert.equal(planReaction(resolved,state,world), null, "No clipped harvest at capacity");
  state.inventory.mushroom = 99-count;
  assert.equal(planReaction(resolved,state,world).state.inventory.mushroom,99);
}
for (const [scene,data] of Object.entries(world.scenes)) for(const node of data.entities.filter(e=>e.harvest)) {
  assert.deepEqual(contract.adventure.entities[scene][node.id].rules,node.rules,"Server and player receive identical amounts");
}
const fire=world.scenes.overworld.entities.find(e=>e.id==="picnic-barbecue");
for(let n=0;n<=6;n++){
  const state=cleanSave(null,world);
  state.inventory={knife:1,lighter:1,twig:1,mushroom:n}; state.flags.fireLit=true;
  assert.equal(actions(fire,state).some(a=>a.id==="cook"),n>=5);
  const p=planReaction(fire,state,world,{action:"cook"});
  if(n<5) assert.equal(p,null);
  else { assert.equal(p.state.inventory.mushroom||0,n-5); assert.equal(p.state.inventory.skewer,1); }
}
const row={id:1,title:"Una raíz",score:1000}, other={...row,id:2};
assert.equal(daily({day:"2026-09-21",pair:[row,other]}).pair.length,2);
for(const bad of [{}, {...row,id:NaN},{...row,id:"1"},{...row,score:-1},{...row,title:""}])
  assert.throws(()=>concept(bad));
assert.throws(()=>daily({day:"2026-09-21",pair:[row,row]}));
assert.throws(()=>daily({day:"21/09/2026",pair:[row,other]}));
assert.deepEqual(ranking({items:[row],offset:0,nextCursor:1}),{items:[row],nextCursor:1});
assert.throws(()=>ranking({items:[row],offset:0,nextCursor:0}));
assert.throws(()=>ranking({items:[row,row],offset:0,nextCursor:null}));
assert.throws(()=>ranking({items:[row],offset:24,nextCursor:null}));
console.log("PASS forest market: six exact-count harvests, full-group capacity, server parity, five-mushroom recipe, strict daily/ranking DTOs.");
