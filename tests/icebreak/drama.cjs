const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');

test('goal captures a bounded replay and rewinds only render poses',()=>{
 const {api,f,elements}=fixture();api.start();f.clear();api.step(1.5);
 assert.ok(api.replay().history>=35,'live play keeps a recent memory buffer');
 const before={x:f.players[0].x,z:f.players[0].z,puckX:f.puck.x,puckZ:f.puck.z};
 api.goal(0);assert.equal(f.phase,'goal');
 assert.equal(api.replay().moment.team,0);
 assert.ok(api.replay().frames>=35,'goal freezes its replay snapshots');
 api.step(.75);
 assert.match(elements.get('momentLabel').textContent,/INSTANT REPLAY/);
 f.render(1.5);
 assert.equal(f.players[0].x,before.x,'replay must not move a real skater');
 assert.equal(f.players[0].z,before.z);
 assert.equal(f.puck.x,before.puckX,'replay must not move the real puck');
 assert.equal(f.puck.z,before.puckZ);
 assert.equal(api.getState().score[0],1);
 api.step(3.0);
 assert.equal(f.phase,'playing');
 assert.equal(api.replay().frames,0,'faceoff clears the old replay');
});

test('goal attribution credits only a recent shot by the scoring team',()=>{
 const {api,f}=fixture();api.start();f.clear();const shooter=f.players[0];
 f.give(shooter);f.shot(shooter,1);api.goal(0);
 assert.match(api.replay().moment.shooter,/#09 CENTER/);
 const other=fixture();other.api.start();other.f.clear();
 other.f.give(other.f.players[0]);other.f.shot(other.f.players[0],1);
 other.api.goal(1);assert.equal(other.api.replay().moment.shooter,'','no false goal credit for an opposing shot');
});

test('pass selects a more open lane instead of forcing the blocked straight pass',()=>{
 const {api,f}=fixture();api.start();f.clear();
 const p=f.players[0],mateA=f.players[1],mateB=f.players[2];
 Object.assign(p,{x:0,z:0,facing:0,stun:0});
 Object.assign(mateA,{x:9,z:0,vx:0,vz:0});
 Object.assign(mateB,{x:8,z:6,vx:0,vz:0});
 const blockers=f.players.filter(q=>q.team!==p.team&&!q.goalie);
 Object.assign(blockers[0],{x:4,z:0});
 Object.assign(blockers[1],{x:20,z:-8});
 Object.assign(blockers[2],{x:21,z:8});
 f.give(p);f.pass(p);
 assert.ok(f.puck.vz>6,'puck should travel into the clear lateral lane');
});

test('the first forechecker anticipates moving loose pucks',()=>{
 const {api,f}=fixture();api.start();f.clear();
 const p=f.players[0];Object.assign(p,{x:5,z:0,vx:0,vz:0,stun:0});
 f.puck.x=0;f.puck.z=0;f.puck.vx=25;f.puck.vz=0;f.puck.owner=null;
 f.ai(p,1/90);
 assert.ok(p.vx>0,'the skater should attack projected puck travel, not retreat to its old position');
});
