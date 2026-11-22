const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const dt=1/90;
test('goalie anticipates a fast moving shot path without teleporting',()=>{
 const {api,f}=fixture();api.start();f.clear();
 const g=f.players.find(p=>p.goalie&&p.team===1);
 Object.assign(g,{x:25.3,z:0,vx:0,vz:0,stun:0});
 Object.assign(f.puck,{owner:null,x:14,z:-2,vx:30,vz:6,lock:1});
 f.ai(g,dt);
 assert.ok(g.vz>0,'projected goal-line crossing should be above center, even though the puck is currently below');
 assert.ok(g.vz<1,'prediction must obey goalie acceleration, not teleport');
});

test('a slow puck cannot gain speed from touching goalie',()=>{
 const {api,f}=fixture();api.start();f.clear();
 const g=f.players.find(p=>p.goalie&&p.team===0);
 Object.assign(g,{x:-25.3,z:0,stun:0,vx:0,vz:0});
 Object.assign(f.puck,{owner:null,x:g.x+1.21,z:0,vx:-4,vz:0,lock:1});
 const before=Math.hypot(f.puck.vx,f.puck.vz);
 for(let i=0;i<8&&g.saves===0;i++)f.puckPhysics(dt);
 assert.equal(g.saves,1);
 assert.ok(Math.hypot(f.puck.vx,f.puck.vz)<=before*.761,'save must dissipate energy');
 assert.ok(f.puck.vx>0,'left goalie clears towards center ice');
 assert.equal(g.saveKind,'PAD');
});

test('glove/pad reactions preserve directional rebound and reset pose at faceoff',()=>{
 const {api,f}=fixture();api.start();f.clear();
 const g=f.players.find(p=>p.goalie&&p.team===1);
 Object.assign(g,{x:25.3,z:0,stun:0,vx:0,vz:0});
 Object.assign(f.puck,{owner:null,x:g.x-1.2,z:.67,vx:32,vz:0,lock:1});
 for(let i=0;i<8&&g.saves===0;i++)f.puckPhysics(dt);
 assert.equal(g.saves,1);
 assert.equal(g.saveKind,'GLOVE');
 assert.ok(f.puck.vx<0,'right goalie clears away from the goal');
 assert.ok(f.puck.vz>0,'save contact has a lateral rebound');
 assert.ok(g.saveFlash>0);
 f.resetFaceoff();
 assert.equal(g.saveFlash,0,'goalie visual recovery must not leak to the faceoff');
 assert.equal(g.saves,1,'match save count survives faceoff');
});

test('goalie never chases an imaginary trajectory from a puck going away',()=>{
 const {api,f}=fixture();api.start();f.clear();
 const g=f.players.find(p=>p.goalie&&p.team===1);
 Object.assign(g,{x:25.3,z:0,vx:0,vz:0,stun:0});
 Object.assign(f.puck,{owner:null,x:17,z:-2,vx:-27,vz:16,lock:1});
 f.ai(g,dt);
 assert.ok(g.vz<0,'outgoing puck uses current tracking instead of extrapolating a non-existent incoming shot');
});
