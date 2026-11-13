import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn}from'node:child_process';
import {fileURLToPath}from'node:url';
import assert from 'node:assert/strict';
import {chromium}from'playwright';
import AxeBuilder from '@axe-core/playwright';
import {signTicket}from'./accounts.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),DATA=fs.mkdtempSync(path.join(os.tmpdir(),'resident-lives-browser-'));
const out=path.resolve(process.env.CHECKAVERSE_LIVES_OUTPUT||path.join(HERE,'../../browser-results/checkaverse-residents'));fs.mkdirSync(out,{recursive:true});
const port=26000+Math.floor(Math.random()*1500),origin=`http://127.0.0.1:${port}`,sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Accelerate the shared activity clock, while all player movement and door use remain real.
const child=spawn(process.execPath,['--disable-warning=ExperimentalWarning',path.join(HERE,'server.mjs')],{cwd:HERE,env:{...process.env,CHECKAVERSE_DATA:DATA,CHECKAVERSE_PORT:String(port),CHECKAVERSE_ORIGINS:origin,CHECKAVERSE_WILD_RATE:'0.000001',CHECKAVERSE_LIFE_RATE:'3'},stdio:'pipe'});
let log='',browser;child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);const errors=[];
async function makePage(width,height,saved=false,quiet=false){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<600,isMobile:width<600,reducedMotion:quiet?'reduce':'no-preference'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>sessionStorage.setItem('checkaverse-tips',JSON.stringify(['walk','partner','say','care','kettle','visitor','sign','gate','wilds','challenge'])));
  let hash='';if(saved){const now=Date.now();hash='#t='+signTicket(fs.readFileSync(path.join(DATA,'ticket-key.txt'),'utf8').trim(),{v:1,p:'syntheticResidentBrowser001',h:'Synthetic residents',d:'2026-11-02',c:true,n:12,s:4,b:9,k:{s:'mochi',n:''},iat:now,exp:now+7200000,j:'browser'});}
  await page.goto(origin+'/?debug'+hash);await page.waitForFunction(()=>window.__checkaverse?.world()?.all().some(n=>n.activity));return{page,context};
}
async function directory(page,id,home=false){
  await page.keyboard.press('Escape');await page.locator('#menuBtn').click();await page.locator('#journalBtn').click();
  const row=page.locator(`#residentDirectory [data-resident="${id}"]`);await row.getByRole('button',{name:home?'Visit home':'Find and talk',exact:true}).click();
}
try{
  for(let i=0;i<60;i++){try{if((await fetch(origin+'/health')).ok)break;}catch{}await sleep(100);}
  browser=await chromium.launch({headless:true});const{page,context}=await makePage(1366,768,true);
  await directory(page,'pax',true);await page.waitForFunction(()=>window.__checkaverse.room().endsWith(':pax'),null,{timeout:25000});
  await page.waitForFunction(()=>!window.__checkaverse.navigating());
  await page.evaluate(()=>window.__checkaverse.walk(5,5));await page.waitForFunction(()=>{const d=window.__checkaverse,p=d.players.get(d.me());return p.x===5&&p.y===5&&!p.seg;});
  await page.waitForFunction(()=>window.__checkaverse.world().active().some(n=>n.id==='pax'&&n.activity.action==='rest'),null,{timeout:50000});
  await page.screenshot({path:path.join(out,'pax-at-home.png')});
  const homePax=await page.evaluate(()=>window.__checkaverse.world().all().find(n=>n.id==='pax'));assert.ok(homePax.deliveries>=1);assert.equal(homePax.room,'home:pax');
  await page.locator('#talkBtn').click();assert.equal(await page.locator('#residentName').textContent(),'Pax');
  await page.getByRole('button',{name:'What are you doing?',exact:true}).click();assert.match(await page.locator('#residentText').textContent(),/break at home/);
  await page.getByRole('button',{name:'One more thing.',exact:true}).click();await page.getByRole('button',{name:'How has your round gone?',exact:true}).click();assert.match(await page.locator('#residentText').textContent(),/Clinic parcels delivered: [1-9]/);
  await page.screenshot({path:path.join(out,'pax-remembers-delivery.png')});
  assert.deepEqual((await new AxeBuilder({page}).include('#residentDialog').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations,[]);
  await page.keyboard.press('Escape');
  console.log('  ok real doorway navigation, resident arrival at home, rest activity and dialogue backed by an actual delivery');
  await directory(page,'nell');await page.waitForFunction(()=>document.getElementById('residentDialog').open,null,{timeout:25000});assert.equal(await page.locator('#residentName').textContent(),'Nell');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>window.__checkaverse.world().all().find(n=>n.id==='nell').received>0,null,{timeout:35000});
  await page.waitForFunction(()=>window.__checkaverse.world().all().find(n=>n.id==='pax').carry==='parcel',null,{timeout:40000});
  await directory(page,'pax');await page.waitForFunction(()=>document.getElementById('residentDialog').open,null,{timeout:25000});
  const courier=await page.evaluate(()=>window.__checkaverse.world().all().find(n=>n.id==='pax'));assert.equal(courier.carry,'parcel');
  await page.keyboard.press('Escape');await page.screenshot({path:path.join(out,'pax-carrying-parcel.png')});
  assert.ok(await page.evaluate(()=>window.__checkaverse.world().work().some(m=>m.kind==='water'&&m.count>0)));
  console.log('  ok find-neighbor follows the current location; carried parcels, Nell receiving deliveries and changed garden state are real');
  const normal=await makePage(1366,768),phone=await makePage(390,844,false,true);
  await phone.page.waitForFunction(()=>window.__checkaverse.world().all().some(n=>n.room==='wilds'),null,{timeout:20000});
  const fieldId=await phone.page.evaluate(()=>window.__checkaverse.world().all().find(n=>n.room==='wilds').id);
  await directory(phone.page,fieldId);await phone.page.waitForFunction(()=>document.getElementById('residentDialog').open,null,{timeout:30000});
  assert.equal(await phone.page.evaluate(()=>window.__checkaverse.room()),'wilds');
  const box=await phone.page.locator('#residentDialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391&&box.y>=0&&box.y+box.height<=845);
  assert.deepEqual((await new AxeBuilder({page:phone.page}).include('#residentDialog').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations,[]);
  await phone.page.screenshot({path:path.join(out,'phone-field-conversation.png')});
  await phone.page.keyboard.press('Escape');
  const key=fs.readFileSync(path.join(DATA,'teacher-key.txt'),'utf8').trim();
  const pause=async v=>{const r=await fetch(origin+'/api/teacher/pause',{method:'POST',headers:{'Content-Type':'application/json','x-teacher-key':key},body:JSON.stringify({v})});assert.equal(r.status,200);};
  await pause(true);await normal.page.locator('#paused').waitFor({state:'visible'});await sleep(600);
  const positions=p=>p.evaluate(()=>window.__checkaverse.world().all().map(n=>[n.id,n.room,n.x,n.y,n.completed,n.activity.progress]));
  assert.deepEqual(await positions(normal.page),await positions(phone.page));await pause(false);
  console.log('  ok touch Find crosses the map gate, phone dialogue fits and passes WCAG; quiet and ordinary clients agree on the same shared world');
  await page.goto(origin+'/?debug');await page.waitForFunction(()=>window.__checkaverse?.world()?.all().some(n=>n.id==='pax'&&n.deliveries>=1));
  console.log('  ok the saved trainer reconnects with resident job history intact');
  await context.close();await normal.context.close();await phone.context.close();assert.deepEqual(errors,[]);
  console.log('PASS resident lives browser');
}catch(e){console.error(log.slice(-3000));for(const c of browser?.contexts()||[])for(const p of c.pages()){try{await p.screenshot({path:path.join(out,'failure.png')});console.error(await p.evaluate(()=>{const d=window.__checkaverse,p=d?.players.get(d.me());return{room:d?.room(),player:p&&[p.x,p.y],navigation:d?.navigating(),residents:d?.world()?.all().map(n=>[n.id,n.room,n.x,n.y,n.activity.label])};}));}catch{}}throw e;}finally{await browser?.close();child.kill();}
