import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const browser=await chromium.launch({headless:true});
const out=resolve('scripts/long-fuse/qa-interludes');
await mkdir(out,{recursive:true});
const tests=[],failures=[];
for(const width of [1440,390]){
 const ctx=await browser.newContext({viewport:{width,height:width===1440?900:800},reducedMotion:'reduce'});
 const page=await ctx.newPage();
 for(const part of [1,2,3]){
  const res=await page.goto((process.env.LONG_FUSE_TEST_ORIGIN||'http://127.0.0.1:4350')+'/storyhubs/the-long-fuse/part-'+part+'/',{waitUntil:'networkidle'});
  const el=page.locator('[data-lf-interlude]');
  const image=el.locator('img');
  await el.scrollIntoViewIfNeeded();
  await image.evaluate(async img=>{await img.decode()});
  const naturalWidth=await image.evaluate(img=>img.naturalWidth);
  const alt=await image.getAttribute('alt');
  const animation=await image.evaluate(n=>getComputedStyle(n).animationName);
  const caption=await el.locator('.lf-interlude-credit').innerText();
  const link=await el.locator('.lf-interlude-credit a').getAttribute('href');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  const record={part,width,status:res?.status(),count:await el.count(),alt,naturalWidth,animation,caption,source:link,overflow};
  tests.push(record);
  if(record.status!==200||record.count!==1||!alt||!link||naturalWidth<=0||animation!=='none'||overflow)failures.push(record);
  await el.screenshot({path:resolve(out,'interlude-'+part+'-'+width+'.png'),animations:'disabled'});
 }
 await ctx.close();
}
await browser.close();
await writeFile('scripts/long-fuse/interludes-evidence.json',JSON.stringify({tests,failures},null,2));
console.log(JSON.stringify({tests:tests.length,failures,examples:tests.slice(0,3)},null,2));
if(failures.length)process.exitCode=1;
