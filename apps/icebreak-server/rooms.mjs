import {randomBytes,randomInt} from 'node:crypto';
import {createMatch, MODES, RINKS, ROLES} from '../../packages/icebreak-core/match.mjs';

export const VERSION=1;
const ROOM_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE=/^[A-HJ-NP-Z2-9]{6}$/;
const TOKEN=/^[A-Za-z0-9_-]{32}$/;
const NEUTRAL=Object.freeze({x:0,z:0,shoot:false,pass:false,check:false,burst:false});
const BUTTONS=['shoot','pass','check','burst'];
const validSeat=seat=>Number.isInteger(seat)&&seat>=0&&seat<8;
const failure=code=>{throw new RoomError(code)};
export class RoomError extends Error {}

export class Rooms {
 #rooms=new Map();
 constructor({now=()=>performance.now(),maxRooms=32,graceMs=30000,idleMs=600000,inputTimeoutMs=500}={}) {
  this.now=now;this.maxRooms=maxRooms;this.graceMs=graceMs;this.idleMs=idleMs;this.inputTimeoutMs=inputTimeoutMs;
 }
 get size(){return this.#rooms.size}
 [Symbol.iterator](){return this.#rooms.values()}
 #settings(message) {
  const {mode='regular',rink='school'}=message;
  if(!MODES.includes(mode)||!RINKS.includes(rink))failure('INVALID_SETTINGS');
  return {mode,rink};
 }
 #make(peer,message) {
  if(!validSeat(message.seat))failure('INVALID_SEAT');
  const settings=this.#settings(message);
  if(this.size>=this.maxRooms)failure('SERVER_FULL');
  let code;
  do {code=Array.from({length:6},()=>ROOM_CHARS[randomInt(ROOM_CHARS.length)]).join('')}
  while(this.#rooms.has(code));
  const room={code,settings,host:message.seat,match:null,seats:Array(8).fill(null),lastActive:this.now(),finishedAt:null,skipInjury:false};
  this.#rooms.set(code,room);
  return this.#join(peer,room,message.seat);
 }
 #seated(room,s,resumed=false) {
  return {type:'seated',version:VERSION,code:room.code,seat:s.seat,team:s.seat>>2,role:ROLES[s.seat%4],
   host:s.seat===room.host,token:s.token,resumed};
 }
 #join(peer,room,seat) {
  if(!validSeat(seat))failure('INVALID_SEAT');
  if(room.match)failure('MATCH_STARTED');
  if(room.seats[seat])failure('SEAT_TAKEN');
  if(room.host<0)room.host=seat;
  const s={seat,peer,token:randomBytes(24).toString('base64url'),ready:seat===room.host,
   epoch:0,sequence:-1,level:NEUTRAL,edges:[],lastInput:-Infinity,reservedUntil:0};
  room.seats[seat]=s;peer.room=room;peer.seat=s;
  room.lastActive=this.now();
  return this.#seated(room,s);
 }
 #resume(peer,room,token) {
  const now=this.now();
  if(typeof token!=='string'||!TOKEN.test(token))failure('INVALID_RESUME');
  const s=room?.seats.find(entry=>entry?.token===token);
  if(!s||s.peer||s.reservedUntil<=now)failure('INVALID_RESUME');
  s.peer=peer;s.reservedUntil=0;s.sequence=-1;s.epoch++;s.level=NEUTRAL;s.edges=[];s.lastInput=-Infinity;
  peer.room=room;peer.seat=s;room.lastActive=now;
  return this.#seated(room,s,true);
 }
 #input(seat,message,now) {
  const {seq,axes}=message;
  if(!Number.isSafeInteger(seq)||seq<0||seq>2147483647||seq<=seat.sequence)failure('INVALID_SEQUENCE');
  if(!Array.isArray(axes)||axes.length!==2||axes.some(v=>!Number.isFinite(v)||Math.abs(v)>1)
    ||BUTTONS.some(k=>message[k]!==undefined&&typeof message[k]!=='boolean'))failure('INVALID_INPUT');
  const input={x:axes[0],z:axes[1],...Object.fromEntries(BUTTONS.map(k=>[k,message[k]===true]))};
  if(seat.level.shoot!==input.shoot||seat.level.check!==input.check||seat.level.pass!==input.pass){
   if(seat.edges.length>=16)failure('INPUT_QUEUE_FULL');
   seat.edges.push(input);
  }
  seat.level=input;seat.sequence=seq;seat.lastInput=now;
  return null;
 }
 handle(peer,message) {
  if(!message||typeof message!=='object'||Array.isArray(message))failure('INVALID_MESSAGE');
  const {type}=message;
  if(type==='create'||type==='join'||type==='resume'){
   if(peer.room)failure('ALREADY_JOINED');
   if(type==='create')return this.#make(peer,message);
   const room=typeof message.code==='string'&&CODE.test(message.code)?this.#rooms.get(message.code):null;
   if(type==='resume')return this.#resume(peer,room,message.token);
   if(!room)failure('ROOM_NOT_FOUND');
   return this.#join(peer,room,message.seat);
  }
  const room=peer.room,s=peer.seat,now=this.now();
  if(!room||!s||s.peer!==peer)failure('JOIN_FIRST');
  room.lastActive=now;
  switch(type){
   case 'ping':return {type:'pong'};
   case 'ready':
    if(room.match)failure('MATCH_STARTED');
    if(typeof message.ready!=='boolean')failure('INVALID_READY');
    s.ready=message.ready;
    return {type:'ready',seat:s.seat,ready:s.ready};
   case 'settings':
    if(s.seat!==room.host)failure('HOST_ONLY');
    if(room.match)failure('MATCH_STARTED');
    room.settings=this.#settings(message);
    for(const m of room.seats)if(m&&m!==s)m.ready=false;
    return {type:'settings',...room.settings};
   case 'start':
    if(s.seat!==room.host)failure('HOST_ONLY');
    if(room.match)failure('MATCH_STARTED');
    if(room.seats.some(m=>m&&(!m.peer||!m.ready)))failure('PLAYERS_NOT_READY');
    room.match=createMatch({...room.settings,seed:randomBytes(4).readUInt32LE(0)});
    return {type:'started',tick:0};
   case 'input':
    if(!room.match||room.finishedAt!==null)return null;
    return this.#input(s,message,now);
   case 'skip-injury':
    if(s.seat!==room.host)failure('HOST_ONLY');
    room.skipInjury=room.match?.phase()==='injury';
    return {type:'skip-injury',queued:room.skipInjury};
   default:failure('UNKNOWN_TYPE');
  }
 }
 disconnect(peer) {
  const room=peer.room,s=peer.seat;
  if(!room||!s||s.peer!==peer)return;
  s.peer=null;s.level=NEUTRAL;s.edges=[];s.lastInput=-Infinity;s.ready=false;
  s.reservedUntil=this.now()+this.graceMs;
  peer.room=null;peer.seat=null;room.lastActive=this.now();
 }
 step() {
  const now=this.now();
  for(const room of this) {
   for(let i=0;i<8;i++){
    const s=room.seats[i];
    if(s&&!s.peer&&s.reservedUntil<=now){
     room.seats[i]=null;
     if(room.host===i){
      room.host=room.seats.findIndex(m=>m?.peer);
      if(room.host>=0&&!room.match)room.seats[room.host].ready=true;
     }
    }
   }
   if(now-room.lastActive>=this.idleMs||(room.finishedAt!==null&&now-room.finishedAt>=60000)){
    this.#rooms.delete(room.code);
    for(const s of room.seats){
     if(!s?.peer)continue;
     const peer=s.peer;peer.room=null;peer.seat=null;s.peer=null;
     peer.send({type:'expired',code:room.code});
    }
    continue;
   }
   if(!room.match||room.finishedAt!==null)continue;
   const commands=new Map();
   for(const s of room.seats){
    if(!s?.peer)continue;
    if(now-s.lastInput>=this.inputTimeoutMs){s.level=NEUTRAL;s.edges=[]}
    commands.set(s.seat,{epoch:s.epoch,level:s.level,edges:s.edges});
    s.edges=[];
   }
   room.match.step(commands,{skipInjury:room.skipInjury});
   room.skipInjury=false;
   if(room.match.finished())room.finishedAt=now;
  }
 }
 snapshot(room){
  const state=room.match?.snapshot()??{tick:0,phase:'lobby',timeLeft:120,dropTime:0,holdTime:0,score:[0,0],
   players:Array.from({length:8},(_,slot)=>({slot,team:slot>>2,role:ROLES[slot%4]})),puck:null,events:[],...room.settings};
  state.players=state.players.map(p=>{
   const s=room.seats[p.slot];
   return {...p,claimed:!!s,connected:!!s?.peer,ready:!!s?.ready,controlledBy:s?.peer?'human':'ai'};
  });
  return {type:'snapshot',version:VERSION,code:room.code,host:room.host,...state};
 }
}
