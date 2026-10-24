import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameClient} from './browser-client.mjs';
function setup(fetch) {
  const peers=new Set(),navigations=[];
  class Channel extends EventTarget {
    constructor(){super();peers.add(this);}
    postMessage(data){for(const peer of peers)if(peer!==this)queueMicrotask(()=>peer.dispatchEvent(new MessageEvent('message',{data})));}
    close(){peers.delete(this);}
  }
  const environment=Object.assign(new EventTarget(),{fetch,BroadcastChannel:Channel,document:Object.assign(new EventTarget(),{visibilityState:'visible'}),location:{assign:url=>navigations.push(url)}});
  return {environment,navigations};
}
const ok=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json','X-Checklings-Session-Remaining-Ms':'120000'}});

test('Done clears immediately and a response ignoring AbortSignal cannot repaint',async()=>{
  const waiting=[];let cleared=0,rendered=0;
  const f=setup((path,options)=>new Promise(resolve=>waiting.push({path,options,resolve})));
  const client=createGameClient({environment:f.environment,onClear:()=>cleared++});
  const old=client.loadCreature('old-pet',()=>rendered++);
  const done=client.logout();assert.equal(cleared,1);assert.equal(waiting[0].options.signal.aborted,true);
  waiting[0].resolve(ok({creature:{nickname:'previous student'}}));waiting[1].resolve(ok({ok:true}));
  await Promise.all([old,done]);assert.equal(rendered,0);
  await client.loadCreature('old-pet',()=>rendered++);assert.equal(waiting.length,2);
  client.dispose();
});
test('cross-tab Done clears other tabs and suppresses their late response',async()=>{
  const waiting=[];let cleared=0,rendered=0;
  const f=setup(path=>path==='/auth/logout'?Promise.resolve(ok({ok:true})):new Promise(resolve=>waiting.push(resolve)));
  const a=createGameClient({environment:f.environment}),b=createGameClient({environment:f.environment,onClear:()=>cleared++});
  const old=b.loadCreature('old',()=>rendered++);await a.logout();
  waiting[0](ok({creature:{}}));await old;
  assert.equal(cleared,1);assert.equal(rendered,0);a.dispose();b.dispose();
});
test('hiding or restoring a cached tab clears private state without refreshing idle time',async()=>{
  let calls=0,clears=0;
  const f=setup(async()=>{calls++;return ok({creature:{}});});
  const client=createGameClient({environment:f.environment,onClear:()=>clears++});
  f.environment.document.visibilityState='hidden';f.environment.document.dispatchEvent(new Event('visibilitychange'));
  await client.loadCreature('old',()=>{});assert.equal(calls,0);assert.equal(clears,1);
  const restored=new Event('pageshow');restored.persisted=true;f.environment.dispatchEvent(restored);assert.equal(clears,2);
  client.dispose();
});
test('sign-in clears prior state and follows only the fixed school host',async()=>{
  const f=setup(async()=>ok({launchUrl:'https://script.google.com/macros/s/synthetic/exec?mode=checklings&ticket=public'}));
  let clear=0;const client=createGameClient({environment:f.environment,onClear:()=>clear++});
  assert.equal(await client.beginLogin(),true);assert.equal(clear,1);assert.equal(f.navigations.length,1);client.dispose();
  const bad=setup(async()=>ok({launchUrl:'https://evil.example/steal'})),other=createGameClient({environment:bad.environment});
  await assert.rejects(other.beginLogin(),/Invalid school launch/);assert.equal(bad.navigations.length,0);other.dispose();
});
test('Done during exchange suppresses completion and failed sign-out is never reported as confirmed',async()=>{
  let complete;
  const f=setup(path=>path==='/auth/exchange'?new Promise(resolve=>{complete=resolve;}):Promise.resolve(new Response('{}',{status:503})));
  const client=createGameClient({environment:f.environment});
  const exchange=client.exchange({flowId:'synthetic',state:'synthetic',code:'synthetic'});
  await assert.rejects(client.logout(),/could not be confirmed/);
  complete(ok({ok:true}));assert.equal(await exchange,false);client.dispose();
});
test('unauthorized responses clear other tabs and never reach a private renderer',async()=>{
  let cleared=0,rendered=0;
  const f=setup(async()=>new Response('{"error":"sign_in_required"}',{status:401}));
  const a=createGameClient({environment:f.environment}),b=createGameClient({environment:f.environment,onClear:()=>cleared++});
  await a.loadCreature('old',()=>rendered++);await Promise.resolve();
  assert.equal(cleared,1);assert.equal(rendered,0);a.dispose();b.dispose();
});
test('missing cross-tab support fails closed before any private request',()=>{
  let cleared=0;const f=setup(async()=>{throw new Error('Must not fetch');});delete f.environment.BroadcastChannel;
  assert.throws(()=>createGameClient({environment:f.environment,onClear:()=>cleared++}),/session support unavailable/);
  assert.equal(cleared,1);
});
test('the server deadline clears a visible private panel without a background poll',async()=>{
  let expire,clears=0,calls=0;
  const f=setup(async()=>{calls++;return ok({creature:{}});});
  f.environment.setTimeout=(callback,ms)=>{assert.ok(ms>0 && ms<=120000);expire=callback;return 1;};f.environment.clearTimeout=()=>{};
  const client=createGameClient({environment:f.environment,onClear:()=>clears++});
  await client.loadCreature('pet',()=>{});expire();assert.equal(clears,1);assert.equal(calls,1);
  await client.loadCreature('pet',()=>{});assert.equal(calls,1);client.dispose();
});

