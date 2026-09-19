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

// Pointer arbitration without a browser: taps, the invisible stick (origin at the touch, following
// origin, dead zone, gait hysteresis), two-finger pan, secondary-button pan, pinch tails, build-mode
// pan, cancellation.
const captures=new Set(), classes=new Set();
const canvas={ addEventListener(){}, setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),
  classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}) };
global.document={getElementById:()=>({hidden:true}),addEventListener(){}};
let cancelled=0;
// La vista mide 400×300 de mundo sobre 800×600 de pantalla: un píxel de pantalla es medio de mundo.
const game={ready:true,world,hasOverlay:()=>false,cameraFollowing:true,camera:{x:600,y:400},player:{x:800,y:558},
  renderer:{width:400,height:300,viewZoom:1,resize(){}},
  pauseMovement(){},cancelPath(){cancelled++;},centerCamera(){}};
const gestures=new MapGestures(game,canvas);
const { STICK_DEAD, STICK_RUN, STICK_WALK } = require("../public/assets/js/adventure/map-gestures");
const event=(x,y,id=1,button=0)=>({clientX:x,clientY:y,pointerId:id,button,preventDefault(){}});
const near=(a,b)=>Math.abs(a-b)<1e-9;
// Un toque: no manda, no suelta la cámara, no corta nada.
gestures.down(event(100,100));gestures.move(event(103,102));assert(gestures.up(event(103,102)));
assert.equal(cancelled,0);assert(game.cameraFollowing);assert.equal(gestures.intent(),null,"Un toque no manda");
/**
 * ⛔ EL MANDO ES UN JOYSTICK INVISIBLE QUE NACE DONDE APOYAS EL DEDO (19-sep-2026). Pasar la
 * holgura es mandar; la dirección va del punto donde se APOYÓ el dedo al punto donde está, como
 * una flecha del teclado, y la cámara sigue siendo del duende. Soltar tras mandar no es un toque.
 */
