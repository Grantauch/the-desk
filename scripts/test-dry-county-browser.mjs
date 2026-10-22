import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('dist/hubs/dry-county'),out=resolve('browser-results/dry-county');
await mkdir(out,{recursive:true});
const instrument=source=>source.replace(/\}\)\(\);\s*$/,'window.__dryTest={get town(){return town},camera,draw,update,interact,showPanel,closePanel,player,places,enterBusiness,leaveBusiness,get airBridge(){return airBridge},get airOps(){return airOps},get interior(){return interior},get save(){return save},set heat(v){heat=v}};})();');
const server=createServer(async(req,res)=>{try{const file=(req.url||'/').split('?')[0];if(file.includes('..'))throw Error('Invalid path');const p=file==='/'?'index.html':file.slice(1);let bytes=await readFile(join(root,p));if(p==='game.js')bytes=Buffer.from(instrument(bytes.toString()));res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.webp')?'image/webp':'text/html');res.end(bytes)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 for(const size of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport:size,isMobile:size.width<900,hasTouch:size.width<900});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'ENTER MT. MORRIS'}).click();
  // Inspect real street rendering before the interior journeys. Test-only hooks
  // move the camera; published builds expose no position-changing controls.
  await page.evaluate(()=>{const t=window.__dryTest;t.closePanel();t.camera.x=t.places[0].x;t.camera.y=t.places[0].y;t.draw()});
  await page.screenshot({path:join(out,'downtown-'+size.width+'x'+size.height+'.png')});
  assert.equal(await page.evaluate(()=>window.dryCounty.snapshot().map.authoredLots),27);
  if(size.width===1440){for(const [name,x,y] of [['north-common',2700,700],['west-country',900,1300],['freight',3200,2380]]){await page.evaluate(({x,y})=>{const t=window.__dryTest;t.camera.x=t.player.x=x;t.camera.y=t.player.y=y;if(t.player.car){t.player.car.x=x;t.player.car.y=y;t.player.car.v=t.player.car.vx=t.player.car.vy=0}t.draw()},{x,y});await page.screenshot({path:join(out,name+'.png')})}}
  await page.keyboard.press('KeyM');await page.locator('#fullmap').waitFor();
  const dimensions=await page.locator('#fullmap').evaluate(el=>({width:el.width,height:el.height}));
  const mapSize=await page.evaluate(()=>window.dryCounty.snapshot().map);
  assert.equal(dimensions.height,Math.round(dimensions.width*mapSize.height/mapSize.width));
  assert.equal(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth),true);
  await page.screenshot({path:join(out,'county-map-'+size.width+'x'+size.height+'.png'),fullPage:true});
  await page.keyboard.press('Escape');
  const enter=async id=>{await page.evaluate(id=>{const t=window.__dryTest;t.town.state.minute=600;if(t.interior)t.leaveBusiness(true);t.player.car=null;t.heat=0;const p=t.places.find(p=>p.id===id);t.player.x=p.x;t.player.y=p.y;t.enterBusiness(p)},id);await page.waitForTimeout(80)};
  const talk=async()=>{await page.evaluate(()=>{window.__dryTest.player.x=360;window.__dryTest.player.y=208});await page.keyboard.press('KeyF');await page.getByRole('dialog',{name:'Conversation'}).waitFor()};
  await enter('grocer');await talk();await page.getByRole('button',{name:'Collect the job parcel.',exact:false}).click();await page.keyboard.press('Escape');
  await talk();await page.getByRole('button',{name:'Show me what you buy and sell.',exact:false}).click();
  const row=page.locator('.shop-row').filter({has:page.getByRole('heading',{name:'Bread loaf',exact:true})});
  const before=await page.evaluate(()=>window.dryCounty.snapshot().cash);await row.getByRole('button',{name:'BUY $0.10',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.dryCounty.snapshot().cash),Math.round((before-.1)*100)/100);
  await row.getByRole('button',{name:'SELL $0.06',exact:true}).click();await page.screenshot({path:join(out,'grocer-'+size.width+'x'+size.height+'.png'),fullPage:true});
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{window.__dryTest.save.jobs=8});await enter('grocer');await page.evaluate(()=>{window.__dryTest.player.x=642;window.__dryTest.player.y=255});await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(()=>window.dryCounty.snapshot().interior),'velvet');await page.screenshot({path:join(out,'speakeasy-'+size.width+'x'+size.height+'.png')});
  await enter('dealer');await talk();await page.getByRole('button',{name:'Show me the cars.',exact:false}).click();await page.getByRole('heading',{name:'Your next set of wheels'}).waitFor();await page.screenshot({path:join(out,'dealer-'+size.width+'x'+size.height+'.png')});await page.keyboard.press('Escape');
  await enter('hardware');await talk();await page.getByRole('button',{name:'Show me what you buy and sell.',exact:false}).click();await page.getByRole('heading',{name:'Lumber bundle',exact:true}).waitFor();await page.keyboard.press('Escape');
  await enter('home');await talk();await page.getByRole('button',{name:'Open the construction book.',exact:false}).click();await page.getByRole('heading',{name:'Make a place of your own'}).waitFor();
  assert.equal(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth),true);await page.screenshot({path:join(out,'home-'+size.width+'x'+size.height+'.png')});
  await page.keyboard.press('Escape');await page.keyboard.press('Tab');await page.getByRole('button',{name:'GARAGE',exact:true}).click();assert.equal(await page.locator('button[data-do="car"]').count(),0);await page.getByText('VISIT COLE MOTOR COMPANY · A ON MAP').first().waitFor();
  // B5 release gate: flight through the actual combined 0.6 town on every viewport.
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{const t=window.__dryTest;t.closePanel();if(t.interior)t.leaveBusiness(true);
   t.heat=0;const c=t.airBridge.craft[0];t.player.car=null;t.player.x=c.x;t.player.y=c.y;
   t.camera.x=c.x;t.camera.y=c.y;});
  await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(()=>window.dryCounty.snapshot().flight.mounted),'rotor','E boards aircraft without disabling 0.6');
  if(size.width===390){
   assert(await page.locator('#mobile button[data-action="air-up"]').isVisible(),'CLIMB on phone');
   assert(await page.locator('#mobile button[data-action="air-down"]').isVisible(),'DESCEND on phone');
   assert(await page.locator('#mobile button[data-action="air-job"]').isVisible(),'AIR RUN on phone');
  }
  await page.keyboard.down('Shift');
  await page.evaluate(()=>{const t=window.__dryTest;for(let i=0;i<180;i++)t.update(1/60);t.draw()});
  await page.keyboard.up('Shift');
  assert(await page.evaluate(()=>window.dryCounty.snapshot().flight.altitude)>10,'aircraft safely climbs in 0.6');
  await page.screenshot({path:join(out,'flight-b5-airborne-'+size.width+'x'+size.height+'.png')});
  await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(()=>window.dryCounty.snapshot().flight.mounted),'rotor','midair exit is forbidden');
  await page.keyboard.down('KeyC');
  await page.evaluate(()=>{const t=window.__dryTest;for(let i=0;i<620;i++)t.update(1/60);t.draw()});
  await page.keyboard.up('KeyC');
  assert.equal(await page.evaluate(()=>window.dryCounty.snapshot().flight.altitude),0,'aircraft lands in 0.6');
  await page.keyboard.press('KeyE');
  assert.equal(await page.evaluate(()=>window.dryCounty.snapshot().flight.mounted),null,'player exits safely on foot');
  await page.evaluate(()=>{const t=window.__dryTest;t.heat=65;for(let i=0;i<12;i++)t.update(1/60)});
  assert.notEqual(await page.evaluate(()=>window.dryCounty.snapshot().flight.airPatrol),'off','police aircraft activates with wanted heat');
  await page.evaluate(()=>{const t=window.__dryTest;t.heat=0;t.airOps.reset();
   const c=t.airBridge.craft[0];c.x=c.home.x;c.y=c.home.y;c.z=0;c.vx=c.vy=c.vz=0;c.landed=true;
   t.player.car=null;t.player.air=null;t.player.x=c.x;t.player.y=c.y;});
  await page.keyboard.press('KeyE');
  if(size.width===390)await page.locator('#mobile button[data-action="air-job"]').click();
  else await page.keyboard.press('KeyG');
  assert.equal(await page.evaluate(()=>window.dryCounty.snapshot().flight.courierStage),0,'courier starts in integrated town');
  const saved=await page.evaluate(()=>window.dryCounty.snapshot());
  assert(saved.town&&saved.scale&&saved.flight,'town diagnostics coexist with air diagnostics');
  await page.screenshot({path:join(out,'flight-b5-courier-'+size.width+'x'+size.height+'.png')});
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Dry County browser checks passed: town + flight boarding, landing, police patrol, courier, counter jobs, cents trading, secret entrance, dealership, supplies and construction at desktop, phone and landscape sizes.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
