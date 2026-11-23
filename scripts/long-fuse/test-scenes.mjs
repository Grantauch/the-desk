import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const origin=process.env.LONG_FUSE_TEST_ORIGIN||'http://127.0.0.1:4350';
const out=resolve('scripts/long-fuse/qa-scenes');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const evidence=[],failures=[];
for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page=await context.newPage();
  for(const [part,kind,expected] of [[1,'crisis',4],[2,'front',4],[3,'weimar',5]]){
    const response=await page.goto(origin+'/storyhubs/the-long-fuse/part-'+part+'/',{waitUntil:'networkidle'});
    const stage=page.locator('#fuse-sequence-'+kind);
    await stage.scrollIntoViewIfNeeded();
    const buttons=stage.locator('[data-lf-select]');
    const panels=stage.locator('[data-lf-panel]');
    const count=await buttons.count();
    const initial=await stage.locator('[data-lf-select][aria-pressed=true]').count();
    if(width!==320)await stage.screenshot({path:resolve(out,kind+'-'+width+'-first.png'),animations:'disabled'});
    await buttons.last().click();
    const pressed=await stage.locator('[data-lf-select][aria-pressed=true]').count();
    const visible=await panels.evaluateAll(items=>items.filter(el=>!el.hidden).length);
    const chosen=await panels.last().isVisible();
    const selectedAlt=await panels.last().locator('img').count() ? await panels.last().locator('img').getAttribute('alt') : null;
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    const record={width,part,kind,status:response?.status(),count,initial,pressed,visible,chosen,selectedAlt,overflow};
    evidence.push(record);
    if(record.status!==200||count!==expected||initial!==1||pressed!==1||visible!==1||!chosen||overflow)failures.push(record);
    if(width!==320)await stage.screenshot({path:resolve(out,kind+'-'+width+'-last.png'),animations:'disabled'});
  }
  await context.close();
}
const context=await browser.newContext({viewport:{width:390,height:900},javaScriptEnabled:false});
const page=await context.newPage();
for(const [part,kind,expected] of [[1,'crisis',4],[2,'front',4],[3,'weimar',5]]){
 await page.goto(origin+'/storyhubs/the-long-fuse/part-'+part+'/',{waitUntil:'domcontentloaded'});
 const nonJS=await page.locator('#fuse-sequence-'+kind+' [data-lf-panel]').evaluateAll(items=>items.filter(el=>!el.hidden).length);
 evidence.push({noJS:kind,visiblePanels:nonJS});
 if(nonJS!==expected)failures.push({noJS:kind,expected,actual:nonJS});
}
await context.close();
await browser.close();
await writeFile(resolve('scripts/long-fuse/scenes-evidence.json'),JSON.stringify({evidence,failures},null,2));
console.log(JSON.stringify({checks:evidence.length,failures,summary:evidence.slice(0,3)},null,2));
if(failures.length)process.exitCode=1;
