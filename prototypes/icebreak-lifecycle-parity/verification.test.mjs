import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {LIFECYCLE,newMatch,resetFaceoff,beginGoal,beginInjury,skipInjury,finishMatch,advanceLifecycle} from './lifecycle.mjs';
import {CHECK} from '../icebreak-parity/headless.mjs';

const require=createRequire(import.meta.url);
const {fixture,file}=require('../../tests/icebreak/fixture.cjs');
const html=readFileSync(file,'utf8');
const probe=`window.__LIFECYCLE_PROBE__={
 get phase(){return phase},get paused(){return paused},get timeLeft(){return timeLeft},
 setTimeLeft:value=>{timeLeft=value},get dropDelay(){return dropDelay},
 get goalDelay(){return goalDelay},get injuryTime(){return injuryTime},
 get injured(){return injured},get score(){return score},
 get goalTeam(){return goalTeam},get period(){return period},
 get replayElapsed(){return replayElapsed},get replaySample(){return replaySample},
 get lastShot(){return lastShot},get replayHistory(){return replayHistory},
 get replayFrames(){return replayFrames},get trail(){return trail}
};`;
assert.ok(html.includes('\n})();'),'expected integrated browser script boundary');
const sourceWithProbe=html.replace('\n})();','\n'+probe+'\n})();');
const DT=1/90,approx=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-9,`${label}: ${a} vs ${b}`);

function setup(){
 const result=fixture(sourceWithProbe);
 result.api.start();
 const probe=result.sandbox.window.__LIFECYCLE_PROBE__;
 assert.ok(probe,'browser lifecycle probes not attached');
 return {...result,probe};
}
function stateFromBrowser({f,probe}){
 const players=f.players.map(p=>({...p}));
 const translate=p=>p?players[f.players.indexOf(p)]:null;
 return {
  players,puck:{...f.puck,owner:translate(f.puck.owner),
   passFrom:translate(f.puck.passFrom),passTarget:translate(f.puck.passTarget)},
  score:[...probe.score],phase:probe.phase,paused:probe.paused,
  timeLeft:probe.timeLeft,period:probe.period,dropDelay:probe.dropDelay,
  goalDelay:probe.goalDelay,injuryTime:probe.injuryTime,
  injured:translate(probe.injured),goalTeam:probe.goalTeam,
  control:translate(f.control),lastShot:probe.lastShot?{...probe.lastShot}:null,
  replayElapsed:probe.replayElapsed,replaySample:probe.replaySample,
  replayHistory:[],replayFrames:[],trail:[]
 };
}
function equalState(state,scene,context='lifecycle'){
 const {f,probe}=scene;
 for(const name of ['timeLeft','dropDelay','goalDelay','injuryTime','replayElapsed'])approx(state[name],probe[name],context+'.'+name);
 for(const name of ['phase','paused','period','goalTeam'])assert.equal(state[name],probe[name],context+'.'+name);
 assert.deepEqual(state.score,[...probe.score],context+'.score');
 assert.equal(state.injured?state.players.indexOf(state.injured):-1,probe.injured?f.players.indexOf(probe.injured):-1,context+'.injured');
}
function equalFaceoff(state,scene){
 equalState(state,scene,'faceoff');
 const {f}=scene;
 assert.equal(f.players.length,8);
 assert.equal(state.players.length,8);
 for(let i=0;i<8;i++){
  const a=f.players[i],b=state.players[i];
  for(const key of ['x','z','vx','vz','facing','energy','balance','check','checkWindow',
   'checkRecovery','checkConnected','stun','fallTime','fallSpan','receiveWait','skid',
   'brace','puckWobble','hitFlash','impactTime','impactSpan','impactPower','impactX',
   'impactZ','impactTier','impactDir','impactLevel','standPose','bracePose','has',
   'shotCharge','oneTimerBuffer','receiveWindow','oneTimerFlash','saveFlash',
   'saveSide','saveKind','carryTime','aiPlanTime','cutTime','comboCooldown',
   'team','id','goalie','number','device','power','powerTime']){
   if(typeof a[key]==='number')approx(a[key],b[key],`player ${i}.${key}`);
   else assert.equal(b[key],a[key],`player ${i}.${key}`);
  }
  assert.equal(b.cutReceiver,null);
  assert.equal(b.aiTarget,null);
 }
 assert.equal(state.players.indexOf(state.control),f.players.indexOf(f.control),'human seat kept across reset');
 for(const key of ['x','z','vx','vz','lock'])approx(state.puck[key],f.puck[key],'faceoff puck '+key);
 assert.equal(state.puck.owner,null);assert.equal(state.puck.passFrom,null);assert.equal(state.puck.passTarget,null);
}
function tick(scene,state,frames){
 for(let n=0;n<frames;n++){
  scene.api.step(DT);
  advanceLifecycle(state,DT);
  equalState(state,scene,'tick '+n);
 }
}

