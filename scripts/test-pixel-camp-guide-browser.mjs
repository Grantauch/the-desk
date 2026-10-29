import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const require=createRequire(import.meta.url);
require('../public/hubs/checkling/camp/engine.js');
const E=globalThis.FirstTrail;
const {classroom,PEOPLE}=require('./lib/hall-pass-fixtures.cjs');
const root=new URL('../',import.meta.url),out=new URL('../browser-results/pixel-camp-guide/',import.meta.url);
await mkdir(out,{recursive:true});
const types={js:'application/javascript',css:'text/css',png:'image/png',gif:'image/gif',ttf:'font/ttf',html:'text/html'};
const schoolHtml=(await readFile(new URL('apps-script/hall-pass/Index.html',root),'utf8')).replace('<?!= JSON.stringify(appMode) ?>','"checkin"').replace('<?= siteBrand ?>','desk').replace(/<script>([\s\S]*?)<\/script>/g,(_,s)=>`<script>${s.replace(/https:\/\/[^\r\n]*/g,'https:')}</script>`);
async function assets(route){const u=new URL(route.request().url()),p=u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname;return route.fulfill({body:await readFile(new URL('public'+p,root)),contentType:types[p.split('.').pop()]||'text/plain',headers:{'Access-Control-Allow-Origin':'*'}});}
async function guide(ui){await ui.locator('[data-view=journal]').click();await ui.locator('[data-journal-page=guide]').click();await ui.locator('#founder-guide').waitFor();}
const card=(ui,id)=>ui.locator('[data-guide-entry='+id+']');
const button=(ui,id,action)=>ui.locator('[data-guide-founder='+id+'][data-guide-action='+action+']');
async function fits(ui,label){assert.equal(await ui.locator('html').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,label+' fits without horizontal scrolling');}
async function getSave(page){const promise=page.waitForEvent('download');await page.locator('#journal-export').click();return JSON.parse(await readFile(await(await promise).path(),'utf8'));}
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
let checks=0;
try {
 for(const width of [320,390,1366]){
  const ctx=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await ctx.route('https://grant-desk.com/**',assets);
  const seed=E.initial();seed.pets.mochi.nickname='Pip <&>';
  seed.journeys.mochi=3;seed.journeys.ember=3;seed.pets.mochi.discoveries=[0,1,2];seed.pets.ember.discoveries=[0,1,2];seed.crafted=['teatable'];
  seed.pets.zee.energy=0;
  await page.addInitScript(value=>{if(!localStorage.getItem('checklings.first-trail.v1'))localStorage.setItem('checklings.first-trail.v1',JSON.stringify(value));},seed);
  await page.goto('https://grant-desk.com/hubs/checkling/camp/');await page.locator('#open-journeys').waitFor();
  const before=await page.evaluate(()=>localStorage.getItem('checklings.first-trail.v1'));
  await guide(page);
  assert.equal(await page.locator('[data-guide-entry]').count(),4);
  assert.deepEqual(await page.locator('.founder-guide-card h3').allTextContents(),['Mochi','Bolt','Zee','Ember']);
  assert.equal(await card(page,'mochi').locator('.guide-camp-name').textContent(),'In your camp: Pip <&>');
  assert.equal(await card(page,'mochi').locator('script').count(),0);
  assert.match(await card(page,'mochi').locator('.guide-keepsake').textContent(),/Promise bench.*Ready to build/);
  assert.match(await card(page,'ember').locator('.guide-keepsake').textContent(),/Lantern tea table.*Built and yours/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('checklings.first-trail.v1')),before,'reading the guide does not mutate progress');
  await fits(page,'guide '+width);
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  await writeFile(new URL('axe-'+width+'.json',out),JSON.stringify(axe.violations,null,2));assert.deepEqual(axe.violations.map(v=>v.id),[],'field guide accessibility '+width);
  await page.screenshot({path:fileURLToPath(new URL('guide-'+width+'.png',out)),fullPage:true});
  await button(page,'bolt','trail').focus();await button(page,'bolt','trail').press('Enter');
  assert.equal(await page.locator('#pet-name').textContent(),'Bolt');assert.equal(await page.locator('#discover').evaluate(e=>e===document.activeElement),true);
  await page.locator('#discover').click();await guide(page);
  assert.match(await card(page,'bolt').locator('.guide-progress').innerText(),/Trail discoveries\s+1 \/ 3/);
  await button(page,'bolt','story').click();await page.locator('[data-journey-choice="0"]').click();await guide(page);
  assert.match(await card(page,'bolt').locator('.guide-progress').innerText(),/Journey chapters\s+1 \/ 3/);
  assert.match(await card(page,'bolt').locator('.guide-keepsake').textContent(),/Waterwheel clock.*Finish this founder/);
  const saved=await getSave(page);assert.equal(saved.version,3);assert.equal(saved.journeys.bolt,1);assert.deepEqual(saved.pets.bolt.discoveries,[0]);
  await page.reload();await page.locator('#open-journeys').waitFor();await guide(page);
  assert.deepEqual(await getSave(page),saved,'guide retains exact saved progress through refresh');
  await button(page,'bolt','trail').click();assert.equal(await page.locator('#location-name').textContent(),'OLD WATERWHEEL');
  await guide(page);await button(page,'zee','trail').click();
  assert.equal(await page.locator('#trail-actions [data-care=rest]').evaluate(e=>e===document.activeElement),true,'tired founder is led to free rest');
  assert.match(await page.locator('#message').textContent(),/Rest is free/);
  await page.locator('#trail-actions [data-care=rest]').click();assert.match(await page.locator('#vitals').textContent(),/Energy\s*100/);
  await guide(page);await card(page,'mochi').locator('summary').click();assert.match(await card(page,'mochi').locator('details p').textContent(),/Choose Cozy:/);await button(page,'mochi','practice').click();
  await page.locator('#start-practice').click();assert.equal(await page.locator('#signature-label').textContent(),'Cozy');await page.locator('[data-move=strike]').click();
  const spar=await page.locator('#combat-scene').innerText();
  await guide(page);await card(page,'zee').locator('summary').click();await button(page,'zee','practice').click();
  assert.equal(await page.locator('#combat-scene').innerText(),spar,'guide cannot heal, switch or reset an unfinished spar');
  assert.match(await page.locator('#message').textContent(),/Finish this spar first/);
  assert.equal(await page.locator('[data-move=guard]').evaluate(e=>e===document.activeElement),true);
  assert.deepEqual(errors,[]);await ctx.close();checks++;
 }
 for(const format of [1,3]){
  const c=classroom({now:new Date('2026-09-10T11:30:00Z')});c.harness.signInAs(PEOPLE.ada.email);
  const identity=c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.ada),'guide-seed');c.harness.call('saveCheckling',identity.pinToken,'bolt','Sprocket');
  const ctx=await browser.newContext({viewport:{width:390,height:950},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('__gas',({name,args})=>{c.harness.newRequest();const answer=JSON.parse(JSON.stringify(c.harness.call(name,...args)));if(name==='getPixelCamp'&&format===1){answer.formats=[1];delete answer.access;}return answer;});
  await page.addInitScript(()=>{function run(success,failure){return new Proxy({},{get(_,name){if(name==='withSuccessHandler')return cb=>run(cb,failure);if(name==='withFailureHandler')return cb=>run(success,cb);return(...args)=>window.__gas({name,args}).then(success).catch(e=>failure?.({message:e.message}));}});}window.google={script:{get run(){return run();}}};});
  await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='school-guide.test')return route.fulfill({body:schoolHtml,contentType:'text/html'});if(u.hostname==='grant-desk.com'&&u.pathname.startsWith('/hubs/checkling/'))return assets(route);return route.fulfill({body:'',contentType:'text/css'});});
  await page.goto('https://school-guide.test/');await page.locator('input[type=password]').fill(c.pin(PEOPLE.ada));await page.locator('#visit-checkling').click();await page.locator('#ck-open-camp').click();
  const ui=page.frameLocator('iframe[title="Your school Pixel Camp"]');await ui.getByText('Saved to school',{exact:true}).waitFor();
  const before=JSON.stringify(c.harness.sheet('Checkling Camps').records());await guide(ui);
  assert.equal(JSON.stringify(c.harness.sheet('Checkling Camps').records()),before,'school guide reads do not create saves');
  assert.equal(await card(ui,'bolt').locator('h3').textContent(),'Bolt');assert.equal(await card(ui,'bolt').locator('.guide-camp-name').textContent(),'In your camp: Sprocket');
  assert.equal(await ui.locator('[data-guide-action=story]').count(),format===3?4:0,'legacy school capabilities gate story links');
  assert.equal((await ui.locator('.guide-intro').textContent()).includes('share a story'),format===3,'guide only offers supported activities');
  assert.equal((await card(ui,'bolt').textContent()).includes('Journey chapters'),format===3);
  await button(ui,'zee','trail').click();await ui.locator('#discover').click();await ui.getByText('Saved to school',{exact:true}).waitFor();await guide(ui);
  assert.match(await card(ui,'zee').locator('.guide-progress').innerText(),/Trail discoveries\s+1 \/ 3/);
  const record=JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']);assert.equal(record.version,format);assert.equal(record.pets.bolt.nickname,'Sprocket');assert.deepEqual(record.pets.zee.discoveries,[0]);
  assert.equal(c.checkIns().length,0);assert.equal(c.passLog().length,0);
  await fits(ui,'school guide v'+format);await page.locator('#checkin-next').click();assert.equal(await page.locator('iframe').count(),0);assert.equal((await page.locator('body').textContent()).includes('Sprocket'),false);
  assert.deepEqual(errors,[]);await ctx.close();checks++;
 }
 await writeFile(new URL('result.json',out),JSON.stringify({status:'passed',checks},null,2));
 console.log('Founder field guide browser journeys passed: '+checks+' (three widths, exact progress/reload, safe active-spar return, school v1/v3 and privacy).');
} finally {await browser.close();}
