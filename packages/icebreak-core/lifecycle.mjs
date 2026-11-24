/**
 * ICEBREAK: standalone match-lifecycle rules for an authoritative online server.
 *
 * Mirrors the integrated browser's phase/clock/faceoff effects, without
 * UI, audio, physics, matchmaking, network requests, or persistence.
 * Source: public/hubs/icebreak.html in the integrated ICEBREAK branch.
 *
 * The authoritative caller owns a fixed 90 Hz simulation and must call
 * advanceLifecycle(state, 1/90, worldStep) exactly once per simulation tick.
 */
export const LIFECYCLE=Object.freeze({
 periodSeconds:120,
 faceoffSeconds:1.35,
 goalSeconds:3.25,
 injurySeconds:5,
});

export function resetFaceoff(state){
 const players=state.players;
 for(const p of players){
  p.x=p.goalie?(p.team===0?-25.4:25.4):(p.team===0?-8-2*(p.id>0):8+2*(p.id>0));
  p.z=p.goalie?0:(p.id===1?(p.team===0?-6:6):p.id===2?(p.team===0?6:-6):0);
  p.vx=p.vz=p.stun=p.fallTime=p.fallSpan=p.receiveWait=p.skid=p.checkWindow=p.checkRecovery=p.brace=p.puckWobble=p.hitFlash=p.impactTime=p.impactSpan=p.impactPower=p.impactX=p.impactZ=p.impactTier=0;
  p.balance=1;
  p.impactDir=p.fallSide=1;
  p.impactLevel=p.standPose=p.bracePose=0;
  p.checkConnected=false;p.has=false;
  p.shotCharge=p.oneTimerBuffer=p.receiveWindow=p.oneTimerFlash=p.saveFlash=0;
  p.saveSide=0;p.saveKind='';
  p.carryTime=0;p.aiPlanTime=0;p.aiTarget=null;
  p.cutTime=p.comboCooldown=0;p.cutReceiver=null;
  p.facing=p.team===0?0:Math.PI;
 }
 state.control=players.find(p=>p.device==='kb1')||players.find(p=>p.device!=='ai')||players[0]||null;
 state.puck={x:0,z:0,vx:0,vz:0,owner:null,lock:0,passFrom:null,passTarget:null};
 state.trail=[];state.replayHistory=[];state.replayFrames=[];
 state.replaySample=0;state.replayElapsed=0;
 state.dropDelay=LIFECYCLE.faceoffSeconds;
 return state;
}

/** Fresh game setup. Caller provides eight skater objects in team/role order. */
export function newMatch(players){
 if(!Array.isArray(players)||players.length!==8)throw Error('EXACTLY_EIGHT_SKATERS_REQUIRED');
 const state={
  players,score:[0,0],timeLeft:LIFECYCLE.periodSeconds,period:1,
  phase:'playing',paused:false,dropDelay:0,goalDelay:0,
  injuryTime:0,injured:null,goalTeam:-1,lastShot:null,
  replayElapsed:0,replaySample:0,replayHistory:[],replayFrames:[],
  puck:{x:0,z:0,vx:0,vz:0,owner:null,lock:0},
  trail:[],control:null
 };
 return resetFaceoff(state);
}

/** Called only by server-side validated goal-line physics. */
export function beginGoal(state,team){
 if(state.goalDelay>0)return false;
 if(team!==0&&team!==1)throw Error('INVALID_GOAL_TEAM');
 state.score[team]++;
 state.goalTeam=team;state.goalDelay=LIFECYCLE.goalSeconds;
 state.phase='goal';state.replayElapsed=0;
 // Replay capture and goal scoring credit are presentation/stat subsystems.
 return true;
}

/** Called only by the authoritative, impact-threshold collision system. */
export function beginInjury(state,target){
 if(!target||!state.players.includes(target))throw Error('INVALID_INJURED_PLAYER');
 state.injured=target;state.injuryTime=LIFECYCLE.injurySeconds;
 state.phase='injury';state.paused=false;
 return true;
}

/**
 * Server-authorized skip. In multiplayer the server (not a peer) decides
 * which inputs may request a skip and broadcasts the resulting state.
 */
export function skipInjury(state){
 if(state.phase!=='injury')return false;
 state.injuryTime=0;state.injured=null;
 if(state.timeLeft<=0){finishMatch(state);return true}
 state.phase='playing';state.paused=false;
 resetFaceoff(state);
 return true;
}
export function finishMatch(state){
 if(state.phase==='finished')return false;
 state.phase='finished';
 return true;
}

/**
 * One deterministic physics tick. Return the last state transition.
 * The authoritative world callback, if provided, handles actual skating,
 * checking, puck/goal physics, AI and powerups; it must not be invoked
 * during pause, injury timeout, goal replay, or the pre-faceoff delay.
 */
export function advanceLifecycle(state,dt,worldStep=null){
 if(!Number.isFinite(dt)||dt<=0||dt>1/30)throw Error('INVALID_TICK');
 if(state.phase==='injury'){
  state.injuryTime-=dt;
  if(state.injuryTime<1e-6){skipInjury(state);return state.phase==='finished'?'finished':'faceoff'}
  return 'injury';
 }
 if(state.paused)return 'paused';
 if(state.phase==='goal'){
  state.goalDelay-=dt;state.replayElapsed+=dt;
  if(state.goalDelay<=0){
   state.phase='playing';
   if(state.timeLeft<=0){finishMatch(state);return 'finished'}
   resetFaceoff(state);return 'faceoff';
  }
  return 'goal';
 }
 if(state.phase!=='playing')return state.phase;
 if(state.dropDelay>0){state.dropDelay-=dt;return 'drop'};
 // At exactly 10,800 active 90 Hz ticks the floating-point residue must
 // not buy an extra play at 0:00. Keep this much smaller than one tick.
 state.timeLeft=state.timeLeft-dt>1e-8?state.timeLeft-dt:0;
 if(state.lastShot)state.lastShot.age+=dt;
 if(worldStep)worldStep(state,dt);
 if(state.phase!=='playing')return state.phase;
 if(state.timeLeft<=0){finishMatch(state);return 'finished'}
 return 'playing';
}


// One frame transition for the normal clock, replay, and explicit injury skip.
// Delivery is keyed to the resulting authoritative phase, never the request.
export function advanceMatchFrame(state,dt,{skipRequested=false,worldStep,event}={}){
 const before=state.phase;
 const transition=skipRequested&&skipInjury(state)
  ? (state.phase==='finished'?'finished':'faceoff')
  : advanceLifecycle(state,dt,worldStep);
 if(before!==state.phase&&state.phase==='finished')event?.('final',null);
 else if(before!==state.phase&&state.phase==='injury')event?.('injury',state.injured);
 else if(transition==='faceoff')event?.('faceoff',null);
 return transition;
}
