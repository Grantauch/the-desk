import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
const require=createRequire(import.meta.url);
const {classroom,PEOPLE,TEACHER_CONTRACT}=require('./lib/hall-pass-fixtures.cjs');
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('apps-script/hall-pass/Index.html',root),'utf8');
const out=new URL('../browser-results/hall-pass-kiosk/',import.meta.url); await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
try {
 for(const width of [320,768,1366]) {
  const c=classroom();
  c.harness.call('teacherSetLunchNumberPins',`${PEOPLE.ada.email}\t54321\n${PEOPLE.alan.email}\t012345`,'USE LUNCH NUMBERS',TEACHER_CONTRACT);
  c.harness.signOut();
  const context=await browser.newContext({viewport:{width,height:width>=600?768:950},reducedMotion:'reduce'});
  const page=await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('__gas',async({name,args})=>{ c.harness.newRequest(); return JSON.parse(JSON.stringify(c.harness.call(name,...args))); });
  await page.addInitScript(()=>{
   function runner(success,failure){return new Proxy({},{get(_,name){
    if(name==='withSuccessHandler')return cb=>runner(cb,failure);
    if(name==='withFailureHandler')return cb=>runner(success,cb);
    return(...args)=>window.__gas({name,args}).then(success).catch(e=>failure?.({message:e.message}));
   }});}
   window.google={script:{get run(){return runner();}}};
  });
  await context.route('**/*',route=>route.fulfill({body:source.replace('<?!= JSON.stringify(appMode) ?>','"kiosk"').replace('<?= siteBrand ?>','desk'),contentType:'text/html'}));
  await page.goto('https://hall-kiosk.test/'); await page.locator('#pin').waitFor();
  for(const digit of '54321') await page.locator(`[data-digit="${digit}"]`).click();
  assert.equal(c.passLog().length,0,'Five digits never auto-submit');
  await page.locator('#pin-form button[type=submit]').click();
  await page.getByText('Pass started. Enter your PIN again when you return.',{exact:true}).waitFor();
  assert.equal(c.passLog().length,1); assert.equal(c.passLog()[0].Status,'OUT');
  assert.equal(await page.locator('#pin').inputValue(),'');
  assert.ok(!(await page.locator('body').innerText()).includes('Byron'),'Previous student name is cleared immediately');
  c.harness.clock.advanceSeconds(10);
  await page.locator('#pin').fill('54321'); await page.locator('#pin-form button[type=submit]').click();
  await page.getByText('Return recorded. You’re all set.',{exact:true}).waitFor();
  assert.equal(c.passLog()[0].Status,'RETURNED');
  c.harness.clock.advanceSeconds(10);
  await page.locator('#pin').fill('012345'); await page.locator('#pin-form button[type=submit]').click();
  await page.getByText('Pass started. Enter your PIN again when you return.',{exact:true}).waitFor();
  assert.equal(c.passLog().length,2,'Leading-zero number authorizes');
  if(width>=600) assert.ok((await page.locator('#pin-form button[type=submit]').boundingBox()).y < 700, 'Submit fits a 768-high Chromebook');
  assert.ok(await page.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No horizontal overflow');
  await page.clock.install(); await page.locator('#pin').fill('123'); await page.clock.fastForward(31000);
  assert.equal(await page.locator('#pin').inputValue(),'','An abandoned entry clears');
  await page.screenshot({path:new URL(`kiosk-${width}.png`,out).pathname,fullPage:true});
  assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('PASS: real kiosk browser flows at 320/768/1366: keypad, explicit five-digit submit, leading zero, request/return, immediate privacy reset, idle clear and viewport fit.');
} finally { await browser.close(); }
