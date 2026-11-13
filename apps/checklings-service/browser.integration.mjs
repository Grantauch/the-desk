// CI-only, synthetic HTTPS/Chromium acceptance. No school service is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {Readable} from 'node:stream';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {httpFixture,syntheticPet} from './http-test-support.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('synthetic Chromium sign-in, cookie and shared-device acceptance over HTTPS',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'ck-https-synthetic-'));
  let server,browser,f,hold;
  const requests=[];
  try {
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'key.pem'),'-out',join(directory,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
    let origin,creatureId;
    server=createServer({key:await readFile(join(directory,'key.pem')),cert:await readFile(join(directory,'cert.pem'))},async(req,res)=>{
      try {
        requests.push({path:req.url,method:req.method});
        if(req.url==='/') {
          // Test-only private renderer; not a shipped game UI.
          res.setHeader('Content-Type','text/html');res.setHeader('Cache-Control','no-store');
          res.end(`<!doctype html><html><body><div id="private"></div><button id="load">Load</button><button id="done">Done</button><script type="module">
            import {createGameClient} from '/auth/client.js';
            const panel=document.getElementById('private');
            const client=createGameClient({onClear:()=>{panel.textContent='';}});
            document.getElementById('load').onclick=()=>client.loadCreature('${creatureId}',data=>{panel.textContent=data.creature.nickname;}).catch(()=>{});
            document.getElementById('done').onclick=()=>client.logout().catch(()=>{});
          </script></body></html>`);return;
        }
        const request=new Request(origin+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})});
        const response=await f.handler(request,{clientAddress:req.socket.remoteAddress});
        if(req.url==='/auth/exchange' && hold) {
          const gate=hold;
          const cookie=response.headers.getSetCookie().find(c=>c.startsWith('__Host-ck-session='));
          if(cookie)gate.tokenHash=createHash('sha256').update(cookie.split(';')[0].slice('__Host-ck-session='.length)).digest('hex');
          gate.committed.resolve();await gate.release.promise;
        }
        for(const [name,value] of response.headers)if(name!=='set-cookie')res.setHeader(name,value);
        if(response.headers.getSetCookie().length)res.setHeader('Set-Cookie',response.headers.getSetCookie());
        res.writeHead(response.status);res.end(Buffer.from(await response.arrayBuffer()));
      } catch {if(!res.headersSent)res.writeHead(503);res.end('{}');}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    origin='https://127.0.0.1:'+server.address().port;f=await httpFixture({origin});
    const importedOwner=await f.login();creatureId=(await f.store.importLegacy(importedOwner.token,'import',syntheticPet)).creature.id;
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({ignoreHTTPSErrors:true});
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===origin){await route.continue();return;}
      if(url.hostname==='script.google.com') {
        const {flow,assertion}=await f.approval(url.searchParams.get('ticket'));
        const broker=await f.request('/bridge/assertion',{assertion},{bridge:true}),{code}=await broker.json();
        const callback=origin+'/auth/callback#'+new URLSearchParams({flowId:flow.flowId,state:flow.state,code});
        await route.fulfill({contentType:'text/html',body:`<html><body><a id="return" href="${callback}">Open Checklings</a></body></html>`});return;
      }
      if(url.hostname==='synthetic-attacker.example'){await route.fulfill({contentType:'text/html',body:'<html><body>synthetic attacker</body></html>'});return;}
      await route.abort();
    });
    async function login(page) {
      await page.goto(origin+'/auth/start');await page.locator('#start').click();
      await page.locator('#return').click();await page.waitForURL(origin+'/');
    }
    await t.test('top-level school return uses a Lax flow cookie and sets an HttpOnly Strict session',async()=>{
      const page=await context.newPage();await login(page);
      const cookies=await context.cookies(origin),session=cookies.find(c=>c.name==='__Host-ck-session');
      assert.ok(session);assert.equal(session.httpOnly,true);assert.equal(session.secure,true);assert.equal(session.sameSite,'Strict');assert.equal(session.path,'/');
      assert.ok(!cookies.some(c=>c.name==='__Host-ck-flow'));
      assert.equal(await page.evaluate(()=>document.cookie),'');
      assert.deepEqual(await page.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0]);
      assert.ok(requests.filter(r=>r.path.startsWith('/auth/callback')).every(r=>r.path==='/auth/callback'));
      await page.locator('#load').click();await page.waitForFunction(()=>document.getElementById('private').textContent==='Keep my progress');
      await page.close();
    });
    await t.test('cross-origin form and preflight requests cannot rename a pet',async()=>{
      const attacker=await context.newPage();await attacker.goto('https://synthetic-attacker.example/');
      await attacker.evaluate(async target=>{
        await fetch(target+'/api/rename',{method:'POST',mode:'no-cors',credentials:'include',headers:{'Content-Type':'text/plain'},body:'{}'}).catch(()=>{});
        await fetch(target+'/api/rename',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Checklings-Request':'1'},body:'{}'}).catch(()=>{});
      },origin);
      assert.equal((await f.store.load(importedOwner.token,creatureId)).revision,0);
      await attacker.close();
    });
    await t.test('Done clears two tabs and a pending old read never repaints',async()=>{
      const a=await context.newPage(),b=await context.newPage();
      await a.goto(origin+'/');await b.goto(origin+'/');
      // Keep the test page visible in its own foreground only when reading it.
      await a.bringToFront();await a.reload();await a.locator('#load').click();await a.waitForFunction(()=>document.getElementById('private').textContent==='Keep my progress');
      await b.bringToFront();await b.reload();await b.locator('#load').click();await b.waitForFunction(()=>document.getElementById('private').textContent==='Keep my progress');
      const delayed=deferred(),readStarted=deferred();
      await b.route('**/api/creature',async route=>{const response=await route.fetch();readStarted.resolve();await delayed.promise;await route.fulfill({response}).catch(()=>{});});
      await b.locator('#load').click();await readStarted.promise;
      await a.bringToFront();await a.locator('#done').click();delayed.resolve();
      await a.waitForFunction(()=>document.getElementById('private').textContent==='');
      await b.waitForFunction(()=>document.getElementById('private').textContent==='');
      await a.close();await b.close();
    });
    await t.test('Done while exchange headers are delayed cancels login and its committed session',async()=>{
      const page=await context.newPage();hold={committed:deferred(),release:deferred()};const gate=hold;
      await page.goto(origin+'/auth/start');await page.locator('#start').click();await page.locator('#return').click();
      await hold.committed.promise;assert.equal(new URL(page.url()).hash,'');
      await page.locator('#done').click();await page.waitForFunction(()=>document.getElementById('status').textContent==='Signed out.');
      hold.release.resolve();hold=null;
      const rows=(await f.db.query('SELECT revoked_ms FROM ck_sessions WHERE token_hash=$1',[gate.tokenHash])).rows;
      assert.equal(rows.length,1);assert.ok(rows[0].revoked_ms!==null);
      assert.equal(new URL(page.url()).pathname,'/auth/callback');await page.close();
    });
    await t.test('invalid fragments are erased without issuing an exchange request',async()=>{
      const page=await context.newPage(),before=requests.filter(r=>r.path==='/auth/exchange').length;
      await page.goto(origin+'/auth/callback#code=bad&code=duplicate');
      await page.waitForFunction(()=>document.getElementById('status').textContent.includes('did not finish'));
      assert.equal(new URL(page.url()).hash,'');assert.equal(requests.filter(r=>r.path==='/auth/exchange').length,before);await page.close();
    });
    await t.test('server idle expiry clears the private browser renderer',async()=>{
      const page=await context.newPage();await login(page);
      await page.locator('#load').click();await page.waitForFunction(()=>document.getElementById('private').textContent==='Keep my progress');
      f.advance(120000);await page.locator('#load').click();await page.waitForFunction(()=>document.getElementById('private').textContent==='');await page.close();
    });
    await context.close();
  } finally {
    hold?.release.resolve();if(browser)await browser.close();
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    if(f)await f.close();await rm(directory,{recursive:true,force:true});
  }
});
