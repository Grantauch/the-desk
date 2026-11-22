const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');

const dt=1/90;
function setupPass(){
 const {f,api,...rest}=fixture();
 api.setSeat(0,1,'kb2');api.start();f.clear();
 const p=f.players[0],receiver=f.players[1],unused=f.players[2];
 Object.assign(p,{x:0,z:0,vx:0,vz:0,facing:0,stun:0});
 Object.assign(receiver,{x:3,z:.38,vx:0,vz:0,facing:0,stun:0});
 Object.assign(unused,{x:-14,z:7,vx:0,vz:0});
 f.give(p);f.pass(p);
 assert.equal(f.puck.passTarget,receiver,'intended receiver is the forward open lane');
 assert.equal(f.puck.passFrom,p,'a release records its passer');
 return {f,api,p,receiver,...rest};
}
function travel(f,n=35){for(let i=0;i<n;i++)f.puckPhysics(dt)}
test('low-speed edge control turns more promptly without instantaneous high-speed rotation',()=>{
 const {f}=fixture(),start=f.makePlayer(0,0,0,0),fast=f.makePlayer(0,0,0,0);
 f.skate(start,0,1,dt);
 assert.ok(start.facing>.13&&start.facing<.2,'low speed turns at an assisted but bounded rate');
 fast.vx=10;f.skate(fast,0,1,dt);
 assert.ok(fast.facing>0&&fast.facing<.05,'fast skates still carve with inertia');
 assert.ok(fast.vx>9,'fast sideways input cannot teleport momentum');
});
test('a timed human shot while the intended pass approaches becomes a one-timer',()=>{
 const {f,api,receiver}=setupPass();
 api.input('m',true);
 assert.ok(receiver.oneTimerBuffer>0,'the button arms a finite reception window');
 for(let i=0;i<35&&!api.touch().lastShot?.oneTimer;i++)f.puckPhysics(dt);
 assert.equal(f.puck.owner,null,'one-timer releases the puck instead of sticking');
 assert.equal(receiver.has,false);
 assert.equal(api.touch().lastShot?.oneTimer,true);
 assert.equal(api.touch().lastShot?.number,16);
 assert.ok(Math.hypot(f.puck.vx,f.puck.vz)>31);
 assert.ok(receiver.oneTimerFlash>0,'show the impact as well as simulating it');
});
test('early release cancels a one-timer and receiving becomes normal possession',()=>{
 const {f,api,receiver}=setupPass();
 api.input('m',true);api.input('m',false);
 assert.equal(receiver.oneTimerBuffer,0);
 travel(f);
 assert.equal(f.puck.owner,receiver);
 assert.equal(receiver.has,true);
 assert.equal(receiver.receiveWindow>.1,true);
 assert.equal(api.touch().lastShot,null);
});
test('shoot after receiving a pass makes a one-touch finish, not a long windup',()=>{
 const {f,api,receiver}=setupPass();
 travel(f);
 assert.equal(f.puck.owner,receiver);
 assert.ok(receiver.receiveWindow>0);
 api.input('m',true);
 assert.equal(f.puck.owner,null);
 assert.equal(api.touch().lastShot?.oneTimer,true);
 assert.ok(Math.hypot(f.puck.vx,f.puck.vz)>31);
});
test('a recent pass can be moved immediately to the next teammate',()=>{
 const {f,api,receiver}=setupPass();
 travel(f);assert.equal(f.puck.owner,receiver);
 const before=receiver.receiveWindow;
 assert.ok(before>0);
 f.pass(receiver);
 assert.equal(receiver.receiveWindow,0);
 assert.ok(Math.hypot(f.puck.vx,f.puck.vz)>24,'one-touch pass must be faster than baseline 21');
 assert.equal(f.puck.passFrom,receiver);
});
test('unintended catches are not treated as one-timers',()=>{
 const {f,api,receiver}=setupPass();
 // Intercept before the intended recipient: an AI player may not inherit
 // the human receiver's armed shoot command or the passer bonus.
 const enemy=f.players[3];Object.assign(enemy,{x:4.5,z:.13,stun:0,receiveWait:0});
 // The original intended receiver cuts away after the pass has launched.
 receiver.x=9;
 api.input('m',true);
 travel(f);
 assert.equal(f.puck.owner,enemy);
 assert.equal(receiver.has,false);
 assert.equal(api.touch().lastShot,null);
 assert.equal(enemy.receiveWindow,0);
});