test('headless lifecycle constants follow integrated game',()=>{
 const match=html.match(/const MOMENT=Object\.freeze\((\{[\s\S]*?\})\);/);
 assert.ok(match,'browser MOMENT constants missing');
 const moment=Function('return ('+match[1]+')')();
 assert.equal(LIFECYCLE.goalSeconds,moment.goalSeconds);
 assert.equal(LIFECYCLE.injurySeconds,CHECK.injurySeconds);
 assert.equal(LIFECYCLE.periodSeconds,120);
 assert.equal(LIFECYCLE.faceoffSeconds,1.35);
});

test('eight role-specific faceoff positions, retained control, stamina and check cooldown match browser',()=>{
 const scene=setup(),{f}=scene;
 for(const [i,p] of f.players.entries()){
  p.x=i*2-7;p.z=i-5;p.energy=.2+i*.09;p.check=.43+i*.05;
  p.stun=1;p.fallTime=.5;p.balance=.4;p.vx=8;p.vz=4;
  p.oneTimerBuffer=.24;p.cutTime=2;p.impactTime=.3;p.bracePose=.2;
  p.power='boost';p.powerTime=4;
 }
 const state=stateFromBrowser(scene);
 resetFaceoff(state);f.resetFaceoff();
 equalFaceoff(state,scene);
 for(let i=0;i<8;i++){
  approx(state.players[i].energy,.2+i*.09,'preserved stamina '+i);
  approx(state.players[i].check,.43+i*.05,'preserved cooldown '+i);
  assert.equal(state.players[i].power,'boost');
 }
});

test('new match enforces eight seats, centered puck, correct clock and drop delay',()=>{
 const scene=setup(),players=scene.f.players.map(p=>({...p}));
 const game=newMatch(players);
 assert.equal(game.phase,'playing');
 assert.equal(game.timeLeft,120);
 assert.equal(game.dropDelay,1.35);
 assert.deepEqual(game.score,[0,0]);
 assert.equal(game.players.filter(p=>p.goalie).length,2);
 assert.throws(()=>newMatch(players.slice(0,7)),/EXACTLY_EIGHT_SKATERS_REQUIRED/);
});

test('faceoff hold freezes world simulation and regulation clock, exactly like browser',()=>{
 const scene=setup(),state=stateFromBrowser(scene);
 let calls=0;
 for(let i=0;i<60;i++){
  scene.api.step(DT);
  advanceLifecycle(state,DT,()=>calls++);
  equalState(state,scene);
 }
 assert.equal(calls,0);
 assert.equal(state.timeLeft,120);
 assert.ok(state.dropDelay>0);
});

test('paused gameplay freezes match clock and cannot invoke server world step',()=>{
 const scene=setup();scene.f.clear();scene.f.setPaused(true);
 const state=stateFromBrowser(scene);let calls=0;
 for(let i=0;i<90;i++){
  scene.api.step(DT);
  assert.equal(advanceLifecycle(state,DT,()=>calls++),'paused');
 }
 assert.equal(calls,0);equalState(state,scene);
});

for(const team of [0,1])test('goal by team '+team+' freezes clock for replay then resets all eight roles',()=>{
 const scene=setup();scene.f.clear();
 const state=stateFromBrowser(scene);
 assert.equal(beginGoal(state,team),true);
 scene.api.goal(team);
 assert.equal(beginGoal(state,team),false,'duplicate score must not count while replay active');
 scene.api.goal(team);
 equalState(state,scene);
 const initialClock=state.timeLeft;
 let simulated=0;
 for(let i=0;i<290;i++){
  scene.api.step(DT);
  advanceLifecycle(state,DT,()=>simulated++);
  equalState(state,scene);
 }
 assert.equal(simulated,0,'world does not advance during the goal replay');
 assert.equal(state.timeLeft,initialClock);
 assert.equal(state.score[team],1);
 for(let i=290;i<300;i++){
  scene.api.step(DT);advanceLifecycle(state,DT);
  equalState(state,scene);
 }
 assert.equal(state.phase,'playing');
 equalFaceoff(state,scene);
});

