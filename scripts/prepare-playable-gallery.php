<?php
declare(strict_types=1);
/** Offline visual contact viewer. No network, registration, game state or deployment. */
$root=dirname(__DIR__);
$base="$root/data/aventura/art/playable-cast";
$read=fn(string $file)=>json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);
$people=$read("$base/approved-101-110.json")['characters'];
$data=[];
foreach($people as $person){
    $key=$person['key'];$dir="$base/$key/review";
    $report=$read("$dir/review.json");$frames=[];
    foreach(array_keys($report['actions']) as $action)$frames[$action]=$read("$dir/$action-atlas.json")['frames'];
    $data[]=['key'=>$key,'number'=>$person['number'],'variant'=>$person['variant'],'name'=>$person['nickname'],'frames'=>$frames];
}
$payload=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_HEX_TAG|JSON_THROW_ON_ERROR);
$template= <<<'HTML'
<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Magikitos · revisión de protagonistas 101–110</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#152820;color:#ede6cf}*{box-sizing:border-box}body{margin:0 auto;max-width:1400px;padding:24px}h1{font-size:24px}p{line-height:1.5;color:#c5ccb5}button,select,input{font:inherit}button,select{background:#263e31;color:inherit;border:1px solid #6f8060;border-radius:9px;padding:9px;min-height:44px;cursor:pointer}button[aria-pressed=true]{outline:2px solid #dfb870;background:#3f4c35}a{color:#e3c58a}nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(94px,1fr));gap:10px;margin:24px 0}nav button{padding:5px}nav img{width:100%;max-width:120px;aspect-ratio:3/4;object-fit:contain}nav small{display:block}#controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:20px 0}label{display:flex;gap:8px;align-items:center}#views{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.pose{padding:12px;background:#41624b;border-radius:14px;text-align:center}.pose canvas{width:192px;height:192px;max-width:100%;image-rendering:pixelated}.pose small{display:block;font:12px ui-monospace,monospace;color:#e5e6d2}#links{display:flex;gap:14px;flex-wrap:wrap;margin:20px 0}#status{min-height:24px}#proof{width:100%;height:auto;border-radius:12px}#phase{width:110px}@media(max-width:500px){body{padding:14px}nav{grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}nav small{font-size:10px}#views{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.pose{padding:6px}.pose canvas{width:100%;height:auto}label{font-size:13px}}
</style>
<h1>Diez protagonistas · revisión de arte</h1>
<p>156 fotogramas por duende. Visor local de las hojas exportadas: no registra personajes ni modifica el juego. Las cards tienen transparencia; la animación permite inspeccionar las fases, no reproduce los tiempos del motor.</p>
<nav aria-label="Personajes" id="cast"></nav>
<div id="controls"><label>Acción <select id="action"><option value="idle">Quieto</option><option value="walk" selected>Andar</option><option value="run">Correr</option><option value="row">Remar</option><option value="push">Empujar</option><option value="work">Trabajar</option><option value="carried">Llevado por gato</option><option value="pee">Mear</option><option value="poop">Cagar</option><option value="discover">Hallazgo</option></select></label><button id="pause" type="button">Pausar</button><label>Fase <input id="phase" type="range" min="0" max="3" value="0" step="1"></label><label>Fondo <select id="backdrop"><option value="#41624b">Bosque</option><option value="#172621">Noche</option><option value="#e6ddc5">Claro</option></select></label></div>
<p id="status" aria-live="polite"></p><div id="views"></div><div id="links"></div>
<details><summary>Remada compuesta con las nueve barcas · capturas del renderer real</summary><p id="boats"></p><img id="proof" alt="32 vistas del duende en la barca" loading="lazy"></details>
<script id="data" type="application/json">__DATA__</script>
<script>
'use strict';
const people=JSON.parse(document.querySelector('#data').textContent);
const $=s=>document.querySelector(s),state={person:people[0],action:'walk',playing:!matchMedia('(prefers-reduced-motion: reduce)').matches,phase:0,token:0,groups:[],image:null};
const path=(p,file)=>'../'+p.key+'/review/'+file;
const directions=['down','down-right','right','up-right','up','up-left','left','down-left'];
const directionNames=['Abajo','Abajo-derecha','Derecha','Arriba-derecha','Arriba','Arriba-izquierda','Izquierda','Abajo-izquierda'];
const packFor=a=>a==='idle'?'walk':['pee','poop'].includes(a)?'needs':a;
const cache=new Map();
function updatePause(){$('#pause').textContent=state.playing?'Pausar':'Reproducir';}
function setBoat(vessel){$('#proof').src=path(state.person,'browser-chrome/'+vessel+'.png');}
function draw(){
 if(!state.image)return;
 for(const g of state.groups){
  const f=g.frames[state.phase%g.frames.length],c=g.canvas.getContext('2d');c.clearRect(0,0,192,192);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  const factor=2.6,dx=96-f.anchor[0]*factor,dy=(state.action==='carried'?18:156)-f.anchor[1]*factor;
  c.drawImage(state.image,f.x,f.y,f.w*f.pixelRatio,f.h*f.pixelRatio,dx,dy,f.w*factor,f.h*factor);
  g.label.textContent=g.name+' · '+(state.phase%g.frames.length+1)+'/'+g.frames.length;
 }
 $('#phase').value=state.phase;
}
async function select(){
 const token=++state.token,p=state.person,a=state.action,pack=packFor(a);state.image=null;state.phase=0;state.groups=[];
 $('#views').replaceChildren();$('#status').textContent='Preparando vista local…';
 document.querySelectorAll('#cast button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.key===p.key)));
 const entries=Object.entries(p.frames[pack]);
 const headings=['pee','poop','discover'].includes(a)?[a]:['push','work'].includes(a)?directions.filter((_,i)=>i%2===0):directions;
 for(const dir of headings){
  const prefix='person-'+p.variant+'-'+dir;
  const frames=entries.filter(([name])=>a==='idle'?name===prefix:a==='walk'?name.startsWith(prefix+'-walk-'):['pee','poop','discover'].includes(a)?name.startsWith(prefix+'-'):name.startsWith(prefix+'-'+a+'-')).map(([,f])=>f);
  if(!frames.length)throw Error('Faltan fases: '+p.key+'/'+a+'/'+dir);
  const card=document.createElement('div');card.className='pose';card.style.background=$('#backdrop').value;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=192;const label=document.createElement('small');card.append(canvas,label);$('#views').append(card);
  state.groups.push({frames,canvas,label,name:directionNames[directions.indexOf(dir)]||dir});
 }
 $('#phase').max=Math.max(...state.groups.map(g=>g.frames.length))-1;
 const url=path(p,pack+'-atlas.png');if(!cache.has(url)){const im=new Image();im.src=url;cache.set(url,im.decode().then(()=>im));}
 const im=await cache.get(url);if(token!==state.token)return;state.image=im;
 $('#status').textContent=p.number+' · '+p.name+' · '+state.groups.reduce((n,g)=>n+g.frames.length,0)+' fotogramas en esta vista';
 $('#links').replaceChildren();for(const [label,file]of [['Hoja completa',pack+'-contact.png'],['Comparar acciones','scale-comparison.png'],['Card sobre tres fondos','portrait-backgrounds.png'],['Cuerpo sentado sin remos','row-fixed-bodies.png']]){const link=document.createElement('a');link.href=path(p,file);link.textContent=label;link.target='_blank';link.rel='noopener';$('#links').append(link);}
 setBoat('bottle');draw();
}
for(const p of people){const b=document.createElement('button');b.type='button';b.dataset.key=p.key;b.setAttribute('aria-label',p.number+' '+p.name);const im=new Image();im.src=path(p,'portrait.png');im.alt='';im.loading='lazy';const label=document.createElement('small');label.textContent=p.number+' · '+p.name;b.append(im,label);b.onclick=()=>{state.person=p;select().catch(fail);};$('#cast').append(b);}
for(const v of ['bottle','birch','painted','leaf','walnut','willow','cork','tin','gourd']){const b=document.createElement('button');b.type='button';b.textContent=v;b.onclick=()=>setBoat(v);$('#boats').append(b);}
function fail(e){$('#status').textContent='Error de revisión: '+e.message;console.error(e);}
$('#action').onchange=e=>{state.action=e.target.value;select().catch(fail);};$('#pause').onclick=()=>{state.playing=!state.playing;updatePause();};$('#phase').oninput=e=>{state.playing=false;updatePause();state.phase=Number(e.target.value);draw();};$('#backdrop').onchange=e=>document.querySelectorAll('.pose').forEach(c=>c.style.background=e.target.value);
let last=0;function tick(now){if(state.playing&&state.image&&now-last>160&&!document.hidden){last=now;state.phase=(state.phase+1)%(Number($('#phase').max)+1);draw();}requestAnimationFrame(tick);}updatePause();select().catch(fail);requestAnimationFrame(tick);
</script></html>
HTML;
$dir="$base/review-101-110";
if(!is_dir($dir))mkdir($dir,0775,true);
file_put_contents("$dir/index.html",str_replace('__DATA__',$payload,$template));
echo "$dir/index.html\n";
