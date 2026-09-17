"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{execFileSync}=require("node:child_process");
const {validateConstruction}=require("../public/assets/js/adventure/construction-layout");
const catalog=JSON.parse(fs.readFileSync(".local/build/world.json")).construction,cases=[];
for(const zone of Object.keys(catalog.zones)){
  for(const [kind,d] of Object.entries(catalog.definitions)){
    const [ex,ey,ew,eh]=catalog.zones[zone].editable;let candidate;
    for(let y=ey+2;y<ey+eh-2&&!candidate;y++)for(let x=ex+2;x<ex+ew-2&&!candidate;x++){
      const o={kind,variant:d.variants[0].id,rotation:0,x,y};
      if(!validateConstruction([o],zone,catalog))candidate=o;
    }
    assert(candidate,"Legal placement exists for "+kind+" in "+zone);
    for(const rotation of d.rotations)cases.push({zone,items:[{...candidate,rotation}]});
    for(const override of [{x:-1},{x:1.1},{x:ex+ew+1},{y:ey-1},{rotation:3},{variant:"invented"},{kind:"unknown"}])cases.push({zone,items:[{...candidate,...override}]});
    cases.push({zone,items:[candidate,candidate]});
  }
}
const web=process.env.GAME_WEB_REPO||path.resolve("..","magikitos");
const php=`require $argv[1]; $d=json_decode(stream_get_contents(STDIN),true); $out=[]; foreach($d['cases'] as $c){try{communityValidate($c['items'],$c['zone'],$d['catalog']);$out[]=null;}catch(Throwable $e){$out[]=$e->getMessage();}} echo json_encode($out);`;
const result=JSON.parse(execFileSync("php",["-r",php,path.join(web,"src/game/community.php")],{input:JSON.stringify({catalog,cases}),encoding:"utf8"}));
cases.forEach((c,i)=>assert.equal(validateConstruction(c.items,c.zone,catalog),result[i],JSON.stringify(c)));
console.log(`PASS ${cases.length} construction JS/PHP parity cases: actual terrain, every kind, every zone, footprints, rotations and rejected input`);
