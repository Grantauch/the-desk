// Minimal dependency-free RFC 6455 server transport for the ICEBREAK room proof.
// Supports browser text frames, ping/pong and close. Fragmentation/extensions are
// rejected deliberately. Replace with a maintained WebSocket library for release.
import { createHash } from 'node:crypto';
const GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME=4096;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});

function frame(opcode,payload=Buffer.alloc(0)){
 const data=Buffer.isBuffer(payload)?payload:Buffer.from(payload);
 const header=data.length<126?2:4,packet=Buffer.alloc(header+data.length);
 packet[0]=0x80|opcode;
 if(data.length<126)packet[1]=data.length;
 else{packet[1]=126;packet.writeUInt16BE(data.length,2)}
 data.copy(packet,header);
 return packet;
}
export function attachWebSockets(server,{onConnect,onMessage,onClose,allowedOrigins,maxConnections=128,allowMissingOrigin=false}){
 const peers=new Set();
 server.on('upgrade',(req,socket,head)=>{
  const fail=(code=403)=>{
   socket.write('HTTP/1.1 '+code+' Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
   socket.destroy();
  };
  const origin=req.headers.origin;
  const key=req.headers['sec-websocket-key'];
  const upgrade=(req.headers.upgrade||'').toLowerCase();
  const conn=(req.headers.connection||'').toLowerCase().split(',').map(x=>x.trim());
  if(req.url!=='/ws'||req.method!=='GET')return fail(404);
  if((!origin&&!allowMissingOrigin)||(origin&&!allowedOrigins.has(origin)))return fail(403);
  if(peers.size>=maxConnections)return fail(503);
  if(upgrade!=='websocket'||!conn.includes('upgrade')||typeof key!=='string')return fail(400);
  const raw=Buffer.from(key,'base64');
  if(raw.length!==16||raw.toString('base64')!==key.trim())return fail(400);
  const accept=createHash('sha1').update(key+GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  socket.setNoDelay(true);
  let pending=Buffer.alloc(0),closed=false,windowStart=Date.now(),windowCount=0;
  const peer={
   room:null,member:null,
   send(value){
    if(closed||!socket.writable)return;
    const data=JSON.stringify(value);
    if(Buffer.byteLength(data)>65000)return;
    socket.write(frame(1,data));
   },
   close(code=1000){
    if(closed)return;
    const info=Buffer.alloc(2);info.writeUInt16BE(code);
    try{socket.write(frame(8,info))}catch{}
    socket.end();
   }
  };
  function cleanup(){
   if(closed)return;
   closed=true;peers.delete(peer);onClose(peer);
  }
  function processFrame(opcode,data){
   if(opcode===8){peer.close();return}
   if(opcode===9){socket.write(frame(10,data));return}
   if(opcode===10)return;
   if(opcode!==1){peer.close(1003);return}
   if(data.length>MAX_FRAME){peer.close(1009);return}
   const now=Date.now();
   if(now-windowStart>=1000){windowStart=now;windowCount=0}
   if(++windowCount>60){peer.close(1008);return}
   try{onMessage(peer,decoder.decode(data))}catch{peer.close(1007)}
  }
  socket.on('data',chunk=>{
   if(closed)return;
   pending=Buffer.concat([pending,chunk]);
   if(pending.length>MAX_FRAME*3){peer.close(1009);return}
   while(pending.length>=2&&!closed){
    const b0=pending[0],b1=pending[1];
    if(!(b0&0x80)||(b0&0x70)!==0){peer.close(1002);return}
    const opcode=b0&15,masked=!!(b1&0x80);
    if(!masked){peer.close(1002);return}
    let length=b1&127,offset=2;
    if(length===127){peer.close(1009);return}
    if(length===126){
     if(pending.length<4)return;
     length=pending.readUInt16BE(2);offset+=2;
    }
    if(length>MAX_FRAME){peer.close(1009);return}
    if(pending.length<offset+4+length)return;
    const mask=pending.subarray(offset,offset+4),payload=Buffer.from(pending.subarray(offset+4,offset+4+length));
    for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];
    pending=pending.subarray(offset+4+length);
    processFrame(opcode,payload);
   }
  });
  socket.on('close',cleanup);socket.on('end',cleanup);socket.on('error',cleanup);
  socket.setTimeout(120000,()=>peer.close(1001));
  peers.add(peer);onConnect(peer);
  if(head?.length)socket.emit('data',head);
 });
 return {peers,closeAll(){for(const p of [...peers])p.close(1001)}};
}