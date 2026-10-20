import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('dist/hubs/dry-county'),out=resolve('browser-results/dry-county');
await mkdir(out,{recursive:true});
const instrument=source=>source.replace(/\}\)\(\);\s*$/,'window.__dryTest={player,places,enterBusiness,leaveBusiness,get interior(){return interior},get save(){return save},set heat(v){heat=v}};})();');
const server=createServer(async(req,res)=>{try{const file=(req.url||'/').split('?')[0];if(file.includes('..'))throw Error('Invalid path');const p=file==='/'?'index.html':file.slice(1);let bytes=await readFile(join(root,p));if(p==='game.js')bytes=Buffer.from(instrument(bytes.toString()));res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.webp')?'image/webp':'text/html');res.end(bytes)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 for(const size of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport:size,isMobile:size.width<900,hasTouch:size.width<900});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'ENTER MT. MORRIS'}).click();
  const enter=async id=>{await page.evaluate(id=>{const t=window.__dryTest;if(t.interior)t.leaveBusiness(true);t.player.car=null;t.heat=0;const p=t.places.find(p=>p.id===id);t.player.x=p.x;t.player.y=p.y;t.enterBusiness(p)},id);await page.waitForTimeout(80)};
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
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Dry County browser checks passed: counter jobs, cents trading, secret entrance, dealership, supplies and construction at desktop, phone and landscape sizes.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
