"use strict";
const { compileWorld } = require("../tools/world.cjs");
const assert = require("node:assert/strict");
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
const catalog=compileWorld(process.cwd());
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
assert(active(find("forest-mushrooms-fern"),state));
state=planReaction(find("forest-mushrooms-fern"),state,catalog).state;
assert(!state.inventory.mushroom,"Knife required to cut a portion");
state=planReaction(find("picnic-knife"),state,catalog).state;
state=planReaction(find("forest-mushrooms-fern"),state,catalog).state;
assert.equal(state.inventory.mushroom,1);assert(!active(find("forest-mushrooms-fern"),state));
assert.equal(state.inventory.knife,1,"Knife is reusable");
/**
 * ⛔ LA FUENTE NO COBRA: SE PIDE UN DESEO Y YA (17-sep-2026, decisión del dueño). Se toca y se
 * pide, sin botón y sin peaje, porque en este bosque no hay nada que comprar.
 *
 * Lo que la casa NO ha tirado es la maquinaria: el peaje, el premio y los recuerdos que se dejan
 * en un sitio siguen en el motor y en el contrato del servidor, porque los setines vuelven el día
 * que el dueño quiera. Así que aquí se comprueban las dos cosas por separado y con la misma
 * dureza: que el MUNDO no cobra, y que la MÁQUINA sigue sabiendo cobrar.
 */
assert(!fountain.actions, "La fuente no tiene botón: se toca y se pide");
assert(!fountain.keepsakes, "Y no se le echa nada dentro");
{
  const s=cleanSave(null,catalog);
  const p=planReaction(fountain,s,catalog,{});
  assert.equal(p.state.wallet.balance,0,"Pedir un deseo no cuesta");
  assert.deepEqual(p.state,s,"Ni cambia nada de la partida");
  assert.equal(p.effects.find(e=>e.type==="dialogue").key,"fountainWish");
}
// Ni una regla del bosque acuña, gasta o deja un recuerdo. Es la comprobación que de verdad
// sostiene la decisión: mirar la fuente sola dejaría la puerta abierta en cualquier otra escena.
for(const [id,sc] of Object.entries(catalog.scenes))
  for(const e of sc.entities){
    for(const a of e.actions||[]) assert(!a.fare,id+"/"+e.id+": una acción con peaje");
    for(const r of e.rules) for(const f of r.effects)
      assert(!["reward","spend","keepsake"].includes(f.type),id+"/"+e.id+": efecto "+f.type);
  }
// Vacío y no ausente: el motor y el contrato del servidor siguen esperando los dos huecos, y un
// `[]` es lo que devuelve PHP para un mapa sin claves — mirar el número no depende de eso.
assert.equal(Object.keys(catalog.economy.fares).length,0,"Sin peajes escritos");
assert.equal(Object.keys(catalog.dialogueTokens).length,0,"Y ninguna frase con un precio dentro");
// La máquina, con una fuente de mentira: mismo motor, mismos números, sin tocar el bosque.
{
  const well={id:"fountain",sprite:"fountain",label:"fountain",solid:fountain.solid,
    keepsakes:{sprite:"setin-flat",limit:12,area:[0,-31,23,10]},
    actions:[{id:"wish",label:"tossSetin",fare:"wish",enabledWhen:{funds:1}}],
    rules:[{action:"wish",when:{funds:1},effects:[
      {type:"spend",fare:"wish"},{type:"keepsake"},
      {type:"presentation",sequence:"toss",sprite:"setin",duration:1.1}]},
      {action:"wish",effects:[{type:"dialogue",key:"fountainWish"}]}]};
  const coin={...catalog,economy:{...catalog.economy,fares:{wish:1}},
    scenes:{...catalog.scenes,overworld:{...scene,
      entities:[...scene.entities.filter(e=>e.id!=="fountain"),well]}}};
  for(const amount of [0,1,2,30]){
    let s=cleanSave(null,coin);s.wallet.balance=amount;
    assert.equal(matches(s,actions(well,s)[0].enabledWhen),amount>=1);
    const before=JSON.stringify(s),p=planReaction(well,s,coin,{action:"wish"});
    assert.equal(JSON.stringify(s),before,"Planning cannot mutate source");
    assert.equal(p.state.wallet.balance,Math.max(0,amount-1));
    assert.equal(p.state.keepsakes?.overworld?.fountain||0,amount?1:0);
    if(amount) assert.equal(p.effects.find(e=>e.type==="presentation").sequence,"toss");
  }
  let st=cleanSave(null,coin);st.wallet.balance=30;
  for(let i=0;i<25;i++)st=planReaction(well,st,coin,{action:"wish"}).state;
  assert.equal(st.wallet.balance,5);assert.equal(st.keepsakes.overworld.fountain,12);
  assert.deepEqual(cleanSave(JSON.parse(JSON.stringify(st)),coin).keepsakes,st.keepsakes);
  assert.deepEqual(cleanKeepsakes({overworld:{fountain:999999,absent:5},unknown:{x:1}},coin),{overworld:{fountain:12}});
  assert.deepEqual(cleanKeepsakes({overworld:{fountain:NaN}},coin),{});
  for(let i=0;i<12;i++){
    const e={...well,x:0,y:0}, pt=keepsakePoint(e,i),[x,y,rx,ry]=e.keepsakes.area;
    assert(((pt.x-x)/rx)**2+((pt.y-y)/ry)**2<1,"Coin remains inside the bowl");
  }
  // Y las monedas de una partida vieja se van solas cuando la fuente deja de admitirlas.
  assert.deepEqual(cleanKeepsakes({overworld:{fountain:7}},catalog),{});
}
assert.deepEqual(gains({inventory:{leaf:1}},{inventory:{leaf:2,twig:1}}),["leaf","twig"]);
assert.equal(cardinal(-2,3),"down");assert.equal(cardinal(-3,2),"left");
const sequence=new Sequence(), game={sequence,player:{}};
const presentation=new Presentation(game);
sequence.play("gesture",1,{kind:"discover"});sequence.advance(.5);
assert.equal(presentation.frame(),"person-100-discover-2");
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
 assert.match(pushFrame(actor),/^person-100-right-push-/);
 assert.equal(w.collisionAt(actor.x,actor.y,actor),null);
}
console.log("PASS Ascua: 64 barbecue states, whole pickup, free fountain with its machinery intact, bounded reload memories, gesture poses, exact density/crops, restrained wind and 30/60/120 Hz pushing.");
