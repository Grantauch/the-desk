const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const dt=1/90;
const KEY='icebreak:shift-book:v1';
function memoryStorage(initial=[]){
 const data=new Map(initial);
 let writes=0;
 return {getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes++;data.set(k,String(v))},get writes(){return writes},data};
}
function match(level='standard',opts={}){
 const localStorage=opts.localStorage||memoryStorage();
 const q=fixture(undefined,{localStorage});
 const {api,f}=q;
 if(opts.multiplayer)api.setSeat(1,0,'kb2');
 if(opts.mode)api.setMode(opts.mode);
 if(opts.none)api.setSeat(0,0,'ai');
 f.config.difficulty=level;
 api.start();f.clear();
 return {...q,localStorage};
}
test('standard is the backward-compatible default and profile constants are frozen',()=>{
 const {f}=match();
 assert.equal(f.config.difficulty,'standard');
 assert.equal(f.AI_LEVELS.standard.puckLead,.35);
 assert.ok(Object.isFrozen(f.AI_LEVELS));
 for(const level of ['rookie','standard','veteran'])assert.ok(Object.isFrozen(f.AI_LEVELS[level]));
});
test('only opponents change levels in solo games, never a human AI teammate',()=>{
 for(const level of ['rookie','standard','veteran']){
  const {f}=match(level),own=f.players.find(p=>p.team===0&&p.device==='ai'),enemy=f.players.find(p=>p.team===1&&!p.goalie),goalie=f.players.find(p=>p.team===1&&p.goalie);
  assert.equal(f.aiLevelFor(own).label,'STANDARD');
  assert.equal(f.aiLevelFor(enemy).label,level.toUpperCase());
  assert.equal(f.aiLevelFor(goalie).label,level.toUpperCase());
 }
});
test('local multi-human play has Standard computers on both sides, independent of difficulty selector',()=>{
 const {f}=match('veteran',{multiplayer:true});
 for(const player of f.players.filter(p=>p.device==='ai'))assert.equal(f.aiLevelFor(player).label,'STANDARD');
 assert.equal(f.matchStats.solo,false);
});
test('all-AI exhibition uses the selected level on both teams',()=>{
 const {f}=match('rookie',{none:true});
 for(const p of f.players)assert.equal(f.aiLevelFor(p).label,'ROOKIE');
});
test('Rookie plans moves less frequently without changing per-step skate ability',()=>{
 const {f}=match('rookie'),p=f.players.find(p=>p.team===1&&p.id===0);
 Object.assign(p,{x:8,z:0,vx:0,vz:0,stun:0});
 Object.assign(f.puck,{owner:null,x:0,z:7,vx:0,vz:0,lock:1});
 f.ai(p,dt);
 const old=JSON.stringify(p.aiTarget),remaining=p.aiPlanTime;
 assert.ok(remaining>.2);
 Object.assign(f.puck,{x:0,z:-7});
 f.ai(p,dt);
 assert.equal(JSON.stringify(p.aiTarget),old);
 assert.ok(p.aiPlanTime<remaining);
 // Standard responds immediately to changed possession / trajectory.
 const standard=match('standard'),q=standard.f.players.find(p=>p.team===1&&p.id===0);
 standard.f.ai(q,dt);
 assert.equal(q.aiPlanTime,0);assert.equal(q.aiTarget,null);
});
test('fast incoming goalie shot is anticipated earlier at Veteran than Rookie',()=>{
 const aim=level=>{
  const {f}=match(level),g=f.players.find(p=>p.team===1&&p.goalie);
  Object.assign(g,{x:25.3,z:0,vx:0,vz:0,stun:0});
  Object.assign(f.puck,{owner:null,x:10,z:-2,vx:24,vz:5,lock:1});
  f.ai(g,dt);return g.vz;
 };
 const rookie=aim('rookie'),standard=aim('standard'),veteran=aim('veteran');
 assert.ok(rookie<0,'beginner tracks current location instead of the later projected contact');
 assert.ok(standard>0,'balanced predicts incoming contact');
 assert.ok(veteran>0,'Veteran also anticipates');
 assert.ok(Math.abs(rookie)<=.5&&Math.abs(veteran)<=.5,'prediction is steering, never teleportation');
});
test('all difficulty levels use exactly the same skating acceleration, top speed, mass and hit costs',()=>{
 const traces=[];
 for(const level of ['rookie','standard','veteran']){
  const {f}=match(level),p=f.players.find(p=>p.team===1&&p.id===0);
  p.vx=p.vz=0;p.x=8;p.z=0;p.energy=1;
  for(let i=0;i<90;i++){f.skate(p,1,0,dt);p.x+=p.vx*dt}
  traces.push([p.x,p.vx,p.vz,p.energy,f.SKATE.topSpeed,f.SKATE.acceleration,f.CHECK.cost]);
 }
 assert.deepEqual(traces[0],traces[1]);
 assert.deepEqual(traces[1],traces[2]);
});
test('veteran AI chooses more clean-lane shot attempts than rookie under controlled identical conditions',()=>{
 const shots=level=>{
  const {f,api}=match(level),p=f.players.find(p=>p.team===1&&p.id===0);
  for(const enemy of f.players.filter(p=>p.team===0&&!p.goalie))Object.assign(enemy,{x:25,z:10,stun:0});
  f.setSeed(10119);
  let attempts=0;
  for(let i=0;i<850;i++){
   Object.assign(p,{x:-16,z:0,stun:0,shootWait:0,facing:Math.PI,aiPlanTime:0});
   f.give(p);f.ai(p,dt);
   if(!p.has)attempts++;
  }
  return attempts;
 };
 const rookie=shots('rookie'),veteran=shots('veteran');
 assert.ok(veteran>rookie,{rookie,veteran});
});
test('pre-difficulty v1 history migrates safely into Standard only, without duplication',()=>{
 const old={version:1,modes:{regular:{games:4,wins:3,bestGoals:2,bestPasses:6,bestChecks:1,bestSaves:0},powerups:{games:1,wins:0,bestGoals:1}},badges:['first-win'],daily:{day:'2026-11-21',completed:1,streak:1,bestStreak:1}};
 const storage=memoryStorage([[KEY,JSON.stringify(old)]]);
 const {f}=match('rookie',{localStorage:storage});
 assert.equal(f.shiftProgress.modes.regular.games,4);
 assert.equal(f.shiftProgress.byDifficulty.standard.regular.games,4);
 assert.equal(f.shiftProgress.byDifficulty.rookie.regular.games,0);
 assert.equal(f.shiftProgress.byDifficulty.veteran.powerups.games,0);
 assert.equal(f.shiftProgress.badges[0],'first-win');
 assert.equal(storage.writes,0,'reading/migrating is not a silent save');
 f.finish();
 assert.equal(storage.writes,1);
 const reloaded=fixture(undefined,{localStorage:storage});
 assert.equal(reloaded.f.shiftProgress.modes.regular.games,5);
 assert.equal(reloaded.f.shiftProgress.byDifficulty.standard.regular.games,4);
 assert.equal(reloaded.f.shiftProgress.byDifficulty.rookie.regular.games,1);
});
test('mode and difficulty partitions do not contaminate one another, aggregate totals are still accurate',()=>{
 const storage=memoryStorage();
 for(const level of ['rookie','veteran']){
  const {f}=match(level,{localStorage:storage});
  f.finish();
 }
 const {f}=match('standard',{mode:'powerups',localStorage:storage});
 f.finish();
 const p=fixture(undefined,{localStorage:storage}).f.shiftProgress;
 assert.equal(p.modes.regular.games,2);
 assert.equal(p.byDifficulty.rookie.regular.games,1);
 assert.equal(p.byDifficulty.veteran.regular.games,1);
 assert.equal(p.byDifficulty.standard.regular.games,0);
 assert.equal(p.modes.powerups.games,1);assert.equal(p.byDifficulty.standard.powerups.games,1);
});
test('faceoff clears Rookie tactical state without affecting personal bests',()=>{
 const {f}=match('rookie'),bot=f.players.find(p=>p.team===1&&p.id===0);
 f.ai(bot,dt);assert.ok(bot.aiPlanTime>0);
 f.resetFaceoff();
 assert.equal(bot.aiPlanTime,0);assert.equal(bot.aiTarget,null);
 assert.equal(f.shiftProgress.byDifficulty.rookie.regular.games,0);
});

