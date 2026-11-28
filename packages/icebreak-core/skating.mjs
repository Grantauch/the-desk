/**
 * ICEBREAK headless domain parity reference.
 * Extracted directly from the integrated browser's gameplay functions.
 * Source: public/hubs/icebreak.html @ SHA b83e673bad60ee22f58703355077ef8ea53696f1
 *
 * Safe to use in Node without canvas, HUD, audio, timers or input devices.
 * This is a SERVER PORTING REFERENCE: not yet the complete authoritative
 * ICEBREAK game loop and not deployed to any public site.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const normalize=(x,z)=>{const d=Math.hypot(x,z)||1;return [x/d,z/d]};
const SKATE=Object.freeze({acceleration:34,topSpeed:10.2,burstAcceleration:46,burstSpeed:13,
 turnRate:9,turnSpeedFalloff:.16,edgeGrip:5.2,brake:42,coastDrag:.55,driveDrag:.38,
 overspeedBrake:18,stopSpeed:.08,fallDrag:1.9,goalieAcceleration:22,goalieSpeed:5,arrivalRadius:3,
  quickTurnUnder:3.4,quickTurnBoost:.55});
const CHECK=Object.freeze({
 window:.29,cooldown:.76,effortRecovery:.72,minEnergy:.12,baseCost:.17,speedCost:.21,
 fullEffort:.78,recoveryRate:.15,exhaustedDrive:.70,facingMin:.55,
 wobble:1.4,loose:9,heavy:25,injury:37,injurySeconds:5,
 aiReach:2.8,aiClosingSpeed:2.5,aiEnergy:.42,
 balanceMin:.35,balanceRecover:.30,balanceSkidLoss:2.65,
 whiffBalanceLoss:.22,whiffRecovery:.27,contactRecovery:.11,
 recoveryDrive:.77,recoveryTurn:.56,offBalanceVulnerability:.32
});
const CONTACT=Object.freeze({bodyRadius:.54,goalieRadius:.64,restitution:.12,boardRetention:.15});
const ROLE_MASS=[1,.90,1.16,1.35];
const GOALX=26.35,GOALZ=2.9;

function limitPlayer(p){const x=p.x,z=p.z;if(p.goalie){const lo=p.team===0?-26.2:23.7,hi=p.team===0?-23.7:26.2;p.x=clamp(p.x,lo,hi);p.z=clamp(p.z,-4.25,4.25)}else{p.x=clamp(p.x,-26.7,26.7);p.z=clamp(p.z,-11.7,11.7);if(Math.abs(p.x)>25&&Math.abs(p.z)>8.5){p.x=clamp(p.x,-25.1,25.1);p.z=clamp(p.z,-8.5,8.5)}}if((x-p.x)*p.vx>0)p.vx*=CONTACT.boardRetention;if((z-p.z)*p.vz>0)p.vz*=CONTACT.boardRetention}

function skate(p,dx,dz,dt,burst=false){
 const magnitude=Math.min(1,Math.hypot(dx,dz)),speed=Math.hypot(p.vx,p.vz),active=magnitude>.001;
 const bonus=p.power==='boost'&&p.powerTime>0?1.23:1;
 const drive=lerp(CHECK.exhaustedDrive,1,clamp(p.energy/.62,0,1));
 const committed=p.checkRecovery>0?CHECK.recoveryDrive:1;
 const max=(p.goalie?SKATE.goalieSpeed:burst?SKATE.burstSpeed:SKATE.topSpeed)*bonus*drive*committed;
 const accel=(p.goalie?SKATE.goalieAcceleration:burst?SKATE.burstAcceleration:SKATE.acceleration)*bonus*drive*committed;
 p.skid=p.brace=0;
 if(active){
  const [ux,uz]=normalize(dx,dz),angle=Math.atan2(uz,ux),delta=Math.atan2(Math.sin(angle-p.facing),Math.cos(angle-p.facing));
  const steering=(p.checkRecovery>0?CHECK.recoveryTurn:1);
   const quickTurn=1+SKATE.quickTurnBoost*(1-clamp(speed/SKATE.quickTurnUnder,0,1));
    p.facing+=clamp(delta,-SKATE.turnRate*quickTurn*steering/(1+speed*SKATE.turnSpeedFalloff)*dt,SKATE.turnRate*quickTurn*steering/(1+speed*SKATE.turnSpeedFalloff)*dt);
  p.facing=Math.atan2(Math.sin(p.facing),Math.cos(p.facing));
  const opposing=speed>.25&&(p.vx*ux+p.vz*uz)/speed<-.25;
  if(opposing){const next=Math.max(0,speed-SKATE.brake*magnitude*dt),ratio=next/speed;p.vx*=ratio;p.vz*=ratio;p.skid=speed;p.brace=magnitude*drive}
  else{
   const fx=Math.cos(p.facing),fz=Math.sin(p.facing),side=-p.vx*fz+p.vz*fx;
   const grip=1-Math.exp(-SKATE.edgeGrip*magnitude*dt);p.vx+=fz*side*grip;p.vz-=fx*side*grip;p.skid=Math.abs(side);
   const forward=p.vx*fx+p.vz*fz,target=max*magnitude;
   const push=Math.min(accel*magnitude*dt,Math.max(0,target-forward))*Math.max(0,fx*ux+fz*uz);
   p.vx+=fx*push;p.vz+=fz*push;
  }
  // Partial-stick and AI arrival input use the same speed response. Burst release
  // sheds excess speed gradually instead of deleting momentum in one tick.
  const sp=Math.hypot(p.vx,p.vz),target=max*magnitude;
  if(sp>target){const next=Math.max(target,Math.min(sp,speed)-SKATE.overspeedBrake*dt);p.vx*=next/sp;p.vz*=next/sp}
 }
 const drag=Math.exp(-(active?SKATE.driveDrag:p.fallTime>0?SKATE.fallDrag:SKATE.coastDrag)*dt);p.vx*=drag;p.vz*=drag;
 // Sideways slip at speed unsettles the skater; sustained clean edges and
 // a planted brake rebuild balance. This is shared by AI and human skating.
 const slip=clamp(p.skid/Math.max(3,speed),0,1);
 const loss=active&&p.brace===0?CHECK.balanceSkidLoss*Math.max(0,slip-.16)*dt:0;
 const returnRate=CHECK.balanceRecover*(p.brace>0?1:1-.50*slip);
 p.balance=clamp(p.balance+returnRate*dt-loss,CHECK.balanceMin,1);
 if(!active&&Math.hypot(p.vx,p.vz)<SKATE.stopSpeed){p.vx=p.vz=0}
}

function steer(p,dx,dz,dt){const d=Math.hypot(dx,dz),max=p.goalie?SKATE.goalieSpeed:SKATE.topSpeed;
 // Velocity-aware arrival stops at the target instead of orbiting it.
 const desired=Math.min(max,d/SKATE.arrivalRadius*max),[ux,uz]=normalize(dx,dz);
 let x=ux*desired-p.vx,z=uz*desired-p.vz,m=Math.hypot(x,z);
 if(d<.12&&Math.hypot(p.vx,p.vz)<.25){p.vx=p.vz=0;skate(p,0,0,dt);return}
 const strength=Math.min(1,m/3);skate(p,m?x/m*strength:0,m?z/m*strength:0,dt)
}

function segmentCircleTime(x0,z0,x1,z1,cx,cz,r){
 const vx=x1-x0,vz=z1-z0,ox=x0-cx,oz=z0-cz;
 const a=vx*vx+vz*vz,c=ox*ox+oz*oz-r*r;
 if(c<=0)return a<1e-12||ox*vx+oz*vz<0?0:null; // moving away from initial overlap is not a new impact
 if(a<1e-12)return null;
 const b=2*(ox*vx+oz*vz),disc=b*b-4*a*c;
 if(disc<0)return null;
 const t=(-b-Math.sqrt(disc))/(2*a);
 return t>=0&&t<=1?t:null;
}

function goalCrossing(x0,z0,x1,z1){
 const side=x0<GOALX&&x1>=GOALX?1:x0>-GOALX&&x1<=-GOALX?-1:0;
 if(!side||x1===x0)return null;
 const t=(side*GOALX-x0)/(x1-x0);
 const z=z0+(z1-z0)*t;
 return Math.abs(z)<GOALZ-.21?{kind:'goal',team:side===1?0:1,t}:null;
}

/** Advance one skater with the exact browser order: skate, integrate, clamp. */
function integrateSkater(player,dx,dz,dt,burst=false){
 skate(player,dx,dz,dt,burst);
 player.x+=player.vx*dt;player.z+=player.vz*dt;
 limitPlayer(player);
 return player;
}

