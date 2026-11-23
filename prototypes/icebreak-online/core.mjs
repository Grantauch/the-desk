import { randomBytes } from 'node:crypto';

export const ROLES = Object.freeze(['CENTER','WING','DEFENDER','GOALIE']);
const RINK = { halfLength:28.7, halfWidth:13.2 };
const ZERO = Object.freeze({x:0,z:0,shoot:false,pass:false,check:false,burst:false});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const round=n=>Math.round(n*1000)/1000;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const validSlot=n=>Number.isInteger(n)&&n>=0&&n<8;

export function makeGame(){
 const players=Array.from({length:8},(_,slot)=>{
  const team=Math.floor(slot/4),role=slot%4;
  const x=role===3?(team===0?-25.4:25.4):(team===0?-9-2*(role>0):9+2*(role>0));
  const z=role===1?(team===0?-6:6):role===2?(team===0?6:-6):0;
  return {slot,team,role:ROLES[role],x,z,vx:0,vz:0,energy:1,stun:0,down:0,checkCooldown:0,
   owner:false,input:{...ZERO},lastShoot:false,lastPass:false,lastCheck:false};
 });
 return {phase:'lobby',tick:0,timeLeft:120,score:[0,0],players,puck:{x:0,z:0,vx:0,vz:0,owner:null,lock:0},
  stoppage:0,mode:'regular',rink:'school'};
}
function resetFaceoff(game){
 const fresh=makeGame();
 for(let i=0;i<8;i++){
  const p=game.players[i],q=fresh.players[i];
  Object.assign(p,{x:q.x,z:q.z,vx:0,vz:0,stun:0,down:0,owner:false,checkCooldown:0,lastShoot:false,lastPass:false,lastCheck:false});
 }
 Object.assign(game.puck,{x:0,z:0,vx:0,vz:0,owner:null,lock:0.35});
 game.phase='playing';
}
function aiInput(game,p){
 const target=p.role==='GOALIE'
  ? {x:p.team===0?-25.1:25.1,z:clamp(game.puck.z,-3.5,3.5)}
  : game.puck.owner===p.slot?{x:p.team===0?22:-22,z:clamp(p.z,-8,8)}:game.puck;
 const dx=target.x-p.x,dz=target.z-p.z,len=Math.hypot(dx,dz)||1;
 return {x:clamp(dx/len,-1,1),z:clamp(dz/len,-1,1),shoot:game.puck.owner===p.slot&&Math.abs(p.x)>18,pass:false,check:false,burst:false};
}
function release(game,p,pass){
 const target=pass?game.players.filter(q=>q.team===p.team&&q.slot!==p.slot&&q.role!=='GOALIE')
  .sort((a,b)=>distance(a,p)-distance(b,p))[0]:null;
 const dx=target?target.x-p.x:(p.team===0?1:-1),dz=target?target.z-p.z:(p.z>0?-p.z*.15:Math.abs(p.z)*.15);
 const length=Math.hypot(dx,dz)||1,speed=pass?18:25;
 Object.assign(game.puck,{owner:null,x:p.x+dx/length*.8,z:p.z+dz/length*.8,
  vx:dx/length*speed+p.vx*.35,vz:dz/length*speed+p.vz*.35,lock:.20});
 p.owner=false;
}
export function advance(game,seatInputs,dt=1/90){
 if(game.phase==='lobby'||game.phase==='finished')return;
 game.tick++;
 if(game.phase==='injury'||game.phase==='faceoff'){
  game.stoppage-=dt;
  if(game.stoppage<=0)resetFaceoff(game);
  return;
 }
 game.timeLeft=Math.max(0,game.timeLeft-dt);
 if(game.timeLeft===0){game.phase='finished';return}
 for(const p of game.players){
  p.stun=Math.max(0,p.stun-dt);p.down=Math.max(0,p.down-dt);
  p.checkCooldown=Math.max(0,p.checkCooldown-dt);
  p.energy=clamp(p.energy+dt*.09,0,1);
  let input=seatInputs.get(p.slot);
  if(!input)input=aiInput(game,p);
  const length=Math.hypot(input.x,input.z),norm=length>1?1/length:1;
  const x=input.x*norm,z=input.z*norm;
  if(p.down<=0&&p.stun<=0){
   const accel=(input.burst&&p.energy>.12?28:20),maxSpeed=input.burst?13:10;
   p.vx=(p.vx+x*accel*dt)*Math.exp(-2.1*dt);
   p.vz=(p.vz+z*accel*dt)*Math.exp(-2.1*dt);
   const mag=Math.hypot(p.vx,p.vz);
   if(mag>maxSpeed){p.vx*=maxSpeed/mag;p.vz*=maxSpeed/mag}
   if(input.burst&&mag>1)p.energy=clamp(p.energy-dt*.25,0,1);
  }else{p.vx*=Math.exp(-5*dt);p.vz*=Math.exp(-5*dt)}
  p.x=clamp(p.x+p.vx*dt,-RINK.halfLength+.8,RINK.halfLength-.8);
  p.z=clamp(p.z+p.vz*dt,-RINK.halfWidth+.6,RINK.halfWidth-.6);
  if(p.role==='GOALIE'){
   p.x=clamp(p.x,p.team===0?-27.4:23.3,p.team===0?-23.3:27.4);
   p.z=clamp(p.z,-4.6,4.6);
  }
  const shoot=!!input.shoot,pass=!!input.pass,check=!!input.check;
  if(p.owner&&shoot&&!p.lastShoot)release(game,p,false);
  else if(p.owner&&pass&&!p.lastPass)release(game,p,true);
  if(check&&!p.lastCheck&&!p.owner&&p.role!=='GOALIE'&&p.checkCooldown===0&&p.energy>.18){
   p.energy-=.18;p.checkCooldown=.85;
   for(const other of game.players){
    if(other.team===p.team||distance(p,other)>1.8)continue;
    const relative=Math.hypot(p.vx-other.vx,p.vz-other.vz);
    if(other.owner){other.owner=false;game.puck.owner=null;game.puck.vx=other.vx+p.vx*.45;game.puck.vz=other.vz+p.vz*.45;game.puck.lock=.24}
    if(relative>7){other.down=1.0;other.stun=.7}
    else other.stun=.15;
    if(relative>12){game.phase='injury';game.stoppage=5;break}
   }
  }
  p.lastShoot=shoot;p.lastPass=pass;p.lastCheck=check;
 }
 if(game.phase==='injury')return;
 // Separate overlapping skaters. All contact results are resolved by the server.
 for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){
  const a=game.players[i],b=game.players[j],dx=b.x-a.x,dz=b.z-a.z;
  const dist=Math.hypot(dx,dz),min=1.25;
  if(dist>=min)continue;
  const nx=dist>1e-6?dx/dist:1,nz=dist>1e-6?dz/dist:0,overlap=(min-dist)/2;
  a.x-=nx*overlap;a.z-=nz*overlap;b.x+=nx*overlap;b.z+=nz*overlap;
  const relative=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;
  if(relative<0){const impulse=-relative*.48;a.vx-=nx*impulse;a.vz-=nz*impulse;b.vx+=nx*impulse;b.vz+=nz*impulse}
 }
 const puck=game.puck;
 puck.lock=Math.max(0,puck.lock-dt);
 if(puck.owner!==null){
  const carrier=game.players[puck.owner];
  puck.x=carrier.x+(carrier.team===0?.75:-.75);puck.z=carrier.z+.15;
  puck.vx=carrier.vx;puck.vz=carrier.vz;
 }else{
  puck.x+=puck.vx*dt;puck.z+=puck.vz*dt;
  puck.vx*=Math.exp(-1.05*dt);puck.vz*=Math.exp(-1.05*dt);
  if(Math.abs(puck.z)>RINK.halfWidth){puck.z=clamp(puck.z,-RINK.halfWidth,RINK.halfWidth);puck.vz*=-.68}
  if(Math.abs(puck.x)>RINK.halfLength){
   if(Math.abs(puck.z)<2.5){
    const scoringTeam=puck.x>0?0:1;game.score[scoringTeam]++;game.phase='faceoff';game.stoppage=2.0;return;
   }
   puck.x=clamp(puck.x,-RINK.halfLength,RINK.halfLength);puck.vx*=-.70;
  }
  if(puck.lock===0){
   const picker=game.players.filter(p=>p.down===0&&p.stun===0&&distance(p,puck)<1.25)
    .sort((a,b)=>distance(a,puck)-distance(b,puck))[0];
   if(picker){picker.owner=true;puck.owner=picker.slot}
  }
 }
}
function secureCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=randomBytes(6);return [...bytes].map(b=>alphabet[b%alphabet.length]).join('')}
function publicSeat(p,member){return {slot:p.slot,team:p.team,role:p.role,x:round(p.x),z:round(p.z),vx:round(p.vx),vz:round(p.vz),
  energy:round(p.energy),down:round(p.down),owner:p.owner,claimed:!!member,connected:!!member?.peer,ready:!!member?.ready}}
