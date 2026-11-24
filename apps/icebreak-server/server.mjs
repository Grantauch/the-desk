import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocket,WebSocketServer} from 'ws';
import {Rooms,RoomError,VERSION} from './rooms.mjs';
import {ROLES,STEP} from '../../packages/icebreak-core/match.mjs';

const ORIGINS=['https://grant-desk.com','https://www.grant-desk.com','https://freegameplace.com','https://www.freegameplace.com'];
const IMMEDIATE=new Set(['create','join','resume','ready','settings','start']);
const MAX_BUFFER=256*1024;

export function createIcebreakServer({port=0,path='/icebreak',origins=ORIGINS,maxConnections=256,
 maxRooms=32,heartbeatMs=20000,rooms=new Rooms({maxRooms}),logger=console}={}) {
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');
 if(typeof path!=='string'||!/^\/(?:[A-Za-z0-9_-]+\/?)+$/.test(path))throw Error('Invalid upgrade path');
 if(!Array.isArray(origins)||!origins.length||origins.some(v=>typeof v!=='string'||v!==new URL(v).origin
   ||!['https:','http:'].includes(new URL(v).protocol)))throw Error('Invalid origin allowlist');
 const allowed=new Set(origins);
 let closing=false,physicsTimer,snapshotTimer,heartbeatTimer,health=true;
 const peers=new Map();
 const server=createServer((req,res)=>{
  const isHealth=req.method==='GET'&&req.url==='/health';
  res.writeHead(isHealth?(health&&!closing?200:503):404,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify(isHealth?{status:health&&!closing?'ok':'unavailable',service:'icebreak',version:VERSION}:{status:'not-found'}));
 });
 const ws=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
 const refuse=(socket,status)=>socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
 server.on('upgrade',(req,socket,head)=>{
  if(closing||!health||ws.clients.size>=maxConnections)return refuse(socket,'503 Service Unavailable');
  if(req.url!==path)return refuse(socket,'404 Not Found');
  if(!allowed.has(req.headers.origin))return refuse(socket,'403 Forbidden');
  ws.handleUpgrade(req,socket,head,client=>ws.emit('connection',client));
 });
 function broadcast(room){
  const raw=JSON.stringify(rooms.snapshot(room));
  for(const seat of room.seats)if(seat?.peer)seat.peer.sendRaw(raw);
 }
 ws.on('connection',socket=>{
  const peer={room:null,seat:null,alive:true,quota:80,lastQuota:performance.now(),
   sendRaw(raw){
    if(socket.readyState!==WebSocket.OPEN)return;
    if(socket.bufferedAmount>MAX_BUFFER){socket.terminate();return}
    socket.send(raw,err=>{if(err)socket.terminate()});
   },
   send(message){this.sendRaw(JSON.stringify(message))}
  };
  peers.set(socket,peer);
  socket.on('error',()=>socket.terminate());
  socket.on('pong',()=>{peer.alive=true});
  socket.on('close',()=>{
   const room=peer.room;
   rooms.disconnect(peer);peers.delete(socket);
   if(room&&!closing)broadcast(room);
  });
  socket.on('message',(raw,binary)=>{
   if(closing||!health)return;
   const now=performance.now();
   peer.quota=Math.min(80,peer.quota+(now-peer.lastQuota)*.065);peer.lastQuota=now;
   if(peer.quota<1){socket.close(1008,'Message limit');return}
   peer.quota--;
   if(binary){socket.close(1003,'Text required');return}
   let data;
   try{data=JSON.parse(raw.toString())}catch{peer.send({type:'error',code:'INVALID_JSON'});return}
   try{
    const reply=rooms.handle(peer,data);
    if(reply)peer.send(reply);
    if(peer.room&&IMMEDIATE.has(data.type))broadcast(peer.room);
   }catch(error){
    if(error instanceof RoomError)peer.send({type:'error',code:error.message});
    else fail(error);
   }
  });
  peer.send({type:'hello',version:VERSION,maximumPlayers:8,roles:ROLES});
 });
 function fail(error){
  if(!health)return;
  health=false;
  logger.error('ICEBREAK server unhealthy:',error?.stack||error);
  for(const socket of peers.keys())socket.close(1011,'Match unavailable');
 }
 async function listen(){
  if(server.listening||closing)throw Error('Already started or closed');
  await new Promise((resolve,reject)=>{
   server.once('error',reject);
   server.listen(port,'127.0.0.1',()=>{server.off('error',reject);resolve()});
  });
  let last=performance.now(),elapsed=0;
  physicsTimer=setInterval(()=>{
   if(!health)return;
   try {
    const now=performance.now();
    elapsed=Math.min(.1,elapsed+(now-last)/1000);last=now;
    while(elapsed>=STEP){rooms.step();elapsed-=STEP}
   }catch(error){fail(error)}
  },5);
  snapshotTimer=setInterval(()=>{
   if(health)try{for(const room of rooms)broadcast(room)}catch(error){fail(error)}
  },50);
  heartbeatTimer=setInterval(()=>{
   for(const [socket,peer] of peers){
    if(!peer.alive){socket.terminate();continue}
    peer.alive=false;
    if(socket.readyState===WebSocket.OPEN)socket.ping();
   }
  },heartbeatMs);
  return server.address();
 }
 async function close(){
  if(closing)return;
  closing=true;
  clearInterval(physicsTimer);clearInterval(snapshotTimer);clearInterval(heartbeatTimer);
  for(const socket of peers.keys())socket.terminate();
  await Promise.all([new Promise(resolve=>ws.close(resolve)),new Promise(resolve=>server.close(resolve))]);
 }
 return {listen,close};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.ICEBREAK_PORT??4300);
 const path=process.env.ICEBREAK_WS_PATH??'/icebreak';
 const origins=process.env.ICEBREAK_ALLOWED_ORIGINS?.split(',').map(v=>v.trim())??ORIGINS;
 const app=createIcebreakServer({port,path,origins});
 await app.listen();
 console.log(`ICEBREAK v${VERSION} listening on loopback port ${port}`);
 for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>app.close());
}
