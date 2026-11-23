const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const DT=1/90;
function quiet(f,api){
 api.start();f.clear();for(const p of f.players){p.stun=999;p.receiveWait=0}
 f.puck.x=0;f.puck.z=0;f.puck.vx=0;f.puck.vz=0;f.puck.owner=null;f.puck.lock=0;
}
test('fast goal-bound puck is intercepted by goalie along its path',()=>{
 const {f,api}=fixture();quiet(f,api);
 const g=f.players.find(p=>p.goalie&&p.team===1);
 g.x=25.4;g.z=0;f.puck.x=22;f.puck.z=0;f.puck.vx=640;
 f.puckPhysics(DT);
 assert.equal(f.score[0],0,'crossing a keeper must not register as a goal');
 assert.ok(f.puck.vx<0,'save must deflect shot away from goal');
 assert.ok(Math.abs(f.puck.x)<26.35,'saved puck stays in front of goal line');
});
test('shot scores only if it crosses the actual goal-mouth segment',()=>{
 const {f,api}=fixture();quiet(f,api);
 f.puck.x=26;f.puck.z=3.2;f.puck.vx=110;f.puck.vz=-130;
 f.puckPhysics(DT);
 assert.equal(f.score[0],0,'ending inside mouth after crossing outside is not a goal');
});
test('valid high-speed centerline goal still counts',()=>{
 const {f,api}=fixture();quiet(f,api);
 f.puck.x=26.2;f.puck.z=0;f.puck.vx=110;f.puck.vz=0;
 f.puckPhysics(DT);
 assert.equal(f.score[0],1,'shot already past keeper should enter goal');
});
test('fast puck can be intercepted by skater along swept trajectory',()=>{
 const {f,api}=fixture();quiet(f,api);
 const receiver=f.players[0];receiver.x=0;receiver.z=0;receiver.stun=0;
 f.puck.x=-2.25;f.puck.z=0;f.puck.vx=400;
 f.puckPhysics(DT);
 assert.equal(f.puck.owner,receiver,'skater on path must receive puck even if endpoint is beyond stick radius');
});
test('player contact separates boundary-pinned overlaps without passing through walls',()=>{
 const {f,api}=fixture();quiet(f,api);
 const a=f.players[0],b=f.players[1];
 for(const p of f.players)if(p!==a&&p!==b){p.x=-15;p.z=(p.id+1)*2+(p.team*10)}
 a.x=26.65;a.z=0;b.x=26.67;b.z=0;
 f.updatePlayers(DT);
 const distance=Math.hypot(a.x-b.x,a.z-b.z);
 assert.ok(distance>1.07,'overlap must be essentially resolved, got '+distance);
 assert.ok(Math.max(a.x,b.x)<=26.7,'player cannot be displaced outside boards');
});
test('fixed simulation is reproducible at 30, 60 and 120 render FPS',()=>{
 const run=fps=>{
  const {f,api}=fixture();quiet(f,api);f.players[0].stun=0;api.input('w',true);
  let steps=0;for(let n=0;n<fps;n++)steps+=f.advanceFrame(1/fps);
  return {steps,x:f.players[0].x,z:f.players[0].z,t:api.getState().timeLeft};
 };
 const a=run(30),b=run(60),c=run(120);
 assert.equal(a.steps,90);assert.equal(b.steps,90);assert.equal(c.steps,90);
 assert.deepEqual(a,b);assert.deepEqual(b,c);
});
test('very long frame stalls are capped without unbounded physics catch-up',()=>{
 const {f,api}=fixture();quiet(f,api);
 const before=api.getState().timeLeft;
 const steps=f.advanceFrame(10);
 assert.ok(steps>0&&steps<=9,'catch-up budget exceeded: '+steps);
 assert.ok(before-api.getState().timeLeft<=.101,'gameplay advanced across a ten-second stall');
});

test('seeded long-play simulations stay finite, in bounds and rink-independent',()=>{
 const timer=Date.now(),seconds=24;
 for(const mode of ['regular','powerups']){
  let expected=null;
  for(const rink of ['school','park','mars']){
   const {f,api}=fixture();api.setMode(mode);api.setRink(rink);api.start();
   api.step(seconds);
   for(const p of f.players){
    assert.ok([p.x,p.z,p.vx,p.vz,p.facing,p.energy].every(Number.isFinite),mode+' '+rink+' produced non-finite skater');
    assert.ok(Math.abs(p.x)<=26.71&&Math.abs(p.z)<=11.71,mode+' '+rink+' skater left the rink');
    assert.ok(p.energy>=0&&p.energy<=1,mode+' '+rink+' invalid energy');
   }
   assert.ok([f.puck.x,f.puck.z,f.puck.vx,f.puck.vz].every(Number.isFinite),mode+' '+rink+' puck non-finite');
   assert.ok(Math.abs(f.puck.x)<29&&Math.abs(f.puck.z)<13,mode+' '+rink+' runaway puck');
   const snapshot=JSON.stringify({score:f.score,phase:f.phase,players:f.players.map(p=>[p.x,p.z,p.vx,p.vz,p.energy]),puck:[f.puck.x,f.puck.z,f.puck.vx,f.puck.vz]});
   if(expected!==null)assert.equal(snapshot,expected,'rink scenery must not change the physics simulation');
   expected=snapshot;
  }
 }
 console.log(JSON.stringify({stress:'six seeded 24-second matches',simulationSteps:6*seconds*90,wallClockMs:Date.now()-timer}));
});
test('goal-line crossing is symmetrical at both ends and respects edges',()=>{
 for(const side of [-1,1]){
  const {f,api}=fixture();quiet(f,api);
  f.players.filter(p=>p.goalie).forEach(p=>p.z=4.2);
  f.puck.x=side*24;f.puck.z=0;f.puck.vx=side*350;
  f.puckPhysics(DT);
  assert.equal(f.score[side===1?0:1],1,'goal did not count at '+side);
 }
});
