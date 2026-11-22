const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const dt=1/90;
function match(offset=0){
 const {f,api}=fixture();api.setSeat(1,0,'kb2');api.start();f.clear();
 const a=f.players.find(p=>p.device==='kb1'),b=f.players.find(p=>p.device==='kb2');
 Object.assign(a,{x:0,z:0,vx:0,vz:0,facing:0,stun:0});
 Object.assign(b,{x:1.06,z:offset,vx:0,vz:0,facing:Math.PI,stun:0});
 return {f,api,a,b};
}
function check(speed,offset=0){
 const m=match(offset),{f,api,a,b}=m;
 a.vx=speed;api.input('l',true);api.input('l',false);
 f.collideSkaters(a,b);return m;
}
test('bodyPose is a pure deterministic presentation value, never a physics update',()=>{
 const {f,a}=match();const before=JSON.stringify(a);
 const first=f.bodyPose(a),second=f.bodyPose(a);
 assert.deepEqual(first,second);assert.equal(JSON.stringify(a),before);
 assert.ok(Object.values(first).every(Number.isFinite));
 assert.deepEqual([first.fall,first.swing,first.hit,first.stand,first.brace],[0,0,0,0,0]);
});
test('checking swing and miss recovery have distinct bounded phases',()=>{
 const {f,api,a}=match();a.x=-15;
 assert.equal(f.beginCheck(a),true);
 a.checkWindow=f.CHECK.window*.5;
 assert.ok(f.bodyPose(a).swing>.99,'mid-window has visible shoulder/stick follow-through');
 api.step(.34);assert.ok(a.checkRecovery>0&&!a.checkConnected);
 assert.ok(f.bodyPose(a).miss>0,'failed check must show stumble, not collision sparks');
 assert.equal(f.bodyPose(a).hit,0);
 api.step(.4);assert.equal(f.bodyPose(a).miss,0);
});
test('impact intensity is calculated from actual contact energy',()=>{
 const light=check(4),heavy=check(11);
 assert.equal(light.f.phase,'playing');assert.equal(heavy.f.phase,'playing');
 assert.ok(light.f.bodyPose(light.b).hit>0);
 assert.ok(heavy.f.bodyPose(heavy.b).hit>light.f.bodyPose(light.b).hit);
 assert.ok(heavy.b.fallTime>.5);
 assert.equal(light.b.fallTime,0);
 assert.ok(heavy.f.bodyPose(heavy.b).hit<=1);
});
test('impact direction comes from collision side rather than a canned animation',()=>{
 const right=check(8,.11),left=check(8,-.11);
 assert.equal(right.b.impactDir,1);assert.equal(left.b.impactDir,-1);
 assert.equal(right.f.bodyPose(right.b).side,1);
 assert.equal(left.f.bodyPose(left.b).side,-1);
 assert.ok(right.b.hitFlash>0&&left.b.hitFlash>0);
});
test('ordinary unarmed bump has no artificial check animation',()=>{
 const {f,a,b}=match();
 a.vx=12;f.collideSkaters(a,b);
 assert.equal(f.bodyPose(b).hit,0);assert.equal(b.impactLevel,0);
 assert.equal(b.fallTime,0);
});
test('heavy collision slides, transitions to planted recovery and expires',()=>{
 const {f,api,a,b}=check(11);assert.ok(b.fallTime>.5);
 api.step(.2);assert.ok(f.bodyPose(b).fall>0);
 api.step(.65);assert.equal(b.fallTime,0);
 assert.ok(f.bodyPose(b).stand>0,'get-up should follow the real end of fall');
 assert.equal(b.stun,0);
 api.step(.4);assert.equal(f.bodyPose(b).stand,0);
});
test('physically requested brake briefly creates a braced pose',()=>{
 const {f,api,a}=match();a.vx=8;
 api.input('s',true);api.step(dt);
 assert.ok(f.bodyPose(a).brace>.95);
 api.input('s',false);api.step(.3);
 assert.equal(f.bodyPose(a).brace,0);
});
test('faceoff removes visual contact residue without resetting earned energy',()=>{
 const {f,a,b}=check(11);const energy=b.energy;
 assert.ok(b.hitFlash>0);
 f.resetFaceoff();
 assert.equal(f.bodyPose(b).fall,0);assert.equal(f.bodyPose(b).stand,0);
 assert.equal(f.bodyPose(b).hit,0);assert.equal(f.bodyPose(b).brace,0);
 assert.equal(b.impactLevel,0);assert.equal(b.impactDir,1);
 assert.equal(b.energy,energy);
});
test('Canvas rendering does not alter the live physics after impact',()=>{
 const {f,a,b}=check(11);
 const snapshot=[...f.players.map(p=>[p.x,p.z,p.vx,p.vz,p.energy,p.stun,p.fallTime,p.impactLevel]),[f.puck.x,f.puck.z,f.puck.vx,f.puck.vz]];
 f.render(.18);
 const after=[...f.players.map(p=>[p.x,p.z,p.vx,p.vz,p.energy,p.stun,p.fallTime,p.impactLevel]),[f.puck.x,f.puck.z,f.puck.vx,f.puck.vz]];
 assert.deepEqual(after,snapshot);
});
