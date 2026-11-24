// Room-local authoritative ICEBREAK world. Gameplay port pinned to browser
// blob b83e673bad60ee22f58703355077ef8ea53696f1 (#528), using locks/geometry
// from #557, active contact #559, and lifecycle #570. No DOM, audio or I/O.
import {CHECK, GOALX, GOALZ, limitPlayer, skate, steer, segmentCircleTime, goalCrossing} from './skating.mjs';
import {STICK, armCheck, advanceCheck, resolveContact} from './contact.mjs';
import {newMatch, beginGoal, advanceLifecycle, skipInjury} from './lifecycle.mjs';
export const STEP = 1 / 90;
export const MODES = Object.freeze(['regular','powerups']);
export const RINKS = Object.freeze(['school','park','mars']);
export const ROLES = Object.freeze(['CENTER','WING','DEFENDER','GOALIE']);
const BUTTONS = ['pass','check','shoot'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const normalize=(x,z)=>{const d=Math.hypot(x,z)||1;return [x/d,z/d]};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const round=n=>Math.round(n*10000)/10000;
const atSlot=p=>p ? p.team*4+p.id : null;
const ONE_TIMER=Object.freeze({buffer:.48,receiveWindow:.30,baseCharge:.35,shotBoost:1.14,accuracy:.75,catchReach:12});
const KEEPER=Object.freeze({readHorizon:.75,readMinSpeed:9,aimBlend:.95,slotLimit:2.55,saveDrag:.76,reboundLock:.23,savePose:.47});
const COMBO=Object.freeze({window:2.3,goDelay:.5,advance:7.4,lateral:5.5,minProgress:2.5,returnCooldown:2.8,scoreBonus:8});
const BODY=Object.freeze({hitDuration:.32,standDuration:.33,braceDuration:.20});
const OFFENSE=Object.freeze({shotZone:19.5,shootFromTraffic:14.5,carryUrgency:3.4,passUrgency:4.2});
const AI_LEVELS=Object.freeze({standard:Object.freeze({label:'STANDARD',goalHorizon:KEEPER.readHorizon,goalBlend:KEEPER.aimBlend,
 puckLead:.35,shotRate:1,passRate:1,aimWeight:.70,checkChance:1,thinkDelay:0,allowReturns:true})});
const stickPoint=p=>{const side=STICK.side+p.puckWobble;return {x:p.x+Math.cos(p.facing)*STICK.forward-Math.sin(p.facing)*side,z:p.z+Math.sin(p.facing)*STICK.forward+Math.cos(p.facing)*side}};
const labels=['CENTER','WING','DEFENDER'];
function makePlayer(team,id,x,z,goalie=false){return {team,id,x,z,vx:0,vz:0,facing:team===0?0:Math.PI,energy:1,balance:1,goalie,carryTime:0,aiPlanTime:0,aiTarget:null,check:0,checkWindow:0,checkEffort:0,checkConnected:false,checkRecovery:0,effortRecovery:0,brace:0,puckWobble:0,hitFlash:0,impactTime:0,impactSpan:0,impactPower:0,impactX:0,impactZ:0,impactTier:0,impactDir:1,impactLevel:0,standPose:0,bracePose:0,stun:0,shootWait:0,shotCharge:0,receiveWait:0,receiveWindow:0,oneTimerBuffer:0,oneTimerFlash:0,cutTime:0,cutReceiver:null,comboCooldown:0,combos:0,skid:0,saveFlash:0,saveSide:0,saveKind:'',saves:0,fallTime:0,fallSpan:0,fallSide:1,step:0,has:false,number:goalie?1:[9,16,27][id],name:goalie?'GOALIE':labels[id],device:'ai',power:null,powerTime:0}}
export function createMatch({mode='regular',rink='school',seed=48171}={}) {
 if(!MODES.includes(mode)||!RINKS.includes(rink)) throw Error('INVALID_SETTINGS');
 const config={mode,rink};
 // Match the original collision traversal; do not infer wire slot from array index.
 const players=[0,1,2,4,5,6,3,7].map(slot=>makePlayer(slot>>2,slot%4,0,0,slot%4===3));
 const state=newMatch(players);
 const inputs=new Map();
 const teamPasses=[0,0],teamSaves=[0,0];
 let tick=0, rng=seed>>>0, powerItems=[], powerSpawn=6, eventId=0, events=[];
 const rnd=()=>{rng=(Math.imul(1664525,rng)+1013904223)>>>0; return rng/4294967296};
 const inputFor=device=>inputs.get(device);
 const getMove=p=>{const i=inputFor(p.device);if(!i)return [0,0];const mag=Math.max(1,Math.hypot(i.x,i.z));return [i.x/mag,i.z/mag]};
 const aiLevelFor=()=>AI_LEVELS.standard;
 const beginCheck=p=>armCheck(p,state);
 const event=(type,detail)=>{events.push({id:++eventId,tick,type,detail});if(events.length>24)events.shift()};
 const sound=kind=>event('play',kind);
 const prompt=(label)=>event('prompt',label);
 const trackPass=player=>teamPasses[player.team]++;
 const trackSave=player=>teamSaves[player.team]++;
 const goal=team=>{if(beginGoal(state,team))event('goal',team)};

function releasePuck(owner,dx,dz,speed){const [ux,uz]=normalize(dx,dz),blade=stickPoint(owner);owner.has=false;owner.carryTime=0;owner.receiveWindow=0;owner.oneTimerBuffer=0;owner.receiveWait=STICK.recatchDelay;state.puck.owner=null;state.puck.passFrom=null;state.puck.passTarget=null;state.puck.x=blade.x+ux*STICK.releaseClearance;state.puck.z=blade.z+uz*STICK.releaseClearance;state.puck.vx=ux*speed+owner.vx*.3;state.puck.vz=uz*speed+owner.vz*.3;state.puck.lock=STICK.releaseLock}
function shot(p,charge=0,oneTime=false){if(!p.has)return;let sx=p.team===0?1:-1;let aim=getMove(p);let goalZ=clamp(aim[1],-1,1)*2.15;let tgt=goalZ+(p.team===0?0:0);let dx=sx*28-p.x,dz=tgt-p.z;let dir=p.facing;let facingX=Math.cos(dir),facingZ=Math.sin(dir);let aimX=facingX*.50+normalize(dx,dz)[0]*.50,aimZ=facingZ*.50+normalize(dx,dz)[1]*.50;if(p.device!=='ai'){aimX=normalize(dx,dz)[0]*.7+facingX*.3;aimZ=normalize(dx,dz)[1]*.7+facingZ*.3}else{const weight=aiLevelFor(p).aimWeight,[ux,uz]=normalize(dx,dz);aimX=ux*weight+facingX*(1-weight);aimZ=uz*weight+facingZ*(1-weight)}const variation=(rnd()-.5)*(oneTime?ONE_TIMER.accuracy:1)*(1.0-charge*.72);const a=Math.atan2(aimZ,aimX)+variation*.22;releasePuck(p,Math.cos(a),Math.sin(a),(25+charge*17)*(oneTime?ONE_TIMER.shotBoost:1)*(p.power==='cannon'&&p.powerTime>0?1.33:1));p.shotCharge=0;p.shootWait=.45;p.oneTimerFlash=oneTime?.34:0;state.lastShot={team:p.team,number:p.number,name:p.name,device:p.device,age:0,oneTimer:oneTime};sound(oneTime?'oneTimer':'shoot')}
// An unobstructed lane and a receiver with space beat an automatic nearest-player pass.
function clearLane(ax,az,bx,bz,defenders,clearance=1.65){
 const dx=bx-ax,dz=bz-az,mag=dx*dx+dz*dz;
 if(mag<.001)return false;
 return defenders.every(e=>{const t=clamp(((e.x-ax)*dx+(e.z-az)*dz)/mag,0,1);return Math.hypot(e.x-ax-t*dx,e.z-az-t*dz)>clearance});
}
function bestPass(p){
 const attack=p.team===0?1:-1,mates=players.filter(t=>t.team===p.team&&!t.goalie&&t!==p&&t.stun<=0&&t.fallTime<=0&&t.checkWindow<=0&&t.checkRecovery<=0),enemies=players.filter(t=>t.team!==p.team&&!t.goalie);
 let dirx=Math.cos(p.facing),dirz=Math.sin(p.facing);
 if(p.device!=='ai'){const v=getMove(p);if(Math.hypot(...v)>.1)[dirx,dirz]=normalize(...v)}
 const options=mates.map(t=>{
  const tx=t.x+t.vx*.22,tz=t.z+t.vz*.22,dx=tx-p.x,dz=tz-p.z,range=Math.hypot(dx,dz);
  const ahead=(dx*dirx+dz*dirz)/Math.max(1,range),progress=dx*attack;
  const lane=clearLane(p.x,p.z,tx,tz,enemies,1.6);
  const pressure=enemies.reduce((m,e)=>Math.min(m,Math.hypot(e.x-tx,e.z-tz)),20);
  return {t,tx,tz,lane,score:ahead*5+progress*.17+Math.min(pressure,6)*.65-(lane?0:8)-range*.07+(lane&&t.cutTime>0&&t.cutReceiver===p&&progress>COMBO.minProgress?COMBO.scoreBonus:0)};
 }).sort((a,b)=>b.score-a.score);
 return options[0]||null;
}
function pass(p){if(!p.has)return;const target=bestPass(p);if(!target)return;
 const quick=p.receiveWindow>0,returnPlay=target.t.cutTime>0&&target.t.cutReceiver===p&&target.lane;
 releasePuck(p,target.tx-p.x,target.tz-p.z,quick?25:21);
 state.puck.passFrom=p;state.puck.passTarget=target.t;p.shootWait=.28;
 if(returnPlay){p.comboCooldown=COMBO.returnCooldown;target.t.cutTime=0;target.t.cutReceiver=null;p.combos++;if(p.device!=='ai'||target.t.device!=='ai')prompt('GIVE & GO!',.8)}
 sound('pass');if(quick&&!returnPlay&&p.device!=='ai')prompt('ONE-TOUCH PASS',.55)
}
function giveGoTarget(p,carrier,enemies){
 const attack=p.team===0?1:-1,x=clamp(carrier.x+attack*COMBO.advance,-23.6,23.6);
 const options=[-1,1].map(side=>{
  const z=clamp(carrier.z+side*COMBO.lateral,-9.4,9.4);
  const lane=clearLane(carrier.x,carrier.z,x,z,enemies,1.6);
  const pressure=enemies.reduce((v,e)=>Math.min(v,Math.hypot(e.x-x,e.z-z)),14);
  const travel=Math.hypot(x-p.x,z-p.z);
  return {x,z,score:(lane?8:0)+Math.min(pressure,6)*.8-travel*.23};
 });
 options.sort((a,b)=>b.score-a.score);return options[0];
}
function requestOneTimer(p){if(!p||p.goalie||p.has||p.stun>0||p.fallTime>0||state.puck.passTarget!==p||state.puck.passFrom?.team!==p.team||dist(p,state.puck)>ONE_TIMER.catchReach)return false;p.oneTimerBuffer=ONE_TIMER.buffer;if(p.device!=='ai')prompt('ONE-TIMER READY',.34);return true}
function goalieClear(p){if(!p.goalie||state.puck.owner||dist(p,state.puck)>3.5)return;const direction=p.team===0?1:-1;const aim=getMove(p);state.puck.x=p.x+direction*1.2;state.puck.z=p.z;state.puck.vx=direction*28;state.puck.vz=aim[1]*8;state.puck.lock=.3;state.puck.passFrom=null;state.puck.passTarget=null;sound('shoot')}
function action(p,key,down){if(!p)return;const input=inputFor(p.device);if(input[key]===down)return;input[key]=down;if(state.phase!=='playing'||state.paused||state.dropDelay>0){if(!down&&key==='shoot'){p.shotCharge=0;p.oneTimerBuffer=0}return}
 if(key==='pass'&&down){if(p.goalie)goalieClear(p);else pass(p)}
 if(key==='check'&&down)beginCheck(p);
 if(key==='shoot'){if(down){p.shotCharge=0;if(p.has&&p.receiveWindow>0&&!p.goalie){shot(p,ONE_TIMER.baseCharge,true);if(p.device!=='ai')prompt('ONE-TIMER!',.55)}else if(!p.has)requestOneTimer(p)}else if(p.goalie)goalieClear(p);else if(p.has)shot(p,clamp(p.shotCharge/1.5,0,1));else p.oneTimerBuffer=0}
}
function ai(p,dt){
 const level=aiLevelFor(p);
 if(p.goalie){
  const goalSide=p.team===0?-1:1;
  const danger=!state.puck.owner&&state.puck.vx*goalSide>KEEPER.readMinSpeed&&Math.abs(state.puck.x)<Math.abs(p.x);
  const eta=danger?(p.x-state.puck.x)/state.puck.vx:0;
  const incoming=danger&&eta>0&&eta<level.goalHorizon;
  // Anticipate the real incoming state.puck trajectory; a save still requires contact.
  const projectedZ=incoming?state.puck.z+state.puck.vz*eta:state.puck.z;
  const base=state.puck.owner?.team===p.team?state.puck.z*.45:state.puck.z*.74;
  const targetZ=clamp(incoming?lerp(base,projectedZ,level.goalBlend):base,-KEEPER.slotLimit,KEEPER.slotLimit);
  steer(p,goalSide*25.3-p.x,targetZ-p.z,dt);return;
 }
 const mates=players.filter(t=>t.team===p.team&&!t.goalie),enemies=players.filter(t=>t.team!==p.team&&!t.goalie);
 const attack=p.team===0?1:-1,teamHas=state.puck.owner?.team===p.team,carrier=state.puck.owner;
 const predicted={x:clamp(state.puck.x+state.puck.vx*level.puckLead,-26,26),z:clamp(state.puck.z+state.puck.vz*level.puckLead,-10,10)};
 let target={x:0,z:0};
 if(p.has){
  const enemyGoal=attack*GOALX;
  target={x:enemyGoal-attack*5,z:clamp(p.z*.55,-6,6)};
  const defenders=enemies.filter(e=>e!==p);
  const shotLane=clearLane(p.x,p.z,enemyGoal,clamp(p.z*.35,-GOALZ+0.6,GOALZ-0.6),defenders,1.5);
  const underPressure=enemies.some(e=>dist(e,p)<3.8);
  const receiver=bestPass(p);
  // Allow an actual receiver's passer to finish the cut before the return pass.
  // An immediate clear shot near goal still wins over the set play.
  const returnReady=p.comboCooldown<=0&&receiver?.lane&&receiver.t.cutReceiver===p
   &&receiver.t.cutTime>0&&receiver.t.cutTime<COMBO.window-COMBO.goDelay
   &&(receiver.tx-p.x)*attack>COMBO.minProgress;
  const goalDistance=Math.abs(enemyGoal-p.x);
  const inShotZone=goalDistance<OFFENSE.shotZone&&Math.abs(p.z)<10.8;
  const shotUrgency=p.carryTime>OFFENSE.carryUrgency?3.8:1;
  // Hockey players fire through traffic, not just from mathematically empty
  // lanes. The *same* state.puck, swept save and goal-line physics resolve each shot.
  const canShoot=inShotZone&&(shotLane||goalDistance<OFFENSE.shootFromTraffic||(underPressure&&p.carryTime>2));
  if(canShoot&&p.shootWait<=0&&rnd()<dt*(shotLane?1.45:1.05)*shotUrgency*level.shotRate){
   shot(p,clamp((OFFENSE.shotZone-goalDistance)/17,.12,.75));
  }else if(level.allowReturns&&returnReady&&p.shootWait<=0){pass(p)}
  else if((underPressure||p.carryTime>OFFENSE.passUrgency)&&p.shootWait<=0&&receiver?.lane&&receiver.score>-1&&
    rnd()<dt*(underPressure?1.3:2.2)*level.passRate){pass(p)}

 }else if(teamHas){
  if(p.cutTime>0&&p.cutReceiver===carrier&&p.device==='ai'){
   target=giveGoTarget(p,carrier,enemies);
  }else{
   const partner=mates.filter(t=>t!==carrier).sort((a,b)=>a.id-b.id);
   const rank=partner.indexOf(p),side=rank===0?-1:1;
   const baseX=clamp(carrier.x+attack*(rank===0?5.7:9),-23.5,23.5);
   let baseZ=clamp(carrier.z+side*(rank===0?6.6:7.9),-10.2,10.2);
   // Open a passing window rather than skating straight into a defender.
   for(const enemy of enemies)if(Math.hypot(enemy.x-baseX,enemy.z-baseZ)<3.2)baseZ=clamp(baseZ+(baseZ>=enemy.z?1:-1)*2.3,-10.2,10.2);
   target={x:baseX,z:baseZ};
  }
 }else{
  // The first defender closes on projected state.puck travel; the second cuts off
  // the middle lane and the last protects the slot instead of all chasing.
  const pursuers=mates.slice().sort((a,b)=>dist(a,predicted)-dist(b,predicted)),rank=pursuers.indexOf(p);
  if(rank===0)target={x:predicted.x,z:predicted.z};
  else if(rank===1)target={x:clamp(predicted.x-attack*4.7,-23,23),z:clamp(predicted.z*.65,-8,8)};
  else target={x:clamp(predicted.x-attack*11,-23,23),z:clamp(predicted.z*.30,-5,5)};
  if(carrier&&carrier.team!==p.team&&rank===0)target={x:carrier.x+carrier.vx*.18,z:carrier.z+carrier.vz*.18};
 }
 if(carrier&&carrier.team!==p.team&&p.energy>=CHECK.aiEnergy&&dist(p,carrier)<CHECK.aiReach&&
     (level.checkChance===1||rnd()<dt*12*level.checkChance)){
  const [nx,nz]=normalize(carrier.x-p.x,carrier.z-p.z),closing=(p.vx-carrier.vx)*nx+(p.vz-carrier.vz)*nz;
  if(closing>CHECK.aiClosingSpeed&&Math.cos(p.facing)*nx+Math.sin(p.facing)*nz>.78&&beginCheck(p)){skate(p,0,0,dt);return}
 }
 // Beginner agents read the ice less frequently, but still skate with the
 // same fixed-step acceleration, top speed, stamina, collision and mass.
 if(level.thinkDelay>0){
  if(p.aiPlanTime>0&&p.aiTarget){
   p.aiPlanTime=Math.max(0,p.aiPlanTime-dt);
   steer(p,p.aiTarget.x-p.x,p.aiTarget.z-p.z,dt);return;
  }
  p.aiPlanTime=level.thinkDelay;
  p.aiTarget={x:target.x,z:target.z};
 }else{p.aiPlanTime=0;p.aiTarget=null}
 steer(p,target.x-p.x,target.z-p.z,dt);
}
function updatePlayers(dt){
 for(const p of players){
  advanceCheck(p,dt);
  p.saveFlash=Math.max(0,p.saveFlash-dt);p.impactTime=Math.max(0,p.impactTime-dt);
  p.standPose=Math.max(0,p.standPose-dt);p.bracePose=Math.max(0,p.bracePose-dt);
  p.cutTime=Math.max(0,p.cutTime-dt);p.comboCooldown=Math.max(0,p.comboCooldown-dt);
   if(p.cutTime<=0||(state.puck.owner&&state.puck.owner!==p.cutReceiver)){p.cutTime=0;p.cutReceiver=null}
   p.effortRecovery=Math.max(0,p.effortRecovery-dt);p.hitFlash=Math.max(0,p.hitFlash-dt);p.oneTimerFlash=Math.max(0,p.oneTimerFlash-dt);p.oneTimerBuffer=Math.max(0,p.oneTimerBuffer-dt);p.receiveWindow=Math.max(0,p.receiveWindow-dt);
  p.puckWobble*=Math.exp(-9*dt);
  p.shootWait=Math.max(0,p.shootWait-dt);p.stun=Math.max(0,p.stun-dt);
  const wasFallen=p.fallTime>0;
  p.fallTime=Math.max(0,p.fallTime-dt);if(wasFallen&&p.fallTime===0)p.standPose=BODY.standDuration;
  p.receiveWait=Math.max(0,p.receiveWait-dt);p.powerTime=Math.max(0,p.powerTime-dt);
  if(p.powerTime<=0)p.power=null;
  let burst=false;
  if(p.device!=='ai'){
   const input=inputFor(p.device),[dx,dz]=getMove(p);
   const canDrive=p.stun<=0&&p.checkWindow<=0;
   burst=canDrive&&input.burst&&Math.hypot(dx,dz)>.001&&p.energy>.10&&!p.goalie;
   skate(p,canDrive?dx:0,canDrive?dz:0,dt,burst);
   if(p.has&&input.shoot&&p.stun<=0)p.shotCharge=Math.min(1.5,p.shotCharge+dt);
  }else if(p.stun<=0&&p.checkWindow<=0)ai(p,dt);
  else skate(p,0,0,dt);
  if(p.brace>.1)p.bracePose=BODY.braceDuration;
  p.carryTime=p.has?p.carryTime+dt:0;
  p.energy=clamp(p.energy+(burst?-.34:p.effortRecovery>0?0:CHECK.recoveryRate)*dt,0,1);
  p.x+=p.vx*dt;p.z+=p.vz*dt;limitPlayer(p);
 }
 // Iterative mass-weighted position correction. At a sideboard, one skater
 // may be pinned, so two passes leave visible overlaps. Exit early on clean ice.
 for(let sweep=0;sweep<12;sweep++){
  let overlapping=false;
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
   if(resolveContact(players[i],players[j],state))overlapping=true;
   if(state.phase==='injury')return;
  }
  if(!overlapping)break;
 }
}
function puckPhysics(dt){
 state.puck.lock=Math.max(0,state.puck.lock-dt);
 if(state.puck.owner){
  const carrier=state.puck.owner,x0=state.puck.x,z0=state.puck.z;
  Object.assign(state.puck,stickPoint(carrier));state.puck.vx=carrier.vx;state.puck.vz=carrier.vz;
  const scoreEvent=goalCrossing(x0,z0,state.puck.x,state.puck.z);
  if(scoreEvent){goal(scoreEvent.team);return}
  const keeper=players.find(p=>p.goalie&&p.team!==carrier.team);
  if(keeper&&dist(keeper,state.puck)<1.08){
   releasePuck(carrier,-Math.sign(carrier.x),(.5-rnd())*.6,12);
   state.puck.lock=.24;sound('hit');
  }
  return;
 }
 const x0=state.puck.x,z0=state.puck.z,x1=x0+state.puck.vx*dt,z1=z0+state.puck.vz*dt;
 let first=goalCrossing(x0,z0,x1,z1);
 for(const goalie of players){
  if(!goalie.goalie)continue;
  const t=segmentCircleTime(x0,z0,x1,z1,goalie.x,goalie.z,1.05);
  if(t!==null&&(!first||t<first.t))first={kind:'save',t,goalie};
 }
 if(state.puck.lock<=0){
  for(const skater of players){
   if(skater.goalie||skater.stun>0||skater.receiveWait>0)continue;
   const range=skater.power==='magnet'&&skater.powerTime>0?1.5:1.04;
   const t=segmentCircleTime(x0,z0,x1,z1,skater.x,skater.z,range);
   if(t!==null&&(!first||t<first.t))first={kind:'catch',t,skater};
  }
 }
 state.puck.x=x1;state.puck.z=z1;
 const friction=Math.exp(-1.12*dt);state.puck.vx*=friction;state.puck.vz*=friction;
 if(first?.kind==='goal'){goal(first.team);return}
 if(first?.kind==='save'){
  const keeper=first.goalie,incident=Math.hypot(state.puck.vx,state.puck.vz);
  state.puck.x=x0+(x1-x0)*first.t;state.puck.z=z0+(z1-z0)*first.t;
  const [ux,uz]=normalize(state.puck.x-keeper.x||-Math.sign(keeper.x),state.puck.z-keeper.z);
  state.puck.x=keeper.x+ux*1.06;state.puck.z=keeper.z+uz*1.06;
  // Pad and glove saves redirect actual momentum; never accelerate a slow state.puck.
  const clearX=-Math.sign(keeper.x),offset=clamp((state.puck.z-keeper.z)/1.06,-1,1);
  const [rx,rz]=normalize(clearX,offset*.88+uz*.22);
  const reboundSpeed=incident*KEEPER.saveDrag;
  state.puck.vx=rx*reboundSpeed;state.puck.vz=rz*reboundSpeed;
  state.puck.lock=KEEPER.reboundLock;state.puck.passFrom=null;state.puck.passTarget=null;
  keeper.saves++;trackSave(keeper);keeper.saveFlash=KEEPER.savePose;keeper.saveSide=offset;
  keeper.saveKind=Math.abs(offset)>.52?'GLOVE':'PAD';
  if(incident>21)prompt('BIG SAVE!',.55);
  sound('save');
 }else if(first?.kind==='catch'){
  const receiver=first.skater;
  const intendedPass=state.puck.passFrom?.team===receiver.team&&state.puck.passFrom!==receiver&&state.puck.passTarget===receiver;
  const passer=intendedPass?state.puck.passFrom:null;
  if(passer)trackPass(passer);
  const fireOnCatch=intendedPass&&receiver.oneTimerBuffer>0&&receiver.device!=='ai';
  state.puck.owner=receiver;receiver.has=true;Object.assign(state.puck,stickPoint(receiver));
  state.puck.vx=receiver.vx;state.puck.vz=receiver.vz;state.puck.passFrom=null;state.puck.passTarget=null;
  receiver.shootWait=.25;receiver.shotCharge=0;receiver.receiveWindow=intendedPass?ONE_TIMER.receiveWindow:0;
  receiver.cutTime=0;receiver.cutReceiver=null;
  if(passer&&!passer.goalie&&passer.comboCooldown<=0){passer.cutTime=COMBO.window;passer.cutReceiver=receiver}
  sound('grab');
  if(fireOnCatch){receiver.oneTimerBuffer=0;shot(receiver,ONE_TIMER.baseCharge,true);prompt('ONE-TIMER!',.62)}
 }else{
  if(Math.abs(state.puck.x)>27.2){state.puck.x=Math.sign(state.puck.x)*27.2;state.puck.vx*=-.80;state.puck.passFrom=null;state.puck.passTarget=null;sound('pass')}
  if(Math.abs(state.puck.z)>12.3){state.puck.z=Math.sign(state.puck.z)*12.3;state.puck.vz*=-.82;state.puck.passFrom=null;state.puck.passTarget=null;sound('pass')}
  if(Math.abs(state.puck.x)>24&&Math.abs(state.puck.z)>9.8){
   state.puck.x=Math.sign(state.puck.x)*24;state.puck.vx*=-.63;
   state.puck.z=Math.sign(state.puck.z)*9.8;state.puck.vz*=-.63;
  }
 }
}
const powerDefinitions=[{id:'boost',color:[.20,.90,1]},{id:'magnet',color:[.98,.65,.23]},{id:'cannon',color:[1,.29,.34]}];
function updatePowerups(dt){if(config.mode!=='powerups')return;powerSpawn-=dt;if(powerSpawn<=0&&powerItems.length<2){let entry=powerDefinitions[Math.floor(rnd()*powerDefinitions.length)];const locations=[[0,8],[0,-8],[-7,0],[7,0]];let [x,z]=locations[Math.floor(rnd()*locations.length)];powerItems.push({...entry,x,z,life:14});powerSpawn=8+rnd()*4}
 for(let item of powerItems){item.life-=dt;for(let p of players){if(p.goalie||p.stun>0||dist(p,item)>1.1)continue;p.power=item.id;p.powerTime=9;item.life=0;prompt(item.id.toUpperCase()+' ACTIVATED',.85);sound('grab');break}}
 powerItems=powerItems.filter(p=>p.life>0)
}
 function step(commands,{skipInjury:requestSkip=false}={}) {
  tick++;
  for(const p of players){
   const command=commands.get(atSlot(p));
   if(!command){
    if(p.device!=='ai'){
     inputs.delete(p.device);p.shotCharge=0;p.oneTimerBuffer=0;
    }
    p.device='ai';continue;
   }
   const id='seat-'+atSlot(p);
   if(p.device!==id || inputs.get(id)?.epoch!==command.epoch) {
    inputs.set(id,{epoch:command.epoch,x:0,z:0,burst:false,pass:false,shoot:false,check:false});
    p.shotCharge=0;p.oneTimerBuffer=0;
   }
   p.device=id;
   const i=inputs.get(id),latest=command.level;
   for(const packet of command.edges){
    i.x=packet.x;i.z=packet.z;i.burst=packet.burst;
    for(const key of BUTTONS)action(p,key,packet[key]);
   }
   // Axes are level-triggered; button states need no repeat event.
   i.x=latest.x;i.z=latest.z;i.burst=latest.burst;
   // Packet timeout clears latches without firing a synthetic release/shot.
   if(!command.edges.length) for(const key of BUTTONS) {
    if(i[key]&&!latest[key]&&key==='shoot'){p.shotCharge=0;p.oneTimerBuffer=0}
    i[key]=latest[key];
   }
  }
  const before=state.phase;
  if(requestSkip&&skipInjury(state)){event('faceoff',null);return}
  advanceLifecycle(state,STEP,()=>{
   updatePlayers(STEP);
   if(state.phase!=='playing')return;
   puckPhysics(STEP);
   if(state.phase==='playing')updatePowerups(STEP);
  });
  if(before!==state.phase && state.phase==='injury')event('injury',atSlot(state.injured));
  if(before!==state.phase && state.phase==='finished')event('final',null);
 }
 function snapshot() {
  const {puck}=state;
  return {tick,phase:state.phase,timeLeft:round(state.timeLeft),dropTime:round(Math.max(0,state.dropDelay)),
   holdTime:round(Math.max(0,state.phase==='injury'?state.injuryTime:state.goalDelay)),
   injured:atSlot(state.injured),goalTeam:state.goalTeam,score:[...state.score],mode,rink,events:events.slice(),teamPasses:[...teamPasses],teamSaves:[...teamSaves],
   puck:{x:round(puck.x),z:round(puck.z),vx:round(puck.vx),vz:round(puck.vz),owner:atSlot(puck.owner)},
   powerItems:powerItems.map(({id,x,z,life})=>({id,x,z,life:round(life)})),
   players:players.map(p=>({slot:atSlot(p),team:p.team,role:ROLES[p.id],x:round(p.x),z:round(p.z),
    vx:round(p.vx),vz:round(p.vz),facing:round(p.facing),energy:round(p.energy),down:round(p.fallTime),
    owner:p.has,power:p.power,powerTime:round(p.powerTime),saveKind:p.saveKind,saveFlash:round(p.saveFlash),
    check:round(p.checkWindow),shootCharge:round(p.shotCharge),oneTimerFlash:round(p.oneTimerFlash)})).sort((a,b)=>a.slot-b.slot)};
 }
 return {step,snapshot,finished:()=>state.phase==='finished',phase:()=>state.phase};
}
