import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const require=createRequire(import.meta.url),{classroom,PEOPLE}=require('./lib/hall-pass-fixtures.cjs');
const root=new URL('../',import.meta.url),out=new URL('../browser-results/pixel-camp-six/',import.meta.url);
await mkdir(out,{recursive:true});
const shot=name=>fileURLToPath(new URL(name+'.png',out));
const types={js:'application/javascript',css:'text/css',png:'image/png',gif:'image/gif',ttf:'font/ttf',html:'text/html'};
const schoolHtml=(await readFile(new URL('apps-script/hall-pass/Index.html',root),'utf8')).replace('<?!= JSON.stringify(appMode) ?>','"checkin"').replace('<?= siteBrand ?>','desk').replace(/<script>([\s\S]*?)<\/script>/g,(_,script)=>`<script>${script.replace(/https:\/\/[^\r\n]*/g,'https:')}</script>`);
async function assets(route){const u=new URL(route.request().url()),p=u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname;return route.fulfill({body:await readFile(new URL('public'+p,root)),contentType:types[p.split('.').pop()]||'text/plain',headers:{'Access-Control-Allow-Origin':'*'}});}
async function fits(ui,label){assert.equal(await ui.locator('html').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,label+' fits without horizontal scrolling');}
async function closeWorkshop(ui){await ui.locator('#close-workshop').click();}
async function getSupplies(ui,stop){await ui.locator('#workshop-dialog').getByRole('button',{name:['Gather fallen wood','Gather smooth stones','Gather reed fiber'][stop],exact:true}).click();await ui.locator('#trail-actions [data-care=rest]').click();await ui.locator('#gather').click();await ui.locator('[data-view=home]').click();await ui.locator('#open-workshop').click();}
async function chapterOne(ui,id){await ui.locator('[data-view=home]').click();await ui.locator('#open-journeys').click();await ui.locator(`[data-journey-go=${id}]`).click();await ui.locator('#discover').click();await ui.locator('[data-journey-choice="0"]').click();assert.match(await ui.locator('#message').textContent(),/pat|pebble|spiral|crack/);}
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
let checks=0;
try{
 for(const width of [320,390,1366]){
  const ctx=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await ctx.route('https://grant-desk.com/**',assets);await p.goto('https://grant-desk.com/hubs/checkling/camp/');await p.locator('#open-journeys').waitFor();
  await chapterOne(p,'mochi');await fits(p,'chapter at '+width);await p.screenshot({path:shot('chapter-'+width),fullPage:true});
  // The chapter-two next step opens the missing recipe, with usable supply shortcuts.
  await p.locator('#journey-next').click();await p.locator('#discover').click();await p.locator('#journey-next').click();assert.equal(await p.locator('#workshop-dialog').isVisible(),true);
  await getSupplies(p,2);await p.locator('[data-craft=seedbox]').click();assert.match(await p.locator('#workshop-message').textContent(),/built and placed/);
  await fits(p,'workshop at '+width);await p.screenshot({path:shot('workshop-'+width)});
  const axe=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  await writeFile(new URL('axe-workshop-'+width+'.json',out),JSON.stringify(axe.violations,null,2));assert.deepEqual(axe.violations.map(v=>v.id),[],'workshop accessibility '+width);
  // Native Escape closes the modal and restores keyboard access.
  await p.locator('#close-workshop').press('Escape');assert.equal(await p.locator('#workshop-dialog').isVisible(),false);
  await p.locator('#open-journeys').click();await p.locator('[data-journey-go=mochi]').click();await p.locator('[data-journey-choice="1"]').click();
  await p.locator('#journey-next').click();await p.locator('#discover').click();await p.locator('[data-journey-choice="0"]').click();assert.match(await p.locator('#message').textContent(),/Journey complete/);
  await p.locator('[data-view=home]').click();assert.equal(await p.locator('#crafted-keepsake').isVisible(),true);
  await p.locator('#open-journeys').click();assert.match(await p.locator('[data-story=mochi]').textContent(),/3\/3/);await fits(p,'journey cards '+width);
  const journeyAxe=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(journeyAxe.violations.map(v=>v.id),[],'journey accessibility '+width);
  await p.screenshot({path:shot('journeys-'+width),fullPage:true});
  // Download is the full camp, and refresh restores the exact completed journey.
  const downloadPromise=p.waitForEvent('download');await p.locator('#journal-export').click();const download=await downloadPromise;const saved=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(saved.version,3);assert.equal(saved.journeys.mochi,3);assert.ok(saved.crafted.includes('seedbox'));
  await p.reload();await p.locator('#open-journeys').click();assert.match(await p.locator('[data-story=mochi]').textContent(),/3\/3/);assert.deepEqual(errors,[]);await ctx.close();checks++;
 }
 // School fixtures prove private save/reload, unsupported-school gating, and delayed/lost acknowledgements.
 for(const formats of [[1],[1,2],[1,2,3]]){
  const c=classroom({now:new Date('2026-09-10T11:30:00Z')});c.harness.signInAs(PEOPLE.ada.email);const id=c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.ada),'seed');c.harness.call('saveCheckling',id.pinToken,'bolt','Sprocket');
  const ctx=await browser.newContext({viewport:{width:390,height:950},reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];let loseResponse=false;
  p.on('pageerror',e=>errors.push(e.message));
  await p.exposeFunction('__gas',({name,args})=>{c.harness.newRequest();if(name==='savePixelCamp'&&!formats.includes(args[3]?.version))throw Error('Unsupported fixture version');const result=JSON.parse(JSON.stringify(c.harness.call(name,...args)));if(name==='getPixelCamp')result.formats=formats;if(name==='savePixelCamp'&&loseResponse){loseResponse=false;throw Error('Synthetic lost acknowledgement.');}return result;});
  await p.addInitScript(()=>{function runner(success,failure){return new Proxy({},{get(_,name){if(name==='withSuccessHandler')return cb=>runner(cb,failure);if(name==='withFailureHandler')return cb=>runner(success,cb);return(...args)=>window.__gas({name,args}).then(success).catch(e=>failure?.({message:e.message}));}});}window.google={script:{get run(){return runner();}}};});
  await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='school-fixture.test')return route.fulfill({body:schoolHtml,contentType:'text/html'});if(u.hostname==='grant-desk.com'&&u.pathname.startsWith('/hubs/checkling/'))return assets(route);return route.fulfill({body:'',contentType:'text/css'});});
  async function open(){await p.goto('https://school-fixture.test/');await p.locator('input[type=password]').fill(c.pin(PEOPLE.ada));await p.locator('#visit-checkling').click();await p.locator('#ck-open-camp').click();const f=p.frameLocator('iframe[title="Your school Pixel Camp"]');await f.getByText('Saved to school',{exact:true}).waitFor();return f;}
  let f=await open();await fits(f,'school '+formats.join());assert.equal(await f.locator('#open-journeys').isVisible(),formats.includes(3));
  if(formats.includes(3)){
   await chapterOne(f,'bolt');await f.getByText('Saved to school',{exact:true}).waitFor();
   // Supply gathering after a committed-but-lost response retries once, without double supplies.
   await f.locator('#trail-actions [data-care=rest]').click();await f.getByText('Saved to school',{exact:true}).waitFor();loseResponse=true;await f.locator('#gather').click();await f.locator('#school-save-retry').waitFor();await f.locator('#school-save-retry').click();await f.getByText('Saved to school',{exact:true}).waitFor();
   const stored=JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']);assert.equal(stored.version,3);assert.equal(stored.journeys.bolt,1);assert.equal(stored.materials.wood,6);
   f=await open();await f.locator('#open-journeys').click();assert.match(await f.locator('[data-story=bolt]').textContent(),/1\/3/);assert.match(await f.locator('.school-banner').textContent(),/Sprocket/);assert.equal(await p.locator('body').evaluate(()=>localStorage.getItem('checklings.first-trail.v1')),null,'school progress never enters persistent browser storage');
  }else{
   await f.locator('[data-view=trail]').click();await f.locator('#discover').click();await f.getByText('Saved to school',{exact:true}).waitFor();const stored=JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']);assert.equal(stored.version,formats.includes(2)?2:1);
   // A journey save must never be silently downgraded by a school awaiting deployment.
   const future=JSON.parse(JSON.stringify(stored));future.version=3;future.journeys={mochi:1,bolt:0,zee:0,ember:0};future.materials={wood:3,stone:0,fiber:0};future.crafted=[];future.equippedCraft='';
   await f.locator('#open-menu').click();await f.locator('#import-file').setInputFiles({name:'journey-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(future))});
   await f.getByText(/Your school camp is updating/).waitFor();assert.equal(await f.locator('#confirm-import').isVisible(),false);assert.equal(JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']).version,stored.version);
   await f.locator('#menu-dialog .close-form button').click();
  }
  assert.equal(c.checkIns().length,0);assert.equal(c.passLog().length,0);await p.locator('.ck-camp-top button').click();await p.getByRole('button',{name:'different student',exact:true}).click();assert.equal(await p.locator('iframe').count(),0);assert.deepEqual(errors,[]);await ctx.close();checks++;
 }
}finally{await browser.close();}
await writeFile(new URL('result.json',out),JSON.stringify({journeys:checks,status:'PASS',features:['three chapters via actual controls','supply gathering/crafting','a11y/keyboard','exact save export/reload','school v1/v2/v3','lost acknowledgement retry','account clearing'],syntheticSchoolOnly:true},null,2));
console.log('Pixel Camp 6 browser journeys passed: '+checks+'.');
