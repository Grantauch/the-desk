import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

// Only this stateless review game is played; no student service is contacted.
const html = await readFile('public/hubs/boss-fight-review.html');
const server = process.env.BOSS_FIGHT_ORIGIN ? null : createServer((req,res)=>{
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});res.end(html);
});
if (server) await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin = process.env.BOSS_FIGHT_ORIGIN || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true});
const output = resolve('browser-results/boss-fight');
await mkdir(output,{recursive:true});
const results=[];
try {
 for (const width of [320,390,1440]) {
  const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  const page = await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
   await page.clock.install();
   const response=await page.goto(origin+'/hubs/boss-fight-review.html');
   assert.equal(response.status(),200);
   assert.equal(await page.locator('#continueBtn').isVisible(),false);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'qText');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.match(await page.locator('.sources').innerText(),/July 2021/);
   assert.equal(await page.locator('.sources a').count(),7);
   assert.deepEqual((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id),[]);
   let turns=0;
   while(await page.locator('#arena').isVisible()) {
    assert.ok(++turns<20,'winning journey must finish');
    const correct=await page.evaluate(()=>bosses[bi].qs[qi].a);
    const question=await page.locator('#qText').innerText();
    await page.locator('.opt').nth(correct).focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'note');
    const hp=await page.locator('#bossHpTxt').innerText();
    await page.locator('.opt').nth(correct).press('Enter');
    assert.equal(await page.locator('#bossHpTxt').innerText(),hp,'duplicate answer cannot change score');
    await page.clock.runFor(10000);
    assert.equal(await page.locator('#qText').innerText(),question,'feedback never advances on a timer');
    assert.equal(await page.locator('#note').isVisible(),true);
    await page.locator('#continueBtn').press('Enter');
    await page.locator('#continueBtn').evaluate(el=>el.click());
    assert.equal(await page.evaluate(()=>document.activeElement.id),await page.locator('#arena').isVisible()?'qText':'endTitle');
   }
   assert.match(await page.locator('#endTitle').innerText(),/ALL BOSSES DEFEATED/);
   await page.screenshot({path:resolve(output,`win-${width}.png`),fullPage:true});
   // Repeated rapid Continue activation is consumed once, even across a boss boundary.
   await page.locator('#restartBtn').press('Enter');
   for(let i=0;i<5;i++) {
    const correct=await page.evaluate(()=>bosses[bi].qs[qi].a);
    await page.locator('.opt').nth((correct+1)%4).press('Enter');
    const question=await page.locator('#qText').innerText();
    await page.clock.runFor(10000);
    assert.equal(await page.locator('#qText').innerText(),question);
    assert.equal(await page.locator('#youHpTxt').innerText(),String(100-20*(i+1)));
    await page.locator('#continueBtn').evaluate(el=>{el.click();el.click();});
   }
   assert.match(await page.locator('#endTitle').innerText(),/CONFIDENCE DEPLETED/);
   assert.equal(await page.locator('#weakList li').count(),6);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'endTitle');
   assert.deepEqual((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id),[]);
   // Exercise feedback for every question, including those a high combo can skip.
   await page.locator('#restartBtn').click();
   for(let b=0;b<3;b++) for(let q=0;q<4;q++) {
    await page.evaluate(({b,q})=>{bi=b;startBoss();qi=q;renderQ();},{b,q});
    const correct=await page.evaluate(()=>bosses[bi].qs[qi].a);
    await page.locator('.opt').nth(correct).click();
    assert.match(await page.locator('#note').innerText(),/HIT/);
    assert.equal(await page.locator('#note a').count(),b===0&&q===2?0:1);
    assert.deepEqual((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id),[]);
   }
   assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
   assert.deepEqual(errors,[]);
   await page.screenshot({path:resolve(output,`feedback-${width}.png`),fullPage:true});
   results.push({width,status:'PASS',winningTurns:turns,reviewedQuestions:12});
   console.log(`PASS Boss Fight win/loss, all feedback, timing, keyboard, WCAG and stateless play at ${width}px (${origin})`);
  } finally {await context.close();}
 }
 // Evidence remains readable when scripting is disabled.
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:900}});
 const page=await context.newPage();await page.goto(origin+'/hubs/boss-fight-review.html');
 assert.equal(await page.locator('.sources a').count(),7);
 assert.equal(await page.locator('noscript').isVisible(),true);await context.close();
 await writeFile(resolve(output,'result.json'),JSON.stringify({origin,results,noJavaScriptSources:'PASS'},null,2));
} finally {await browser.close();if(server)await new Promise(ok=>server.close(ok));}
