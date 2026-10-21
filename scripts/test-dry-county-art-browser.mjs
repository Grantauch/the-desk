import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';

// Render every furniture family: a mocked canvas cannot catch bad image sources.
const root=resolve('public/hubs/dry-county'),out=resolve('browser-results/dry-county-art');
await mkdir(out,{recursive:true});
const instrument=s=>s.replace(/\}\)\(\);\s*$/,`window.__artTest={player,places,enterBusiness,leaveBusiness,draw,closePanel,weather,set elapsed(v){elapsed=v},set heat(v){heat=v},set toastTimer(v){toastTimer=v},get interior(){return interior}};})();`);
const server=createServer(async(req,res)=>{try{const p=decodeURIComponent((req.url||'/').split('?')[0]);if(p.includes('..'))throw Error('Invalid path');const file=p==='/'?'index.html':p.slice(1);let bytes=await readFile(join(root,file));if(file==='game.js')bytes=Buffer.from(instrument(bytes.toString()));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'text/html');res.end(bytes)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true}),errors=[];
try{
 for(const size of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport:size,reducedMotion:'reduce',hasTouch:size.width<900});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
  await page.locator('#startBtn').waitFor();await page.screenshot({path:join(out,`title-${size.width}.png`)});
  const title=await page.evaluate(()=>{const b=document.querySelector('#startBtn').getBoundingClientRect(),f=document.querySelector('.titlefooter').getBoundingClientRect();return{buttonBottom:b.bottom,footerTop:f.top,buttonRight:b.right,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}});
  assert(!title.overflow,JSON.stringify({size,title}));assert(title.buttonBottom<title.footerTop);assert(title.buttonRight<=title.width);
  await page.locator('#startBtn').click();await page.waitForTimeout(250);
  const minimap=await page.locator('#minimapWrap').evaluate(el=>{const b=el.getBoundingClientRect(),map=el.querySelector('canvas').getBoundingClientRect(),label=el.querySelector('div').getBoundingClientRect();return{height:b.height,contentHeight:map.height+label.height,top:b.top,bottom:b.bottom,viewport:innerHeight}});
  assert(minimap.height<=minimap.contentHeight+4,'Minimap must wrap its contents instead of stretching over the play area: '+JSON.stringify({size,minimap}));
  assert(minimap.top>=0&&minimap.bottom<=minimap.viewport,'Minimap stays inside the viewport');
  await page.evaluate(()=>{const t=window.__artTest;t.toastTimer=0;document.querySelector('#toast').classList.remove('show');t.draw()});
  await page.screenshot({path:join(out,`street-${size.width}.png`)});
  if(size.width===1440){
   for(const id of ['grocer','diner','pharmacy','tailor','pawn','barber','dealer','hardware','furniture','garage','still','safe','docks','velvet']){
    await page.evaluate(id=>{const t=window.__artTest;if(t.interior)t.leaveBusiness(true);t.player.car=null;t.heat=0;const p=t.places.find(p=>p.id===id);t.player.x=p.x;t.player.y=p.y;t.enterBusiness(p,!!p.hidden);t.toastTimer=0;document.querySelector('#toast').classList.remove('show');t.draw()},id);
    await page.waitForTimeout(100);assert.equal(await page.locator('#mission').isVisible(),false);await page.screenshot({path:join(out,`room-${id}.png`)});
   }
   await page.evaluate(()=>{const t=window.__artTest;t.leaveBusiness(true);t.elapsed=11*60*5;t.weather.rain=0;t.draw()});await page.screenshot({path:join(out,'daylight.png')});
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Art browser checks passed: title controls and compact minimap fit four viewports, all 14 room renderers draw without errors, interior HUD clears, daylight and reduced-motion screenshots captured.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
