// CI-only synthetic Chromium: real school-page HTML/issuer functions in the
// fake Apps Script workbook. Google navigation/RPC are intercepted, not field use.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from './database.mjs';
import {schoolFixture} from './school-test-support.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('synthetic Chromium school PIN, class confirmation and issuer integration',async t=>{
  const db=await PGlite.create(),database={transaction:work=>db.transaction(work)};
  await migrate(database);const browser=await chromium.launch({headless:true});
  async function setup() {
    const f=await schoolFixture(database);await f.call('syncChecklingsAccess',['Period 1',true]);await f.call('syncChecklingsAccess',['Period 2',true]);
    const context=await browser.newContext(),origin=f.config.gameOrigin;
    let hold=null;
    await context.addInitScript(()=>{
      if(location.hostname!=='script.google.com')return;
      const build=(ok,fail)=>new Proxy({}, {get(_,name){
        if(name==='withSuccessHandler')return fn=>build(fn,fail);
        if(name==='withFailureHandler')return fn=>build(ok,fn);
        return (...args)=>fetch(location.origin+'/__synthetic_rpc__',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})})
          .then(async r=>{const body=await r.json();if(body.error)throw new Error(body.error);ok(body.value);}).catch(fail);
      }});
      window.google={script:{run:build(()=>{},()=>{})}};
    });
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.hostname==='script.google.com') {
        if(url.pathname==='/__synthetic_rpc__') {
          const {name,args}=request.postDataJSON();
          try {const value=await f.call(name,args,'ada');if(name==='identifyChecklingsGame' && hold){const gate=hold;gate.ready.resolve();await gate.release.promise;}
            await route.fulfill({contentType:'application/json',body:JSON.stringify({value})});}
          catch {await route.fulfill({contentType:'application/json',body:JSON.stringify({error:'synthetic RPC failed'})});}
        } else {
          const output=await f.call('doGet',[{parameter:{mode:'checklings',ticket:url.searchParams.get('ticket')}}],'ada');
          await route.fulfill({contentType:'text/html',headers:{'Cache-Control':'no-store'},body:output.content});
        }
        return;
      }
      if(url.origin!==origin){await route.abort();return;}
      if(url.pathname==='/'){await route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic signed-in destination</title><p>Test destination</p>'});return;}
      const headers=await request.allHeaders(),body=request.postDataBuffer();
      const response=await f.handler(new Request(url,{method:request.method(),headers,...(body?{body}:{})}),{clientAddress:'192.0.2.40'});
      const replyHeaders=Object.fromEntries(response.headers);if(response.headers.getSetCookie().length)replyHeaders['set-cookie']=response.headers.getSetCookie().join('\n');
      await route.fulfill({status:response.status,headers:replyHeaders,body:Buffer.from(await response.arrayBuffer())});
    });
    const page=await context.newPage();
    async function start(){await page.goto(origin+'/auth/start');await page.locator('#start').click();await page.locator('#pin').waitFor();}
    return {...f,page,context,start,pin:()=>f.invoke({kind:'pin'}),setHold:gate=>{hold=gate;},cleanup:async()=>{if(hold)hold.release.resolve();await context.close();await f.close();}};
  }
  try {
    await t.test('PIN, explicit own-class confirmation and user-activated return reach a usable session',async()=>{
      const f=await setup();try {
        const before=await f.invoke({kind:'facts'});await f.start();await f.page.locator('#pin').fill(await f.pin());await f.page.getByRole('button',{name:'Continue',exact:true}).click();
        await f.page.locator('select').selectOption({label:'Period 2'});await f.page.getByRole('button',{name:'Confirm class',exact:true}).click();
        await f.page.locator('#open-game').click();await f.page.waitForURL(f.config.gameOrigin+'/');
        const cookie=(await f.context.cookies(f.config.gameOrigin)).find(c=>c.name==='__Host-ck-session');assert.ok(cookie?.httpOnly);assert.equal(cookie.sameSite,'Strict');
        await database.transaction(c=>f.auth.authorize(cookie.value,c));
        assert.deepEqual(await f.invoke({kind:'facts'}),before);
        assert.deepEqual(await f.page.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0]);assert.equal(new URL(f.page.url()).hash,'');
      } finally {await f.cleanup();}
    });
    await t.test('failed PIN clears the input and exposes no game callback',async()=>{
      const f=await setup();try {await f.start();await f.page.locator('#pin').fill('000000');await f.page.getByRole('button',{name:'Continue',exact:true}).click();
        await f.page.waitForFunction(()=>document.getElementById('message').textContent.includes('could not be confirmed'));
        assert.equal(await f.page.locator('#pin').inputValue(),'');assert.equal(await f.page.locator('#open-game').count(),0);
      } finally {await f.cleanup();}
    });
    await t.test('Done clears a delayed PIN response and prevents it repainting class selection',async()=>{
      const f=await setup(),gate={ready:deferred(),release:deferred()};f.setHold(gate);
      try {await f.start();await f.page.locator('#pin').fill(await f.pin());await f.page.getByRole('button',{name:'Continue',exact:true}).click();await gate.ready.promise;
        await f.page.getByRole('button',{name:'Done / clear this screen',exact:true}).click();
        const response=f.page.waitForResponse(r=>r.url().includes('__synthetic_rpc__'));gate.release.resolve();await response;
        await f.page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        assert.equal(await f.page.locator('#panel').textContent(),'');assert.equal(await f.page.locator('select').count(),0);assert.match(await f.page.locator('#message').textContent(),/Screen cleared/);
      } finally {await f.cleanup();}
    });
    await t.test('a teacher pause between PIN and confirmation prevents the callback',async()=>{
      const f=await setup();try {await f.start();await f.page.locator('#pin').fill(await f.pin());await f.page.getByRole('button',{name:'Continue',exact:true}).click();await f.page.locator('select').selectOption({label:'Period 1'});
        await f.call('syncChecklingsAccess',['Period 1',false]);await f.page.getByRole('button',{name:'Confirm class',exact:true}).click();
        await f.page.waitForFunction(()=>document.getElementById('message').textContent.includes('could not be confirmed'));assert.equal(await f.page.locator('#open-game').count(),0);
      } finally {await f.cleanup();}
    });
  } finally {await browser.close();await db.close();}
});
