"use strict";
const assert = require("node:assert/strict");
const { TravelPace, routeDistance, WALK_SPEED, RUN_SPEED } = require("../public/assets/js/adventure/locomotion");
const { follow } = require("../public/assets/js/adventure/movement");
const { runFrame, DIRECTIONS } = require("../public/assets/js/adventure/characters");
const { seatedClip } = require("../public/assets/js/adventure/seating");
const { pose } = require("../public/assets/js/adventure/ambient-actors");
const { MapGestures } = require("../public/assets/js/adventure/map-gestures");
const { stickVector } = require("../public/assets/js/adventure/world-controls");
const { smoothPath } = require("../public/assets/js/adventure/navigation");
assert.equal(stickVector(0,0,40),null);
assert.equal(stickVector(4,4,40),null);
for(let i=0;i<8;i++) {
  const angle=i*Math.PI/4, vector=stickVector(Math.cos(angle)*40,Math.sin(angle)*40,40);
  assert(Math.abs(Math.hypot(vector.x,vector.y)-1)<1e-10,"Equal speed in all eight directions");
  assert(Math.abs(vector.x-Math.cos(angle))<1e-10 && Math.abs(vector.y-Math.sin(angle))<1e-10);
}
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

// Pointer arbitration without a browser: taps, slop, drag, pinch tails, cancellation.
const captures=new Set(), classes=new Set();
const canvas={ addEventListener(){}, setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),
  classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}) };
global.document={getElementById:()=>({hidden:true}),addEventListener(){}};
let paused=0;
const game={ready:true,world,hasOverlay:()=>false,cameraFollowing:true,camera:{x:600,y:400},renderer:{width:400,height:300,viewZoom:1,resize(){}},pauseMovement(){paused++;},centerCamera(){}};
const gestures=new MapGestures(game,canvas);
const event=(x,y,id=1)=>({clientX:x,clientY:y,pointerId:id,button:0,preventDefault(){}});
gestures.down(event(100,100));gestures.move(event(103,102));assert(gestures.up(event(103,102)));
assert.equal(paused,0);assert(game.cameraFollowing);
gestures.down(event(100,100));gestures.move(event(180,140));assert(!gestures.up(event(180,140)));
assert(!game.cameraFollowing);assert.deepEqual(game.camera,{x:560,y:380});assert.equal(paused,1);assert.equal(captures.size,0);
gestures.down(event(100,100,1));gestures.down(event(200,100,2));gestures.move(event(230,100,2));
assert(!gestures.up(event(100,100,1)));assert(!gestures.up(event(230,100,2)),"No ghost tap at end of pinch");
gestures.down(event(100,100));assert(!gestures.up(event(100,100),true));
gestures.down(event(100,100));gestures.clear();assert(!gestures.up(event(100,100)));assert.equal(captures.size,0);
console.log("PASS mobility: route-relative gait, eight-direction run/recovery, no corner cutting, frame-independent waypoints, reusable seated clips, mouse/touch gesture arbitration.");
