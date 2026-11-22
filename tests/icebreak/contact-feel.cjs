const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const DT=1/90;

function match(speed=8){
 const result=fixture(),{f,api}=result;
 api.setSeat(1,0,'kb2');api.start();f.clear();
 const a=f.players.find(p=>p.device==='kb1'),b=f.players.find(p=>p.device==='kb2');
 Object.assign(a,{x:0,z:0,vx:speed,vz:0,stun:0,facing:0,energy:1,balance:1,check:0,checkWindow:0});
 Object.assign(b,{x:1.06,z:0,vx:0,vz:0,stun:0,facing:Math.PI,energy:1,balance:1,brace:0});
 f.give(b);
 assert.equal(f.beginCheck(a),true);
 f.collideSkaters(a,b);
 return {...result,a,b};
}
test('real checks have progressively stronger recoil, directional symmetry and distinct tiers',()=>{
 const outcomes=[match(4),match(8),match(11),match(13)];
 const expected=[0,1,2,3];
 for(let i=0;i<outcomes.length;i++){
  const {f,a,b}=outcomes[i];
  assert.ok(b.impactTime>0,'carrier must react');
  assert.ok(a.impactTime>0,'checker must also absorb contact');
  assert.equal(b.impactTier,expected[i]);
  assert.equal(a.impactTier,expected[i]);
  assert.equal(b.impactX,1);
  assert.equal(a.impactX,-1,'reaction direction must oppose the transferred normal impulse');
  assert.ok(b.impactPower>a.impactPower,'checker should receive less body recoil');
  if(i)assert.ok(b.impactPower>outcomes[i-1].b.impactPower,'strength should scale with collision energy');
 }
 assert.equal(outcomes[0].f.puck.owner,outcomes[0].b,'glancing hit should not take puck');
 assert.equal(outcomes[1].f.puck.owner,null,'solid hit should dislodge puck');
 assert.ok(outcomes[2].b.fallTime>0,'heavy check must put player down');
 assert.equal(outcomes[3].f.phase,'injury','maximum hit must stop play');
});
test('impact pose pulses once then decays, without repeated collision re-triggers',()=>{
 const {f,api,a,b}=match(11),remaining=b.impactTime;
 assert.equal(f.impactPose(b),0,'reaction starts at contact rather than remaining tilted forever');
 const energy=a.energy;
 f.collideSkaters(a,b);
 assert.equal(b.impactTime,remaining,'same check cannot repeatedly re-arm effects');
 assert.equal(a.energy,energy,'continued collision cannot spend stamina twice');
 api.step(.10);
 assert.ok(f.impactPose(b)>.10,'body recoil must become readable after collision');
 api.step(.40);
 assert.equal(b.impactTime,0);
 assert.equal(f.impactPose(b),0,'reaction should be fully reset after decay');
});
test('injured skater is visibly down throughout stopped five-second clock',()=>{
 const {f,api,b}=match(13);
 assert.equal(f.phase,'injury');
 assert.equal(f.fallAmount(b),1,'injury frame must not show an upright skater');
 const clock=api.getState().timeLeft;
 api.step(3);
 assert.equal(f.fallAmount(b),1,'fall must stay visible while frozen');
 assert.equal(api.getState().timeLeft,clock,'stoppage cannot consume match clock');
 f.endInjury();
 assert.equal(f.fallAmount(b),0,'faceoff resets down pose');
 assert.equal(b.impactTime,0,'faceoff clears transient recoil');
 assert.equal(f.phase,'playing');
});
test('ordinary unarmed contact conserves momentum without fabricated hit feedback',()=>{
 const {f,api,a,b}=match(8);
 f.resetFaceoff();
 Object.assign(a,{x:0,z:0,vx:8,vz:0,stun:0,checkWindow:0,impactTime:0});
 Object.assign(b,{x:1.06,z:0,vx:0,vz:0,stun:0,impactTime:0});
 const before=a.vx*f.ROLE_MASS[a.id]+b.vx*f.ROLE_MASS[b.id];
 f.collideSkaters(a,b);
 const after=a.vx*f.ROLE_MASS[a.id]+b.vx*f.ROLE_MASS[b.id];
 assert.ok(Math.abs(before-after)<1e-9);
 assert.equal(a.impactTime,0);
 assert.equal(b.impactTime,0);
});
test('Canvas rendering presents reaction without writing physics state',()=>{
 const {f,b}=match(11);
 const snapshot=()=>JSON.stringify(f.players.map(p=>[p.x,p.z,p.vx,p.vz,p.balance,p.impactTime,p.impactPower,p.fallTime]));
 const before=snapshot();
 f.render(0.20);f.render(0.25);
 assert.equal(snapshot(),before,'render-only recoil must not change simulation outcomes');
});
