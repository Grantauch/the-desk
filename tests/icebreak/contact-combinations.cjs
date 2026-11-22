const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const dt=1/90;

function readyCut(){
 const {f,api}=fixture();
 api.setSeat(1,0,'kb2');api.start();f.clear();
 const passer=f.players[0],receiver=f.players[1],hitter=f.players[3];
 Object.assign(passer,{x:0,z:0,vx:0,vz:0,facing:0,stun:0});
 Object.assign(receiver,{x:3,z:.38,vx:0,vz:0,facing:0,stun:0});
 Object.assign(f.players[2],{x:-14,z:7,vx:0,vz:0});
 f.give(passer);f.pass(passer);
 assert.equal(f.puck.passTarget,receiver);
 for(let i=0;i<42&&!f.puck.owner;i++)f.puckPhysics(dt);
 assert.equal(f.puck.owner,receiver,'the intended receiver must have collected the pass');
 assert.ok(passer.cutTime>0,'the cut activates on clean intended reception');
 assert.equal(passer.cutReceiver,receiver);
 return {f,api,passer,receiver,hitter};
}
function hit(f,hitter,target,speed){
 Object.assign(hitter,{
  x:target.x-1.06,z:target.z,vx:speed,vz:0,facing:0,energy:1,balance:1,
  check:0,checkWindow:0,checkRecovery:0,stun:0
 });
 Object.assign(target,{vx:0,vz:0,stun:0,balance:1,brace:0});
 assert.equal(f.beginCheck(hitter),true,'the defender must be eligible to check');
 f.collideSkaters(hitter,target);
}
test('solid check on a give-and-go receiver cancels its pass and runner intent',()=>{
 const {f,passer,receiver,hitter}=readyCut();
 hit(f,hitter,receiver,8);
 assert.equal(receiver.has,false);
 assert.equal(f.puck.owner,null,'puck must be physically dislodged');
 assert.equal(f.puck.passTarget,null,'old intended pass cannot remain tagged');
 assert.equal(passer.cutTime,0,'runner must not keep pursuing a canceled return pass');
 assert.equal(passer.cutReceiver,null);
 assert.ok(receiver.impactPower>0,'receiver should react to contact');
 assert.equal(f.phase,'playing');
});
test('heavy check on the cutter cancels tactical run but preserves teammate possession',()=>{
 const {f,passer,receiver,hitter}=readyCut();
 hit(f,hitter,passer,11);
 assert.equal(f.puck.owner,receiver,'the carrier must not lose possession from a remote hit');
 assert.ok(passer.fallTime>0,'runner should physically fall');
 assert.equal(passer.cutTime,0);
 assert.equal(passer.cutReceiver,null);
 assert.equal(passer.has,false);
});
test('glancing check does not arbitrarily erase a viable pass combination',()=>{
 const {f,passer,receiver,hitter}=readyCut();
 const before=passer.cutTime;
 hit(f,hitter,passer,4);
 assert.equal(f.puck.owner,receiver);
 assert.equal(passer.cutTime,before,'light bump cannot invalidate a clean ongoing play');
 assert.equal(passer.cutReceiver,receiver);
 assert.equal(passer.fallTime,0);
});
test('a skater cannot retain a give-and-go run while committing to a check',()=>{
 const {f,passer,receiver}=readyCut();
 assert.ok(passer.cutTime>0);
 assert.equal(f.beginCheck(passer),true);
 assert.equal(passer.cutTime,0);
 assert.equal(passer.cutReceiver,null);
 assert.equal(f.puck.owner,receiver,'a check away from the puck cannot break teammate possession');
});
test('passing ignores fallen, stunned and check-committed teammates',()=>{
 const {f,passer,receiver}=readyCut();
 const third=f.players[2];
 Object.assign(passer,{x:13,z:0,stun:.52,fallTime:.52,checkWindow:0,checkRecovery:0});
 Object.assign(third,{x:7,z:-2,stun:0,fallTime:0,checkWindow:0,checkRecovery:0});
 Object.assign(receiver,{x:4,z:0,facing:0,stun:0});
 f.give(receiver);f.pass(receiver);
 assert.equal(f.puck.passTarget,third,'an upright open player must be chosen over a fallen teammate');
 f.give(receiver);third.checkWindow=.20;
 f.pass(receiver);
 assert.equal(f.puck.owner,receiver,'if all receiving players are checking or down, keep possession');
});
test('combination cancellation and recoil stay symmetric across all three rinks and modes',()=>{
 let expected=null;
 for(const mode of ['regular','powerups']){
  for(const rink of ['school','park','mars']){
   const {f,api}=fixture();api.setRink(rink);api.setMode(mode);api.setSeat(1,0,'kb2');api.start();f.clear();
   const carrier=f.players[0],hitter=f.players[3],runner=f.players[1];
   Object.assign(carrier,{x:0,z:0,vx:0,vz:0,facing:0,stun:0,cutTime:0});
   Object.assign(runner,{x:7,z:3,cutTime:2.2,cutReceiver:carrier});
   Object.assign(hitter,{x:-1.06,z:0,vx:8,vz:0,facing:0,stun:0,energy:1,check:0,checkWindow:0});
   f.give(carrier);assert.equal(f.beginCheck(hitter),true);f.collideSkaters(hitter,carrier);
   const snapshot={mode,loose:f.puck.owner===null,cut:runner.cutTime,hitTier:carrier.impactTier,hitPower:carrier.impactPower,phase:f.phase};
   assert.equal(snapshot.loose,true);assert.equal(snapshot.cut,0);
   const comparable={...snapshot,mode:null};
   if(expected===null||expected.mode!==mode)expected=snapshot;
   else assert.deepEqual(comparable,{...expected,mode:null},'scenery must not alter impact and tactical cancellation');
  }
 }
});
