import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createIcebreakServer } from '../icebreak-online/server.mjs';

const output = path.resolve(process.env.ICEBREAK_ONLINE_EVIDENCE || 'browser-results/icebreak-online');
fs.mkdirSync(output,{recursive:true});
const results={checks:[],clients:[],errors:[],caveats:[]};
const step=(name,value)=>{results.checks.push({name,passed:true,...value});console.log('PASS '+name)};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label,timeout=7000){
 const start=Date.now();
 while(Date.now()-start<timeout){const value=await predicate();if(value)return value;await delay(45)}
 throw Error('Timed out: '+label);
}
function lastSnapshot(c){return c.snapshots.at(-1)}
function findCommonSnapshot(clients){
 const first=clients[0].snapshots.slice(-75).filter(x=>x.phase==='playing');
 for(let i=first.length-1;i>=0;i--){
  const item=first[i],others=clients.slice(1).map(c=>c.snapshots.find(x=>x.phase==='playing'&&x.tick===item.tick));
  if(others.every(Boolean))return [item,...others];
 }
 return null;
}
function watch(page){
 const received=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('websocket',socket=>{
  socket.on('framereceived',frame=>{
   try{
    const packet=JSON.parse(String(frame.payload));
    received.push(packet);
    if(received.length>1000)received.shift();
   }catch{}
  });
 });
 return {received,errors,snapshots:[],listen(){
  this.snapshots=received.filter(x=>x.type==='snapshot');
 }};
}
const app=createIcebreakServer({port:0,serveDemo:true,allowedOrigins:[
 'https://grant-desk.com','https://freegameplace.com']});
