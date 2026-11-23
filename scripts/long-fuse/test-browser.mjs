import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=process.env.LONG_FUSE_TEST_ORIGIN||'http://127.0.0.1:4350';
const screenshots=resolve('scripts/long-fuse/qa');
await mkdir(screenshots,{recursive:true});
const browser=await chromium.launch({headless:true});
const checks=[],problems=[];
for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
 for(const suffix of ['/storyhubs/the-long-fuse/','/storyhubs/the-long-fuse/part-1/','/storyhubs/the-long-fuse/part-2/','/storyhubs/the-long-fuse/part-3/']){
  const url=root+suffix;
  const r=await page.goto(url,{waitUntil:'networkidle',timeout:40000});
  const title=await page.title();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
  const missing=await page.locator('img').evaluateAll(ims=>ims.filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src')));
  const headings=await page.locator('h1').count();
  checks.push({width,suffix,status:r?.status(),title,headings,overflow,missing});
  if(r?.status()!==200||overflow||missing.length||!headings)problems.push(checks.at(-1));
  await page.screenshot({path:resolve(screenshots,width+'-'+(suffix.split('/').filter(Boolean).at(-1))+'.png'),fullPage:false});
  if(width===1440&&suffix.includes('part-3')){
   const vote=page.locator('[data-fuse-votes]');
   if(await vote.count()){
    await vote.locator('button[data-label="Nov 1932"]').click();
    const value=await vote.locator('[data-vote-number]').innerText();
    if(value!=='33.1%')problems.push({voteInteractionFailed:value});else checks.push({voteInteraction:'passed',value});
   }
   const verdict=page.locator('[data-fuse-verdict]');
   if(await verdict.count()){
    await verdict.locator('textarea[data-verdict-field=decision]').fill('Austria-Hungary chose to issue the ultimatum on July 23.');
    await verdict.locator('textarea[data-verdict-field=evidence]').fill('The primary 1914 ultimatum describes the demands in question.');
    await verdict.locator('textarea[data-verdict-field=alternative]').fill('A narrower inquiry could have been accepted but the outcome remains uncertain.');
    await verdict.locator('textarea[data-verdict-field=uncertainty]').fill('No document proves a peaceful resolution would have followed.');
    await verdict.locator('[data-verdict-check]').click();
    const state=await verdict.locator('[role=status]').innerText();
    checks.push({verdictInteraction:state});
    if(!state.includes('All four'))problems.push({verdictFailed:state});
    await page.reload({waitUntil:'domcontentloaded'});
    const restored=verdict.locator('textarea[data-verdict-field=decision]');
    await verdict.locator('[data-verdict-check]:enabled').waitFor();
    assert.match(await restored.inputValue(),/Austria-Hungary chose/);
    await verdict.locator('[data-verdict-clear]').click();
    assert.deepEqual(await verdict.locator('textarea').evaluateAll(fields=>fields.map(field=>field.value)),['','','','']);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('fuse-evidence-verdict-v1')),null);
    assert.match(await verdict.locator('[role=status]').innerText(),/Nothing was transmitted/);
   }
  }
 }
 await page.close();
}
for(const mode of ['javascript-disabled','verdict-script-unavailable']){
 const page=await browser.newPage({javaScriptEnabled:mode!=='javascript-disabled',viewport:{width:390,height:844}});
 if(mode==='verdict-script-unavailable'){
  await page.route(root+'/storyhubs/the-long-fuse/part-3/',async route=>{
   const response=await route.fetch();
   await route.fulfill({response,headers:{...response.headers(),'content-security-policy':"script-src 'none'"}});
  });
 }
 const requests=[];
 page.on('request',request=>requests.push({url:request.url(),body:request.postData(),navigation:request.isNavigationRequest()}));
 await page.goto(root+'/storyhubs/the-long-fuse/part-3/',{waitUntil:'load'});
 const verdict=page.locator('[data-fuse-verdict]');
 const controls=await verdict.locator('textarea,button').evaluateAll(els=>els.map(el=>[el.tagName,el.form!==null,el.getAttribute('name'),el.type,el.disabled]));
 assert.equal(controls.length,6,mode);
 assert.deepEqual(controls.slice(0,4),Array.from({length:4},()=>['TEXTAREA',false,null,'textarea',false]),mode);
 assert.deepEqual(controls.slice(4),Array.from({length:2},()=>['BUTTON',false,null,'button',true]),mode);
 const marker='fuse-local-synthetic-marker-47';
 const initial=page.url();
 const first=verdict.locator('textarea').first();
 await first.fill(marker);
 await first.press('Enter');
 assert.equal(page.url(),initial,mode);
 assert.equal(requests.filter(request=>request.navigation).length,1,mode);
 assert.equal(requests.some(request=>request.url.includes(marker)||request.body?.includes(marker)),false,mode);
 checks.push({verdictNoTransmission:mode});
 await page.close();
}
await browser.close();
await writeFile(resolve('scripts/long-fuse/browser-evidence.json'),JSON.stringify({checks,problems},null,2));
console.log(JSON.stringify({total:checks.length,problems,example:checks.filter(x=>x.width===1440).slice(0,4)},null,2));
if(problems.length)process.exitCode=1;
