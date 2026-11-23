/**
 * ICEBREAK authoritative contact reference, extracted from integrated game rules.
 *
 * Parity scope: attempt cost, closing-angle gating, mass-weighted collision,
 * puck loss, balance, slides and injury trigger. Does not run the full match
 * clock, scoring, render effects, match stats or network serialization.
 *
 * The browser remains source of truth until the eight-seat server game loop
 * is complete and these parity tests remain green.
 */
import {SKATE,CHECK,CONTACT,ROLE_MASS,limitPlayer} from '../icebreak-parity/headless.mjs';

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const normalize=(x,z)=>{const d=Math.hypot(x,z)||1;return [x/d,z/d]};
export const STICK=Object.freeze({forward:.92,side:.38,releaseClearance:.10,releaseLock:.055,recatchDelay:.24});

/** Same attempt gate and stamina charge as the integrated browser. */
export function armCheck(player,state){
 if(state.phase!=='playing'||state.paused||state.dropDelay>0||player.goalie||player.has||player.check>0||player.stun>0)return false;
 if(player.energy<CHECK.minEnergy)return false;
 const speed=Math.hypot(player.vx,player.vz);
 player.checkEffort=clamp(player.energy/CHECK.fullEffort,0,1)*(.70+.30*player.balance);
 player.energy=Math.max(0,player.energy-CHECK.baseCost-CHECK.speedCost*clamp(speed/SKATE.burstSpeed,0,1));
 player.check=CHECK.cooldown;player.checkWindow=CHECK.window;
 player.checkConnected=false;player.checkRecovery=0;player.effortRecovery=CHECK.effortRecovery;
 player.cutTime=0;player.cutReceiver=null;
 return true;
}

/** Advance only the contact timers; caller must also advance skating and stamina. */
export function advanceCheck(player,dt){
 player.check=Math.max(0,player.check-dt);
 const committed=player.checkWindow>0;
 player.checkWindow=Math.max(0,player.checkWindow-dt);
 const whiff=committed&&player.checkWindow===0&&!player.checkConnected;
 if(whiff){
  player.checkRecovery=CHECK.whiffRecovery;
  player.balance=Math.max(CHECK.balanceMin,player.balance-CHECK.whiffBalanceLoss);
 }
 player.checkRecovery=Math.max(0,player.checkRecovery-dt);
 return whiff;
}

