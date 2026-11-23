import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const results=[];
for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}); const page=await context.newPage();
 for(const suffix of ['','part-1/','part-2/','part-3/']){
  await page.goto((process.env.LONG_FUSE_TEST_ORIGIN||'http://127.0.0.1:4350')+'/storyhubs/the-long-fuse/'+suffix,{waitUntil:'networkidle'});
  const {violations,incomplete,passes}=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  results.push({width,suffix: suffix||'series',violations:violations.map(x=>({id:x.id,impact:x.impact,help:x.help,nodes:x.nodes.map(n=>({target:n.target,summary:n.failureSummary?.slice(0,180)}))})),incomplete:incomplete.length,passes:passes.length});
  console.log(width,suffix||'series','violations',violations.length,violations.map(x=>x.id).join(','));
 }
 await context.close();
}
await browser.close();
await writeFile('scripts/long-fuse/accessibility-evidence.json',JSON.stringify(results,null,2));
if(results.some(r=>r.violations.length))process.exitCode=1;
