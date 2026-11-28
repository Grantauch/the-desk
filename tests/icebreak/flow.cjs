// Game-flow checks: play never locks up, and AI matches are two-sided.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const DT=1/90;

// Plays an all-AI match from the opening faceoff and reports flow statistics.
function playMatch(seed,seconds=120){
 const {f,api}=fixture();
 f.setSeed(seed);api.setSeat(0,0,'ai');api.start();
 let pinned=0,longestPin=0,carried=0,changes=0,last=null;
 for(let i=0;i<seconds*30;i++){
  api.step(1/30);
  const s=api.getState();if(s.phase!=='playing')continue;
  if(s.puck.owner!==last){changes++;last=s.puck.owner}
  const c=f.players.find(p=>p.has);
  if(!c){pinned=0;continue}
  carried++;
  const near=Math.min(...f.players.filter(p=>p.team!==c.team&&!p.goalie).map(p=>Math.hypot(p.x-c.x,p.z-c.z)));
  pinned=Math.hypot(c.vx,c.vz)<1.5&&near<1.4?pinned+1/30:0;
  longestPin=Math.max(longestPin,pinned);
 }
 return {score:api.getState().score,longestPin,changes,carried};
}

test('a carrier held chest-to-chest by a defender loses the puck',()=>{
 const {f,api}=fixture();
 api.start();f.clear();
 const carrier=f.players.find(p=>p.team===0&&!p.goalie),defender=f.players.find(p=>p.team===1&&!p.goalie);
 for(const p of [carrier,defender]){p.stun=0;p.receiveWait=0;p.device='ai';p.vx=p.vz=0}
 carrier.x=0;carrier.z=0;carrier.facing=0;defender.x=1.08;defender.z=0;defender.facing=Math.PI;
 f.give(carrier);
 let lost=false;
 for(let i=0;i<90*2&&!lost;i++){f.step(DT);lost=!carrier.has}
 assert.ok(lost,'two seconds of stick-on-puck pressure must knock the puck loose');
});

test('opening faceoff never turns into a shoving stalemate',()=>{
 for(const seed of [48171,7,1234]){
  const r=playMatch(seed,60);
  assert.ok(r.longestPin<2,`seed ${seed}: carrier stuck in place for ${r.longestPin.toFixed(1)}s`);
 }
});

test('both centers can win the opening faceoff',()=>{
 const wins=[0,0];
 for(let seed=1;seed<=16;seed++){
  const {f,api}=fixture();f.setSeed(seed*268435456+12345);api.setSeat(0,0,'ai');api.start();
  for(let i=0;i<90*4&&!f.puck.owner;i++)f.step(DT);
  if(f.puck.owner)wins[f.puck.owner.team]++;
 }
 assert.ok(wins[0]>=3&&wins[1]>=3,`faceoffs must be contested; Glaciers ${wins[0]}, Embers ${wins[1]}`);
});

test('AI-only matches are two-sided over many games',()=>{
 const goals=[0,0];
 for(let seed=1;seed<=12;seed++){const r=playMatch(seed*7919);goals[0]+=r.score[0];goals[1]+=r.score[1]}
 assert.ok(goals[0]>=3&&goals[1]>=3,`both teams must score; got Glaciers ${goals[0]}, Embers ${goals[1]}`);
 assert.ok(goals[0]+goals[1]>=12,`matches need real chances; only ${goals[0]+goals[1]} goals in 12 games`);
});

module.exports={playMatch};
