import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomDirectory, makeGame, advance } from './core.mjs';
import { createIcebreakServer } from './server.mjs';
import { createConnection } from 'node:net';
import { randomBytes } from 'node:crypto';
import vm from 'node:vm';

function fake(){return {room:null,member:null}}
function client(url){
 const ws=new WebSocket(url),inbox=[],waiting=[];
 ws.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  const index=waiting.findIndex(w=>w.type===message.type&&w.predicate(message));
  if(index>=0){const w=waiting.splice(index,1)[0];clearTimeout(w.timer);w.resolve(message)}
  else inbox.push(message);
 });
 const open=new Promise((resolve,reject)=>{
  ws.addEventListener('open',resolve,{once:true});
  ws.addEventListener('error',reject,{once:true});
 });
 function wait(type,predicate=()=>true,ms=5000){
  const index=inbox.findIndex(m=>m.type===type&&predicate(m));
  if(index>=0)return Promise.resolve(inbox.splice(index,1)[0]);
  return new Promise((resolve,reject)=>{
   const w={type,predicate,resolve,timer:setTimeout(()=>{
    const i=waiting.indexOf(w);if(i>=0)waiting.splice(i,1);
    reject(Error('Timed out waiting for '+type));
   },ms)};
   waiting.push(w);
  });
 }
 return {ws,open,wait,send(value){ws.send(JSON.stringify(value))},
  async close(){
   if(ws.readyState===WebSocket.CLOSED)return;
   await new Promise(resolve=>{ws.addEventListener('close',resolve,{once:true});ws.close()});
  }};
}
test('room core reserves eight unique slots and a ninth cannot steal a seat',()=>{
 let now=1000;const directory=new RoomDirectory({now:()=>now,graceMs:1000});
 const host=fake(),receipt=directory.handle(host,{type:'create',seat:0});
 assert.equal(receipt.seat,0);assert.match(receipt.code,/^[A-HJ-NP-Z2-9]{6}$/);
 for(let seat=1;seat<8;seat++){
  const peer=fake(),response=directory.handle(peer,{type:'join',code:receipt.code,seat});
  assert.equal(response.seat,seat);
  assert.notEqual(response.token,receipt.token);
 }
 assert.throws(()=>directory.handle(fake(),{type:'join',code:receipt.code,seat:0}),/SEAT_TAKEN/);
 assert.throws(()=>directory.handle(fake(),{type:'join',code:receipt.code,seat:8}),/INVALID_SEAT/);
 assert.equal(directory.snapshot(host.room).players.filter(p=>p.claimed).length,8);
});
test('disconnect clears input and honors limited reconnect token',()=>{
 let now=100;const directory=new RoomDirectory({now:()=>now,graceMs:250});
 const first=fake(),seat=directory.handle(first,{type:'create',seat:3}),code=seat.code;
 directory.rooms.get(code).game.phase='playing';
 directory.handle(first,{type:'input',seq:44,axes:[1,0]});
 directory.disconnect(first);
 assert.equal(directory.snapshot(directory.rooms.get(code)).players[3].connected,false);
 const wrong=fake();
 assert.throws(()=>directory.handle(wrong,{type:'resume',code,token:'wrong'}),/INVALID_RESUME/);
 const resumed=fake(),result=directory.handle(resumed,{type:'resume',code,token:seat.token});
 assert.equal(result.seat,3);
 assert.equal(directory.handle(resumed,{type:'input',seq:1,axes:[0,0]}),null,'reconnected client restarts input sequence');
 directory.disconnect(resumed);now+=251;directory.step();
 assert.equal(directory.rooms.get(code).seats[3],null);
 assert.throws(()=>directory.handle(fake(),{type:'resume',code,token:seat.token}),/INVALID_RESUME/);
});
test('authority ignores forged state, stale sequence, out-of-range input and unready starts',()=>{
 const directory=new RoomDirectory(),a=fake(),b=fake(),result=directory.handle(a,{type:'create',seat:0});
 directory.handle(b,{type:'join',code:result.code,seat:4});
 assert.throws(()=>directory.handle(a,{type:'score',score:[99,0]}),/UNKNOWN_TYPE/);
 assert.throws(()=>directory.handle(a,{type:'start'}),/PLAYERS_NOT_READY/);
 directory.handle(b,{type:'ready',ready:true});
 assert.equal(directory.handle(a,{type:'start'}).type,'started');
 assert.throws(()=>directory.handle(a,{type:'input',seq:1,axes:[40,0]}),/INVALID_INPUT/);
 assert.equal(directory.handle(a,{type:'input',seq:1,axes:[1,0],shoot:false}),null);
 assert.throws(()=>directory.handle(a,{type:'input',seq:1,axes:[0,0]}),/INVALID_SEQUENCE/);
 assert.throws(()=>directory.handle(a,{type:'input',seq:2,axes:[0,0],check:42}),/INVALID_INPUT/);
 directory.step(1/90);
 assert.deepEqual(directory.snapshot(a.room).score,[0,0]);
});
test('fixed-step game simulates eight positions and score without client authority',()=>{
 const g=makeGame();g.phase='playing';
 assert.deepEqual(g.players.map(p=>p.role),['CENTER','WING','DEFENDER','GOALIE','CENTER','WING','DEFENDER','GOALIE']);
 const inputs=new Map([[0,{x:1,z:0,burst:true,shoot:false,pass:false,check:false}]]);
 const start=g.players[0].x;
 for(let i=0;i<100;i++)advance(g,inputs,1/90);
 assert.ok(g.players[0].x>start+1,'first remote input changes authoritative skater position');
 assert.ok(g.timeLeft<120);
 assert.equal(g.players.length,8);
 Object.assign(g.puck,{owner:null,x:28.65,z:0,vx:20,vz:0,lock:1});
 advance(g,inputs,1/90);
 assert.equal(g.score[0],1);
 assert.equal(g.phase,'faceoff');
});
test('eight independent real WebSocket connections share one server match and reject ninth seat',async t=>{
 const app=createIcebreakServer({port:0,allowMissingOrigin:true,allowedOrigins:['https://grant-desk.com','https://freegameplace.com']});
 const address=await app.listen();
 t.after(()=>app.close());
 const url='ws://127.0.0.1:'+address.port+'/ws';
 const clients=[];
 t.after(async()=>{await Promise.allSettled(clients.map(c=>c.close()))});
 for(let i=0;i<9;i++){
  const c=client(url);clients.push(c);await c.open;assert.equal((await c.wait('hello')).maximumPlayers,8);
 }
 const host=clients[0];host.send({type:'create',seat:0});
 const seat0=await host.wait('seated');
 const codes=new Set([seat0.code]),tokens=new Set([seat0.token]);
 for(let i=1;i<8;i++){
  clients[i].send({type:'join',code:seat0.code,seat:i});
  const seat=await clients[i].wait('seated');
  codes.add(seat.code);tokens.add(seat.token);
  assert.equal(seat.seat,i);
 }
 assert.equal(codes.size,1);assert.equal(tokens.size,8);
 clients[8].send({type:'join',code:seat0.code,seat:0});
 assert.equal((await clients[8].wait('error')).code,'SEAT_TAKEN');
 const first=await host.wait('snapshot',p=>p.players.filter(x=>x.claimed).length===8);
 assert.equal(first.players.length,8);
 for(let i=1;i<8;i++){
  clients[i].send({type:'ready',ready:true});
  assert.equal((await clients[i].wait('ready')).seat,i);
 }
 host.send({type:'start'});await host.wait('started');
 const started=await host.wait('snapshot',p=>p.phase==='playing');
 const threshold=started.tick+5;
 host.send({type:'input',seq:1,axes:[1,0],burst:true});
 const fromA=await clients[0].wait('snapshot',p=>p.tick>=threshold);
 const fromB=await clients[7].wait('snapshot',p=>p.tick===fromA.tick);
 assert.deepEqual(fromA.players,fromB.players);
 assert.deepEqual(fromA.puck,fromB.puck);
 assert.deepEqual(fromA.score,fromB.score);
 assert.ok(fromA.timeLeft<120);
 host.send({type:'score',score:[999,0]});
 assert.equal((await host.wait('error')).code,'UNKNOWN_TYPE');
 assert.deepEqual(app.rooms.rooms.get(seat0.code).game.score,[0,0]);
});
test('remote clients reconnect to their own seat but not another seat',async t=>{
 const app=createIcebreakServer({port:0,allowMissingOrigin:true,graceMs:2000});
 const address=await app.listen();t.after(()=>app.close());
 const url='ws://127.0.0.1:'+address.port+'/ws';
 const a=client(url);await a.open;await a.wait('hello');
 a.send({type:'create',seat:7});const ticket=await a.wait('seated');
 await a.close();
 const b=client(url);t.after(()=>b.close());
 await b.open;await b.wait('hello');
 b.send({type:'resume',code:ticket.code,token:ticket.token});
 const recovered=await b.wait('seated');
 assert.equal(recovered.seat,7);assert.equal(recovered.resumed,true);
 assert.equal(recovered.host,true);
});
function rawUpgrade(port,origin){
 const key=randomBytes(16).toString('base64');
 return new Promise((resolve,reject)=>{
  const socket=createConnection(port,'127.0.0.1'),timer=setTimeout(()=>{socket.destroy();reject(Error('upgrade timeout'))},3000);
  socket.on('connect',()=>{
   socket.write('GET /ws HTTP/1.1\r\nHost: 127.0.0.1:'+port+'\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: '+key+'\r\nOrigin: '+origin+'\r\n\r\n');
  });
  socket.once('data',data=>{clearTimeout(timer);const response=data.toString('utf8');socket.destroy();resolve(response)});
  socket.once('error',error=>{clearTimeout(timer);reject(error)});
 });
}
test('cross-origin WebSocket requests are refused except explicitly trusted sites',async t=>{
 const app=createIcebreakServer({port:0,allowedOrigins:['https://grant-desk.com','https://freegameplace.com']});
 const address=await app.listen();t.after(()=>app.close());
 const evil=await rawUpgrade(address.port,'https://attacker.example');
 const desk=await rawUpgrade(address.port,'https://grant-desk.com');
 const portal=await rawUpgrade(address.port,'https://freegameplace.com');
 assert.match(evil,/HTTP\/1\.1 403/);
 assert.match(desk,/HTTP\/1\.1 101/);
 assert.match(portal,/HTTP\/1\.1 101/);
});
test('same-origin localhost demo serves a valid client with its own allowed WebSocket origin',async t=>{
 const app=createIcebreakServer({port:0,serveDemo:true,allowedOrigins:[]});
 const address=await app.listen();t.after(()=>app.close());
 const url='http://127.0.0.1:'+address.port;
 const response=await fetch(url+'/demo');
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/Online Room Lab/);
 const code=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(code);
 assert.doesNotThrow(()=>new vm.Script(code));
 assert.match(await rawUpgrade(address.port,url),/HTTP\/1\.1 101/);
 assert.equal((await (await fetch(url+'/health')).json()).status,'ok');
});