for(const [name,failure] of [
  ['network rejection',async()=>{throw new TypeError('synthetic connection lost');}],
  ['interrupted response body',async()=>({ok:true,status:200,json:async()=>{throw new TypeError('synthetic body interrupted');}})],
  ['malformed success JSON',async()=>new Response('{broken',{status:200})],
  ['unreadable unauthorized response',async()=>new Response('<html>signed out</html>',{status:401})],
]) test(`${name} clears already rendered private state in both tabs`,async()=>{
  let failing=false,calls=0,local='empty',peer='empty';
  const f=setup(async()=>{calls++;return failing?failure():ok({creature:{nickname:'synthetic private pet'}});});
  const a=createGameClient({environment:f.environment,onClear:()=>{local='';}});
  const b=createGameClient({environment:f.environment,onClear:()=>{peer='';}});
  try {
    await a.loadCreature('pet',data=>{local=data.creature.nickname;});
    await b.loadCreature('pet',data=>{peer=data.creature.nickname;});
    assert.equal(local,'synthetic private pet');assert.equal(peer,local);
    failing=true;
    await assert.rejects(a.loadCreature('pet',()=>assert.fail('Failed response must not render')));
    await Promise.resolve();
    assert.equal(local,'');assert.equal(peer,'');
    const before=calls;
    await a.loadCreature('pet',()=>assert.fail('Cleared client must remain inactive'));
    await b.loadCreature('pet',()=>assert.fail('Cleared peer must remain inactive'));
    assert.equal(calls,before);
  } finally {a.dispose();b.dispose();}
});

test('transport failure cancels a peer request and suppresses its late successful response',async()=>{
  let failing=false,pending,lateSignal,rendered=0;
  const f=setup((path,options)=>{
    if(path==='/api/rename')return Promise.reject(new TypeError('synthetic connection lost'));
    if(failing)return new Promise(resolve=>{pending=resolve;lateSignal=options.signal;});
    return Promise.resolve(ok({creature:{}}));
  });
  const a=createGameClient({environment:f.environment}),b=createGameClient({environment:f.environment});
  try {
    await a.loadCreature('pet',()=>{});failing=true;
    const late=b.loadCreature('pet',()=>{rendered++;});
    await assert.rejects(a.rename('synthetic-command',{},()=>assert.fail('Failed rename must not render')));
    await Promise.resolve();
    // The late transport deliberately ignores AbortSignal, as some callbacks do.
    const aborted=lateSignal.aborted;
    pending(ok({creature:{nickname:'old private result'}}));await late;
    assert.equal(aborted,true);assert.equal(rendered,0);
  } finally {a.dispose();b.dispose();}
});
