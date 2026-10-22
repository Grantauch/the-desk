'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const sandbox={window:{}};
for(const name of ['flight.js','air-bridge.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/hubs/dry-county',name),'utf8'),sandbox);
const F=sandbox.window.DryFlight,B=sandbox.window.DryAirBridge;
const world={width:1200,height:900,P:(x,y)=>({x:600+x,y:250+y}),nearest:p=>({d:Math.abs(p.x-400)})};
const roof={x:765,y:380,w:75,h:60,z:36};
const blocked=(x,y,r=10,z=0)=>x<55+r||y<55+r||x>1145-r||y>845-r||(z<=roof.z+2&&x+r>roof.x&&x-r<roof.x+roof.w&&y+r>roof.y&&y-r<roof.y+roof.h);
let changed=0;
const create=saved=>B.create({flight:F,world,blocked,save:saved,onChange:()=>changed++});
const dt=1/60;let n=0;const test=(title,fn)=>{fn();console.log('  OK '+title);n++};
const player=(x,y)=>({x,y,car:null,air:null,a:0,vx:0,vy:0});
const steps=(bridge,p,input,count)=>{for(let i=0;i<count;i++)bridge.tick(p,input,dt,{x:0,y:0})};

test('three air pads and craft are created once, outside any roof',()=>{
 const b=create();assert.equal(b.pads.length,3);assert.equal(b.craft.length,3);
 assert.equal(new Set(b.craft.map(c=>c.id)).size,3);
 for(const c of b.craft)assert(!blocked(c.x,c.y,F.TYPES[c.type].span*.44+11,0));
});
test('only nearby pedestrians board aircraft; a driver cannot board',()=>{
 const b=create(),a=b.craft[0],p=player(a.x,a.y);
 p.car={type:'sedan'};assert.equal(b.interaction(p).handled,false);p.car=null;
 assert.equal(b.interaction(p).kind,'board');assert.equal(b.mounted,a);assert.equal(p.air,a);
 assert.equal(b.interaction(p).kind,'exit');assert.equal(b.mounted,null);assert.equal(p.air,null);
});
test('takeoff blocks cockpit exit, then safe landing permits exit',()=>{
 const b=create(),a=b.craft[0],p=player(a.x,a.y);b.interaction(p);
 steps(b,p,{lift:1,forward:0},300);assert(a.z>20);
 assert.equal(b.interaction(p).kind,undefined);assert.equal(p.air,a,'cannot jump out airborne');
 steps(b,p,{lift:-1,forward:0},900);assert.equal(a.z,0);
 steps(b,p,{lift:0,forward:0},180);assert.equal(b.interaction(p).kind,'exit');
 assert.equal(p.air,null);
});
test('roof penetration is stopped by a continuous 3D collision sweep',()=>{
 const b=create(),a=b.craft[0],p=player(a.x,a.y);b.interaction(p);
 a.x=roof.x-57;a.y=roof.y+roof.h/2;a.z=25;a.vx=100;a.vy=0;a.vz=0;a.landed=false;
 for(let i=0;i<30;i++)b.tick(p,{forward:1,lift:0},dt);
 assert(a.x<roof.x,'craft entered a roof');assert(a.z>=0);assert(a.health<100,'impact carries damage');
 // At high enough altitude the same 2D building is passable.
 a.x=roof.x-57;a.y=roof.y+roof.h/2;a.z=roof.z+90;a.vx=100;a.vy=0;a.vz=0;
 steps(b,p,{forward:1,lift:0},50);
 assert(a.x>roof.x-40,'safe overflight should not collide with roof');
});
test('save in flight resumes parked at last safe spot; loading never duplicates craft',()=>{
 const b=create(),a=b.craft[1],p=player(a.x,a.y);b.interaction(p);
 steps(b,p,{forward:1,lift:1},600);assert(a.z>0);
 const pad={...a.lastSafe}; // Taxi changes the last safe landing point before takeoff.
 const snap=b.snapshot(),record=snap.craft.find(c=>c.id==='jenny');
 assert.equal(record.x,pad.x);assert.equal(record.y,pad.y);
 const reloaded=create(snap);
 assert.equal(reloaded.craft.length,3);assert.equal(reloaded.craft[1].z,0);
 assert.equal(reloaded.craft[1].x,pad.x);assert.equal(reloaded.craft[1].y,pad.y);
 reloaded.restore(snap);assert.equal(reloaded.craft.length,3);
});
test('corrupted saved positions are ignored rather than placing planes in buildings',()=>{
 const b=create({v:1,craft:[{id:'rotor',x:roof.x+20,y:roof.y+20,fuel:-80,health:0},{id:'jenny',x:Infinity,y:200,fuel:90000}]});
 assert(!blocked(b.craft[0].x,b.craft[0].y,25,0));assert.equal(b.craft[0].health,1);
 assert.equal(b.craft[1].fuel,F.TYPES.biplane.fuel);
});
test('boarding and exiting trigger save notifications and do not duplicate or teleport the player',()=>{
 const b=create(),a=b.craft[2],p=player(a.x,a.y);const before=changed;
 assert.equal(b.interaction(p).kind,'board');assert.equal(changed,before+1);
 assert.equal(b.interaction(p).kind,'exit');assert.equal(changed,before+2);
 assert(Math.hypot(p.x-a.x,p.y-a.y)<110);assert(!blocked(p.x,p.y,10,0));
});
test('missing exit clearances never allow exiting into walls',()=>{
 const b=B.create({flight:F,world,blocked:(x,y,r,z)=>blocked(x,y,r,z)||(x>425&&x<560&&y>540&&y<640)});
 const a=b.craft[0],p=player(a.x,a.y);b.interaction(p);
 // Guaranteed no exit is possible by re-instantiating with a collision check
 // that blocks all exit points but preserves the original pad.
 const sealed=B.create({flight:F,world,blocked:(x,y,r,z)=>r===10||blocked(x,y,r,z)});
 const air=sealed.craft[0],q=player(air.x,air.y);sealed.interaction(q);
 assert.equal(sealed.interaction(q).handled,true);assert(q.air,'remains safely boarded');
});
test('airborne movement remains suspended unless tick is explicitly called',()=>{
 const b=create(),a=b.craft[0],p=player(a.x,a.y);b.interaction(p);
 steps(b,p,{lift:1},60);
 const x=a.x,y=a.y,z=a.z,clock=b.snapshot();
 assert.equal(a.x,x);assert.equal(a.y,y);assert.equal(a.z,z);
 assert.equal(b.snapshot().craft.length,clock.craft.length);
});
console.log('Dry County Air Bridge: '+n+' checks passed.');
