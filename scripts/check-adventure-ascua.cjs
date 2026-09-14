"use strict";
const assert = require("node:assert/strict"), {execFileSync} = require("node:child_process");
const root = "../public/assets/js/adventure/";
const {planReaction,actions,matches,active}=require(root+"rules");
const {cleanSave}=require(root+"save");
const {gains,cardinal,Presentation}=require(root+"presentation");
const {cleanKeepsakes,keepsakePoint}=require(root+"keepsakes");
const {windAmount,drawVegetation}=require(root+"vegetation");
const {Sequence}=require(root+"sequence");
const {World}=require(root+"model");
const {move}=require(root+"movement");
const {tryPush,PUSH_SPEED_RATIO}=require(root+"movables");
const {pushFrame}=require(root+"characters");
const {SpriteLibrary}=require(root+"sprites");
const catalog=JSON.parse(execFileSync("php",["-r",'echo json_encode(require "data/aventura/world.php");'],{encoding:"utf8"}));
const scene=catalog.scenes.overworld, find=id=>scene.entities.find(e=>e.id===id);
const bbq=find("picnic-barbecue"), fountain=find("fountain");
for(let bits=0;bits<64;bits++){
  const s=cleanSave(null,catalog), keys=["lighter","twig","mushroom","knife","skewer"];
  keys.forEach((k,i)=>{if(bits&(1<<i))s.inventory[k]=1;});
  s.flags.fireLit=Boolean(bits&32);
  const expected=s.inventory.skewer?"barbecueAfter":
    !s.flags.fireLit?(s.inventory.lighter?"barbecueLightReady":"barbecueHint"):
    !s.inventory.twig?"skewerNeedTwig":!s.inventory.mushroom?"skewerNeedMushroom":
    !s.inventory.knife?"skewerNeedKnife":"skewerReady";
  const hint=planReaction(bbq,s,catalog).effects.filter(e=>e.type==="dialogue");
  assert.deepEqual(hint,[{type:"dialogue",key:expected}],"One correct hint, state "+bits);
  const ready=Boolean(s.flags.fireLit&&s.inventory.twig&&s.inventory.mushroom&&s.inventory.knife&&!s.inventory.skewer);
  assert.equal(actions(bbq,s).some(a=>a.id==="cook"),ready);
  const before=JSON.stringify(s), cooked=planReaction(bbq,s,catalog,{action:"cook"});
  assert.equal(Boolean(cooked),ready);
  assert.equal(JSON.stringify(s),before,"Pure recipe planning");
  if(cooked){
    assert.equal(cooked.state.inventory.skewer,1);
    assert.equal(cooked.state.inventory.knife,1);
    assert.equal(cooked.state.inventory.lighter,s.inventory.lighter);
    assert(!cooked.state.inventory.twig&&!cooked.state.inventory.mushroom);
    assert(cooked.effects.some(e=>e.type==="presentation"&&e.sequence==="work"));
  }
}
let state=cleanSave(null,catalog);
assert(active(find("picnic-mushroom"),state));
state=planReaction(find("picnic-mushroom"),state,catalog).state;
assert.equal(state.inventory.mushroom,1);assert(!active(find("picnic-mushroom"),state));
assert(!state.inventory.knife,"Whole mushroom before knife");
for(const amount of [0,1,2,30]){
  let s=cleanSave(null,catalog);s.wallet.balance=amount;
  const action=actions(fountain,s)[0];
  assert.equal(matches(s,action.enabledWhen),amount>=1);
  const before=JSON.stringify(s),p=planReaction(fountain,s,catalog,{action:"wish"});
  assert.equal(JSON.stringify(s),before,"Fountain planning cannot mutate source");
  assert.equal(p.state.wallet.balance,Math.max(0,amount-1));
  assert.equal(p.state.keepsakes?.overworld?.fountain||0,amount?1:0);
  if(amount) assert.equal(p.effects.find(e=>e.type==="presentation").sequence,"toss");
}
state=cleanSave(null,catalog);state.wallet.balance=30;
for(let i=0;i<25;i++)state=planReaction(fountain,state,catalog,{action:"wish"}).state;
assert.equal(state.wallet.balance,5);assert.equal(state.keepsakes.overworld.fountain,12);
assert.deepEqual(cleanSave(JSON.parse(JSON.stringify(state)),catalog).keepsakes,state.keepsakes);
assert.deepEqual(cleanKeepsakes({overworld:{fountain:999999,absent:5},unknown:{x:1}},catalog),{overworld:{fountain:12}});
assert.deepEqual(cleanKeepsakes({overworld:{fountain:NaN}},catalog),{});
for(let i=0;i<12;i++){
 const e={...fountain,x:0,y:0}, p=keepsakePoint(e,i),[x,y,rx,ry]=e.keepsakes.area;
 assert(((p.x-x)/rx)**2+((p.y-y)/ry)**2<1,"Coin remains inside the bowl");
}
assert.deepEqual(gains({inventory:{leaf:1}},{inventory:{leaf:2,twig:1}}),["leaf","twig"]);
assert.equal(cardinal(-2,3),"down");assert.equal(cardinal(-3,2),"left");
const sequence=new Sequence(), game={sequence,player:{}};
const presentation=new Presentation(game);
sequence.play("gesture",1,{kind:"discover"});sequence.advance(.5);
assert.equal(presentation.frame(),"person-0-discover-2");
sequence.advance(.5);assert.equal(presentation.frame(),null);
let animated=0,resting=0;
for(let i=0;i<100;i++)for(let t=0;t<30;t++){
 const e={id:"tree-"+i,wind:{amplitude:1,fixedFrom:.6,share:.35}};
 const a=windAmount(e,t);assert(Math.abs(a)<=1);
 assert.equal(windAmount(e,0),0,"Reduced motion stays still");
 assert.equal(a,windAmount(e,t),"Deterministic phase");
 if(a)animated++;else resting++;
}
assert(animated>0&&resting>animated*4,"Selective movement mostly rests");
assert.equal(windAmount({id:"house"},5),0,"Rigid artwork does not breathe");
const calls=[], sprite=new SpriteLibrary(), fakeImage={};
sprite.owners.set("test","test");sprite.packs.set("test",{image:fakeImage,frames:{test:{x:4,y:6,w:20,h:30,anchor:[10,29],pixelRatio:2}}});
sprite.draw({drawImage:(...a)=>calls.push(a)},"test",10,20);
assert.deepEqual(calls[0].slice(1),[4,6,40,60,10,20,20,30],"Density is texture-only");
sprite.drawRegion({drawImage:(...a)=>calls.push(a)},"test",2,3,4,5,6,7,8,9);
assert.deepEqual(calls[1].slice(1),[8,12,8,10,6,7,8,9],"Native crop uses physical source coordinates");
for(const dt of [1/30,1/60,1/120]){
 const data={id:"push",width:32,height:32,indoor:true,seed:1,paths:[],waters:[],clearings:[],regions:[],
   spawn:{x:4,y:25},entities:[{id:"box",sprite:"crates",x:12,y:12,solid:[-.5,-.5,1,1],pushable:true,rules:[]}]};
 const w=new World(data), s={flags:{},inventory:{},objects:{}};w.refresh(s);
 const box=w.entities[0], actor={x:box.x-14,y:box.y,actor:true}, x=actor.x;
 w.actors=[actor];
 for(let t=0;t<Math.round(1/dt);t++)move(w,actor,60*dt,0,()=>{},{
   resolveCollision:(e,dx,dy)=>tryPush(w,actor,e,dx,dy,s)});
 assert(Math.abs(actor.x-x-60*PUSH_SPEED_RATIO)<.001,"Effort speed is frame-rate independent");
 assert.match(pushFrame(actor),/^person-0-right-push-/);
 assert.equal(w.collisionAt(actor.x,actor.y,actor),null);
}
console.log("PASS Ascua: 64 barbecue states, whole pickup, atomic local fountain, bounded reload memories, gesture poses, exact density/crops, restrained wind and 30/60/120 Hz pushing.");
