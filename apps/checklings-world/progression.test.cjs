'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {ITEMS,createProgressionService}=require('./progression.cjs');
function setup(){
 const rows=new Map();let day=42,school=true,counted=true,streak=1;
 const store={load:async k=>structuredClone(rows.get(k)||null),transact:async(k,fn)=>{const x=fn(structuredClone(rows.get(k)||null));rows.set(k,structuredClone(x.state));return x.result;}};
 const service=createProgressionService({authorize:async token=>token==='a'?{key:'class-a'}:token==='b'?{key:'class-b'}:null,calendar:async()=>({day,isSchoolDay:school}),attendance:()=>({verified:true,membershipConfirmed:true,day,bestStreak:streak,counted}),store,random:n=>n-1,seed:()=>('c'.repeat(32))});
 return {service,next:()=>day++,late:()=>counted=false,weekend:()=>school=false,setStreak:v=>streak=v};
}
test('wardrobe offers seven slots and dozens of unique items',()=>{assert.equal(new Set(ITEMS.map(x=>x.id)).size,ITEMS.length);assert.ok(ITEMS.length>=40);assert.equal(new Set(ITEMS.map(x=>x.slot)).size,7);});
test('session isolation and private seeds',async()=>{const f=setup();await assert.rejects(f.service.load('fake'),/Unauthorized/);await f.service.adopt('a','ember','Blaze');assert.equal(await f.service.load('b'),null);assert.ok(!JSON.stringify(await f.service.load('a')).includes('c'.repeat(32)));});
test('one adoption per member, no replacement',async()=>{const f=setup();await f.service.adopt('a','ember','Blaze');const b=await f.service.adopt('a','mochi','Mochi');assert.equal(b.created,false);assert.equal(b.state.pet.species,'ember');});
test('invalid species and name rejected',async()=>{const f=setup();await assert.rejects(f.service.adopt('a','__proto__','X'));await assert.rejects(f.service.adopt('a','ember','<svg>'));});
test('attendance earns only one daily crate and bonus',async()=>{const f=setup();await f.service.adopt('a','mochi','M');const a=await f.service.checkIn('a'),b=await f.service.checkIn('a');assert.equal(a.result.awarded,true);assert.equal(b.result.awarded,false);assert.equal(b.state.crates,1);assert.equal(b.state.dust,15);});
test('late attendance maintains lifetime stage without rewards',async()=>{const f=setup();await f.service.adopt('a','bolt','B');f.setStreak(30);f.late();const a=await f.service.checkIn('a');assert.equal(a.state.stage,4);assert.equal(a.state.crates,0);});
test('quests require completion and reject replay',async()=>{const f=setup();await f.service.adopt('a','bolt','B');await assert.rejects(f.service.claim('a','play'),/incomplete/);await f.service.care('a','play');await f.service.claim('a','play');const b=await f.service.claim('a','play');assert.equal(b.result.awarded,false);assert.equal(b.state.dust,10);});
test('care caps repeated farming, preserving bond',async()=>{const f=setup();await f.service.adopt('a','bolt','B');for(let i=0;i<12;i++)await f.service.care('a','play');const x=await f.service.load('a');assert.equal(x.bond,2);});
test('crate consumes only once and stale retries fail',async()=>{const f=setup();await f.service.adopt('a','mochi','M');await f.service.checkIn('a');const a=await f.service.load('a');const b=await f.service.open('a',a.revision);assert.equal(b.state.crates,0);await assert.rejects(f.service.open('a',a.revision),/Stale/);});
test('locked cosmetics cannot be equipped',async()=>{const f=setup();await f.service.adopt('a','mochi','M');await assert.rejects(f.service.equip('a','hat-3'),/not owned/);});
test('holidays do not permit minting',async()=>{const f=setup();await f.service.adopt('a','mochi','M');f.weekend();await assert.rejects(f.service.checkIn('a'),/school days/);await assert.rejects(f.service.care('a','play'),/school days/);});
test('daily quests reset without stripping collected items',async()=>{const f=setup();await f.service.adopt('a','mochi','M');await f.service.care('a','play');await f.service.claim('a','play');f.next();await assert.rejects(f.service.claim('a','play'),/incomplete/);assert.ok((await f.service.load('a')).owned.includes('eyes-0'));});
