'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/hubs/dry-county/flight.js'),'utf8'),sandbox);
const Flight=sandbox.window.DryFlight;
const env={width:6800,height:3300,windX:4,windY:-2};
const dt=1/60;
function advance(c,cmd,seconds){for(let i=0;i<Math.round(seconds/dt);i++)Flight.step(c,cmd,dt,env)}
function finite(c){for(const field of ['x','y','z','a','vx','vy','vz','fuel','rotor'])assert(Number.isFinite(c[field]),field)}
let count=0;
function test(name,fn){fn();count++;console.log('  OK '+name)}

test('three aircraft classes have unique roles and historically labeled equipment',()=>{
 assert.deepEqual(Object.keys(Flight.TYPES).sort(),['balloon','biplane','rotorcraft']);
 assert(Flight.TYPES.rotorcraft.period.includes('Alternate-history'));
 assert(Flight.TYPES.biplane.period.includes('Period'));
 assert.notEqual(Flight.TYPES.biplane.span,Flight.TYPES.rotorcraft.span);
 assert.throws(()=>Flight.create('not-aircraft',10,10),RangeError);
});
test('rotorcraft lifts off, moves, hovers and lands on the ground plane',()=>{
 const c=Flight.create('rotorcraft',3000,1500);
 advance(c,{lift:1,forward:1},5);
 assert(c.z>30,'expected climb');assert(c.x>3000,'expected movement');finite(c);
 advance(c,{lift:0,forward:0},4);
 assert(c.z>0,'expected hover');
 advance(c,{lift:-1,forward:0},14);
 assert.equal(c.z,0);assert.equal(c.landed,true);assert(c.fuel<Flight.TYPES.rotorcraft.fuel);
});
test('biplane must build airspeed before it climbs',()=>{
 const c=Flight.create('biplane',2100,1700);
 advance(c,{lift:1},3);assert.equal(c.z,0,'no vertical leap');
 advance(c,{forward:1,lift:1},10);
 assert(c.z>10,'runway takeoff');assert(Math.hypot(c.vx,c.vy)>Flight.TYPES.biplane.stall);
});
test('balloon moves in the wind and uses heat to adjust height',()=>{
 const c=Flight.create('balloon',2800,1200);
 advance(c,{lift:1},8);
 assert(c.z>0);assert(c.x>2800);assert(c.y<1200);
 advance(c,{lift:-1},15);assert.equal(c.z,0);
});
test('aircraft stay within all map edges at extreme speeds',()=>{
 const c=Flight.create('rotorcraft',60,60,{vx:-300,vy:-300,z:70});
 advance(c,{forward:0,lift:0},2);
 assert(c.x>=54&&c.y>=54);
 c.x=6745;c.y=3245;c.vx=300;c.vy=300;
 advance(c,{forward:1,lift:0},4);
 assert(c.x<=6746&&c.y<=3246);finite(c);
});
test('police follow visible suspects, then preserve last known coordinates',()=>{
 const c=Flight.create('rotorcraft',1000,900,{z:80,landed:false});
 for(let i=0;i<600;i++)Flight.updatePolice(c,{x:2000,y:1200,visible:true},dt,env);
 assert(c.x>1010,'follows actual sighting');assert.deepEqual(c.search,{x:2000,y:1200});
 for(let i=0;i<420;i++)Flight.updatePolice(c,{x:3000,y:2000,visible:false},dt,env);
 assert.deepEqual(c.search,{x:2000,y:1200},'must not track invisible player');
 assert(c.searchAge>6);
 const cmd=Flight.policeInput(c,null,36);assert(cmd.searching);
 finite(c);
});
test('fuel depletion cannot produce powered climbing and aircraft remain finite',()=>{
 const c=Flight.create('rotorcraft',3000,1300,{z:50,landed:false,fuel:0});
 advance(c,{lift:1,forward:1},8);
 assert(c.z<50);assert.equal(c.fuel,0);finite(c);
});
test('large frame gaps are clamped and no NANs emerge during long patrol',()=>{
 const c=Flight.create('rotorcraft',2800,1900,{z:88,landed:false});
 Flight.step(c,{forward:1,lift:1},25,env);finite(c);
 for(let i=0;i<18000;i++)Flight.updatePolice(c,i%120<60?{x:3000,y:1700,visible:true}:null,dt,env);
 finite(c);assert(c.x>=54&&c.y>=54&&c.x<=6746&&c.y<=3246);
});
test('all three craft render through Canvas 2D without external asset dependencies',()=>{
 const methods=['save','restore','beginPath','ellipse','fill','stroke','arc','fillRect','strokeRect','translate','rotate','scale','fillText','moveTo','lineTo','closePath'];
 const ctx={};for(const key of methods)ctx[key]=()=>{};
 for(const type of Object.keys(Flight.TYPES)){const c=Flight.create(type,3000,1300,{z:70});
  Flight.render(ctx,c,1.75,{beamTarget:{x:3100,y:1400}});
  Flight.render(ctx,c,2,{lowDetail:true});
 }
});
console.log('Dry County Flight: '+count+' checks passed.');
