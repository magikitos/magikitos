"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{execFileSync}=require("node:child_process");
const {validateConstruction}=require("../public/assets/js/adventure/construction-layout");
const catalog=JSON.parse(fs.readFileSync(".local/build/world.json")).construction,cases=[];
// Una pieza suelta se prueba en su sitio; un TRAZADO necesita además sus vértices, y se prueban
// los tres rechazos que solo existen para él: sin vértices, con un tramo microscópico y con un
// trazo más largo de lo que una vallita puede medir.
const candidateFor=(kind,d,x,y)=>({kind,variant:d.variants[0].id,rotation:0,x,y,
  ...(d.shape==="polyline"?{points:[[0,0],[3,0],[3,2]]}:{})});
for(const zone of Object.keys(catalog.zones)){
  for(const [kind,d] of Object.entries(catalog.definitions)){
    const [ex,ey,ew,eh]=catalog.zones[zone].editable;let candidate;
    for(let y=ey+2;y<ey+eh-2&&!candidate;y++)for(let x=ex+2;x<ex+ew-2&&!candidate;x++){
      const o=candidateFor(kind,d,x,y);
      if(!validateConstruction([o],zone,catalog))candidate=o;
    }
    assert(candidate,"Legal placement exists for "+kind+" in "+zone);
    for(const rotation of d.rotations)cases.push({zone,items:[{...candidate,rotation}]});
    for(const override of [{x:-1},{x:1.1},{x:ex+ew+1},{y:ey-1},{rotation:3},{variant:"invented"},{kind:"unknown"}])cases.push({zone,items:[{...candidate,...override}]});
    cases.push({zone,items:[candidate,candidate]});
    if(d.shape==="polyline")
      for(const points of [undefined,[],[[0,0]],[[1,0],[4,0]],[[0,0],[0.5,0]],[[0,0],[0,0.3]],
        [[0,0],[30,0]],[[0,0],[3,0],[6,0],[9,0],[12,0],[15,0],[18,0],[21,0],[24,0]],
        [[0,0],[3,"x"]],[[0,0],[3.3,0]]])
        cases.push({zone,items:[{...candidate,points}]});
    else cases.push({zone,items:[{...candidate,points:[[0,0],[3,0]]}]});
  }
}
const web=process.env.GAME_WEB_REPO||path.resolve("..","magikitos");
const php=`require $argv[1]; $d=json_decode(stream_get_contents(STDIN),true); $out=[]; foreach($d['cases'] as $c){try{communityValidate($c['items'],$c['zone'],$d['catalog']);$out[]=null;}catch(Throwable $e){$out[]=$e->getMessage();}} echo json_encode($out);`;
const result=JSON.parse(execFileSync("php",["-r",php,path.join(web,"src/game/community.php")],{input:JSON.stringify({catalog,cases}),encoding:"utf8"}));
cases.forEach((c,i)=>assert.equal(validateConstruction(c.items,c.zone,catalog),result[i],JSON.stringify(c)));
// Y lo que cuesta un trazado lo dicen los dos motores igual, porque el servidor no se fía del
// precio que le manden: lo vuelve a medir sobre los vértices.
const {objectCost}=require("../public/assets/js/adventure/construction-layout");
const line=(...points)=>({kind:"twig-fence",variant:"ramitas",rotation:0,x:0,y:0,points});
const costs=[line([0,0],[3,0]),line([0,0],[3,0],[3,4]),line([0,0],[0,1]),line([0,0],[2.5,0])];
const phpCosts=JSON.parse(execFileSync("php",["-r",
  `require $argv[1]; $d=json_decode(stream_get_contents(STDIN),true); $out=[]; foreach($d['objects'] as $o){$out[]=communityObjectCost($o,$d['catalog']['definitions']['twig-fence']);} echo json_encode($out);`,
  path.join(web,"src/game/community.php")],{input:JSON.stringify({catalog,objects:costs}),encoding:"utf8"}));
costs.forEach((o,i)=>assert.deepEqual(objectCost(o,catalog.definitions["twig-fence"]),phpCosts[i],JSON.stringify(o.points)));
assert.deepEqual(objectCost(costs[0],catalog.definitions["twig-fence"]),{twig:6},"Three tiles of fence cost three tiles of twigs");
/**
 * ⛔ UN CAMINO SE ANDA, ASÍ QUE NO PUEDE CERRAR EL CLARO. Ocupa sitio como todo lo demás —nadie
 * entierra un banco debajo— pero queda FUERA del relleno por inundación: una valla que cruce el
 * claro de lado a lado se rechaza, y un camino idéntico en el mismo sitio se acepta. Es la única
 * diferencia entre las dos polilíneas, y es la que las define.
 */
{
  const zone=Object.keys(catalog.zones)[0],[zx,zy,zw,zh]=catalog.zones[zone].editable;
  // Ningún trazado llega solo de lado a lado (el largo está acotado), así que el corte se hace
  // con dos, que es exactamente lo que haría alguien decidido a cerrar el paso.
  const corte=(kind)=>{const d=catalog.definitions[kind],x=zx+Math.round(zw/3);
    // Media celda de aire entre las dos: dos trazados que se tocan se PISAN, porque cada tramo
    // ocupa un cuarto de celda a cada lado. Al relleno le da igual —cierra huecos de hasta 0,8—
    // y a la vista también, que un poste mide doce píxeles.
    return [[0.5,zh-6],[zh-5.5,zh-0.5]].map(([a,b])=>({kind,variant:d.variants[0].id,rotation:0,
      x,y:zy+a,points:[[0,0],[0,b-a]]}));};
  assert.equal(validateConstruction(corte("twig-fence"),zone,catalog),"blocked_access",
    "Two fences end to end cut the way through the clearing");
  assert.equal(validateConstruction(corte("forest-path"),zone,catalog),null,
    "…and the same two lines as a path are exactly what a path is for");
  const phpCruce=JSON.parse(execFileSync("php",["-r",
    `require $argv[1]; $d=json_decode(stream_get_contents(STDIN),true); $out=[]; foreach($d['runs'] as $items){try{communityValidate($items,$d['zone'],$d['catalog']);$out[]=null;}catch(Throwable $e){$out[]=$e->getMessage();}} echo json_encode($out);`,
    path.join(web,"src/game/community.php")],
    {input:JSON.stringify({catalog,zone,runs:[corte("twig-fence"),corte("forest-path")]}),encoding:"utf8"}));
  assert.deepEqual(phpCruce,["blocked_access",null],"and the authority says the same");
}
console.log(`PASS ${cases.length} construction JS/PHP parity cases + ${costs.length} priced traces: actual terrain, every kind, every zone, footprints, polylines, rotations and rejected input`);
