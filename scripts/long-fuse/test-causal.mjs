import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const site='http://127.0.0.1:4350/storyhubs/the-long-fuse/';
const dir=resolve('scripts/long-fuse/qa-causal');
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[],issues=[];
for(const width of [1440,390,320]){
 const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 const page=await ctx.newPage();
 for(const [part,kind,correct] of [[1,'ultimatum',0],[2,'peace',2],[3,'appointment',1]]){
  const response=await page.goto(site+'part-'+part+'/',{waitUntil:'networkidle'});
  const lab=page.locator('#lf-causal-'+kind);
  await lab.scrollIntoViewIfNeeded();
  const buttons=lab.locator('[data-lf-causal-choice]');
  const panels=lab.locator('[data-lf-causal-panel]');
  const count=await buttons.count();
  const first=await panels.first().isVisible();
  const initiallyPressed=await lab.locator('[aria-pressed=true]').count();
  await buttons.last().click();
  const selected=await lab.locator('[data-lf-causal-choice][aria-pressed=true]').count();
  const visible=await panels.evaluateAll(els=>els.filter(el=>!el.hidden).length);
  const lastVisible=await panels.last().isVisible();
  const radios=lab.locator('input[type=radio]');
  await radios.nth((correct+1)%3).check();
  await lab.locator('[data-lf-causal-submit]').click();
  const wrong=await lab.locator('[data-lf-causal-feedback]').innerText();
  await radios.nth(correct).check();
  await lab.locator('[data-lf-causal-submit]').click();
  const right=await lab.locator('[data-lf-causal-feedback]').innerText();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  const record={width,part,kind,status:response?.status(),count,first,initiallyPressed,selected,visible,lastVisible,wrong,right,overflow};
  results.push(record);
  if(response?.status()!==200||count!==3||!first||initiallyPressed!==1||selected!==1||visible!==1||!lastVisible||!wrong.includes('Reconsider')||!right.includes('passed')||overflow)issues.push(record);
  if(width!==320)await lab.screenshot({path:resolve(dir,kind+'-'+width+'.png'),animations:'disabled'});
 }
 await ctx.close();
}
const noJs=await browser.newContext({viewport:{width:390,height:900},javaScriptEnabled:false});
const page=await noJs.newPage();
for(const [part,kind] of [[1,'ultimatum'],[2,'peace'],[3,'appointment']]){
 await page.goto(site+'part-'+part+'/',{waitUntil:'domcontentloaded'});
 const panels=page.locator('#lf-causal-'+kind+' [data-lf-causal-panel]');
 const visible=await panels.evaluateAll(els=>els.filter(el=>!el.hidden).length);
 const sources=await panels.locator('a[href^="https://"]').count();
 results.push({kind,noJS:visible,sourceLinks:sources});
 if(visible!==3||sources!==3)issues.push({kind,noJS:visible,sourceLinks:sources});
}
await noJs.close();await browser.close();
await writeFile('scripts/long-fuse/causal-evidence.json',JSON.stringify({results,issues},null,2));
console.log(JSON.stringify({checks:results.length,issues,first:results.slice(0,3)},null,2));
if(issues.length)process.exitCode=1;