let browser;
const clients=[];
try{
 const address=await app.listen();
 const port=address.port;
 // The actual browsers use distinct HTTP origins for the same local server.
 // Production HTTPS/WSS allowlisting is tested separately by room.test.mjs.
 browser=await chromium.launch({headless:true,args:[
  '--host-resolver-rules=MAP localhost 127.0.0.1',
  '--disable-features=Translate'
 ]});
 async function openClient(index){
  const context=await browser.newContext({
   viewport:index%2?{width:1440,height:900}:{width:390,height:844},
   isMobile:index%2===0,hasTouch:index%2===0,
   deviceScaleFactor:1
  });
  const page=await context.newPage(),monitor=watch(page);
  const origin=index%2?'http://localhost:'+port:'http://127.0.0.1:'+port;
  await page.goto(origin+'/demo',{waitUntil:'domcontentloaded'});
  await until(async()=>await page.locator('#connection').textContent()==='Connected to room server',
   'client '+index+' connects over browser WebSocket');
  const c={index,context,page,origin,monitor,get snapshots(){return monitor.received.filter(p=>p.type==='snapshot')}};
  clients.push(c);
  return c;
 }
 const roles=['CENTER','WING','DEFENDER','GOALIE'];
 const first=await openClient(0);
 await first.page.locator('#create').click();
 const code=await until(async()=>{
  const c=(await first.page.locator('#roomcode').textContent())?.trim()||'';
  return /^[A-HJ-NP-Z2-9]{6}$/.test(c)?c:false;
 },'room creation');
 results.room=code;
 step('host creates a six-character room',{code});
 for(let i=1;i<8;i++){
  const c=await openClient(i);
  await c.page.locator('#seats .seat').nth(i).click();
  await c.page.locator('#joincode').fill(code);
  await c.page.locator('#join').click();
  await until(async()=>await c.page.locator('#roomcode').textContent()===code,'seat '+i+' join');
  const expected=(i<4?'Glaciers':'Embers')+' · '+roles[i%4];
  assert.equal((await c.page.locator('#me').textContent()).trim(),expected);
  results.clients.push({seat:i,origin:c.origin,role:roles[i%4],team:i<4?0:1});
 }
 results.clients.unshift({seat:0,origin:first.origin,role:roles[0],team:0});
 step('eight distinct real Chromium contexts claim one unique position each',{
  contexts:clients.length,origins:[...new Set(clients.map(c=>c.origin))].length});
 const ninth=await openClient(8);
 await ninth.page.locator('#joincode').fill(code);
 await ninth.page.locator('#join').click();
 await until(async()=>/SEAT_TAKEN/.test(await ninth.page.locator('#notice').textContent()),'ninth seat denied');
 assert.equal((await ninth.page.locator('#roomcode').textContent()).trim(),'—');
 step('ninth Chromium browser rejected from full room');
 await ninth.context.close();
 clients.pop();

 const host=clients[0];
 // No start before all participating players explicitly mark ready.
 await host.page.locator('#start').click();
 await until(async()=>/PLAYERS_NOT_READY/.test(await host.page.locator('#notice').textContent()),
  'host cannot start without readiness');
 for(let i=1;i<8;i++){
  await clients[i].page.locator('#ready').click();
  await until(async()=>/^Ready/.test(await clients[i].page.locator('#ready').textContent()),
   'seat '+i+' ready acknowledgement');
 }
 await host.page.locator('#start').click();
 await until(async()=>clients.every(c=>c.snapshots.some(s=>s.phase==='playing')),
  'eight clients see start',8000);
 step('host ready gate and all eight shared live phase');

 const set=await until(()=>findCommonSnapshot(clients),'common authoritative tick across eight browsers');
 const [authority,...replicas]=set;
 assert.equal(authority.players.length,8);
 assert.equal(authority.players.filter(p=>p.claimed&&p.connected).length,8);
 for(const replica of replicas){
  assert.deepEqual(replica.players,authority.players);
  assert.deepEqual(replica.puck,authority.puck);
  assert.deepEqual(replica.score,authority.score);
  assert.equal(replica.timeLeft,authority.timeLeft);
 }
 step('eight browsers receive identical authoritative puck, clock, score and skater state',
  {tick:authority.tick,players:authority.players.length});

 // Two browsers on different origins steer their own skaters concurrently.
 const baseline=lastSnapshot(clients[0]);
 const initX0=baseline.players[0].x,initX5=baseline.players[5].x;
 await Promise.all([clients[0].page.keyboard.down('w'),clients[5].page.keyboard.down('s')]);
 await delay(560);
 await Promise.all([clients[0].page.keyboard.up('w'),clients[5].page.keyboard.up('s')]);
 await until(()=>{
  const s=lastSnapshot(clients[0]);
  return s&&s.tick>=baseline.tick+30&&s.players[0].x>initX0+.15&&s.players[5].x<initX5-.15?s:false;
 },'independent steering across origins');
 const moved=lastSnapshot(clients[0]);
 step('separate internet clients independently move their own assigned skaters',
  {homeDelta:Math.round((moved.players[0].x-initX0)*100)/100,
   awayDelta:Math.round((moved.players[5].x-initX5)*100)/100});

 const beforeDisconnect=lastSnapshot(clients[7]);
 assert.equal(beforeDisconnect.players[7].connected,true);
 const old=clients[7].monitor.received.filter(x=>x.type==='seated').at(-1);
 assert.equal(old?.seat,7);
 await clients[7].page.reload({waitUntil:'domcontentloaded'});
 await until(()=>clients[7].monitor.received.some(x=>x.type==='seated'&&x.resumed===true),
  'seat seven resumes from browser session token',8000);
 await until(()=>{
  const s=lastSnapshot(clients[0]);
  return s&&s.players[7].claimed&&s.players[7].connected?s:false;
 },'reconnected seat returns to shared world');
 assert.equal((await clients[7].page.locator('#me').textContent()).trim(),'Embers · GOALIE');
 step('disconnected browser reclaims its original goalie seat without duplication');

 await host.page.screenshot({path:path.join(output,'host-desktop-or-mobile.png')});
 await clients[5].page.screenshot({path:path.join(output,'opposing-team-origin.png')});
 results.clients=clients.map(c=>({seat:c.index,origin:c.origin,snapshots:c.snapshots.length,
  errors:c.monitor.errors}));
 assert.ok(clients.every(c=>c.monitor.errors.length===0),
  'no uncaught browser page errors allowed');
 results.caveats=[
  'Local browser origins emulate two separate websites; this does not prove production TLS/WSS or DNS.',
  'The room server implements simplified hockey physics, not mature ICEBREAK physics parity.',
  'Eight browser contexts run on a single CI host, not eight distinct human devices.'
 ];
 step('no browser JavaScript errors; screenshots captured');
 console.log(JSON.stringify({suite:'ICEBREAK eight-browser cross-origin room proof',results},null,2));
}finally{
 fs.writeFileSync(path.join(output,'eight-browser-results.json'),JSON.stringify(results,null,2));
 await Promise.allSettled(clients.map(c=>c.context.close()));
 if(browser)await browser.close();
 await app.close();
}