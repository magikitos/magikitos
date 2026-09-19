"use strict";
const assert = require("node:assert/strict");
const { TravelPace, routeDistance, WALK_SPEED, RUN_SPEED } = require("../public/assets/js/adventure/locomotion");
const { follow } = require("../public/assets/js/adventure/movement");
const { runFrame, DIRECTIONS } = require("../public/assets/js/adventure/characters");
const { seatedClip } = require("../public/assets/js/adventure/seating");
const { pose } = require("../public/assets/js/adventure/ambient-actors");
const { MapGestures } = require("../public/assets/js/adventure/map-gestures");
const { smoothPath } = require("../public/assets/js/adventure/navigation");
const diagonal=Array.from({length:180},(_,i)=>({x:(i+1)*16,y:(i+1)*16}));
assert.deepEqual(smoothPath({clearSegment:()=>true},{x:0,y:0},diagonal),[diagonal.at(-1)],"Long clear diagonals have no steering waypoints, even beyond the search horizon");
assert.deepEqual(smoothPath({clearSegment:()=>true},{x:0,y:0},[...diagonal,{x:4000,y:3000}]),[{x:4000,y:3000}],"A distant visible target needs no intermediate bends");
const start = { x: 200, y: 200 };
const route = (distance, spacing = 8) => Array.from({ length: Math.ceil(distance / spacing) }, (_, i) => ({ x: start.x + Math.min(distance, (i + 1) * spacing), y: start.y }));
const world = { width: 160, height: 120, data: {}, canStand: () => true, collisionAt: () => null };
assert(RUN_SPEED > WALK_SPEED * 1.8);
for (const [length, pace] of [[24,"walk"], [150,"run"], [480,"run"]]) {
  const path = route(length), travel = new TravelPace();
  assert.equal(routeDistance(start, path), length);
  travel.begin(start, path);
  assert.equal(travel.speed(start, path), pace === "walk" ? WALK_SPEED : RUN_SPEED);
  assert.equal(travel.speed({ x: start.x + length - 24, y: start.y }, [path.at(-1)]), WALK_SPEED);
  assert.equal(travel.rollDistance, undefined, "No implicit roll, even on very long journeys");
}
const turn = [{x:216,y:200},{x:232,y:200},{x:232,y:500}];
const travel = new TravelPace(); travel.begin(start,turn);
assert.equal(travel.speed(start, turn), RUN_SPEED);
for (const fps of [20,30,60,120]) {
  const actor = {...start}, path = route(600,2);
  for(let i=0;i<fps;i++) follow(world,actor,path,1/fps,RUN_SPEED);
  assert(Math.abs(actor.x-start.x-RUN_SPEED)<1e-6,`Full budget over short waypoints at ${fps} FPS`);
}
{
  const actor={...start}, path=route(200,2);
  follow(world,actor,path,1,RUN_SPEED,()=>{},()=>false);
  assert(actor.x<=start.x+2,"Threshold callback stops this frame immediately");
}
for (const direction of DIRECTIONS) {
  for (let i=0;i<4;i++) assert.equal(runFrame({direction,walkDistance:i*9},true),`person-100-${direction}-run-${i}`);
  assert.equal(runFrame({direction},false),null);
  for (const mood of [0,2]) {
    const clip=seatedClip(`person-12-${direction}-sit-${mood}`);
    assert(clip); assert.equal(pose(clip,0).frame,clip.steps[0][0]);
    assert.equal(pose(clip,3).frame,pose(clip,3+clip.duration).frame);
  }
}

// Pointer arbitration without a browser: taps, hold-to-guide, slop, two-finger pan, secondary-button
// pan, pinch tails, build-mode pan, cancellation.
const captures=new Set(), classes=new Set();
const canvas={ addEventListener(){}, setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),
  classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}) };
