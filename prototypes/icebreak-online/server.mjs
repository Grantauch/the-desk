import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { RoomDirectory } from './core.mjs';
import { attachWebSockets } from './socket.mjs';

const DEFAULT_ORIGINS=[
 'https://grant-desk.com','https://www.grant-desk.com',
 'https://freegameplace.com','https://www.freegameplace.com'
];
function fail(res,code,text){
 res.writeHead(code,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
 res.end(text);
}
export function createIcebreakServer(options={}){
 const host=options.host||'127.0.0.1',port=options.port??0;
 const rooms=new RoomDirectory({now:options.now,maxRooms:options.maxRooms,graceMs:options.graceMs,idleMs:options.idleMs});
 const allowedOrigins=new Set(options.allowedOrigins||DEFAULT_ORIGINS);
 const demoPath=fileURLToPath(new URL('./demo.html',import.meta.url));
 const server=http.createServer(async(req,res)=>{
  if(req.method!=='GET')return fail(res,405,'Method not allowed');
  if(req.url==='/health'){
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
   return res.end(JSON.stringify({status:'ok',version:1,rooms:rooms.rooms.size}));
  }
  if(req.url==='/'||req.url==='/demo'){
   // Demo is localhost-only; public arcade clients integrate independently.
   if(!options.serveDemo)return fail(res,404,'Not found');
   try{
    const html=await readFile(demoPath);
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
    return res.end(html);
   }catch{return fail(res,500,'Demo unavailable')}
  }
  return fail(res,404,'Not found');
 });
 const ws=attachWebSockets(server,{
  allowedOrigins,maxConnections:options.maxConnections||128,
  allowMissingOrigin:!!options.allowMissingOrigin,
  onConnect(peer){peer.send({type:'hello',version:1,maximumPlayers:8,roles:['CENTER','WING','DEFENDER','GOALIE']})},
  onMessage(peer,raw){
   let data;
   try{data=JSON.parse(raw)}catch{peer.send({type:'error',code:'INVALID_JSON'});return}
   try{
    const response=rooms.handle(peer,data);
    if(response)peer.send(response);
    if(peer.room&&(data.type==='create'||data.type==='join'||data.type==='resume'
      ||data.type==='ready'||data.type==='start'))broadcast(peer.room);
   }catch(err){
    peer.send({type:'error',code:err?.message||'INVALID_OPERATION'});
   }
  },
  onClose(peer){rooms.disconnect(peer)}
 });
 function broadcast(room){
  const packet=rooms.snapshot(room);
  for(const member of room.seats)if(member?.peer)member.peer.send(packet);
 }
 let physicsTimer,snapshotTimer;
 async function listen(){
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve)});
  let last=performance.now(),accumulator=0;
  physicsTimer=setInterval(()=>{
   const now=performance.now();
   accumulator=Math.min(.1,accumulator+(now-last)/1000);last=now;
   let frames=0;
   while(accumulator>=1/90&&frames++<9){rooms.step(1/90);accumulator-=1/90}
  },5);
  snapshotTimer=setInterval(()=>{for(const room of rooms.rooms.values())broadcast(room)},50);
  return server.address();
 }
 async function close(){
  if(physicsTimer)clearInterval(physicsTimer);
  if(snapshotTimer)clearInterval(snapshotTimer);
  ws.closeAll();
  await new Promise(resolve=>server.close(resolve));
 }
 return {server,rooms,listen,close,broadcast};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const origins=process.env.ICEBREAK_ALLOWED_ORIGINS?.split(',').map(x=>x.trim()).filter(Boolean)||DEFAULT_ORIGINS;
 const port=Number(process.env.ICEBREAK_PORT||0);
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');
 const app=createIcebreakServer({port,host:'127.0.0.1',allowedOrigins:origins,
  serveDemo:process.env.NODE_ENV!=='production',
  allowMissingOrigin:process.env.NODE_ENV!=='production'});
 app.listen().then(address=>console.log('ICEBREAK prototype listening on 127.0.0.1:'+address.port));
 const shutdown=()=>app.close().then(()=>process.exit(0));
 process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
}