test('a pressured AI carrier no longer hoards the puck indefinitely while near goal',()=>{
 const {f}=match('standard'),p=f.players.find(p=>p.team===1&&p.id===0);
 const blocking=f.players.find(p=>p.team===0&&p.id===1);
 Object.assign(p,{x:-23,z:0,facing:Math.PI,vx:0,vz:0,stun:0,shootWait:0});
 Object.assign(blocking,{x:-25,z:0,stun:0});
 f.give(p);p.carryTime=5;
 let released=false;
 for(let i=0;i<450;i++){
  f.ai(p,dt);
  if(!p.has){released=true;break}
 }
 assert.equal(released,true,'real shot/pass should release after extended possession in attack zone');
 assert.equal(p.carryTime,0,'a release resets puck-control age');
 assert.ok(f.matchStats.teamShots[1]+f.matchStats.teamPasses[1]>0,'AI creates a real event, not a fake score');
 assert.equal(f.score[1],0,'shooting cannot grant an automatic goal');
});
test('holding the puck as a human never triggers automatic offensive decisions',()=>{
 const {f,api}=match('veteran'),human=f.players.find(p=>p.device==='kb1');
 for(const player of f.players)if(player!==human){player.stun=999;player.x=player.team===1?25:-25;player.z=10}
 f.give(human);human.stun=0;
 api.step(6);
 assert.equal(f.puck.owner,human);
 assert.ok(human.carryTime>5);
 assert.equal(f.matchStats.human.shots,0);
 assert.equal(f.matchStats.teamPasses[0],0);
});
test('carrying timers clear at faceoffs and on normal passes',()=>{
 const {f}=match('standard'),p=f.players.find(p=>p.device==='kb1');
 f.give(p);p.carryTime=7;f.pass(p);
 assert.equal(p.carryTime,0);
 f.give(p);p.carryTime=5;f.resetFaceoff();
 assert.equal(p.carryTime,0);
});
