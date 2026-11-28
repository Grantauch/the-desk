import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createIcebreakServer} from '../../apps/icebreak-server/server.mjs';
import {createRequire} from 'node:module';
const WS=createRequire(new URL('../../apps/icebreak-server/package.json',import.meta.url))('ws');

const A='https://grant-desk.com',B='https://freegameplace.com';
function connect(url,origin){
 const socket=new WS(url,{origin,perMessageDeflate:false,handshakeTimeout:2000});
 const messages=[];
 socket.on('message',data=>{messages.push(JSON.parse(data.toString()));if(messages.length>200)messages.shift()});
 socket.on('error',()=>{}); // wait() will produce a bounded failure with the last messages.
 return {socket,messages,send:type=>socket.send(JSON.stringify(type)),close:()=>socket.close()};
}
async function until(select,description,timeout=4000){
 const end=performance.now()+timeout;
 while(performance.now()<end){const result=select();if(result)return result;await delay(12)}
 assert.fail('Timed out waiting for '+description);
}
function wait(c,which,pred=()=>true){return until(()=>c.messages.find(m=>m.type===which&&pred(m)),which)}
const snapshots=(c,check)=>c.messages.filter(m=>m.type==='snapshot'&&check(m));
function shared(clients,check){
 return until(()=>{
  const candidates=snapshots(clients[0],check).slice().reverse();
  for(const candidate of candidates){
   const group=clients.map(c=>snapshots(c,s=>s.tick===candidate.tick&&check(s)).at(-1));
   if(group.every(Boolean)){group.forEach(s=>assert.deepEqual(s,candidate));return candidate}
  }
 },'a common complete same-tick snapshot');
}

test('eight WebSocket clients from two configured origins play one real match and reconnect', {timeout:16000},async t=>{
 const app=createIcebreakServer({origins:[A,B]});
 t.after(()=>app.close());
 const address=await app.listen(),url='ws://127.0.0.1:'+address.port+'/icebreak';
 assert.equal((await fetch('http://127.0.0.1:'+address.port+'/health')).status,200);
 const clients=Array.from({length:8},(_,i)=>connect(url,i%2===0?A:B));
 await Promise.all(clients.map(c=>wait(c,'hello',m=>m.maximumPlayers===8)));
 clients[0].send({type:'create',seat:0,rink:'park',mode:'powerups'});
 const {code}=await wait(clients[0],'seated');
 clients.slice(1).forEach((c,k)=>c.send({type:'join',code,seat:k+1}));
 const guests=await Promise.all(clients.slice(1).map((c,k)=>wait(c,'seated',m=>m.seat===k+1)));
 const ninth=connect(url,B);
 await wait(ninth,'hello');
 ninth.send({type:'join',code,seat:7});
 await wait(ninth,'error',m=>m.code==='SEAT_TAKEN');
 ninth.send({type:'create',seat:0,rink:'mars'});
 const other=(await wait(ninth,'seated')).code;
 assert.notEqual(other,code);
 await wait(ninth,'snapshot',m=>m.code===other);
 clients[0].send({type:'start'});
 await wait(clients[0],'error',m=>m.code==='PLAYERS_NOT_READY');
 clients.slice(1).forEach(c=>c.send({type:'ready',ready:true}));
 await wait(clients[0],'snapshot',m=>m.code===code&&m.players.length===8&&m.players.every(s=>s.ready));
 clients[0].send({type:'start'});
 await wait(clients[0],'started');
 const initial=await shared(clients,s=>s.code===code&&s.phase==='playing'&&s.dropTime>0);
 assert.equal(initial.rink,'park');assert.equal(initial.mode,'powerups');
 assert.deepEqual(initial.players.map(p=>p.slot),[0,1,2,3,4,5,6,7]);
 assert.equal(initial.timeLeft,120);
 assert.ok(initial.players.every(s=>s.connected&&s.controlledBy==='human'));
 assert.ok(!JSON.stringify(initial).includes(guests[0].token));

 let sequence=0;
 function pulse(slot) {
  // Distinct role-safe directions, including independent goalie input within their creases.
  const axes=slot%4===3?[0,slot===3?1:-1]:[slot<4?1:-1,slot%4===1?-.3:.2];
  clients[slot].send({type:'input',seq:sequence,axes,burst:slot%4!==3});
 }
 let pulseTimer;
 try{
  pulseTimer=setInterval(()=>{sequence++;clients.forEach((c,i)=>{if(c.socket.readyState===WS.OPEN)pulse(i)})},45);
  const moving=await shared(clients,s=>s.code===code&&s.timeLeft<119.5&&s.players.every((p,i)=>
   Math.hypot(p.x-initial.players[i].x,p.z-initial.players[i].z)>.25));
  assert.ok(moving.tick>initial.tick);
  assert.equal(moving.players[3].role,'GOALIE');
  assert.ok(moving.players[3].z>.25&&moving.players[7].z<-.25);
  assert.deepEqual(moving.score,[0,0]);
  assert.ok(moving.puck&&Number.isFinite(moving.puck.x));
 }finally{clearInterval(pulseTimer)}
 const goalie=guests.at(-1);
 clients[7].close();
 const dropout=await wait(clients[0],'snapshot',m=>m.code===code&&m.tick>initial.tick&&m.players[7].controlledBy==='ai');
 assert.equal(dropout.players[7].claimed,true);
 const resumed=connect(url,B);
 await wait(resumed,'hello');
 resumed.send({type:'resume',code,token:goalie.token});
 await wait(resumed,'seated',m=>m.seat===7&&m.resumed);
 const group=[...clients.slice(0,7),resumed];
 const resumedSnapshot=await shared(group,m=>m.code===code&&m.tick>dropout.tick&&m.players[7].connected);
 resumed.send({type:'input',seq:0,axes:[0,1]});
 const resumedMotion=await shared(group,m=>m.code===code&&m.tick>resumedSnapshot.tick+7&&m.players[7].vz>.5);
 assert.ok(resumedMotion.timeLeft<initial.timeLeft);
 assert.ok(ninth.messages.every(m=>m.type!=='snapshot'||(m.code===other&&m.phase==='lobby'&&m.tick===0)));
});