gestures.down(event(100,100));gestures.move(event(140,100));
assert(gestures.steering,"Pasada la holgura, el dedo manda");
let v=gestures.intent();assert(v&&near(v.x,1)&&v.y===0,"…hacia donde se ha movido desde donde se apoyó");
assert(!gestures.running,"Cuarenta píxeles es andar");
assert(game.cameraFollowing&&game.camera.x===600,"El mando no toca la cámara");
assert.equal(cancelled,1,"Empezar a mandar corta el viaje tocado, como una flecha");
assert(!classes.has("is-panning"),"Mandar no es panear");
gestures.move(event(105,100));assert.equal(gestures.intent(),null,"Dentro de la zona muerta no hay dirección");
// En el borde se corre, con histéresis para que un pulgar en el límite no parpadee.
gestures.move(event(100+STICK_RUN,100));assert(gestures.running,"En el borde del mando se corre");
gestures.move(event(100+STICK_WALK+5,100));assert(gestures.running,"Recogerse un poco sigue corriendo");
gestures.move(event(100+STICK_WALK-5,100));assert(!gestures.running,"Recogerse hasta STICK_WALK vuelve a andar");
// ⛔ EL ORIGEN SIGUE AL DEDO pasado el radio, y por eso volver atrás es virar sin levantar.
gestures.move(event(100+STICK_RUN+80,100));
assert(gestures.running);assert.equal(gestures.stick.origin.x,180,"Pasado el radio, el origen se arrastra detrás del dedo");
gestures.move(event(100+STICK_RUN+80-150,100));
v=gestures.intent();assert(v&&v.x<0,"Volver hacia atrás es cambiar de rumbo sin levantar el dedo");
assert(!gestures.running,"…y a media distancia se anda");
const view=gestures.stickView();
assert(view&&near(view.unit,0.5)&&near(view.radius,STICK_RUN/2)&&near(view.origin.x,90),"El aro se mide en unidades de la vista");
assert(!gestures.up(event(100+STICK_RUN+80-150,100)),"Soltar tras mandar no es un toque");
assert.equal(gestures.intent(),null,"…y soltar para");assert(!gestures.steering&&!gestures.stickView());
assert.equal(captures.size,0);
// Pulsar sin mover es un toque, dure lo que dure: no hay temporizador que lo convierta en otra cosa.
gestures.down(event(400,300));assert.equal(gestures.intent(),null);assert(!gestures.steering);
assert(gestures.up(event(400,300)),"Pulsar sin mover es un toque");
// Dos dedos: el segundo suelta el mando (te paras a mirar), la cámara es suya cuando viajan, y no se
// ordena nada. Al soltar el primero, el que queda sigue siendo de la cámara.
game.cameraFollowing=true;cancelled=0;
gestures.down(event(100,100,1));gestures.move(event(140,100,1));assert(gestures.steering);
gestures.down(event(200,100,2));
assert(!gestures.steering&&gestures.intent()===null,"El segundo dedo suelta el mando");
assert(game.cameraFollowing,"Apoyar dos dedos todavía no suelta la cámara");
gestures.move(event(200,101,2));   // un pellizco casi quieto: zoom sobre el duende, cámara suya
assert(game.cameraFollowing,"Un pellizco quieto hace zoom sin soltar la cámara");
gestures.move(event(230,130,2));   // los dedos viajan: ahora la cámara es de ellos
assert(!game.cameraFollowing,"Cuando los dedos viajan, la cámara es suya");
assert(gestures.dragging&&!gestures.steering,"…y eso es panear, no mandar");
assert(game.camera.x<600&&game.camera.y<400,"La cámara se desplaza hacia donde tiran los dedos");
assert.equal(cancelled,1,"Dos dedos no cortan el viaje tocado que hubiera");
assert(!gestures.up(event(100,100,1)));
assert(gestures.dragging,"El dedo que queda sigue siendo de la cámara");
assert(!gestures.up(event(230,130,2)),"No ghost tap at end of pinch");
assert(!gestures.steering&&!gestures.dragging&&captures.size===0);
// El botón derecho o central del ratón panea. Un botón que no se mueve no suelta nada.
game.cameraFollowing=true;game.camera={x:600,y:400};
gestures.down(event(100,100,1,2));assert(game.cameraFollowing,"Apoyar el botón derecho no suelta la cámara");
gestures.move(event(150,100,1,2));assert(!game.cameraFollowing&&game.camera.x===575,"Arrastrar con el derecho mueve la cámara");
assert(classes.has("is-panning"));assert.equal(gestures.intent(),null,"…sin mandar al duende");
assert(!gestures.up(event(150,100,1,2)),"Soltar el derecho no es un toque");
assert(!classes.has("is-panning"));
// Construyendo, un dedo mueve el mapa: ahí no se dan órdenes de andar.
game.cameraFollowing=true;game.camera={x:600,y:400};game.community={editing:true};
gestures.down(event(100,100));gestures.move(event(180,140));
assert(gestures.dragging&&!gestures.steering&&!game.cameraFollowing,"Construyendo, arrastrar es panear");
assert.deepEqual(game.camera,{x:560,y:380});assert.equal(gestures.intent(),null);
gestures.up(event(180,140));game.community=null;
// Cancelar y limpiar nunca dejan un toque fantasma, un mando puesto ni una captura viva.
game.cameraFollowing=true;
gestures.down(event(100,100));gestures.move(event(160,100));assert(gestures.steering);
assert(!gestures.up(event(160,100),true));assert(!gestures.steering&&gestures.intent()===null,"Cancelar suelta el mando");
gestures.down(event(100,100));gestures.clear();assert(!gestures.up(event(100,100)));assert.equal(captures.size,0);
assert(game.cameraFollowing);assert(STICK_DEAD<STICK_WALK&&STICK_WALK<STICK_RUN,"Los radios van en orden");
console.log("PASS mobility: route-relative gait, eight-direction run/recovery, no corner cutting, frame-independent waypoints, reusable seated clips, invisible stick with following origin and gait hysteresis, two-finger/secondary-button pan and tap arbitration.");
