import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {createConnection,createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {createIcebreakServer} from '../../apps/icebreak-server/server.mjs';

const WS=createRequire(new URL('../../apps/icebreak-server/package.json',import.meta.url))('ws');
const origin='https://grant-desk.com';
const realHeartbeat=process.env.ICEBREAK_REAL_HEARTBEAT==='1';
const wsUrl=port=>'ws://127.0.0.1:'+port+'/icebreak';
function client(port,extra){
 const socket=new WS(wsUrl(port),{origin,...extra});
 const messages=[];
 socket.on('message',frame=>messages.push(JSON.parse(frame.toString())));
 socket.on('error',()=>{});
 return {socket,messages,send:message=>socket.send(JSON.stringify(message))};
}
async function find(read,timeoutMs=3500){
 const stop=performance.now()+timeoutMs;
 while(performance.now()<stop){const value=read();if(value)return value;await delay(10)}
 assert.fail('Timed out waiting for expected runtime state');
}
const message=(c,type,pred=()=>true,timeoutMs)=>find(()=>c.messages.find(v=>v.type===type&&pred(v)),timeoutMs);

// A TCP path outage silently drops bytes without delivering a WS close or TCP FIN
// to the match server. No hand-built WebSocket frames are used.
async function linkTo(serverPort){
 let unplugged=false;
 const sockets=new Set();
 const relay=createServer(downstream=>{
  const upstream=createConnection(serverPort,'127.0.0.1');
  for(const socket of [upstream,downstream]){
   sockets.add(socket);
   socket.on('error',()=>{});
   socket.on('close',()=>{
    sockets.delete(socket);
    const far=socket===upstream?downstream:upstream;
    far.destroy();
   });
  }
  downstream.on('data',packet=>{if(!unplugged&&!upstream.destroyed)upstream.write(packet)});
  upstream.on('data',packet=>{if(!unplugged&&!downstream.destroyed)downstream.write(packet)});
 });
 await new Promise(resolve=>relay.listen(0,'127.0.0.1',resolve));
 return {port:relay.address().port,unplug(){unplugged=true},close(){
  for(const socket of sockets)socket.destroy();
  return new Promise(resolve=>relay.close(resolve));
 }};
}

test('silent network loss switches reserved seat to AI; slow reachable mobile peer stays human; reconnect restores slot', {timeout:realHeartbeat?15000:6000},async t=>{
 const timing=realHeartbeat?{}:{heartbeatMs:150,peerTimeoutMs:800};
 const app=createIcebreakServer({origins:[origin],...timing});
 const {port}=await app.listen();
 const path=await linkTo(port);
 t.after(async()=>{await path.close();await app.close()});
 const host=client(port),guest=client(path.port),slow=client(port,{autoPong:false});
 let delayed=0;
 slow.socket.on('ping',data=>{
  if(delayed++===0)return; // A missed ping plus late responses shouldn't drop this seat.
  setTimeout(()=>{if(slow.socket.readyState===WS.OPEN)slow.socket.pong(data)},realHeartbeat?3200:360);
 });
 await Promise.all([host,guest,slow].map(c=>message(c,'hello')));
 host.send({type:'create',seat:0});
 const {code}=await message(host,'seated');
 guest.send({type:'join',code,seat:7});slow.send({type:'join',code,seat:2});
 const {token}=await message(guest,'seated');
 await message(slow,'seated');
 guest.send({type:'ready',ready:true});slow.send({type:'ready',ready:true});
 await message(host,'snapshot',s=>s.players[2].ready&&s.players[7].ready);
 host.send({type:'start'});await message(host,'started');
 const before=await message(host,'snapshot',s=>s.phase==='playing'&&s.players[7].connected);

 const stopped=performance.now();
 path.unplug();
 const resumed=client(port);
 await message(resumed,'hello');resumed.send({type:'resume',code,token});
 await message(resumed,'error',s=>s.code==='SEAT_STILL_CONNECTED');
 const lost=await message(host,'snapshot',s=>s.phase!=='lobby'&&s.tick>before.tick&&s.players[7].controlledBy==='ai',realHeartbeat?11000:3500);
 const failoverMs=Math.round(performance.now()-stopped);
 assert.ok(failoverMs<(realHeartbeat?9000:1450),'detection exceeded expected limit: '+failoverMs+' ms');
 if(realHeartbeat)console.log('Default heartbeat: silent link switched to AI in '+failoverMs+' ms');
 assert.equal(lost.players[7].claimed,true);
 assert.equal(lost.players[7].connected,false);
 assert.equal(lost.players[2].controlledBy,'human');
 assert.ok(delayed>1);
 resumed.send({type:'resume',code,token});await message(resumed,'seated',s=>s.seat===7&&s.resumed);
 await message(host,'snapshot',s=>s.tick>lost.tick&&s.players[7].controlledBy==='human');
});

test('simulation failure is 503 and WebSocket 1011 before the supervisor sees nonzero exit', {timeout:7500},async t=>{
 const serverUrl=new URL('../../apps/icebreak-server/server.mjs',import.meta.url).href;
 const roomUrl=new URL('../../apps/icebreak-server/rooms.mjs',import.meta.url).href;
 const fixture=`
  import {startIcebreakProcess} from ${JSON.stringify(serverUrl)};
  import {Rooms} from ${JSON.stringify(roomUrl)};
  const rooms=new Rooms();
  const step=rooms.step.bind(rooms);
  rooms.step=()=>{if(broken)throw Error('test simulation failure');step()};
  let broken=false;
  process.on('message',()=>{broken=true;process.disconnect()});
  const address=await startIcebreakProcess({rooms,origins:[${JSON.stringify(origin)}]});
  process.send(address.port);
 `;
 const child=spawn(process.execPath,['--input-type=module','-e',fixture],{stdio:['ignore','ignore','pipe','ipc']});
 let diagnostics='';
 child.stderr.on('data',chunk=>{diagnostics+=chunk});
 t.after(()=>{if(child.exitCode===null)child.kill('SIGTERM')});
 const ended=once(child,'exit');
 const [port]=await once(child,'message');
 const health='http://127.0.0.1:'+port+'/health';
 assert.equal((await fetch(health)).status,200);
 const c=client(port);await message(c,'hello');
 const wsClosed=once(c.socket,'close');
 child.send('simulate-failure');
 const [code]=await wsClosed;
 assert.equal(code,1011);
 const response=await fetch(health);
 assert.equal(response.status,503);
 assert.deepEqual(await response.json(),{status:'unavailable',service:'icebreak',version:1});
 const [exit,signal]=await ended;
 assert.equal(exit,1);assert.equal(signal,null);
 assert.match(diagnostics,/ICEBREAK server unhealthy:[\s\S]*test simulation failure/);
});
