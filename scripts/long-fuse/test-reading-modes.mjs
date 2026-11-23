import {chromium} from 'playwright';
const base=(process.env.LONG_FUSE_TEST_ORIGIN||'http://127.0.0.1:4350')+'/storyhubs/the-long-fuse/';
const browser=await chromium.launch({headless:true});
const tested=[],problems=[];
for(const width of [1280,390]){
 const context=await browser.newContext({viewport:{width,height:width===1280?720:800},reducedMotion:'reduce'});
 const page=await context.newPage();
 for(const part of [1,2,3]){
  const path=base+'part-'+part+'/?mode=chapter';
  const response=await page.goto(path,{waitUntil:'networkidle'});
  const chapterControl=page.locator('[data-setting=chapter]');
  const active=await chapterControl.getAttribute('aria-pressed');
  const interlude=page.locator('[data-lf-interlude]');
  const hidden=!(await interlude.isVisible());
  await chapterControl.click();
  const restored=await interlude.isVisible();
  await page.keyboard.press('Alt+p');
  const dialog=page.locator('[data-lf-classroom]');
  const opened=await dialog.evaluate(el=>el.open);
  await page.keyboard.press('Alt+p');
  const closed=!(await dialog.evaluate(el=>el.open));
  const record={width,part,http:response?.status(),active,interludeHiddenInChapterMode:hidden,interludeVisibleInScrollMode:restored,keyboardOpened:opened,keyboardClosed:closed};
  tested.push(record);
  if(record.http!==200||active!=='true'||!hidden||!restored||!opened||!closed)problems.push(record);
 }
 await context.close();
}
await browser.close();
console.log(JSON.stringify({tested:tested.length,problems,examples:tested.slice(0,3)},null,2));
if(problems.length)process.exitCode=1;