function alignment(attacker,target,nx,nz){
 if(attacker.checkWindow<=0||attacker.stun>0||attacker.team===target.team||target.goalie)return 0;
 const facing=Math.cos(attacker.facing)*nx+Math.sin(attacker.facing)*nz;
 const advance=attacker.vx*nx+attacker.vz*nz;
 return facing>=CHECK.facingMin&&advance>.35
  ?facing*attacker.checkEffort*clamp(advance/6,.45,1):0;
}
function cancelCombination(players,target){
 for(const p of players)if(p===target||p.cutReceiver===target){p.cutTime=0;p.cutReceiver=null}
}
function releasePuck(state,owner,dx,dz,speed){
 const [ux,uz]=normalize(dx,dz),side=STICK.side+owner.puckWobble;
 const bx=owner.x+Math.cos(owner.facing)*STICK.forward-Math.sin(owner.facing)*side;
 const bz=owner.z+Math.sin(owner.facing)*STICK.forward+Math.cos(owner.facing)*side;
 owner.has=false;owner.carryTime=0;owner.receiveWindow=0;owner.oneTimerBuffer=0;owner.receiveWait=STICK.recatchDelay;
 state.puck.owner=null;state.puck.passFrom=null;state.puck.passTarget=null;
 state.puck.x=bx+ux*STICK.releaseClearance;state.puck.z=bz+uz*STICK.releaseClearance;
 state.puck.vx=ux*speed+owner.vx*.3;state.puck.vz=uz*speed+owner.vz*.3;state.puck.lock=STICK.releaseLock;
}
function outcome(attacker,target,nx,nz,closing,reducedMass,strength,velocityChange,state){
 attacker.checkWindow=0;attacker.checkConnected=true;
 attacker.checkRecovery=Math.max(attacker.checkRecovery,CHECK.contactRecovery);
 const impact=.5*reducedMass*closing**2*strength**2*(1-.42*target.brace)*(1+CHECK.offBalanceVulnerability*(1-target.balance));
 if(impact<CHECK.wobble)return impact;
 const contactSide=-Math.sin(target.facing)*nx+Math.cos(target.facing)*nz;
 target.hitFlash=.32;
 target.impactDir=contactSide>=0?1:-1;
 target.impactLevel=clamp((impact-CHECK.wobble)/(CHECK.injury-CHECK.wobble),.08,1);
 const loose=impact>=CHECK.loose,heavy=impact>=CHECK.heavy;
 target.balance=Math.max(CHECK.balanceMin,target.balance-(heavy?.18:loose?.10:.025));
 if(loose&&target.has){
  cancelCombination(state.players,target);
  releasePuck(state,target,nx,nz,Math.min(12,velocityChange*.8));
  target.shotCharge=0;
 }else if(target.has){
  const side=-Math.sin(target.facing)*nx+Math.cos(target.facing)*nz;
  target.puckWobble=clamp((Math.abs(side)<.15?.5:side)*impact*.035,-.28,.28);
 }
 if(heavy){
  cancelCombination(state.players,target);
  const severity=clamp((impact-CHECK.heavy)/(CHECK.injury-CHECK.heavy),0,1);
  target.stun=Math.max(target.stun,.52+.30*severity);
  target.fallTime=Math.max(target.fallTime,target.stun);target.fallSpan=target.fallTime;
  target.fallSide=target.impactDir;
  target.energy=Math.max(0,target.energy-.05-.11*severity);
  target.checkWindow=0;
 }
 if(impact>=CHECK.injury){
  state.injured=target;state.injuryTime=CHECK.injurySeconds;
  state.phase='injury';state.paused=false;
 }
 return impact;
}

/** Return true on physical overlap, even if neither player attempted a check. */
export function resolveContact(a,b,state){
 const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
 const separation=(a.goalie?CONTACT.goalieRadius:CONTACT.bodyRadius)+(b.goalie?CONTACT.goalieRadius:CONTACT.bodyRadius);
 if(d>=separation)return false;
 const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0;
 const ia=1/ROLE_MASS[a.id],ib=1/ROLE_MASS[b.id],reducedMass=1/(ia+ib);
 const overlap=(separation-d)*reducedMass;
 a.x-=nx*overlap*ia;a.z-=nz*overlap*ia;b.x+=nx*overlap*ib;b.z+=nz*overlap*ib;
 const closing=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
 if(closing>0){
  const alignA=alignment(a,b,nx,nz),alignB=alignment(b,a,-nx,-nz);
  const impulse=closing*(1+CONTACT.restitution)*reducedMass;
  a.vx-=nx*impulse*ia;a.vz-=nz*impulse*ia;
  b.vx+=nx*impulse*ib;b.vz+=nz*impulse*ib;
  if(alignB>alignA){
   outcome(b,a,-nx,-nz,closing,reducedMass,alignB,impulse*ia,state);
   if(state.phase!=='injury'&&a.stun<=0&&alignA>0)
    outcome(a,b,nx,nz,closing,reducedMass,alignA,impulse*ib,state);
  }else if(alignA>0){
   outcome(a,b,nx,nz,closing,reducedMass,alignA,impulse*ib,state);
   if(state.phase!=='injury'&&b.stun<=0&&alignB>0)
    outcome(b,a,-nx,-nz,closing,reducedMass,alignB,impulse*ia,state);
  }
 }
 limitPlayer(a);limitPlayer(b);
 return true;
}
export {SKATE,CHECK,CONTACT,ROLE_MASS};
