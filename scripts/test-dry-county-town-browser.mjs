import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('dist/hubs/dry-county'),out=resolve('browser-results/dry-county-town');
await mkdir(out,{recursive:true});
// Hooks exist only in this test server, never in a published game.
const instrument=s=>s.replace(/\}\)\(\);\s*$/,`window.__townTest={
 park(){if(job)failJob('Browser observation');const c=player.car,n=WLD.nearest(WLD.P(590,356));Object.assign(c,{x:n.x-Math.sin(n.angle)*29,y:n.y+Math.cos(n.angle)*29,a:n.angle,v:0,vx:0,vy:0});player.x=c.x;player.y=c.y;camera.x=c.x;camera.y=c.y;save.settings.sound=false;save.settings.music=false;setSound(false);setMusic(false);},
 observation(){return {town:town.snapshot(),people:peds.filter(r=>!r.hidden&&dist(r,player)<650).map(r=>r.id),drivers:cars.filter(c=>c.ai==='resident'&&!c.parked&&Math.abs(c.v)>3&&dist(c,player)<650).map(c=>c.residentId),player:{x:player.x,y:player.y,hp:player.hp},quality,mode,frame}},
 };})();`);
const server=createServer(async(req,res)=>{try{const p=(req.url||'/').split('?')[0];if(p.includes('..'))throw Error();const file=p==='/'?'index.html':p.slice(1);let bytes=await readFile(join(root,file));if(file==='game.js')bytes=Buffer.from(instrument(bytes.toString()));res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'text/html');res.end(bytes)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true}),errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#startBtn').click();await page.evaluate(()=>window.__townTest.park());
 const initial=await page.evaluate(()=>window.__townTest.observation()),people=new Set(),drivers=new Set(),observations=[];
 await page.screenshot({path:join(out,'main-street-start.png')});
 // Five real minutes, with no driving, shooting, camera movement or clock skips.
 for(let i=0;i<60;i++){
  await page.waitForTimeout(5000);const s=await page.evaluate(()=>window.__townTest.observation());
  s.people.forEach(id=>people.add(id));s.drivers.forEach(id=>drivers.add(id));observations.push(s);
  assert.equal(s.mode,'play');assert(s.player.hp>0);assert(Math.hypot(s.player.x-initial.player.x,s.player.y-initial.player.y)<2,'Parked player moved');
  if(i===29)await page.screenshot({path:join(out,'main-street-midpoint.png')});
 }
 const final=observations.at(-1);await page.screenshot({path:join(out,'main-street-five-minutes.png')});
 assert(people.size>=8,'Insufficient Main Street footfall');assert(drivers.size>=2,'Insufficient destination traffic');assert(final.town.stats.parked>=2,'Drivers never parked');
 assert(final.town.stats.visits>=8);assert(final.town.stats.deliveries>=1);assert(final.town.stats.farSteps>0);assert(final.town.events.length<=12);assert.equal(final.town.residents,72);
 assert(final.frame-initial.frame>=3000,'Sustained frame rate below 10fps in CI');
 await writeFile(join(out,'five-minute-observation.json'),JSON.stringify({people:people.size,drivers:drivers.size,initial,final,observations},null,2));
 assert.deepEqual(errors,[]);await context.close();
 console.log(`Five real minutes parked on Main Street: ${people.size} residents, ${drivers.size} drivers, ${final.town.stats.visits} business visits, ${final.town.stats.parked} parking arrivals, ${final.town.stats.deliveries} deliveries. Screenshots and full observations saved.`);
}finally{await browser.close();await new Promise(r=>server.close(r))}