export class RoomDirectory{
 constructor(options={}){this.now=options.now||Date.now;this.maxRooms=options.maxRooms||48;this.rooms=new Map();
  this.graceMs=options.graceMs??20000;this.idleMs=options.idleMs??600000}
 make(peer,seat=0){
  if(!validSlot(seat))throw Error('INVALID_SEAT');
  if(peer.room)throw Error('ALREADY_JOINED');
  if(this.rooms.size>=this.maxRooms)throw Error('SERVER_FULL');
  let code;do{code=secureCode()}while(this.rooms.has(code));
  const room={code,game:makeGame(),seats:Array(8).fill(null),host:null,created:this.now(),lastActive:this.now()};
  this.rooms.set(code,room);
  return this.enter(peer,code,seat,true);
 }
 enter(peer,code,seat,host=false){
  if(peer.room)throw Error('ALREADY_JOINED');
  const room=this.rooms.get(code);
  if(!room)throw Error('ROOM_NOT_FOUND');
  if(room.game.phase!=='lobby')throw Error('MATCH_STARTED');
  if(!validSlot(seat))throw Error('INVALID_SEAT');
  if(room.seats[seat])throw Error('SEAT_TAKEN');
  const member={seat,token:randomBytes(24).toString('base64url'),peer,ready:host,seq:-1,
   input:{...ZERO},lastInput:this.now(),reservedUntil:0};
  room.seats[seat]=member;
  if(host)room.host=seat;
  peer.room=room;peer.member=member;room.lastActive=this.now();
  return {type:'seated',code,seat,role:ROLES[seat%4],team:Math.floor(seat/4),host:room.host===seat,token:member.token};
 }
 resume(peer,code,token){
  if(peer.room)throw Error('ALREADY_JOINED');
  const room=this.rooms.get(code);
  if(!room||typeof token!=='string')throw Error('INVALID_RESUME');
  const member=room.seats.find(m=>m&&m.token===token);
  if(!member||member.peer||member.reservedUntil<this.now())throw Error('INVALID_RESUME');
  member.peer=peer;member.reservedUntil=0;member.lastInput=this.now();member.input={...ZERO};member.seq=-1;member.ready=false;
  peer.room=room;peer.member=member;room.lastActive=this.now();
  return {type:'seated',code,seat:member.seat,role:ROLES[member.seat%4],team:Math.floor(member.seat/4),host:room.host===member.seat,token:member.token,resumed:true};
 }
 handle(peer,message){
  if(!message||typeof message!=='object'||Array.isArray(message))throw Error('INVALID_MESSAGE');
  const room=peer.room,m=peer.member,now=this.now();
  if(message.type==='create')return this.make(peer,message.seat);
  if(message.type==='join'){
   if(typeof message.code!=='string'||!/^[A-HJ-NP-Z2-9]{6}$/.test(message.code))throw Error('INVALID_CODE');
   return this.enter(peer,message.code,message.seat);
  }
  if(message.type==='resume')return this.resume(peer,message.code,message.token);
  if(!room||!m)throw Error('JOIN_FIRST');
  room.lastActive=now;
  if(message.type==='ready'){if(room.game.phase!=='lobby')throw Error('MATCH_STARTED');m.ready=message.ready===true;return {type:'ready',seat:m.seat,ready:m.ready}}
  if(message.type==='start'){
   if(room.host!==m.seat)throw Error('HOST_ONLY');
   if(room.game.phase!=='lobby')throw Error('MATCH_STARTED');
   if(room.seats.some(x=>x&&x.peer&&!x.ready))throw Error('PLAYERS_NOT_READY');
   room.game.phase='playing';
   return {type:'started',tick:room.game.tick};
  }
  if(message.type==='input'){
   if(room.game.phase!=='playing')return {type:'ignored',reason:'NOT_PLAYING'};
   const seq=message.seq;
   if(!Number.isSafeInteger(seq)||seq<=m.seq||seq>2147483647)throw Error('INVALID_SEQUENCE');
   if(!Array.isArray(message.axes)||message.axes.length!==2||message.axes.some(v=>!Number.isFinite(v)||Math.abs(v)>1))throw Error('INVALID_INPUT');
   const keys=['shoot','pass','check','burst'];
   if(keys.some(k=>message[k]!==undefined&&typeof message[k]!=='boolean'))throw Error('INVALID_INPUT');
   m.seq=seq;m.input={x:message.axes[0],z:message.axes[1],shoot:message.shoot===true,pass:message.pass===true,
    check:message.check===true,burst:message.burst===true};m.lastInput=now;
   return null;
  }
  if(message.type==='ping')return {type:'pong',time:now};
  throw Error('UNKNOWN_TYPE');
 }
 disconnect(peer){
  const room=peer.room,m=peer.member;
  if(!room||!m)return;
  if(m.peer===peer){m.peer=null;m.input={...ZERO};m.reservedUntil=this.now()+this.graceMs;m.ready=false}
  peer.room=null;peer.member=null;
  room.lastActive=this.now();
 }
 step(dt=1/90){
  const now=this.now();
  for(const [code,room] of this.rooms){
   for(let seat=0;seat<8;seat++){
    const member=room.seats[seat];
    if(member&&!member.peer&&member.reservedUntil<now){room.seats[seat]=null;if(room.host===seat)room.host=room.seats.findIndex(x=>x?.peer)}
   }
   if((room.game.phase==='finished'&&room.lastActive+60000<now)||room.lastActive+this.idleMs<now){
    this.rooms.delete(code);continue;
   }
   const liveInputs=new Map();
   for(const m of room.seats){
    if(m?.peer&&now-m.lastInput<350)liveInputs.set(m.seat,m.input);
   }
   advance(room.game,liveInputs,dt);
  }
 }
 snapshot(room){
  const g=room.game;
  return {type:'snapshot',version:1,code:room.code,phase:g.phase,tick:g.tick,timeLeft:round(g.timeLeft),
   score:[...g.score],host:room.host,mode:g.mode,rink:g.rink,
   puck:{x:round(g.puck.x),z:round(g.puck.z),vx:round(g.puck.vx),vz:round(g.puck.vz),owner:g.puck.owner},
   players:g.players.map(p=>publicSeat(p,room.seats[p.slot]))};
 }
}