global.document={getElementById:()=>({hidden:true}),addEventListener(){}};
let paused=0;
const llevado=[];
// La vista mide 400×300 de mundo sobre 800×600 de pantalla: un píxel de pantalla es medio píxel de
// mundo. El cuerpo del duende (ocho píxeles sobre los pies) está en el centro exacto, (800, 550).
const game={ready:true,world,hasOverlay:()=>false,cameraFollowing:true,camera:{x:600,y:400},player:{x:800,y:558},
  renderer:{width:400,height:300,viewZoom:1,resize(){}},
  pauseMovement(){paused++;},centerCamera(){},leadTo(p){llevado.push(p);}};
const gestures=new MapGestures(game,canvas);
const { HOLD_MS } = require("../public/assets/js/adventure/map-gestures");
const event=(x,y,id=1,button=0)=>({clientX:x,clientY:y,pointerId:id,button,preventDefault(){}});
// Un toque: ni guía, ni suelta la cámara, ni pausa nada.
gestures.down(event(100,100));gestures.move(event(103,102));assert(gestures.up(event(103,102)));
assert.equal(paused,0);assert(game.cameraFollowing);
assert.deepEqual(llevado,[],"Un toque no guía, así que no lleva a nadie a ninguna parte");
/**
 * ⛔ MANTENER ES GUIAR (19-sep-2026). Pasar la holgura con un dedo es guiar al duende hacia lo que
 * hay bajo el dedo, y la cámara sigue siendo SUYA: no se mueve ni se suelta. Soltar no es un toque.
 */
