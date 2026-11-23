import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root='http://127.0.0.1:4350';
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
    await verdict.locator('textarea[name=decision]').fill('Austria-Hungary chose to issue the ultimatum on July 23.');
    await verdict.locator('textarea[name=evidence]').fill('The primary 1914 ultimatum describes the demands in question.');
    await verdict.locator('textarea[name=alternative]').fill('A narrower inquiry could have been accepted but the outcome remains uncertain.');
    await verdict.locator('textarea[name=uncertainty]').fill('No document proves a peaceful resolution would have followed.');
    await verdict.locator('button[type=submit]').click();
    const state=await verdict.locator('[role=status]').innerText();
    checks.push({verdictInteraction:state});
    if(!state.includes('All four'))problems.push({verdictFailed:state});
   }
  }
 }
 await page.close();
}
await browser.close();
await writeFile(resolve('scripts/long-fuse/browser-evidence.json'),JSON.stringify({checks,problems},null,2));
console.log(JSON.stringify({total:checks.length,problems,example:checks.filter(x=>x.width===1440).slice(0,4)},null,2));
if(problems.length)process.exitCode=1;
