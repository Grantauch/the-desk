import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const require=createRequire(import.meta.url);
require('../public/hubs/checkling/camp/engine.js');
const E=globalThis.FirstTrail,{classroom,PEOPLE}=require('./lib/hall-pass-fixtures.cjs');
const root=new URL('../',import.meta.url),out=new URL('../browser-results/pixel-camp-workshop/',import.meta.url);
await mkdir(out,{recursive:true});
const types={js:'application/javascript',css:'text/css',png:'image/png',gif:'image/gif',ttf:'font/ttf',html:'text/html'};
const schoolHtml=(await readFile(new URL('apps-script/hall-pass/Index.html',root),'utf8')).replace('<?!= JSON.stringify(appMode) ?>','"checkin"').replace('<?= siteBrand ?>','desk').replace(/<script>([\s\S]*?)<\/script>/g,(_,s)=>`<script>${s.replace(/https:\/\/[^\r\n]*/g,'https:')}</script>`);
async function assets(route){const u=new URL(route.request().url()),p=u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname;return route.fulfill({body:await readFile(new URL('public'+p,root)),contentType:types[p.split('.').pop()]||'text/plain',headers:{'Access-Control-Allow-Origin':'*'}});}
const recipe=(ui,id)=>ui.locator('[data-recipe='+id+']'),plan=(ui,id)=>ui.locator('[data-build-plan='+id+']');
async function workshop(ui){await ui.locator('[data-view=home]').click();await ui.locator('#open-workshop').click();}
async function fits(ui,label){assert.equal(await ui.locator('html').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,label+' fits');}
async function saved(page){const promise=page.waitForEvent('download');await page.locator('#journal-export').click();return JSON.parse(await readFile(await(await promise).path(),'utf8'));}
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
let checks=0;
async function demo(width,seed=E.initial()){
 const ctx=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await ctx.route('https://grant-desk.com/**',assets);
 await page.addInitScript(value=>{if(!localStorage.getItem('checklings.first-trail.v1'))localStorage.setItem('checklings.first-trail.v1',JSON.stringify(value));},seed);
 await page.goto('https://grant-desk.com/hubs/checkling/camp/');await page.locator('#open-workshop').waitFor();return {ctx,page,errors};
}
try{
 for(const width of [320,390,1366]){
  const {ctx,page,errors}=await demo(width);
  const before=await page.evaluate(()=>localStorage.getItem('checklings.first-trail.v1'));await workshop(page);
  assert.equal(await recipe(page,'seedbox').locator('[data-material=wood] strong').textContent(),'Have 0 / Need 3');
  assert.equal(await recipe(page,'seedbox').locator('[data-craft]').isEnabled(),false);
  assert.equal(await page.evaluate(()=>localStorage.getItem('checklings.first-trail.v1')),before,'reading workshop does not save');
  await fits(page,'workshop '+width);
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[],'workshop accessibility '+width);
  await writeFile(new URL('axe-'+width+'.json',out),JSON.stringify(axe.violations,null,2));
  await plan(page,'seedbox').click();assert.equal(await page.locator('#gather').evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.locator('#build-plan-title').textContent(),'Seedling box build plan');
  assert.equal(await page.locator('#build-plan').evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('#journey-scene'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'supply plan stays beside gathering before unrelated story');
  assert.equal(await page.locator('#location-name').textContent(),'SEED GATE');
  await page.locator('#gather').click();assert.match(await page.locator('#build-plan-supplies [data-material=wood]').textContent(),/Have 3 \/ Need 3.*Enough/);
  await page.locator('#build-plan-next').click();assert.equal(await page.locator('#location-name').textContent(),'STAR POND');
  await page.locator('#gather').click();assert.match(await page.locator('#build-plan-status').textContent(),/All supplies ready/);
  assert.equal(await page.locator('#build-plan-workshop').isVisible(),false,'ready plan has one clear workshop action');
  await fits(page,'trail plan '+width);const planAxe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(planAxe.violations.map(v=>v.id),[]);
  await page.screenshot({path:fileURLToPath(new URL('plan-'+width+'.png',out)),fullPage:true});
  await page.locator('#build-plan-next').click();assert.equal(await recipe(page,'seedbox').locator('[data-craft]').evaluate(e=>e===document.activeElement),true);
  await recipe(page,'seedbox').locator('[data-craft]').click();
  const built=JSON.parse(await page.evaluate(()=>localStorage.getItem('checklings.first-trail.v1')));
  assert.deepEqual(built.materials,{wood:0,stone:0,fiber:0});assert.deepEqual(built.crafted,['seedbox']);assert.equal(built.equippedCraft,'seedbox');
  await recipe(page,'seedbox').locator('[data-craft]').click();assert.equal(await page.evaluate(()=>localStorage.getItem('checklings.first-trail.v1')),JSON.stringify(built),'re-placing costs nothing');
  await page.locator('#close-workshop').click();assert.equal(await page.locator('#build-plan-next').textContent(),'See in camp');await page.locator('#build-plan-next').click();
  assert.equal(await page.locator('#crafted-keepsake').innerText(),'Seedling box');
  await page.locator('[data-view=journal]').click();assert.deepEqual(await saved(page),built,'export contains exact progress and no plan field');
  await page.reload();await page.locator('[data-view=trail]').click();assert.equal(await page.locator('#build-plan').isVisible(),false,'plan is not a persisted field');
  await page.locator('[data-view=journal]').click();assert.deepEqual(await saved(page),built,'reload retains crafted progress exactly');
  assert.deepEqual(errors,[]);await ctx.close();checks++;
 }
 {
  const seed=E.initial();seed.materials={wood:9,stone:2,fiber:1};seed.journeys.mochi=3;seed.pets.mochi.energy=0;
  const {ctx,page,errors}=await demo(390,seed);await workshop(page);
  assert.match(await recipe(page,'gardenbench').locator('[data-material=wood]').textContent(),/Have 9 \/ Need 6/);
  assert.equal(await recipe(page,'gardenbench').locator('[data-material=wood] progress').getAttribute('value'),'6','native progress bounded while actual stock stays visible');
  await plan(page,'gardenbench').click();assert.equal(await page.locator('#trail-actions [data-care=rest]').evaluate(e=>e===document.activeElement),true);
  await page.locator('#trail-actions [data-care=rest]').click();assert.match(await page.locator('#vitals').textContent(),/Energy\s*100/);
  await page.locator('#gather').click();await page.locator('#build-plan-next').click();await recipe(page,'gardenbench').locator('[data-craft]').click();
  const current=JSON.parse(await page.evaluate(()=>localStorage.getItem('checklings.first-trail.v1')));assert.deepEqual(current.materials,{wood:3,stone:2,fiber:1});
  await page.locator('#close-workshop').click();await page.locator('[data-view=journal]').click();await page.locator('[data-journal-page=journeys]').click();
  assert.match(await page.locator('[data-story=mochi]').innerText(),/Promise bench is built/);assert.equal(await page.locator('[data-journey-go=mochi]').textContent(),'Place keepsake');
  await page.locator('[data-journey-go=mochi]').click();assert.equal(await recipe(page,'gardenbench').locator('[data-craft]').evaluate(e=>e===document.activeElement),true,'completed story opens its own existing keepsake');
  await plan(page,'toolkit').click();assert.equal(await page.locator('#location-name').textContent(),'OLD WATERWHEEL');
  await page.locator('#build-plan-workshop').click();assert.equal(await plan(page,'toolkit').evaluate(e=>e===document.activeElement),true,'insufficient recipe returns to enabled plan control');
  await plan(page,'starchart').click();assert.equal(await page.locator('#location-name').textContent(),'STAR POND');
  const beforeClear=await page.evaluate(()=>localStorage.getItem('checklings.first-trail.v1'));await page.locator('#build-plan-clear').click();assert.equal(await page.locator('#build-plan').isVisible(),false);assert.equal(await page.evaluate(()=>localStorage.getItem('checklings.first-trail.v1')),beforeClear,'changing/clearing plan spends no materials');
  await workshop(page);assert.equal(await plan(page,'teatable').count(),0,'locked recipe cannot start a supply plan');await recipe(page,'teatable').locator('[data-recipe-story]').click();assert.equal(await page.locator('#pet-name').textContent(),'Ember');
  const after=JSON.parse(await page.evaluate(()=>localStorage.getItem('checklings.first-trail.v1')));assert.deepEqual(after.materials,current.materials);assert.equal(after.journeys.ember,0);
  assert.deepEqual(errors,[]);await ctx.close();checks++;
 }
 {
  const {ctx,page,errors}=await demo(390);await page.locator('[data-view=practice]').click();await page.locator('#start-practice').click();await page.locator('[data-move=strike]').click();const spar=await page.locator('#combat-scene').innerText();
  await workshop(page);await plan(page,'seedbox').click();assert.equal(await page.locator('#combat-scene').innerText(),spar,'build plan cannot heal, swap or reset an unfinished spar');assert.equal(await page.locator('#leave-practice').evaluate(e=>e===document.activeElement),true);
  assert.deepEqual(errors,[]);await ctx.close();checks++;
 }
 for(const format of [1,2,3]){
  const c=classroom({now:new Date('2026-09-10T11:30:00Z')});c.harness.signInAs(PEOPLE.ada.email);const identity=c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.ada),'workshop-seed');c.harness.call('saveCheckling',identity.pinToken,'bolt','Sprocket');
  const ctx=await browser.newContext({viewport:{width:390,height:950},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('__gas',({name,args})=>{c.harness.newRequest();const answer=JSON.parse(JSON.stringify(c.harness.call(name,...args)));if(name==='getPixelCamp'&&format<3){answer.formats=[format];delete answer.access;}return answer;});
  await page.addInitScript(()=>{function run(success,failure){return new Proxy({},{get(_,name){if(name==='withSuccessHandler')return cb=>run(cb,failure);if(name==='withFailureHandler')return cb=>run(success,cb);return(...args)=>window.__gas({name,args}).then(success).catch(e=>failure?.({message:e.message}));}});}window.google={script:{get run(){return run();}}};});
  await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='school-workshop.test')return route.fulfill({body:schoolHtml,contentType:'text/html'});if(u.hostname==='grant-desk.com'&&u.pathname.startsWith('/hubs/checkling/'))return assets(route);return route.fulfill({body:'',contentType:'text/css'});});
  await page.goto('https://school-workshop.test/');await page.locator('input[type=password]').fill(c.pin(PEOPLE.ada));await page.locator('#visit-checkling').click();await page.locator('#ck-open-camp').click();const ui=page.frameLocator('iframe[title="Your school Pixel Camp"]');await ui.getByText('Saved to school',{exact:true}).waitFor();
  const before=JSON.stringify(c.harness.sheet('Checkling Camps').records());
  if(format<3){assert.equal(await ui.locator('#open-workshop').isVisible(),false);assert.equal(await ui.locator('#build-plan').isVisible(),false);}
  else{
   await workshop(ui);assert.equal(JSON.stringify(c.harness.sheet('Checkling Camps').records()),before,'read-only recipe inspection creates no revision');
   await plan(ui,'seedbox').click();assert.equal(JSON.stringify(c.harness.sheet('Checkling Camps').records()),before,'in-memory plan at current stop creates no revision');
   await ui.locator('#gather').click();await ui.getByText('Saved to school',{exact:true}).waitFor();await ui.locator('#build-plan-next').click();await ui.locator('#gather').click();await ui.getByText('Saved to school',{exact:true}).waitFor();await ui.locator('#build-plan-next').click();await recipe(ui,'seedbox').locator('[data-craft]').click();await ui.getByText('Saved to school',{exact:true}).waitFor();
   const record=JSON.parse(c.harness.sheet('Checkling Camps').records()[0]['Camp JSON']);assert.equal(record.version,3);assert.equal(record.pets.bolt.nickname,'Sprocket');assert.deepEqual(record.crafted,['seedbox']);assert.equal(Object.hasOwn(record,'plannedRecipe'),false);
  }
  assert.equal(c.checkIns().length,0);assert.equal(c.passLog().length,0);await page.locator('#checkin-next').click();assert.equal(await page.locator('iframe').count(),0);assert.equal((await page.locator('body').textContent()).includes('Sprocket'),false);assert.deepEqual(errors,[]);await ctx.close();checks++;
 }
 await writeFile(new URL('result.json',out),JSON.stringify({status:'passed',checks},null,2));console.log('Workshop build plan browser journeys passed: '+checks+' (actual gathering/crafting, focus, accessibility, free rest, active spar, school1/2/3 and privacy).');
}finally{await browser.close();}
