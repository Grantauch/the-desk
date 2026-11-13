import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {httpFixture,schoolUrl,syntheticPet} from './http-test-support.mjs';
import {createGameHandler} from './http.mjs';

test('HTTP authentication and creature command boundary with synthetic SQL',async t=>{
  const f=await httpFixture();
  try {
    await t.test('only the browser cookie receives the proof and session token',async()=>{
      const l=await f.login();
      assert.deepEqual(await l.response.json(),{ok:true});
      for(const c of l.response.headers.getSetCookie()) {
        assert.match(c,/Path=\/; Secure; HttpOnly; SameSite=/);assert.ok(!c.includes('Domain='));
      }
      assert.match(l.response.headers.getSetCookie()[0],/SameSite=Strict; Max-Age=900$/);
      const started=await f.begin();
      assert.match(started.response.headers.getSetCookie().at(-1),/SameSite=Lax; Max-Age=60$/);
      assert.ok(!started.launchUrl.includes(started.flowCookie.split('=')[1]));
      assert.equal(new URL(started.launchUrl).origin,'https://script.google.com');
    });
    await t.test('authenticated rename persists and replay is scoped to its owner',async()=>{
      const a=await f.login(),b=await f.login('b');
      const imported=await f.store.importLegacy(a.token,'import',syntheticPet);
      const input={creatureId:imported.creature.id,expectedRevision:0,nickname:'After transport'};
      const saved=await f.request('/api/rename',{commandId:'rename',input},{cookie:a.cookie});
      assert.equal(saved.status,200);const first=await saved.json();assert.equal(first.creature.revision,1);
      assert.deepEqual(await (await f.request('/api/rename',{commandId:'rename',input},{cookie:a.cookie})).json(),first);
      assert.equal((await f.request('/api/creature',{creatureId:input.creatureId},{cookie:b.cookie})).status,404);
      assert.equal((await f.request('/api/rename',{commandId:'stale',input},{cookie:a.cookie})).status,409);
      assert.equal((await f.request('/api/rename',{commandId:'changed',input:{...input,revision:99}},{cookie:a.cookie})).status,400);
      assert.equal((await f.request('/api/import',syntheticPet,{cookie:a.cookie})).status,404);
    });
    await t.test('cross-origin, missing/null origin, simple form and cross-site requests cannot mutate',async()=>{
      for(const headers of [{Origin:'https://evil.example'},{Origin:'https://synthetic-game.example.evil.example'},{Origin:null},{Origin:'null'},{'X-Checklings-Request':null},{'Sec-Fetch-Site':'cross-site'}])
        assert.equal((await f.request('/auth/launch',{}, {headers})).status,403);
      assert.equal((await f.request('/auth/launch',{}, {headers:{'Content-Type':'application/x-www-form-urlencoded'}})).status,415);
      for(const method of ['GET','OPTIONS','PUT'])assert.equal((await f.request('/auth/launch',{}, {method})).status,405);
    });
    await t.test('all responses deny caching, framing, third-party assets and CORS',async()=>{
      for(const response of [await f.request('/auth/launch'),await f.request('/unknown'),await f.request('/auth/callback',{}, {method:'GET'})]) {
        assert.match(response.headers.get('cache-control'),/no-store/);
        assert.equal(response.headers.get('referrer-policy'),'no-referrer');
        assert.equal(response.headers.get('x-frame-options'),'DENY');
        assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
        assert.equal(response.headers.get('access-control-allow-origin'),null);
      }
      assert.equal((await f.request('/auth/callback?code=synthetic',{}, {method:'GET'})).status,400);
    });
    await t.test('malformed/oversized/compressed JSON and duplicate cookies fail before use',async()=>{
      for(const raw of ['{bad','null','[]','{"extra":true}'])assert.equal((await f.request('/auth/launch',{}, {raw})).status,400);
      assert.equal((await f.request('/auth/launch',{}, {raw:' '.repeat(8193)})).status,413);
      assert.equal((await f.request('/auth/launch',{}, {headers:{'Content-Length':'9000'}})).status,413);
      assert.equal((await f.request('/auth/launch',{}, {headers:{'Content-Encoding':'gzip'}})).status,415);
      assert.equal((await f.request('/auth/launch',{}, {cookie:'__Host-ck-session=a; __Host-ck-session=b'})).status,400);
    });
    await t.test('broker accepts signed server assertions and refuses browser calls or extra PIN/role claims',async()=>{
      const l=await f.begin(),approved=await f.approval(l.ticket);
      assert.equal((await f.request('/bridge/assertion',{assertion:approved.assertion})).status,403);
      assert.equal((await f.request('/bridge/assertion',{assertion:approved.assertion},{bridge:true,headers:{'Sec-Fetch-Site':'none'}})).status,403);
      assert.equal((await f.request('/bridge/assertion',{assertion:approved.assertion,pin:'synthetic-only'},{bridge:true})).status,400);
      assert.equal((await f.request('/bridge/assertion',{assertion:'forged'},{bridge:true})).status,401);
      assert.equal((await f.request('/bridge/assertion',{assertion:approved.assertion},{bridge:true})).status,200);
    });
    await t.test('exchange requires the originating cookie; token/body/URL claims cannot replace it',async()=>{
      const l=await f.begin(),{flow,assertion}=await f.approval(l.ticket);
      const {code}=await (await f.request('/bridge/assertion',{assertion},{bridge:true})).json();
      const body={flowId:flow.flowId,state:flow.state,code};
      assert.equal((await f.request('/auth/exchange',body)).status,401);
      assert.equal((await f.request('/auth/exchange',{...body,flowCookie:l.flowCookie.split('=')[1]})).status,400);
      assert.equal((await f.request('/auth/exchange',body,{cookie:l.flowCookie})).status,200);
      assert.equal((await f.request('/auth/exchange',body,{cookie:l.flowCookie})).status,401);
    });
    await t.test('Done revokes two tabs, prevents receipt replay and clears both cookies',async()=>{
      const l=await f.login();const r=await f.store.importLegacy(l.token,'import',syntheticPet);
      const done=await f.request('/auth/logout',{}, {cookie:l.cookie});
      assert.equal(done.status,200);assert.equal(done.headers.getSetCookie().length,2);
      assert.ok(done.headers.getSetCookie().every(c=>c.endsWith('Max-Age=0')));
      assert.equal((await f.request('/api/creature',{creatureId:r.creature.id},{cookie:l.cookie})).status,401);
      assert.equal((await f.request('/auth/logout',{}, {cookie:l.cookie})).status,200);
    });
    await t.test('beginning another sign-in revokes the previous browser session',async()=>{
      const l=await f.login();assert.equal((await f.request('/auth/launch',{}, {cookie:l.cookie})).status,200);
      await assert.rejects(f.database.transaction(c=>f.auth.authorize(l.token,c)),/Unauthorized/);
    });
    await t.test('Done cancels an exchange whose successful response has not arrived',async()=>{
      const l=await f.login(); // Keep the old proof as if exchange headers are still in transit.
      assert.equal((await f.request('/auth/logout',{}, {cookie:l.flowCookie})).status,200);
      await assert.rejects(f.database.transaction(c=>f.auth.authorize(l.token,c)),/Unauthorized/);
    });
    await t.test('idle expiry is enforced by the server and anonymous GET cannot refresh it',async()=>{
      const l=await f.login();f.advance(120000);
      assert.equal((await f.request('/api/creature',{creatureId:'anything'},{cookie:l.cookie})).status,401);
    });
    await t.test('database errors are redacted and failed logout never reports success',async()=>{
      const reports=[],broken=createGameHandler({auth:{...f.auth,logout:async()=>{throw new Error('private synthetic credentials must not leak');}},store:f.store,limiter:f.limiter,origin:f.origin,schoolLaunchUrl:schoolUrl,report:x=>reports.push(x)});
      const request=new Request(f.origin+'/auth/logout',{method:'POST',headers:{Origin:f.origin,'X-Checklings-Request':'1','Content-Type':'application/json'},body:'{}'});
      const response=await broken(request,{clientAddress:'192.0.2.41'});
      assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'service_unavailable'});
      assert.equal(response.headers.getSetCookie().length,2);
      assert.deepEqual(reports,[{event:'request_failed',scope:'logout',status:503}]);
      const missing=await f.handler(new Request(f.origin+'/auth/launch',{method:'POST',headers:{Origin:f.origin,'X-Checklings-Request':'1','Content-Type':'application/json'},body:'{}'}));
      assert.equal(missing.status,503);
    });
    await t.test('private configuration cannot create an open school redirect',()=>{
      for(const destination of ['https://evil.example/exec','javascript:alert(1)',schoolUrl+'?callback=https://evil.example',schoolUrl+'#fragment'])
        assert.throws(()=>createGameHandler({auth:f.auth,store:f.store,limiter:f.limiter,origin:f.origin,schoolLaunchUrl:destination}),/configuration/);
    });
    await t.test('rate limits are shared and do not block Done when a classroom quota is exhausted',async()=>{
      const limited=await httpFixture({limits:{launch:1,exchange:1,logout:1,bridge:1,command:1}});
      try {
        assert.equal((await limited.request('/auth/launch')).status,200);
        const denied=await limited.request('/auth/launch');assert.equal(denied.status,429);assert.equal(denied.headers.get('retry-after'),'60');
        assert.equal((await limited.request('/auth/logout')).status,200);
        assert.equal((await limited.request('/auth/logout')).status,200);
      } finally {await limited.close();}
    });
    await t.test('streaming bodies have a deadline even when the sender stops sending',async()=>{
      const handler=createGameHandler({auth:f.auth,store:f.store,limiter:f.limiter,origin:f.origin,schoolLaunchUrl:schoolUrl,bodyTimeoutMs:20});
      const request=new Request(f.origin+'/auth/launch',{method:'POST',headers:{Origin:f.origin,'X-Checklings-Request':'1','Content-Type':'application/json'},body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));}}),duplex:'half'});
      assert.equal((await handler(request,{clientAddress:'192.0.2.42'})).status,408);
    });
  } finally {await f.close();}
});