gestures.down(event(100,100));gestures.move(event(180,140));
assert(gestures.guiding,"Pasada la holgura, se guía");
assert.deepEqual(llevado,[{x:690,y:470}],"El destino es lo que hay bajo el dedo, en coordenadas de mundo");
assert(game.cameraFollowing,"Guiar no suelta la cámara");assert.deepEqual(game.camera,{x:600,y:400},"…ni la mueve");
assert.equal(paused,1,"El viaje anterior se corta una vez al empezar a guiar");
assert(!gestures.up(event(180,140)),"Soltar tras guiar no es un toque");assert.equal(captures.size,0);
assert(!classes.has("is-panning"),"Guiar no es panear");
// El destino se replanea según el dedo se mueve DE VERDAD: un camino por fotograma serían sesenta
// búsquedas por segundo para correr la meta un par de píxeles.
llevado.length=0;
gestures.down(event(400,300));
gestures.move(event(460,300));   // pasa la holgura: 30 px de mundo a la derecha del cuerpo → primer destino
gestures.move(event(464,300));   // dos píxeles de mundo: todavía es el mismo sitio
assert.equal(llevado.length,1,"Mover el dedo dos píxeles de mundo no replanea nada");
gestures.move(event(500,300));   // veinte: destino nuevo
assert.equal(llevado.length,2,"Y cuando el dedo cambia de sitio, el destino se muda");
assert(llevado[1].x>llevado[0].x,"El destino va con el dedo");
gestures.up(event(500,300));
// Un dedo QUIETO pasa a guiar cuando lleva HOLD_MS puesto, desde el bucle y no desde un temporizador.
llevado.length=0;paused=0;
const t0=performance.now();
gestures.down(event(500,300));
gestures.update(t0+HOLD_MS/2);assert(!gestures.guiding,"Antes de HOLD_MS un dedo quieto sigue siendo un toque en curso");
assert.deepEqual(llevado,[]);
gestures.update(t0+HOLD_MS+1000);assert(gestures.guiding,"Pasado HOLD_MS, guía");
assert.deepEqual(llevado,[{x:850,y:550}],"…hacia lo que hay bajo el dedo");
gestures.update(t0+HOLD_MS+1100);assert.equal(llevado.length,1,"Con el dedo y la cámara quietos no se replanea");
assert(gestures.up(event(500,300)),"Levantar sin haber movido el dedo sigue siendo un TOQUE, aunque se haya guiado");
// El dedo ENCIMA del duende es quieto: se pausa el viaje y no se ordena ninguno.
llevado.length=0;paused=0;
gestures.down(event(402,298));
gestures.update(performance.now()+HOLD_MS+1000);
assert(gestures.guiding&&gestures.resting,"Encima del duende se guía en reposo");
assert.deepEqual(llevado,[],"…sin destino");assert.equal(paused,2,"…y con el viaje que hubiera cortado (empezar a guiar, y parar)");
assert.equal(gestures.guideVector(),null,"En reposo no hay rumbo que adelantar");
gestures.move(event(412,298));   // cinco píxeles de mundo: dentro de la histéresis, sigue quieto
gestures.update(performance.now()+HOLD_MS+2000);
assert(gestures.resting&&llevado.length===0,"Cinco píxeles no sacan del reposo");
gestures.move(event(450,298));   // veinticinco: ya guía
gestures.update(performance.now()+HOLD_MS+3000);
assert(!gestures.resting&&llevado.length===1,"Veinticinco sí");
assert(gestures.guideVector().x>0,"…y el rumbo apunta al dedo");
gestures.up(event(450,298));
// Dos dedos: la cámara es suya y no se ordena nada. Al soltar el primero, el que queda sigue siendo de la cámara.
llevado.length=0;paused=0;game.cameraFollowing=true;
gestures.down(event(100,100,1));gestures.down(event(200,100,2));
assert(game.cameraFollowing,"Apoyar dos dedos todavía no suelta la cámara");
gestures.move(event(200,101,2));   // un pellizco casi quieto: zoom sobre el duende, cámara suya
assert(game.cameraFollowing,"Un pellizco quieto hace zoom sin soltar la cámara");
gestures.move(event(230,130,2));   // los dedos viajan: ahora la cámara es de ellos
assert(!game.cameraFollowing,"Cuando los dedos viajan, la cámara es suya");
assert(gestures.dragging&&!gestures.guiding,"…y eso es panear, no guiar");
assert(game.camera.x<600&&game.camera.y<400,"La cámara se desplaza hacia donde tiran los dedos");
assert.deepEqual(llevado,[],"Dos dedos no ordenan nada");assert.equal(paused,0,"…ni cortan el viaje que hubiera");
assert(!gestures.up(event(100,100,1)));
assert(gestures.dragging,"El dedo que queda sigue siendo de la cámara");
assert(!gestures.up(event(230,130,2)),"No ghost tap at end of pinch");
assert(!gestures.guiding&&!gestures.dragging&&captures.size===0);
// El botón derecho o central del ratón panea. Un botón que no se mueve no suelta nada.
game.cameraFollowing=true;game.camera={x:600,y:400};
gestures.down(event(100,100,1,2));assert(game.cameraFollowing,"Apoyar el botón derecho no suelta la cámara");
gestures.move(event(150,100,1,2));assert(!game.cameraFollowing&&game.camera.x===575,"Arrastrar con el derecho mueve la cámara");
assert(classes.has("is-panning"));assert(!gestures.up(event(150,100,1,2)),"Soltar el derecho no es un toque");
assert(!classes.has("is-panning"));assert.deepEqual(llevado,[]);
// Construyendo, un dedo mueve el mapa: ahí no se dan órdenes de andar.
game.cameraFollowing=true;game.camera={x:600,y:400};game.community={editing:true};
gestures.down(event(100,100));gestures.move(event(180,140));
assert(gestures.dragging&&!gestures.guiding&&!game.cameraFollowing,"Construyendo, arrastrar es panear");
assert.deepEqual(game.camera,{x:560,y:380});assert.deepEqual(llevado,[]);
gestures.update(performance.now()+HOLD_MS+1000);assert(!gestures.guiding,"…y un dedo quieto tampoco guía");
gestures.up(event(180,140));game.community=null;
// Cancelar y limpiar nunca dejan un toque fantasma ni una captura viva.
game.cameraFollowing=true;
gestures.down(event(100,100));assert(!gestures.up(event(100,100),true));
gestures.down(event(100,100));gestures.clear();assert(!gestures.up(event(100,100)));assert.equal(captures.size,0);
assert(game.cameraFollowing&&llevado.length===0);
console.log("PASS mobility: route-relative gait, eight-direction run/recovery, no corner cutting, frame-independent waypoints, reusable seated clips, hold-to-guide with rest and hysteresis, two-finger/secondary-button pan and tap arbitration.");
