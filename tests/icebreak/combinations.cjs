const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const dt=1/90;
function setup(){
 const {api,f}=fixture();api.start();f.clear();
 const passer=f.players[0],receiver=f.players[1],third=f.players[2];
 Object.assign(passer,{x:0,z:0,vx:0,vz:0,facing:0,stun:0});
 Object.assign(receiver,{x:3,z:.38,vx:0,vz:0,facing:0,stun:0});
 Object.assign(third,{x:-14,z:7,vx:0,vz:0});
 f.give(passer);f.pass(passer);
 assert.equal(f.puck.passTarget,receiver);
 return {f,api,passer,receiver,third};
}
function deliver(f,n=42){for(let i=0;i<n&&!f.puck.owner;i++)f.puckPhysics(dt)}
test('a clean intended catch starts a timed support run for the original passer',()=>{
 const {f,passer,receiver}=setup();assert.equal(passer.cutTime,0);
 deliver(f);assert.equal(f.puck.owner,receiver);
 assert.ok(passer.cutTime>2);assert.equal(passer.cutReceiver,receiver);
 assert.equal(receiver.cutTime,0);
});
test('an opponent interception cannot activate a false combination',()=>{
 const {f,passer,receiver}=setup();
 const opponent=f.players[3];Object.assign(opponent,{x:4.5,z:.13,stun:0,receiveWait:0});receiver.x=9;
 deliver(f);assert.equal(f.puck.owner,opponent);
 assert.equal(passer.cutTime,0);assert.equal(passer.cutReceiver,null);
});
test('an unintended same-team reception cannot activate the passer run',()=>{
 const {f,passer,receiver,third}=setup();
 Object.assign(third,{x:4.5,z:.13,stun:0,receiveWait:0});receiver.x=9;
 deliver(f);assert.equal(f.puck.owner,third);
 assert.equal(passer.cutTime,0);
});
test('AI passer steers into the offensive passing lane after the catch',()=>{
 const {f,passer,receiver}=setup();deliver(f);
 assert.equal(f.puck.owner,receiver);assert.equal(passer.cutReceiver,receiver);
 passer.vx=passer.vz=0;passer.stun=0;
 f.ai(passer,dt);
 assert.ok(passer.vx>0,'the skater should advance toward the opposing net');
 assert.ok(Math.abs(passer.vz)>.01,'the cut should create a lateral receiving window');
});
test('an AI receiver returns to a clear advancing cutter after the cut matures',()=>{
 const {f,passer,receiver,third}=setup();deliver(f);
 Object.assign(passer,{x:12,z:5,vx:0,vz:0,stun:0,cutTime:1.6});
 Object.assign(receiver,{x:6,z:0,vx:0,vz:0,facing:0,stun:0,shootWait:0,comboCooldown:0});
 third.x=-16;third.z=7;
 for(const enemy of f.players.filter(p=>p.team===1&&!p.goalie))Object.assign(enemy,{x:19,z:-9});
 f.give(receiver);f.ai(receiver,dt);
 assert.equal(f.puck.owner,null,'receiver returns the puck');
 assert.equal(f.puck.passTarget,passer,'AI must target the runner');
 assert.equal(receiver.combos,1);
 assert.ok(receiver.comboCooldown>2);
 assert.equal(passer.cutTime,0);
});
test('a blocked passing lane does not trigger a forced return',()=>{
 const {f,passer,receiver,third}=setup();deliver(f);
 Object.assign(passer,{x:12,z:5,vx:0,vz:0,stun:0,cutTime:1.6});
 Object.assign(receiver,{x:6,z:0,vx:0,vz:0,facing:0,stun:0,shootWait:0,comboCooldown:0});
 third.x=-16;third.z=7;
 for(const enemy of f.players.filter(p=>p.team===1&&!p.goalie))Object.assign(enemy,{x:19,z:-9});
 const defender=f.players[3];Object.assign(defender,{x:9,z:2.5,stun:0});
 f.give(receiver);f.ai(receiver,dt);
 assert.equal(f.puck.owner,receiver,'do not pass through a blocked return lane');
 assert.equal(receiver.combos,0);
});
test('return-pass cooldown prevents runaway give-and-go ping pong',()=>{
 const {f,passer,receiver,third}=setup();deliver(f);
 Object.assign(passer,{x:12,z:5,vx:0,vz:0,stun:0,cutTime:1.6});
 Object.assign(receiver,{x:6,z:0,vx:0,vz:0,facing:0,stun:0,shootWait:0,comboCooldown:0});
 third.x=-16;for(const enemy of f.players.filter(p=>p.team===1&&!p.goalie))Object.assign(enemy,{x:19,z:-9});f.give(receiver);f.ai(receiver,dt);
 assert.equal(f.puck.passTarget,passer);
 // Safely move the puck into the valid swept catch segment without AI ticks.
 passer.receiveWait=0;f.puck.x=passer.x-1.25;f.puck.z=passer.z;f.puck.vx=22;f.puck.vz=0;f.puck.lock=0;
 for(let i=0;i<15&&!f.puck.owner;i++)f.puckPhysics(dt);
 assert.equal(f.puck.owner,passer);
 assert.equal(receiver.cutTime,0,'the returning receiver must not begin a new cut');
 assert.equal(passer.cutTime,0);
 f.resetFaceoff();assert.equal(receiver.comboCooldown,0);assert.equal(passer.cutReceiver,null);
});