/**
 * Passive/ungated skater collision, matching the integrated solver when no
 * checkWindow is armed. Checking injuries and puck transfers still require
 * the production checkOutcome subsystem and are NOT implemented here.
 */
function resolvePassiveContact(a,b){
 const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
 const separation=(a.goalie?CONTACT.goalieRadius:CONTACT.bodyRadius)+(b.goalie?CONTACT.goalieRadius:CONTACT.bodyRadius);
 if(d>=separation)return false;
 const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0;
 const ia=1/ROLE_MASS[a.id],ib=1/ROLE_MASS[b.id],reducedMass=1/(ia+ib);
 const overlap=(separation-d)*reducedMass;
 a.x-=nx*overlap*ia;a.z-=nz*overlap*ia;b.x+=nx*overlap*ib;b.z+=nz*overlap*ib;
 const closing=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
 if(closing>0){
  const impulse=closing*(1+CONTACT.restitution)*reducedMass;
  a.vx-=nx*impulse*ia;a.vz-=nz*impulse*ia;b.vx+=nx*impulse*ib;b.vz+=nz*impulse*ib;
 }
 limitPlayer(a);limitPlayer(b);
 return true;
}

export {SKATE,CHECK,CONTACT,ROLE_MASS,GOALX,GOALZ,limitPlayer,skate,steer,
 segmentCircleTime,goalCrossing,integrateSkater,resolvePassiveContact};
