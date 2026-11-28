import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createIcebreakServer} from '../../apps/icebreak-server/server.mjs';

const chromiumModule=process.env.ICEBREAK_PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(chromiumModule);
const executablePath=process.env.ICEBREAK_CHROMIUM||undefined;
const fixture=createServer((_req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>ICEBREAK transport fixture</title><main tabindex="0">Transport smoke test</main>')});
let app,browser;
try {
 await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
 const p=fixture.address().port,origins=['http://localhost:'+p,'http://127.0.0.1:'+p];
 app=createIcebreakServer({origins});
 const port=(await app.listen()).port,url='ws://127.0.0.1:'+port+'/icebreak';
 browser=await chromium.launch({executablePath,headless:true});
 const init=async i=>{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(origins[i%2]);
  await page.evaluate(({url,seat})=>{
   const socket=new WebSocket(url),messages=[];
   window.fixture={socket,messages,send:m=>socket.send(JSON.stringify(m))};
   socket.addEventListener('message',e=>messages.push(JSON.parse(e.data)));
   let sequence=0;
   const axis=seat%4===3?[0,seat===3?1:-1]:[seat<4?1:-1,.2];
   window.addEventListener('keydown',e=>{
    if(e.key==='ArrowUp'&&socket.readyState===WebSocket.OPEN){
     window.fixture.send({type:'input',seq:sequence++,axes:axis});
    }
   });
  },{url,seat:i});
  await page.waitForFunction(()=>window.fixture.messages.some(m=>m.type==='hello'));
  return {page,context};
 };
 const clients=await Promise.all(Array.from({length:8},(_,i)=>init(i)));
 async function send(i,message){await clients[i].page.evaluate(m=>window.fixture.send(m),message)}
 await send(0,{type:'create',seat:0});
 const code=await (await clients[0].page.waitForFunction(()=>window.fixture.messages.find(m=>m.type==='seated')?.code)).jsonValue();
 await Promise.all(clients.slice(1).map(async ({page},idx)=>{
  await send(idx+1,{type:'join',seat:idx+1,code});
  await page.waitForFunction(seat=>window.fixture.messages.some(m=>m.type==='seated'&&m.seat===seat),idx+1);
  await send(idx+1,{type:'ready',ready:true});
 }));
 const host=clients[0].page;
 await host.waitForFunction(()=>window.fixture.messages.some(m=>m.type==='snapshot'&&m.players.every(p=>p.ready)));
 await send(0,{type:'start'});
 const initial=await (await host.waitForFunction(()=>window.fixture.messages.find(m=>m.type==='snapshot'&&m.phase==='playing'))).jsonValue();
 await host.waitForFunction(()=>window.fixture.messages.some(m=>m.type==='snapshot'&&m.phase==='playing'&&m.timeLeft<120));
 const deadline=performance.now()+5000;
 let common;
 while(!common&&performance.now()<deadline){
  await Promise.all(clients.map(({page})=>page.keyboard.press('ArrowUp')));
  await host.waitForTimeout(90);
  const rows=await Promise.all(clients.map(({page})=>page.evaluate(()=>window.fixture.messages.filter(m=>m.type==='snapshot'&&m.phase==='playing'))));
  for(const candidate of rows[0].slice().reverse()){
   if(!candidate.players.every((p,i)=>Math.hypot(p.x-initial.players[i].x,p.z-initial.players[i].z)>.25))continue;
   const same=rows.map(list=>list.find(m=>m.tick===candidate.tick));
   if(same.every(Boolean)){same.forEach(item=>assert.deepEqual(item,candidate));common=candidate;break}
  }
 }
 assert.ok(common,'all eight moved and saw one identical authoritative tick');
 console.log(JSON.stringify({clients:8,origins:2,sameTick:common.tick,score:common.score,clock:common.timeLeft,
  movers:common.players.map(({slot,role})=>[slot,role])}));
} finally {
 if(browser)await browser.close();
 if(app)await app.close();
 await new Promise(resolve=>fixture.close(resolve));
}
