import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,STEP} from '../../packages/icebreak-core/match.mjs';
import {newMatch,advanceMatchFrame,beginGoal,beginInjury} from '../../packages/icebreak-core/lifecycle.mjs';
import {Rooms} from '../../apps/icebreak-server/rooms.mjs';

function run(seed){ // Deterministic fixture, with all eight vacancies using the real AI.
 const game=createMatch({seed,mode:'powerups',rink:'mars'});
 const commands=new Map();
 let before=game.snapshot(),goal=false,injury=false,powers=false,possession=false,save=false;
 for(let i=0;i<14000&&!game.finished();i++){
  game.step(commands);const s=game.snapshot();
  assert.equal(s.tick,before.tick+1);
  if(before.phase!=='playing'||before.dropTime>0)assert.equal(s.timeLeft,before.timeLeft,'clock during stoppage');
  if(s.powerItems.length)powers=true;
  if(s.puck.owner!==null){possession=true;assert.equal(s.players[s.puck.owner].owner,true)}
  assert.equal(s.players.filter(p=>p.owner).length,s.puck.owner===null?0:1);
  if(s.teamSaves[0]+s.teamSaves[1])save=true;
  if(s.phase==='goal'){goal=true;assert.ok(s.holdTime<=3.25)}
  if(s.phase==='injury'){injury=true;assert.ok(s.holdTime<=5&&(s.injured>=0&&s.injured<8))}
  before=s;
 }
 assert.equal(before.timeLeft,0);assert.equal(before.phase,'finished');
 return {goal,injury,powers,possession,save,score:before.score};
}
test('fixed-step AI world plays possession, spawns powerups, scores goals and ends the clock',()=>{
 const result=run(7);
 assert.ok(result.goal&&result.powers&&result.possession&&result.save);
 assert.deepEqual(result.score,[0,1]);
});
test('ordinary active contact can trigger a real five-second injury in the same authoritative loop',()=>{
 const result=run(2);
 assert.ok(result.injury&&result.powers&&result.possession);
});
test('room expiry releases connected peers; short reconnect reservation blocks an early start',()=>{
 let now=0;
 const makePeer=()=>({message:null,send(message){this.message=message}});
 const rooms=new Rooms({now:()=>now,graceMs:20,idleMs:60});
 const host=makePeer(),guest=makePeer();
 const {code}=rooms.handle(host,{type:'create',seat:0});
 rooms.handle(guest,{type:'join',code,seat:7});
 rooms.disconnect(guest);
 assert.throws(()=>rooms.handle(host,{type:'start'}),/PLAYERS_NOT_READY/);
 now=20;rooms.step();
 assert.equal(rooms.handle(host,{type:'start'}).type,'started');
 now=81;rooms.step();
 assert.equal(rooms.size,0);
 assert.equal(host.message.type,'expired');
 assert.equal(rooms.handle(host,{type:'create',seat:0}).type,'seated');
});

test('last live tick cannot run a second play at 0:00; horn emitted once',()=>{
 const players=Array.from({length:8},(_,i)=>({id:i%4,team:i>>2,goalie:i%4===3}));
 const state=newMatch(players),events=[];
 let worldTicks=0;
 for(let i=0;i<11000;i++)advanceMatchFrame(state,STEP,{
  worldStep:()=>worldTicks++,event:(type)=>events.push(type)
 });
 assert.equal(state.timeLeft,0);assert.equal(state.phase,'finished');
 assert.equal(worldTicks,10800);assert.deepEqual(events,['final']);
});

test('goal on last tick records once and holds score/clock until one final, never a new faceoff',()=>{
 const state=endScenario(),events=[];
 let worldTicks=0;
 const tick=()=>advanceMatchFrame(state,STEP,{
  worldStep:()=>{worldTicks++;beginGoal(state,1)},event:(type)=>events.push(type)
 });
 tick();
 assert.deepEqual(state.score,[0,1]);assert.equal(state.phase,'goal');assert.equal(state.goalDelay,3.25);assert.equal(state.timeLeft,0);
 let elapsed=0;
 while(state.phase==='goal'&&elapsed<300){tick();elapsed++;assert.equal(state.timeLeft,0)}
 assert.equal(elapsed,293);assert.equal(worldTicks,1);assert.equal(state.phase,'finished');
 tick();
 assert.deepEqual(events,['final']);assert.deepEqual(state.score,[0,1]);
});

test('injury skip is a real faceoff only with playing time left, else one final',()=>{
 for(const atHorn of [false,true]){
  const state=endScenario(),events=[],record=(type)=>events.push(type);
  if(!atHorn)state.timeLeft=5;
  advanceMatchFrame(state,STEP,{worldStep:()=>beginInjury(state,state.players[3]),event:record});
  assert.equal(state.phase,'injury');assert.equal(state.injuryTime,5);
  const remaining=state.timeLeft;
  advanceMatchFrame(state,STEP,{skipRequested:true,event:record});
  assert.equal(state.timeLeft,remaining);
  if(atHorn){
   assert.equal(state.phase,'finished');
   advanceMatchFrame(state,STEP,{skipRequested:true,event:record});
   assert.deepEqual(events,['injury','final']);
  }else{
   assert.equal(state.phase,'playing');assert.equal(state.dropDelay,1.35);
   assert.deepEqual(events,['injury','faceoff']);
  }
 }
});

function endScenario(){
 const state=newMatch(Array.from({length:8},(_,i)=>({id:i%4,team:i>>2,goalie:i%4===3})));
 state.dropDelay=0;state.timeLeft=STEP;
 return state;
}
