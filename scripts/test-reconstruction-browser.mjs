import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const require = createRequire(import.meta.url);
const { world, PEOPLE } = require('./lib/turn-in-harness.cjs');
const route = '/hubs/reconstruction-case-file-student.html';
const root = resolve('public');
const server = process.env.RECONSTRUCTION_ORIGIN ? null : createServer(async (req,res) => {
  try {
    const path = resolve(root, '.' + new URL(req.url,'http://local').pathname);
    assert.ok(path.startsWith(root + '/'.replace('/', process.platform === 'win32' ? '\\' : '/')));
    res.writeHead(200, {'content-type': extname(path) === '.js' ? 'text/javascript' : 'text/html'});
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end('missing'); }
});
if(server) await new Promise(ok => server.listen(0,'127.0.0.1',ok));
const origin = process.env.RECONSTRUCTION_ORIGIN || `http://127.0.0.1:${server.address().port}`;
const output = resolve(process.env.RECONSTRUCTION_OUTPUT || 'browser-results/reconstruction');
await mkdir(output,{recursive:true});
const browser = await chromium.launch();
const results = [];
async function wait(fn) {
  const start=Date.now(); while(!await fn()) {if(Date.now()-start>15000) throw Error('condition timed out'); await new Promise(ok=>setTimeout(ok,75));}
}
async function rig(s,width) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',acceptDownloads:true});
  const errors=[], calls=[];
  await context.addInitScript(() => {
    window.__deskSaveTest={endpoint:'https://turnin.test/exec',gate:true,debounceMs:300,snapshotMs:300};
    // An old browser-wide save must never become a new student's work.
    localStorage.setItem('rcf1865',JSON.stringify({name:'Previous synthetic student',p6:{a:'Previous private answer'}}));
  });
  await context.route('**/*',async r=>{
    const url=new URL(r.request().url());
    if(url.origin===new URL(origin).origin) return r.continue();
    if(url.hostname==='turnin.test') {
      const headers={'access-control-allow-origin':'*','access-control-allow-headers':'content-type'};
      if(r.request().method()==='OPTIONS') return r.fulfill({status:204,headers});
      const data=r.request().postData(); calls.push(JSON.parse(data).action);
      return r.fulfill({status:200,headers:{...headers,'content-type':'application/json'},body:JSON.stringify(s.post(data))});
    }
    return r.abort();
  });
  async function open(){
    const p=await context.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));
    p.on('dialog',d=>d.accept());
    assert.equal((await p.goto(origin+route,{waitUntil:'load'})).status(),200);
    await p.waitForFunction(()=>window.__deskSave?.ready);return p;
  }
  return {context,errors,calls,open};
}
async function enter(p,pin) {
  const gate=p.locator('#desk-save-gate');
  await gate.locator('input[type=password]').fill(pin);
  await gate.getByRole('button',{name:'Start',exact:true}).click();
  await gate.getByRole('button',{name:'Yes, that is me'}).waitFor();
  await gate.getByRole('button',{name:'Yes, that is me'}).click();
  await p.waitForFunction(()=>!window.__deskSave.gate());
}
async function section(p,n) {
  // Use the actual navigation, preserving focus and visibility behavior.
  while(await p.locator('[data-section-index]:visible').getAttribute('data-section-index')!==String(n)) {
    const current=Number(await p.locator('[data-section-index]:visible').getAttribute('data-section-index'));
    await p.locator(n>current?'#next':'#back').click();
  }
}
async function audit(p,width,n) {
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`fit ${width} section ${n}`);
  const a=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  assert.deepEqual(a.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>({target:n.target,detail:n.failureSummary}))})),[],`WCAG ${width} section ${n}`);
}
try {
  for(const width of [320,390,1440]) {
    const s=world(), r=await rig(s,width); let home;
    try {
      const p=await r.open();
      assert.equal(await p.evaluate(()=>window.__deskSave.gate()),true);
      assert.deepEqual(r.calls,[],'no account requests before sign-in');
      assert.equal(await p.evaluate(()=>localStorage.getItem('rcf1865')),null);
      assert.equal(await p.locator('#nm').inputValue(),'');
      await enter(p,s.pin(PEOPLE.ada));
      await section(p,0); await audit(p,width,0);
      await p.locator('#nm').fill('Synthetic investigator'); await p.locator('#hr').fill('Period 1');
      const expected={};
      for(let n=1;n<=6;n++) {
        await section(p,n);
        assert.equal(await p.evaluate(()=>document.activeElement.id),`section-heading-${n}`);
        const pane=p.locator(`[data-section-index="${n}"]`);
        for(const field of await pane.locator('textarea,input[type=text]').all()) {
          const id=await field.getAttribute('id'); const value=id==='gap-lnd-change'?'No general guarantee':`Synthetic ${id}`;
          await field.fill(value); expected[id]=value;
        }
        // All choices must persist, including previous hidden sections.
        for(const set of await pane.locator('fieldset').all()) {
          const radios=set.locator('input[type=radio]'); await radios.last().check();
        }
        for(const button of await pane.getByRole('button',{name:/Check my/}).all()) await button.click();
        await audit(p,width,n);
        console.log(`checked ${width} section ${n}`);
      }
      // Keyboard selection and a later-section writing bookmark.
      await section(p,3);
      const first=p.locator('[data-token=t1] input').first();await first.focus();await p.keyboard.press('ArrowRight');
      assert.equal(await p.locator('[data-token=t1] input:checked').inputValue(),'ban');
      await section(p,6); await p.locator('#p6a').focus();
      await p.evaluate(()=>{const f=document.querySelector('#p6a');f.setSelectionRange(3,8);f.dispatchEvent(new Event('select',{bubbles:true}));});
      await p.evaluate(()=>window.__deskSave.saveCloud());
      await wait(()=>s.rows('Drafts').some(row=>row.Data.includes('Synthetic why_a')&&row.Data.includes('Synthetic p6a')));
      const before=await p.evaluate(()=>window.__deskSave.state().values);
      assert.equal(Object.keys(before).length,49,'23 text fields and 26 choice groups are saved');
      assert.equal(before['r:choice-13'],'ban','markup is a saved answer');
      await p.reload({waitUntil:'load'});await p.waitForFunction(()=>window.__deskSave?.ready&&!window.__deskSave.gate());
      assert.deepEqual(await p.evaluate(()=>window.__deskSave.state().values),before,'same-tab refresh preserves the complete file');
      home=await rig(s,width);const q=await home.open();await enter(q,s.pin(PEOPLE.ada));
      assert.deepEqual(await q.evaluate(()=>window.__deskSave.state().values),before,'all 49 answers restored from the account');
      for(const [id,value] of Object.entries(expected)) assert.equal(await q.locator('#'+id).inputValue(),value,`cloud restore ${id}`);
      assert.equal(await q.locator('[data-token=t1] input:checked').inputValue(),'ban');
      await section(q,7);await audit(q,width,7);
      const report=await q.locator('#answer-summary').innerText();
      for(const value of Object.values(expected)) assert.ok(report.includes(value),`complete report: ${value}`);
      const download=q.waitForEvent('download');await q.getByRole('button',{name:'Download my answers',exact:true}).click();
      const file=await download;const text=await readFile(await file.path(),'utf8');
      assert.ok(text.includes('Synthetic why_a')&&text.includes('Synthetic p6a')&&text.includes('slavery: ban'));
      await q.locator('#desk-save-panel').getByRole('button',{name:'Turn In',exact:true}).click();
      await wait(()=>s.rows('Turn Ins').length===1);
      const submitted=JSON.parse(s.rows('Turn Ins')[0].Data);
      assert.deepEqual(submitted.answers.map(answer=>answer.k).sort(),Object.keys(before).sort(),'Turn In includes every answer key');
      assert.ok(JSON.stringify(submitted).includes('Synthetic why_a')&&JSON.stringify(submitted).includes('Synthetic p6a'));
      assert.match(s.rows('Turn Ins')[0].Answers,/No general guarantee/);
      await q.screenshot({path:resolve(output,`report-${width}.png`),fullPage:true});
      await q.locator('#desk-save-resume summary').click();
      await q.locator('#desk-save-resume').getByRole('button',{name:'Not you? Sign out'}).click();
      await q.waitForFunction(()=>window.__deskSave.gate());
      assert.equal(await q.locator('#p6a').inputValue(),'');
      assert.ok(!(await q.locator('#answer-summary').textContent()).includes('Synthetic'));
      await enter(q,s.pin(PEOPLE.grace));await section(q,7);
      assert.ok(!(await q.locator('#answer-summary').textContent()).includes('Synthetic'));
      const next=await r.open();await enter(next,s.pin(PEOPLE.grace));
      assert.equal(await next.locator('#nm').inputValue(),'');assert.equal(await next.locator('#p6a').inputValue(),'');
      assert.deepEqual(r.errors,[]);assert.deepEqual(home.errors,[]);
      results.push({width,status:'PASS',checks:'all sections, 49 saved answers, native keyboard, tab/cloud restore, complete report/download/Turn In, sign-out/new-student isolation, WCAG, fit'});
      console.log(`PASS Reconstruction ${width}px: complete save, restore, submission, privacy, WCAG and fit (${origin})`);
    } finally {await r.context.close();if(home)await home.context.close();}
  }
  const context=await browser.newContext({javaScriptEnabled:false});const p=await context.newPage();await p.goto(origin+route);
  assert.equal(await p.locator('.sources a').count(),5);await context.close();
  await writeFile(resolve(output,'result.json'),JSON.stringify({origin,results,noJavaScriptSources:'PASS',syntheticOnly:true},null,2));
} finally {await browser.close();if(server)await new Promise(ok=>server.close(ok));}
