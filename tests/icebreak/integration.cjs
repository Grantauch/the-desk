const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');

test('merged AI tactics, physical impact and progression survive one match and reset together',()=>{
 const {f,api}=fixture();
 f.config.difficulty='veteran';api.start();f.clear();
 const attacker=f.players.find(p=>p.team===0&&!p.goalie&&p.device==='kb1');
 const defender=f.players.find(p=>p.team===1&&!p.goalie&&p.id===0);
 assert.equal(f.aiLevelFor(defender).label,'VETERAN');
 assert.equal(f.aiLevelFor(attacker).label,'STANDARD');
 assert.ok(f.matchStats&&f.matchStats.human,'the solo progression tracker must exist');
 Object.assign(attacker,{x:-1.06,z:0,vx:11,vz:0,facing:0,stun:0,energy:1,check:0});
 Object.assign(defender,{x:0,z:0,vx:0,vz:0,stun:0});
 f.give(defender);
 assert.equal(f.beginCheck(attacker),true);
 f.collideSkaters(attacker,defender);
 assert.ok(defender.impactTime>0,'physical impact feedback must remain active');
 assert.ok(Number.isFinite(f.impactPose(defender)),'impact animation must be finite');
 assert.ok(Number.isFinite(f.bodyPose(defender).hit),'body pose must coexist with impact visual');
 defender.carryTime=7;defender.aiPlanTime=.3;
 f.resetFaceoff();
 assert.equal(defender.impactTime,0,'faceoff removes contact residue');
 assert.equal(defender.carryTime,0,'faceoff clears strategic carry timers');
 assert.equal(defender.aiPlanTime,0,'faceoff clears planned AI decisions');
 assert.ok(f.matchStats,'faceoff preserves the match stat ledger');
});
