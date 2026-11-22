const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const DT=1/90;

function stage(speed=9, targetBalance=1, rink='school'){
 const result=fixture(),{f,api}=result;
 api.setRink(rink);api.setSeat(1,0,'kb2');api.start();f.clear();
 const a=f.players.find(p=>p.device==='kb1'),b=f.players.find(p=>p.device==='kb2');
 Object.assign(a,{x:0,z:0,vx:speed,vz:0,energy:1,balance:1,facing:0,stun:0,check:0,checkWindow:0,checkRecovery:0});
 Object.assign(b,{x:1.06,z:0,vx:0,vz:0,energy:1,balance:targetBalance,facing:Math.PI,brace:0,stun:0});
 f.give(b);
 return {...result,a,b};
}
test('sharp carving unsettles balance; clean gliding restores it',()=>{
 const {f}=fixture(),edge=f.makePlayer(0,0,0,0),straight=f.makePlayer(0,0,0,0);
 edge.vx=straight.vx=10;
 for(let i=0;i<45;i++){f.skate(edge,0,1,DT);f.skate(straight,1,0,DT)}
 assert.ok(edge.balance<straight.balance-.03,'hard lateral carve must cost stability');
 const low=edge.balance;
 for(let i=0;i<150;i++)f.skate(edge,0,0,DT);
 assert.ok(edge.balance>low+.15,'clean recovery must restore footing');
 assert.ok(edge.balance<=1&&edge.balance>=f.CHECK.balanceMin);
});
test('equal-speed checks launched off a poor edge have less leverage',()=>{
 const {f}=stage(8);
 const planted=f.makePlayer(0,0,0,0),skidding=f.makePlayer(0,0,0,0);
 planted.vx=skidding.vx=9;skidding.balance=.45;
 assert.equal(f.beginCheck(planted),true);assert.equal(f.beginCheck(skidding),true);
 assert.ok(skidding.checkEffort<planted.checkEffort*.9);
 assert.equal(planted.vx,skidding.vx,'arming a check must not add momentum');
});
test('whiff leaves real steering and acceleration recovery without applying a dash',()=>{
 const {f,api,a,b}=stage(8);
 a.x=-15;b.x=19;
 assert.equal(f.beginCheck(a),true);
 const startingEnergy=a.energy;
 api.step(.32);
 assert.equal(a.checkConnected,false);
 assert.equal(a.checkWindow,0);
 assert.ok(a.checkRecovery>.20&&a.checkRecovery<=f.CHECK.whiffRecovery);
 assert.ok(a.balance<.85,'whiff must damage footing');
 assert.equal(a.energy,startingEnergy,'whiff recovery cannot refund spent energy');
 const baseline=f.makePlayer(0,0,0,0);
 baseline.vx=a.vx;baseline.vz=a.vz;baseline.facing=a.facing;baseline.energy=a.energy;baseline.balance=a.balance;
 const before=a.facing;
 f.skate(a,0,1,DT);f.skate(baseline,0,1,DT);
 assert.ok(a.facing-before<baseline.facing-before,'whiff should reduce immediate turning authority');
 api.step(.3);
 assert.equal(a.checkRecovery,0,'normal control returns after a short recovery');
});
test('real contact is rewarded with shorter recovery, not a delayed whiff',()=>{
 const {f,api,a,b}=stage(8);
 assert.equal(f.beginCheck(a),true);
 f.collideSkaters(a,b);
 assert.equal(a.checkConnected,true);
 assert.equal(a.checkWindow,0);
 assert.ok(a.checkRecovery>0&&a.checkRecovery<=f.CHECK.contactRecovery);
 assert.ok(b.balance<1,'glancing or solid contact must disturb defender footing');
 api.step(.35);
 assert.equal(a.checkRecovery,0,'a connected check must not trigger whiff delay later');
});
test('poor defender balance changes a near-threshold hit without creating momentum',()=>{
 const stable=stage(9.4),unsteady=stage(9.4,.42);
 for(const m of [stable,unsteady]){
  assert.equal(m.f.beginCheck(m.a),true);
  m.f.collideSkaters(m.a,m.b);
  assert.equal(m.f.phase,'playing','neither hit should force injury');
 }
 assert.equal(stable.b.fallTime,0,'stable carrier must withstand this hit');
 assert.ok(unsteady.b.fallTime>0,'off-balance carrier must fall to the same hit');
 const momentum=m=>m.a.vx*m.f.ROLE_MASS[m.a.id]+m.b.vx*m.f.ROLE_MASS[m.b.id];
 assert.ok(Math.abs(momentum(stable)-9.4)<1e-9);
 assert.ok(Math.abs(momentum(unsteady)-9.4)<1e-9);
});
test('faceoff clears overcommit and restores neutral footing but preserves stamina',()=>{
 const {f,a}=stage(6);
 a.balance=.4;a.checkRecovery=.20;a.checkConnected=false;a.energy=.33;a.check=.55;
 f.resetFaceoff();
 assert.equal(a.balance,1);assert.equal(a.checkRecovery,0);
 assert.equal(a.energy,.33);assert.equal(a.check,.55);
});
