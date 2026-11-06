// Runs only against a throwaway local server and invented bus tickets.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {signTicket} from './accounts.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.env.CHECKAVERSE_BROWSER_OUTPUT || path.join(HERE,'../../browser-results/checkaverse-world'));
fs.mkdirSync(out,{recursive:true});
const port = 20000 + Math.floor(Math.random()*2000), origin = `http://127.0.0.1:${port}`;
const data = fs.mkdtempSync(path.join(os.tmpdir(),'checkaverse-world-browser-'));
const child = spawn(process.execPath,['--disable-warning=ExperimentalWarning',path.join(HERE,'server.mjs')],{
  cwd:HERE,env:{...process.env,CHECKAVERSE_PORT:String(port),CHECKAVERSE_DATA:data,CHECKAVERSE_ORIGINS:origin,CHECKAVERSE_WILD_RATE:'0.000001'},stdio:'pipe'
});
let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
const delay = ms => new Promise(r=>setTimeout(r,ms));let browser;
const errors = [];
try {
  for(let i=0;i<100;i++){try{if((await fetch(`${origin}/health`)).ok)break;}catch{}await delay(100);}
  browser = await chromium.launch({headless:true});
  const ticket = id => {const now=Date.now();return signTicket(fs.readFileSync(path.join(data,'ticket-key.txt'),'utf8').trim(),{v:1,p:`syntheticWorld${id}000000`,h:'Synthetic test',d:'2026-11-02',c:true,n:12,s:4,b:9,k:{s:'mochi',n:''},iat:now,exp:now+7200000,j:'test'});};
  async function pageFor(size,id,saved=true,quiet=false,touch=false){
    const context=await browser.newContext({viewport:size,reducedMotion:quiet?'reduce':'no-preference',hasTouch:touch,isMobile:touch});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    let lastLife=null;
    page.on('websocket', socket => socket.on('framereceived', ({payload}) => {
      try { const message=JSON.parse(String(payload));
        if(message.t==='residents')lastLife=message;
        else if(message.life)lastLife=message.life;
      } catch {}
    }));
    // Quiet the already-tested introduction so it cannot cover the town controls.
    await page.addInitScript(()=>sessionStorage.setItem('checkaverse-tips',JSON.stringify(['walk','partner','say','visitor','care','kettle','sign','gate','challenge','wilds'])));
    await page.goto(`${origin}/?debug${saved?`#t=${ticket(id)}`:''}`);
    await page.waitForFunction(()=>window.__checkaverse?.players.size>0);
    await page.waitForFunction(()=>window.__checkaverse.world()?.active().length>0);
    return {page,context,life:()=>lastLife};
  }
  async function walk(page,x,y){
    await page.evaluate(([x,y])=>window.__checkaverse.walk(x,y),[x,y]);
    await page.waitForFunction(([x,y])=>{const d=window.__checkaverse,p=d.players.get(d.me());return p&&Math.abs(p.dx-x)<.01&&Math.abs(p.dy-y)<.01&&!p.seg;},[x,y],{timeout:20000});
  }
  async function clickResident(page,id){
    // Tap the actual visible canvas sprite. That freezes this resident while
    // pathfinding approaches it; talk only opens after the trainer gets there.
    // Phase 3 / loop step 4: living residents keep walking between rooms. Wait
    // for an unobstructed stop before sampling a sprite's coordinates, so the
    // next animation frame cannot move it out from under the queued mouse tap.
    await page.waitForFunction(id=>{
      const d=window.__checkaverse,n=d.world().active().find(n=>n.id===id);
      if(!n||n.seg||n.q?.length||!n.activity||n.activity.action==='walk'||n.activity.progress>=.75)return false;
      const c=d.camera(),canvas=document.getElementById('town'),r=canvas.getBoundingClientRect();
      const x=r.left+((n.dx+.5)*32-c.x)/c.width*r.width,y=r.top+((n.dy+.1)*32-c.y)/c.height*r.height;
      return x>r.left&&x<r.right&&y>r.top&&y<r.bottom&&document.elementFromPoint(x,y)===canvas;
    },id,{timeout:60000});
    const point=await page.evaluate(id=>{const d=window.__checkaverse,c=d.camera(),n=d.world().find(id),r=document.getElementById('town').getBoundingClientRect();return {x:r.left+((n.dx+.5)*32-c.x)/c.width*r.width,y:r.top+((n.dy+.1)*32-c.y)/c.height*r.height};},id);
    await page.mouse.click(point.x,point.y);
    await page.waitForFunction(()=>document.getElementById('residentDialog').open,null,{timeout:15000});
    assert.equal(await page.locator('#residentName').textContent(),await page.evaluate(id=>window.__checkaverse.world().find(id).name,id));
  }
  async function findResident(page,id){
    // A resident visiting a neighbor can share the same canvas hit area. The
    // visible directory selects the intended resident and follows their route.
    await page.keyboard.press('Escape');await page.locator('#menuBtn').click();await page.locator('#journalBtn').click();
    await page.locator(`#residentDirectory [data-resident="${id}"]`).getByRole('button',{name:'Find and talk',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('residentDialog').open,null,{timeout:30000});
    assert.equal(await page.locator('#residentName').textContent(),await page.evaluate(id=>window.__checkaverse.world().find(id).name,id));
  }
  async function returnToTown(page){
    if((await page.evaluate(()=>window.__checkaverse.room())).startsWith('nr:')){
      const house=JSON.parse(fs.readFileSync(path.join(HERE,'content/house.json'),'utf8'));
      await walk(page,house.exit.x,house.exit.y-1);
      await page.keyboard.down('ArrowDown');await delay(300);await page.keyboard.up('ArrowDown');
      await page.waitForFunction(()=>window.__checkaverse.room()==='town');
    }
    assert.equal(await page.evaluate(()=>window.__checkaverse.room()),'town');
  }
  const {page,context}=await pageFor({width:1366,height:768},'desktop');
  await walk(page,11,10);await clickResident(page,'rowan');
  assert.equal(await page.locator('#residentName').textContent(),'Rowan');
  await page.getByRole('button',{name:'What is up the trail?',exact:true}).click();
  await page.getByRole('button',{name:'One more thing.',exact:true}).click();
  await page.screenshot({path:path.join(out,'conversation-desktop.png')});
  assert.deepEqual((await new AxeBuilder({page}).include('#residentDialog').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations,[]);
  // Native dialog focus trap and movement inhibition.
  const before=await page.evaluate(()=>{const d=window.__checkaverse,p=d.players.get(d.me());return [p.x,p.y];});
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(()=>document.getElementById('residentDialog').contains(document.activeElement)));
  assert.deepEqual(await page.evaluate(()=>{const d=window.__checkaverse,p=d.players.get(d.me());return [p.x,p.y];}),before);
  await page.getByRole('button',{name:'Need a hand?',exact:true}).click();
  await page.getByRole('button',{name:"I'll have a look.",exact:true}).click();
  await walk(page,9,9);assert.equal(await page.evaluate(()=>window.__checkaverse.world().status('rowan')),'found');
  await walk(page,11,10);await clickResident(page,'rowan');
  assert.match(await page.locator('#residentText').textContent(),/There it is/);
  await page.waitForFunction(()=>window.__checkaverse.world().all().find(n=>n.id==='rowan').helped===1);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#residentDialog').evaluate(e=>e.open),false);
  await page.locator('#menuBtn').click();await page.locator('#journalBtn').click();
  assert.match(await page.locator('#journalEntries').textContent(),/Complete/);
  await page.keyboard.press('Escape');
  await walk(page,13,13);await clickResident(page,'pax');
  await page.getByRole('button',{name:'Lose something?',exact:true}).click();await page.getByRole('button',{name:"I'll have a look.",exact:true}).click();
  await walk(page,15,22);assert.equal(await page.evaluate(()=>window.__checkaverse.world().status('pax')),'found');
  await walk(page,13,13);await clickResident(page,'pax');await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.__checkaverse.world().status('pax')),'done');
  await page.screenshot({path:path.join(out,'kettle-desktop.png')});
  // Watch routines actually advance, then freeze the server's world with its teacher API.
  const first=await page.evaluate(()=>window.__checkaverse.world().all().map(n=>[n.id,n.completed,n.activity.progress]));await delay(1600);
  assert.notDeepEqual(await page.evaluate(()=>window.__checkaverse.world().all().map(n=>[n.id,n.completed,n.activity.progress])),first);
  const key=fs.readFileSync(path.join(data,'teacher-key.txt'),'utf8').trim();
  const pause=async v=>{const r=await fetch(`${origin}/api/teacher/pause`,{method:'POST',headers:{'Content-Type':'application/json','x-teacher-key':key},body:JSON.stringify({v})});assert.equal(r.status,200);};
  await pause(true);await page.locator('#paused').waitFor({state:'visible'});
  const pausedClock=await page.evaluate(()=>window.__checkaverse.world().clock());await delay(600);
  assert.equal(await page.evaluate(()=>window.__checkaverse.world().clock()),pausedClock);
  await pause(false);await page.locator('#paused').waitFor({state:'hidden'});
  console.log('  ok Chromebook: real walking and sprite tap, branching dialogue, keyboard focus, complete story and journal');
  await page.locator('#menuBtn').click();await page.locator('#motionBtn').click();await page.keyboard.press('Escape');
  await delay(100);assert.equal(await page.locator('#motionBtn').getAttribute('aria-pressed'),'true');
  const quietFirst=await page.evaluate(()=>window.__checkaverse.world().all().map(n=>[n.completed,n.activity.progress]));await delay(1100);
  assert.notDeepEqual(await page.evaluate(()=>window.__checkaverse.world().all().map(n=>[n.completed,n.activity.progress])),quietFirst,'quiet rendering does not stop the shared resident simulation');
  await context.close();
  for(const [width,height] of [[390,844],[320,740]]){
    const mobile=await pageFor({width,height},`phone${width}`,true,true,true);
    await walk(mobile.page,13,13);
    // Use the visible touch Talk action, which remains reachable above the pad.
    await mobile.page.locator('#talkBtn').waitFor({state:'visible'});await mobile.page.locator('#talkBtn').tap();
    const rect=await mobile.page.locator('#residentDialog').boundingBox();
    assert.ok(rect.x>=0&&rect.x+rect.width<=width+1&&rect.y>=0&&rect.y+rect.height<=height+1);
    assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual((await new AxeBuilder({page:mobile.page}).include('#residentDialog').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations,[]);
    await mobile.page.screenshot({path:path.join(out,`conversation-${width}.png`)});
    await mobile.page.keyboard.press('Escape');await mobile.page.screenshot({path:path.join(out,`kettle-${width}.png`)});await mobile.context.close();
  }
  console.log('  ok 390px and 320px: touch walking/talking, full conversation fit, no overflow, reduced motion');
  const visitor=await pageFor({width:1366,height:768},'visitor',false);
  await findResident(visitor.page,'tess');
  await visitor.page.getByRole('button',{name:'Need help setting up?',exact:true}).click();await visitor.page.getByRole('button',{name:"I'll have a look.",exact:true}).click();
  await returnToTown(visitor.page);
  await walk(visitor.page,10,15);assert.equal(await visitor.page.evaluate(()=>window.__checkaverse.world().status('tess')),'found');
  await findResident(visitor.page,'tess');await visitor.page.keyboard.press('Escape');
  assert.equal(await visitor.page.evaluate(()=>window.__checkaverse.world().status('tess')),'done');
  await returnToTown(visitor.page);
  await visitor.page.screenshot({path:path.join(out,'town-desktop.png')});
  await walk(visitor.page,12,1);await visitor.page.keyboard.down('ArrowUp');await delay(300);await visitor.page.keyboard.up('ArrowUp');
  await visitor.page.waitForFunction(()=>window.__checkaverse.room()==='wilds');
  await visitor.page.screenshot({path:path.join(out,'wilds-desktop.png')});
  // Residents commute through the gate and their homes. Compare the visible
  // client roster with the actual server snapshot instead of a fixed headcount.
  let snapshotMatches=false;
  for(let attempt=0;attempt<20&&!snapshotMatches;attempt++){
    const expected=(visitor.life()?.residents||[]).filter(n=>n.room==='wilds').map(n=>n.id).sort();
    const actual=await visitor.page.evaluate(()=>window.__checkaverse.world().active().map(n=>n.id).sort());
    snapshotMatches=expected.length>0&&JSON.stringify(actual)===JSON.stringify(expected);
    if(!snapshotMatches)await delay(100);
  }
  assert.ok(snapshotMatches,'Wilds residents must match the authoritative server roster');
  // All sixteen path masks: full-width seams join, isolated caps remain rounded.
  assert.ok(await visitor.page.evaluate(()=>{
    const {paintPaths}=window.CheckaverseWorld;
    for(let mask=0;mask<16;mask++){
      const a=[['.','.','.'],['.','P','.'],['.','.','.']];
      [[1,0],[2,1],[1,2],[0,1]].forEach(([x,y],i)=>{if(mask&(1<<i))a[y][x]='P';});
      const c=document.createElement('canvas');c.width=c.height=192;const g=c.getContext('2d');paintPaths(g,a.map(r=>r.join('')),64);
      const alpha=(x,y)=>g.getImageData(x,y,1,1).data[3];
      for(const [i,[x,y]] of [[95,64],[127,95],[95,127],[64,95]].entries())if(Boolean(alpha(x,y))!==Boolean(mask&(1<<i)))return false;
    }
    const c=document.createElement('canvas');c.width=192;c.height=64;const g=c.getContext('2d');paintPaths(g,['PFP'],64);
    if(!g.getImageData(95,32,1,1).data[3])return false;
    return true;
  }));
  await visitor.context.close();
  assert.deepEqual(errors,[]);console.log('PASS living world browser: no browser errors');
}catch(e){console.error(log.slice(-5000));throw e;}finally{await browser?.close();child.kill();}
