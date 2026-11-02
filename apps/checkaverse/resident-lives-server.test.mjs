import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import WebSocket from 'ws';
import {signTicket} from './accounts.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'resident-lives-server-'));
const PORT=24000+Math.floor(Math.random()*1000),origin=`http://127.0.0.1:${PORT}`,sleep=ms=>new Promise(r=>setTimeout(r,ms));
let child,log='';const clients=[];
async function start(rate){
  child=spawn(process.execPath,['--disable-warning=ExperimentalWarning',path.join(HERE,'server.mjs')],{cwd:HERE,env:{...process.env,CHECKAVERSE_DATA:DATA,CHECKAVERSE_PORT:String(PORT),CHECKAVERSE_ORIGINS:origin,CHECKAVERSE_WILD_RATE:'0.000001',CHECKAVERSE_LIFE_RATE:String(rate)},stdio:'pipe'});
  child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
  for(let i=0;i<80;i++){try{if((await fetch(origin+'/health')).ok)return;}catch{}await sleep(100);}throw Error('server did not start');
}
async function stop(){for(const c of clients)if(c.ws.readyState===1)c.ws.close();await sleep(350);if(child.exitCode===null&&child.signalCode===null){const exit=new Promise(r=>child.once('exit',r));child.kill();await exit;}}
function ticket(id){const now=Date.now();return signTicket(fs.readFileSync(path.join(DATA,'ticket-key.txt'),'utf8').trim(),{v:1,p:`syntheticResident${id}000000`,h:'Synthetic residents',d:'2026-11-02',c:true,n:12,s:4,b:9,k:{s:'mochi',n:''},iat:now,exp:now+7200000,j:'test'});}
async function client(t=null){
  const ws=new WebSocket(`ws://127.0.0.1:${PORT}/ws`,{origin}),inbox=[];
  ws.on('message',d=>inbox.push(JSON.parse(d)));await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});ws.send(JSON.stringify({t:'hello',ticket:t}));
  const next=async(type,test=()=>true,ms=5000)=>{const end=Date.now()+ms;while(Date.now()<end){const i=inbox.findIndex(m=>m.t===type&&test(m));if(i>=0)return inbox.splice(i,1)[0];await sleep(15);}throw Error(`timeout: ${type}`);};
  const c={ws,inbox,next,send:m=>ws.send(JSON.stringify(m))};clients.push(c);c.w=await next('welcome');c.pos=c.w.players.find(p=>p.id===c.w.you);c.kind=c.w.kind;return c;
}
try{
  await start(30);const a=await client(),b=await client();
  const fa=await a.next('residents',m=>m.clock>Math.max(a.w.life.clock,b.w.life.clock));
  const fb=await b.next('residents',m=>m.clock===fa.clock);
  assert.deepEqual(fa.residents,fb.residents);assert.deepEqual(fa.marks,fb.marks);assert.equal(fa.residents.length,7);
  console.log('  ok two real WebSocket clients receive the same shared positions, tasks, props and memories');
  const ta=ticket('A'),tb=ticket('B'),p=await client(ta),q=await client(tb);
  assert.equal(p.w.life.residents.length,5);assert.equal(p.w.kettle.residentHomes.length,5);assert.equal(p.w.town.residentHomes.length,7);
  assert.ok(!JSON.stringify(p.w.life).includes('syntheticResidentA'));
  p.send({t:'resident_find',id:'rowan'});const held=await p.next('residents',m=>m.residents.some(n=>n.id==='rowan'&&n.held));
  const other=await q.next('residents');assert.equal(other.residents.find(n=>n.id==='rowan').held,false);p.send({t:'resident_release',id:'rowan'});
  const delivered=await p.next('residents',m=>m.residents.find(n=>n.id==='pax').deliveries>0&&m.residents.find(n=>n.id==='nell').received>0,18000);
  assert.ok(delivered.residents.some(n=>n.completed>0));
  console.log('  ok saved home towns isolate resident holds and history; actual parcels are delivered and received');
  const teacher=fs.readFileSync(path.join(DATA,'teacher-key.txt'),'utf8').trim();
  const pause=async v=>assert.equal((await fetch(origin+'/api/teacher/pause',{method:'POST',headers:{'Content-Type':'application/json','x-teacher-key':teacher},body:JSON.stringify({v})})).status,200);
  await pause(true);await p.next('paused',m=>m.v);p.inbox.length=0;const frozen=await p.next('residents');await sleep(600);const still=await p.next('residents',m=>m.clock===frozen.clock);assert.deepEqual(still.residents,frozen.residents);
  await pause(false);await p.next('residents',m=>m.clock>frozen.clock);
  console.log('  ok the teacher pause freezes the real shared and private resident clocks');
  const count=delivered.residents.find(n=>n.id==='pax').deliveries;
  await stop();await start(1);const resumed=await client(ta);assert.ok(resumed.w.life.residents.find(n=>n.id==='pax').deliveries>=count);assert.ok(resumed.w.life.residents.some(n=>n.memory.length));
  console.log('  ok NPC jobs, carried state and memories survive a real process restart and account reconnect');
  const before=resumed.w.room;resumed.send({t:'resident_enter',id:'pax'});await sleep(150);assert.ok(!resumed.inbox.some(m=>m.t==='room'));
  function route(rows,from,to){const qu=[[from.x,from.y,[]]],seen=new Set();for(let i=0;i<qu.length;i++){const[x,y,path]=qu[i],k=`${x},${y}`;if(seen.has(k))continue;seen.add(k);if(x===to[0]&&y===to[1])return path;for(const[d,[ax,ay]]of Object.entries({u:[0,-1],d:[0,1],l:[-1,0],r:[1,0]})){const ch=rows[y+ay]?.[x+ax];if(ch&&!('TWHSLGCRAXBKN'.includes(ch)))qu.push([x+ax,y+ay,[...path,d]]);}}throw Error('no player route');}
  resumed.send({t:'resident_find',id:'pax',home:true});const directions=await resumed.next('resident_path');
  for(const d of route(resumed.w.kettle.rows,resumed.pos,directions.goal)){resumed.send({t:'move',d});const pos=await resumed.next('pos',m=>m.id===resumed.w.you);resumed.pos=pos;await sleep(125);}
  resumed.send({t:'move',d:directions.then});const inside=await resumed.next('room');assert.equal(inside.kind,'house');assert.equal(inside.owner.resident,'pax');assert.match(inside.room,/^nr:private-/);
  resumed.send({t:'move',d:'d'});const outside=await resumed.next('room');assert.equal(outside.kind,'kettle');assert.equal(outside.room,before);
  console.log('  ok real grid walking enters the named NPC home through its door and exits to the correct private town; remote-entry messages cannot teleport');
  await stop();const db=new DatabaseSync(path.join(DATA,'checkaverse.db'));const keys=db.prepare("SELECT key FROM meta WHERE key LIKE 'resident-life-v1:%'").all();assert.equal(keys.length,3);db.close();
  console.log('PASS resident lives server');
}catch(e){console.error(log.slice(-2500));throw e;}finally{if(child?.exitCode===null&&child?.signalCode===null)await stop();}
