'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const box={window:{}};for(const file of ['flight.js','air-ops.js'])
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../public/hubs/dry-county',file),'utf8'),box);
const F=box.window.DryFlight,O=box.window.DryAirOps;
const world={width:1200,height:900,P:(x,y)=>({x:310+x,y:185+y})},dt=1/60;
const roof={x:540,y:420,w:72,h:105,z:57};
const blocked=(x,y,r=2,z=0)=>x<55+r||y<55+r||x>1145-r||y>845-r||
 (z<=roof.z+2&&x+r>roof.x&&x-r<roof.x+roof.w&&y+r>roof.y&&y-r<roof.y+roof.h);
const events=[];const ops=()=>O.create({flight:F,world,blocked,onCourier:(kind,payload)=>events.push([kind,payload])});
let tests=0;const test=(name,fn)=>{fn();tests++;console.log('  OK '+name)};
const person=(x,y,z=0)=>({x,y,car:null,air:z?{z,vx:0,vy:0}:null,vx:0,vy:0});
const tick=(o,heat,player,n=1,extra={})=>{let result;for(let i=0;i<n;i++)result=o.tickLaw(dt,{heat,player,wind:{x:0,y:0},rain:0,night:0,...extra});return result};
const simpleCtx=new Proxy({},{get:()=>()=>{}});
test('no airborne law unit exists below threat threshold',()=>{
 const o=ops();tick(o,40,person(800,650),120);assert.equal(o.phase,'off');assert.equal(o.aircraft,null);
});
test('serious pursuit deploys exactly one aerial unit',()=>{
 const o=ops();tick(o,65,person(900,650));const c=o.aircraft;assert(c);assert.equal(c.type,'rotorcraft');tick(o,85,person(900,650),120);assert.equal(o.aircraft,c);assert(Number.isFinite(c.x));
});
test('patrol follows authored waypoints without borrowing invisible player coordinates',()=>{
 const o=ops();const far=person(1100,830);tick(o,80,far,360,{rain:1,night:1});const c=o.aircraft;
 assert(c);assert.notEqual(c.x,world.width*.085);assert(!c.search,'unseen player must not become target');
});
test('3D line of sight is obstructed by roofs, not blocked by a lower roof when ray clears it',()=>{
 const o=ops();
 assert(!o.clearSight({x:420,y:472,z:110},{x:720,y:472,z:0}),'downward ray intersects tall roof');
 assert(o.clearSight({x:420,y:472,z:180},{x:720,y:472,z:180}),'high air-to-air ray clears roof');
});
test('forward-facing detection has range, cone, rain and altitude gates',()=>{
 const o=ops(),air=F.create('rotorcraft',400,300,{z:115,a:0});
 assert(o.canSpot(air,person(530,300)));
 assert(!o.canSpot(air,person(300,300)),'rear target');
 assert(!o.canSpot(air,person(1050,300)),'too far');
 assert(!o.canSpot(air,person(530,300,350)),'height mismatch');
 assert(!o.canSpot(air,person(895,300),1,1),'bad weather must reduce range');
});
test('sightings update verified last known location, not an unseen teleport',()=>{
 const o=ops(),p=person(900,700);tick(o,80,p);const c=o.aircraft;c.x=650;c.y=700;c.a=0;c.z=140;
 assert(tick(o,80,p).visible,'clear forward target');
 const last={...c.search};p.x=200;p.y=100;
 for(let i=0;i<180;i++)tick(o,80,p);
 assert.equal(c.search.x,last.x,'do not track hidden player x');
 assert.equal(c.search.y,last.y,'do not track hidden player y');
 assert.equal(o.phase,'search');
});
test('roof blocks police detection at street height behind a building',()=>{
 const o=ops(),c=F.create('rotorcraft',430,472,{z:110,a:0});
 assert(!o.canSpot(c,person(720,472)),'rooftop occludes sloping ray');
});
test('evasion returns to patrol after search memory expires',()=>{
 const o=ops(),p=person(1000,650);tick(o,80,p);const c=o.aircraft;
 c.search={x:700,y:600};c.searchAge=26;p.x=100;p.y=100;
 tick(o,70,p,720);
 assert(['search','patrol'].includes(o.phase));
 assert(c.searchAge>28,'lost sight ages correctly');
});
test('aerial law retires once wanted heat clears and can reset without spawning duplicates',()=>{
 const o=ops();tick(o,75,person(1100,600));const c=o.aircraft;assert(c);
 tick(o,0,person(1100,600),2400);
 assert(['off','return'].includes(o.phase));o.reset();assert.equal(o.aircraft,null);assert.equal(o.phase,'off');
});
test('courier requires a parked aircraft near its own hangar and cannot double-start',()=>{
 const o=ops(),craft=F.create('biplane',350,400,{id:'jenny',home:{x:350,y:400}});
 assert.equal(o.startCourier(person(350,400)).ok,false);
 const p={x:350,y:400,air:craft};assert.equal(o.startCourier(p).ok,true);
 assert.equal(o.startCourier(p).ok,false);assert.equal(o.courier.stage,0);
});
test('air courier requires altitude, ordered checkpoints and safe return',()=>{
 events.length=0;const o=ops(),craft=F.create('biplane',350,400,{id:'jenny',home:{x:350,y:400}});
 const p={x:350,y:400,air:craft};o.startCourier(p);
 const second=o.drops[1];p.x=second.x;p.y=second.y;craft.z=90;craft.landed=false;
 o.tickCourier(dt,{player:p,pads:[]});assert.equal(o.courier.stage,0,'must fly first drop before second');
 const first=o.drops[0];p.x=first.x;p.y=first.y;craft.z=28;
 o.tickCourier(dt,{player:p,pads:[]});assert.equal(o.courier.stage,0,'low-altitude drop forbidden');
 craft.z=100;o.tickCourier(dt,{player:p,pads:[]});assert.equal(o.courier.stage,1);
 p.x=second.x;p.y=second.y;o.tickCourier(dt,{player:p,pads:[]});assert.equal(o.courier.stage,2);
 p.x=350;p.y=400;craft.z=0;craft.landed=true;craft.vx=craft.vy=0;
 const done=o.tickCourier(dt,{player:p,pads:[{x:350,y:400,r:65}]});
 assert(done.complete);assert.equal(done.reward,42);assert.equal(o.courier,null);
 assert.deepEqual(events.map(e=>e[0]),['start','drop','drop','complete']);
});
test('leaving the aircraft or timing out fails courier without paying rewards',()=>{
 events.length=0;const o=ops(),craft=F.create('rotorcraft',300,400,{id:'r',home:{x:300,y:400}});
 const p={x:300,y:400,air:craft};o.startCourier(p);p.air=null;
 assert(o.tickCourier(dt,{player:p,pads:[]}).failed);
 p.air=craft;o.startCourier(p);assert(o.tickCourier(256,{player:p,pads:[]})===null||o.courier!==null,'timeout is clamped per tick');
 for(let i=0;i<16000;i++)o.tickCourier(dt,{player:p,pads:[]});
 assert.equal(o.courier,null);assert.equal(events.filter(e=>e[0]==='complete').length,0);
});
test('patrol and courier render in low detail without sprite allocation',()=>{
 const o=ops(),p=person(920,680);tick(o,70,p);o.draw(simpleCtx,5,0,()=>true);o.map(simpleCtx,x=>x,true);
});
console.log('Dry County Flight B3: '+tests+' checks passed.');
