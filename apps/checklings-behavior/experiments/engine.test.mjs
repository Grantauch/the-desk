import test from 'node:test';
import assert from 'node:assert/strict';
import {replay, chooseIntent, hash32, LIMITS} from './engine.mjs';
const spec={id:'creature-1',speciesId:'mochi',seed:1234,speciesDefaults:{curiosity:60,activity:40}};
const e=(id,seq,kind,tag='garden')=>({id,seq,kind,tag});
const events=[e('evt-1',1,'PLAY'),e('evt-2',2,'EXPLORE'),e('evt-3',3,'SCARE')];

test('traits and replay stay identical across repeat runs',()=>{
  const a=replay(spec,events),b=replay(structuredClone(spec),structuredClone(events));
  assert.deepEqual(a,b); assert.deepEqual(chooseIntent(a),chooseIntent(b));
});
test('event history cannot reroll stable temperament',()=>{
  assert.deepEqual(replay(spec,events).traits,replay(spec,[]).traits);
  assert.equal(replay(spec,[]).revision,0);assert.equal(replay(spec,[]).memories.length,0);
});
test('identical replays are idempotent, conflicting duplicates rejected',()=>{
  assert.deepEqual(replay(spec,[events[0],events[0],...events.slice(1)]),replay(spec,events));
  assert.throws(()=>replay(spec,[events[0],e('evt-1',1,'FEED')]),/conflicting duplicate/);
});
test('order, bounds and schema prevent phantom events and unbounded inputs',()=>{
  assert.throws(()=>replay(spec,[e('evt-7',7,'PLAY')]),/nonconsecutive/);
  assert.throws(()=>replay(spec,[e('x',1,'MINT_COINS')]),/unknown event/);
  assert.throws(()=>replay(spec,[{...e('x',1,'FEED'),nickname:'private'}]),/unexpected event/);
  assert.throws(()=>replay(spec,Array.from({length:257},()=>e('dup',1,'REST'))),/at most/);
  assert.throws(()=>replay({...spec,seed:-2},[]),/unsigned 32-bit/);
  assert.throws(()=>replay(spec,[e('x',1,'FEED','@'.repeat(33))]),/safe ASCII/);
});
test('bounded memories and preferences with long recorded history',()=>{
  const log=Array.from({length:256},(_,i)=>e('ev-'+(i+1),i+1,i%8===0?'SCARE':'PLAY','tag-'+(i%30)));
  const output=replay(spec,log);
  assert.ok(output.counters.memories<=LIMITS.memories);
  assert.ok(output.counters.preferences<=LIMITS.preferences);
  assert.equal(output.counters.eventsProcessed,256);
  assert.ok(Object.values(output.state).every(v=>v>=0&&v<=100));
});
test('same species with different seeds have durable distinct temperaments',()=>{
  const a=replay(spec,events),b=replay({...spec,id:'creature-2',seed:9876},events);
  assert.notDeepEqual(a.traits,b.traits);
  assert.deepEqual(replay(spec,events),a);
});
test('events shift learned preferences without fabricating new encounters',()=>{
  const base=replay(spec,[]),withEvents=replay(spec,events);
  assert.equal(base.preferences.garden,undefined);assert.equal(withEvents.preferences.garden,4);
  assert.equal(withEvents.memories.length,3);
  assert.equal(withEvents.memories[0].eventId,'evt-1');
});
test('snapshot intent is read-only and tied to exact revision',()=>{
  const shot=replay(spec,events),before=JSON.stringify(shot);
  const a=chooseIntent(shot,{scene:'river',tag:'garden'});
  const b=chooseIntent(shot,{scene:'river',tag:'garden'});
  assert.deepEqual(a,b);assert.equal(a.commitsAction,false);
  assert.ok(['rest','explore','socialize','observe','seek_comfort','withdraw'].includes(a.intent));
  assert.equal(JSON.stringify(shot),before);
});
test('caller objects and arrays remain untouched after replay',()=>{
  const s=structuredClone(spec),ev=structuredClone(events);
  replay(spec,events);assert.deepEqual(spec,s);assert.deepEqual(events,ev);
});
test('missing history stays missing; no founder biography is inferred',()=>{
  const a=replay({id:'legacy-founder',speciesId:'ember',seed:10},[]);
  assert.equal(a.memories.length,0);assert.equal(a.counters.eventsProcessed,0);
});
test('bad species defaults and unknown kind are rejected',()=>{
  assert.throws(()=>replay({...spec,speciesDefaults:{curiosity:999}},[]),/speciesDefaults/);
  assert.throws(()=>replay({...spec,speciesDefaults:{diagnosis:1}},[]),/speciesDefaults/);
});
test('noncryptographic hash stable but not security primitive',()=>{
  assert.equal(hash32('abc'),hash32('abc'));assert.notEqual(hash32('abc'),hash32('abd'));
});
test('intent mix avoids universal socialize default in 300 synthetic individuals',()=>{
  const tally={};
  for(let seed=1;seed<=300;seed++){
    const instance=replay({id:'mochi-sample-'+seed,speciesId:'mochi',seed,speciesDefaults:{curiosity:55,caution:55,activity:40}},[
      e('feed',1,'FEED','berries'), e('explore',2,'EXPLORE','pond'),
      e('play',3,'PLAY','ball'),e('scare',4,'SCARE','thunder'),
      e('recover',5,'RECOVER','quiet-den'),e('friendly',6,'FRIENDLY','neighbor')
    ]);
    const behavior=chooseIntent(instance,{scene:'home',tag:'pond'}).intent;
    tally[behavior]=(tally[behavior]||0)+1;
  }
  assert.ok(Object.keys(tally).length>=4,JSON.stringify(tally));
  assert.ok(Math.max(...Object.values(tally))<=165,JSON.stringify(tally));
});
test('extreme energy deficit causes rest before exploration and socializing',()=>{
  const instance=replay(spec,Array.from({length:8},(_,i)=>e('play-'+(i+1),i+1,'PLAY')));
  assert.equal(instance.state.energy,0);
  assert.equal(chooseIntent(instance,{scene:'home',tag:'garden'}).intent,'rest');
});
test('repeated scares prompt withdrawal, recovery lets individual respond differently',()=>{
  const scared=replay(spec,Array.from({length:8},(_,i)=>e('scare-'+(i+1),i+1,'SCARE')));
  assert.equal(scared.state.comfort,0);
  assert.equal(chooseIntent(scared,{scene:'home',tag:'garden'}).intent,'withdraw');
  const recovered=replay(spec,[...Array.from({length:8},(_,i)=>e('scare-'+(i+1),i+1,'SCARE')), ...Array.from({length:8},(_,i)=>e('recover-'+(i+1),i+9,'RECOVER'))]);
  assert.ok(recovered.state.comfort>scared.state.comfort);
  assert.notEqual(chooseIntent(recovered,{scene:'home',tag:'garden'}).intent,'withdraw');
});
test('behavior decisions cannot change the event count, replay or temperament',()=>{
  const snap=replay(spec,events);const serialized=JSON.stringify(snap);
  for(let i=0;i<300;i++)chooseIntent(snap,{scene:'pond',tag:'garden'});
  assert.equal(JSON.stringify(snap),serialized);
  assert.equal(snap.counters.eventsProcessed,3);
  assert.deepEqual(replay(spec,events),snap);
});
