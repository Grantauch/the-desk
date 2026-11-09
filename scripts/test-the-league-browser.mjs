import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {preview} from 'astro';
const url=process.env.LEAGUE_URL||'http://127.0.0.1:4397/hubs/the-league.html';
let server;
if(!process.env.LEAGUE_URL)server=await preview({server:{host:'127.0.0.1',port:4397}});
const browser=await chromium.launch({headless:true});
await mkdir('browser-results/the-league',{recursive:true});
const results=[],errors=[];
async function check(page,label,{axe=false,shot=false}={}){
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  assert.equal(overflow,false,label+' has no horizontal overflow');
  if(axe){const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();if(a.violations.length)await writeFile('browser-results/the-league/axe-failure.json',JSON.stringify(a.violations,null,2));assert.deepEqual(a.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})),[],label+' accessibility');}
  if(shot)await page.screenshot({path:`browser-results/the-league/${label}.png`,fullPage:true});results.push(label);
}
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('the-league-v1')).state);
async function click(page,selector){await page.locator(selector).first().click();}
try{
  for(const width of [1440,390,320]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:width===320?'reduce':'no-preference'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
    await page.goto(url);await page.locator('.start-card').first().waitFor();await check(page,`${width}-landing`,{axe:true,shot:true});
    await click(page,'[data-ui="help"]');assert.equal(await page.locator('#dialog').evaluate(d=>d.open),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#dialog').evaluate(d=>d.open),false);
    await click(page,'[data-ui="solo"]');await page.fill('#team-0','Motors <b>');await page.getByRole('button',{name:"Let's build a dynasty"}).click();
    await check(page,`${width}-history`,{axe:true,shot:width===1440});
    await click(page,'[data-action="begin"]');const initial=await saved(page);await page.reload();await click(page,'[data-ui="resume"]');assert.deepEqual(await saved(page),initial);
    await click(page,'[data-action="bid"]');await check(page,`${width}-auction`,{axe:true,shot:true});
    await click(page,'[data-ui="undo"]');assert.deepEqual(await saved(page),initial,'Undo restores complete state and random generator');
    const seen=new Set();let guard=0;
    while((await saved(page)).phase!=='final'&&guard++<160){
      const s=await saved(page);
      if(!seen.has(s.phase)){await check(page,`${width}-${s.phase}-play`,{axe:true,shot:width===1440});seen.add(s.phase);}
      const phase=s.phase;
      if(phase==='history')await click(page,'[data-action="begin"]');
      if(phase==='auction')await click(page,'[data-action="pass"]');
      if(phase==='sold')await click(page,'[data-action="nextLot"]');
      if(phase==='decision')await click(page,'[data-action="decision"]:not(:disabled)');
      if(phase==='office')await click(page,'[data-action="invest"]:not(:disabled)');
      if(phase==='season')await click(page,'[data-action="season"]');
      if(phase==='results')await click(page,'[data-action="nextEra"]');
    }
    const complete=await saved(page);assert.equal(complete.phase,'final');assert.equal(complete.completed,8);assert.equal(complete.teams.reduce((n,t)=>n+t.titles,0),8);
    await check(page,`${width}-final`,{axe:true,shot:true});
    // Results details, export and import are real browser interactions.
    await page.locator('summary').click();await check(page,`${width}-score-breakdown`,{axe:width===1440});
    const downloadPromise=page.waitForEvent('download');await click(page,'[data-ui="export"]');const download=await downloadPromise;
    assert.ok(download.suggestedFilename().endsWith('.json'));const savePath=await download.path();
    await page.setInputFiles('#load-file',{name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"state":{}}')});assert.deepEqual(await saved(page),complete,'Bad import preserves current game');
    await page.setInputFiles('#load-file',savePath);assert.deepEqual(await saved(page),complete,'Downloaded save roundtrip');
    await context.close();
  }
  for(const count of [2,6]){
    const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await click(page,'[data-ui="class"]');await page.selectOption('#team-count',String(count));await page.getByRole('button',{name:"Let's build a dynasty"}).click();
    let guard=0;
    while((await saved(page)).phase!=='final'&&guard++<300){
      const s=await saved(page);
      if(s.phase==='history')await click(page,'[data-action="begin"]');
      if(s.phase==='auction'){
        if(s.era===0&&s.lot===0){await check(page,`class-${count}-projector`,{axe:true,shot:true});}
        await click(page,'[data-action="bid"]:not(:disabled)');await click(page,'[data-action="bid"]:not(:disabled)');await click(page,'[data-action="sell"]');}
      if(s.phase==='sold')await click(page,'[data-action="nextLot"]');
      if(s.phase==='office')await click(page,'[data-action="invest"][data-id="save"]');
      if(s.phase==='decision')await click(page,`[data-action="decision"][data-id="${s.era===4?'lockout':'move'}"]`);
      if(s.phase==='season')await click(page,'[data-action="season"]');
      if(s.phase==='results'){
        if(count===2){await click(page,'[data-ui="finish"]');await page.keyboard.press('Escape');assert.equal((await saved(page)).phase,'results');await click(page,'[data-ui="finish"]');await click(page,'[data-ui="finish-confirm"]');}
        else await click(page,'[data-action="nextEra"]');
      }
    }
    assert.equal((await saved(page)).completed,count===2?1:8);await check(page,`class-${count}-complete`,{axe:true});
    if(count===2){await click(page,'[data-ui="undo"]');assert.equal((await saved(page)).phase,'results');}
    await context.close();
  }
  // Denied storage must still permit a full opening round; no save claim when blocked.
  const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError');};});
  await page.goto(url);await click(page,'[data-ui="solo"]');await page.getByRole('button',{name:"Let's build a dynasty"}).click();assert.match(await page.locator('.save-status').innerText(),/unavailable/);await click(page,'[data-action="begin"]');await click(page,'[data-action="pass"]');assert.ok(await page.locator('.sold-stamp').isVisible());results.push('storage-denied-playable');await context.close();
  assert.deepEqual(errors,[],'No uncaught browser errors');
  await writeFile('browser-results/the-league/results.json',JSON.stringify({checks:results.length,results,errors},null,2));console.log(`PASS THE LEAGUE: ${results.length} browser checks; complete solo at 1440/390/320; 2/6-team shared-screen play; save/import/reload/undo; WCAG A/AA; no errors.`);
}catch(e){console.error(e);throw e;}finally{await browser.close();await server?.stop();}