function hit(scene){
 const {f}=scene;f.clear();
 const a=f.players.find(p=>p.device==='kb1');
 const b=f.players.find(p=>p.team!==a.team&&!p.goalie);
 Object.assign(a,{x:0,z:0,vx:13,vz:0,facing:0,energy:1,stun:0,check:0});
 Object.assign(b,{x:1.06,z:0,vx:0,vz:0,facing:Math.PI,stun:0});
 f.give(b);
 assert.equal(f.beginCheck(a),true);
 f.collideSkaters(a,b);
 assert.equal(f.phase,'injury','natural 13-unit checked contact must trigger injury');
 return b;
}
test('actual heavy-hit injury freezes game and a skip restores possession-free faceoff',()=>{
 const scene=setup(),victim=hit(scene),state=stateFromBrowser(scene);
 state.phase='playing';state.injuryTime=0;state.injured=null;
 assert.equal(beginInjury(state,state.players[scene.f.players.indexOf(victim)]),true);
 equalState(state,scene);
 const clock=state.timeLeft,x=state.players[0].x,energy=state.players[0].energy,device=state.players[0].device;
 tick(scene,state,90);
 assert.equal(state.phase,'injury');assert.equal(state.timeLeft,clock);
 assert.equal(state.players[0].x,x);
 assert.equal(state.players[0].energy,energy);
 assert.equal(skipInjury(state),true);
 scene.f.endInjury();
 equalFaceoff(state,scene);
 assert.equal(state.players[0].energy,energy);
 assert.equal(state.players[0].device,device);
 assert.equal(skipInjury(state),false);
});

test('automatic five-second injury timeout ends at same simulation tick as browser',()=>{
 const scene=setup(),victim=hit(scene),state=stateFromBrowser(scene);
 state.phase='playing';state.injured=null;state.injuryTime=0;
 beginInjury(state,state.players[scene.f.players.indexOf(victim)]);
 tick(scene,state,449);
 assert.equal(state.phase,'injury');
 tick(scene,state,1);
 assert.equal(state.phase,'playing');
 equalFaceoff(state,scene);
 assert.equal(state.injuryTime,0);
});

test('final horn stops clock and cannot run again after finish',()=>{
 const scene=setup();scene.f.clear();scene.probe.setTimeLeft(.04);
 const state=stateFromBrowser(scene);
 for(let i=0;i<8;i++){
  scene.api.step(DT);
  advanceLifecycle(state,DT);
  equalState(state,scene);
 }
 assert.equal(state.phase,'finished');
 assert.equal(state.timeLeft,0);
 assert.equal(finishMatch(state),false);
});

test('zero-clock injury timeout finishes match instead of returning to faceoff',()=>{
 const scene=setup(),victim=hit(scene);
 scene.probe.setTimeLeft(0);
 const state=stateFromBrowser(scene);state.phase='playing';state.injuryTime=0;state.injured=null;
 beginInjury(state,state.players[scene.f.players.indexOf(victim)]);
 assert.equal(skipInjury(state),true);
 scene.f.endInjury();
 equalState(state,scene);
 assert.equal(state.phase,'finished');
});

test('zero-clock goal replay ends at final horn rather than another faceoff',()=>{
 const scene=setup();scene.f.clear();scene.probe.setTimeLeft(0);
 const state=stateFromBrowser(scene);
 scene.api.goal(1);beginGoal(state,1);
 tick(scene,state,293);
 assert.equal(state.phase,'finished');
 assert.deepEqual(state.score,[0,1]);
});

test('headless clock gate rejects malformed ticks and illegal transitions',()=>{
 const scene=setup(),state=stateFromBrowser(scene);
 for(const bad of [0,-1,NaN,Infinity,.06])assert.throws(()=>advanceLifecycle(state,bad),/INVALID_TICK/);
 assert.throws(()=>beginGoal(state,2),/INVALID_GOAL_TEAM/);
 assert.throws(()=>beginInjury(state,{id:2}),/INVALID_INJURED_PLAYER/);
 assert.equal(skipInjury(state),false);
 assert.deepEqual(state.score,[0,0]);
});
