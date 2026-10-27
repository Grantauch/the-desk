/** Focused, offline acceptance for this lesson. Run from the repository root:
 * node storyhub/stories/USH9/JULY1914/verify.mjs
 * BROWSER_EXECUTABLE may point to an installed Chromium when needed.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const { world, PEOPLE } = require(join(root, 'scripts/lib/turn-in-harness.cjs'));
const backend = world();
const route = '/hubs/ush9-bytesize-thirty-seven-days.html';
const artifacts = join(root,'browser-results/thirty-seven-days');
await mkdir(artifacts,{recursive:true});
const server = createServer(async (req,res)=>{
 try {const path=resolve(root,'public','.'+new URL(req.url,'http://x').pathname);assert.ok(path.startsWith(join(root,'public')+'/'));const bytes=await readFile(path);res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp'})[extname(path)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-gpu']});
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'content-type'};
async function context(options={}){
 const c=await browser.newContext(options);
 await c.addInitScript(()=>{window.__deskSaveTest={endpoint:'https://turnin.test/exec',debounceMs:300,snapshotMs:300};});
 await c.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();if(u.hostname==='turnin.test'){if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:cors});return r.fulfill({status:200,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(backend.post(r.request().postData()||'{}'))});}return r.fulfill({status:503,body:'Offline fixture'});});return c;
}
try {
 for(const width of [320,390,1440]){
  const c=await context({viewport:{width,height:900}}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+route);await p.waitForFunction(()=>window.__deskSave?.ready);
  await p.evaluate(async()=>{for(const i of document.images){i.loading='eager';await i.decode();}});
  await p.screenshot({path:join(artifacts,`initial-${width}.png`)});
  const overflow=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,id:e.id,c:e.getAttribute('class'),r:e.getBoundingClientRect().right})).filter(e=>e.r>innerWidth+1).slice(0,12)}));assert.ok(overflow.scroll<=width+1,'No overflow: '+JSON.stringify(overflow));
  const ids=await p.locator('[id]').evaluateAll(els=>els.map(e=>e.id));assert.equal(new Set(ids).size,ids.length,'Unique IDs');
  await p.locator('#allyChips [data-country="ita"]').click();assert.match(await p.locator('#allyOut').innerText(),/remained neutral/);assert.equal(await p.locator('#allianceMap .links .link.alliance').count(),2);assert.notEqual(await p.locator('#allianceMap .links path').first().evaluate(e=>getComputedStyle(e).stroke),'none');
  await p.locator('#modeDrill').click();await p.locator('#allianceMap [data-k="fra"]').dispatchEvent('click');assert.match(await p.locator('#drillFeedback').innerText(),/Keep looking/);
  await p.locator('#drillShow').click();for(const k of ['srb','aut','deu','rus','fra','bel','gbr','ita'])await p.locator(`#allianceMap [data-k="${k}"]`).dispatchEvent('click');assert.match(await p.locator('#drillScore').innerText(),/8 of 8 found · 1 hints/);
  await p.locator('#drillRestart').click();assert.match(await p.locator('#drillScore').innerText(),/0 of 8 found/);await p.locator('#modeAlly').click();
  await p.locator('[data-emp="gbr"]').click();assert.match(await p.locator('#empOut').innerText(),/India/);assert.equal(await p.locator('#worldMap').getAttribute('data-focus'),'gbr');await p.locator('[data-emp=""]').click();assert.equal(await p.locator('#worldMap').getAttribute('data-focus'),null);
  for(let i=0;i<9;i++)await p.locator('#cNext').click();assert.equal(await p.locator('#cDate').innerText(),'August 4');assert.match(await p.locator('#cDay').innerText(),/37/);assert.equal(await p.locator('#crisisMap .s-war-ent').count(),5);assert.ok(await p.locator('#cNext').isDisabled());await p.locator('#cBack').click();assert.equal(await p.locator('#cDate').innerText(),'August 3');
  await p.locator('#cRange').fill('0');assert.equal(await p.locator('#cDate').innerText(),'June 28');assert.ok(await p.locator('#cBack').isDisabled());
  for(const v of ['real','dec','plan']){await p.locator(`[data-view="${v}"]`).click();assert.match(await p.locator('#westMap').getAttribute('class'),new RegExp('show-'+v));assert.ok((await p.locator('#westOut').innerText()).length>90);}
  await p.locator('#tab-M').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.locator('#tab-A').getAttribute('aria-selected'),'true');await p.keyboard.press('End');assert.equal(await p.locator('#tab-N').getAttribute('aria-selected'),'true');
  await p.locator('#checkCauses').click();assert.match(await p.locator('#causeScore').innerText(),/8 unanswered/);
  const answers=['M','A','I','N','M','A','I','N'];for(let i=0;i<8;i++)await p.locator(`input[name="main-${i+1}"][value="${answers[i]}"]`).check();await p.locator('#checkCauses').click();assert.match(await p.locator('#causeScore').innerText(),/8 of 8 correct/);
  await p.locator('input[name="main-1"][value="N"]').check();await p.locator('#checkCauses').click();assert.match(await p.locator('#causeScore').innerText(),/7 of 8 correct/);await p.locator('input[name="main-1"][value="M"]').check();
  await p.locator('#q-choice').fill('On July 28, Austria-Hungary declared war on Serbia.');await p.reload();await p.waitForFunction(()=>window.__deskSave?.ready);assert.match(await p.locator('#q-choice').inputValue(),/July 28/);assert.ok(await p.locator('input[name="main-1"][value="M"]').isChecked());
  const fresh=await c.newPage();await fresh.goto(origin+route);await fresh.waitForFunction(()=>window.__deskSave?.ready);assert.equal(await fresh.locator('#q-choice').inputValue(),'','New tab is blank on a shared device');await fresh.close();
  await p.locator('#desk-save-panel input[type="password"]').fill(backend.pin(PEOPLE.ada));await p.locator('#desk-save-panel').getByRole('button',{name:'Turn In',exact:true}).click();await p.waitForFunction(()=>/Turned in/.test(document.querySelector('#desk-save-panel').shadowRoot.querySelector('.status').textContent),null,{timeout:10000});
  assert.ok(backend.rows('Turn Ins').some(row=>JSON.stringify(row).includes('July 28')),'Synthetic server received written answer');
  const recoveryContext=await context({viewport:{width,height:900}}),recovered=await recoveryContext.newPage();await recovered.goto(origin+route);await recovered.waitForFunction(()=>window.__deskSave?.ready);await recovered.locator('#desk-save-resume input[type="password"]').fill(backend.pin(PEOPLE.ada));await recovered.locator('#desk-save-resume').getByRole('button',{name:'Load My Work',exact:true}).click();await recovered.waitForFunction(()=>document.querySelector('#q-choice').value.includes('July 28'));assert.ok(await recovered.locator('input[name="main-1"][value="M"]').isChecked(),'MAIN choices recover across devices');await recoveryContext.close();
  await p.locator('#main-content > section').first().screenshot({path:join(artifacts,`cover-${width}.png`)});
  await p.locator('#allyChips [data-country="deu"]').click();await p.locator('#map1').screenshot({path:join(artifacts,`map-${width}.png`)});
  if(width===1440)await p.locator('#main-workshop').screenshot({path:join(artifacts,`workshop-${width}.png`)});
  for(const scheme of ['light','dark']){await p.emulateMedia({colorScheme:scheme});await p.evaluate(()=>delete document.documentElement.dataset.theme);const a=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();await readFile(join(root,'public',route));assert.deepEqual(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`Accessibility ${width} ${scheme}`);}
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');assert.deepEqual(errors,[]);
  await c.close();console.log('PASS '+width+'px: all maps, drill, MAIN corrections, keyboard, refresh, shared device, synthetic Turn In and cross-device recovery, light/dark accessibility and reduced motion');
 }
 const c=await browser.newContext({javaScriptEnabled:false});const p=await c.newPage();await p.route('https://**',r=>r.fulfill({status:503,body:'Offline'}));await p.goto(origin+route);await p.getByText('Read the complete crisis timeline',{exact:true}).click();assert.ok(await p.getByText('August 4 · Belgium is invaded; Britain enters.',{exact:false}).isVisible());assert.equal(await p.locator('[role="tabpanel"]:visible').count(),4);await c.close();console.log('PASS no-script evidence and MAIN definitions');
} finally {await browser.close();await new Promise(r=>server.close(r));}
