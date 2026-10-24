'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {ITEMS,createProgressionService}=require('./progression.cjs');
function setup(){
 const rows=new Map();let day=42,school=true,counted=true,streak=1;
 const store={load:async k=>structuredClone(rows.get(k)||null),transact:async(k,fn)=>{const x=fn(structuredClone(rows.get(k)||null));rows.set(k,structuredClone(x.state));return x.result;}};
 const service=createProgressionService({authorize:async token=>token==='a'?{key:'class-a'}:token==='b'?{key:'class-b'}:null,calendar:async()=>({day,isSchoolDay:school}),attendance:()=>({verified:true,membershipConfirmed:true,day,bestStreak:streak,counted}),store,random:n=>n-1,seed:()=>('c'.repeat(32))});
 return {service,next:()=>day++,jump:n=>{day+=n;},setVital:(key,vital,value)=>{const s=structuredClone(rows.get(key));s.vitals[vital]=value;rows.set(key,s);},late:()=>counted=false,weekend:()=>school=false,setStreak:v=>streak=v};
}
test('wardrobe offers seven slots and dozens of unique items',()=>{assert.equal(new Set(ITEMS.map(x=>x.id)).size,ITEMS.length);assert.ok(ITEMS.length>=40);assert.equal(new Set(ITEMS.map(x=>x.slot)).size,7);});
test('session isolation and private seeds',async()=>{const f=setup();await assert.rejects(f.service.load('fake'),/Unauthorized/);await f.service.adopt('a','ember','Blaze');assert.equal(await f.service.load('b'),null);assert.ok(!JSON.stringify(await f.service.load('a')).includes('c'.repeat(32)));});
test('one adoption per member, no replacement',async()=>{const f=setup();await f.service.adopt('a','ember','Blaze');const b=await f.service.adopt('a','mochi','Mochi');assert.equal(b.created,false);assert.equal(b.state.pet.species,'ember');});
test('invalid species and name rejected',async()=>{const f=setup();await assert.rejects(f.service.adopt('a','__proto__','X'));await assert.rejects(f.service.adopt('a','ember','<svg>'));});
test('attendance earns only one daily crate and bonus',async()=>{const f=setup();await f.service.adopt('a','mochi','M');const a=await f.service.checkIn('a'),b=await f.service.checkIn('a');assert.equal(a.result.awarded,true);assert.equal(b.result.awarded,false);assert.equal(b.state.crates,1);assert.equal(b.state.dust,15);});
test('late attendance maintains lifetime stage without rewards',async()=>{const f=setup();await f.service.adopt('a','bolt','B');f.setStreak(30);f.late();const a=await f.service.checkIn('a');assert.equal(a.state.stage,4);assert.equal(a.state.crates,0);});
test('quests require completion and reject replay',async()=>{const f=setup();await f.service.adopt('a','bolt','B');await assert.rejects(f.service.claim('a','play'),/incomplete/);await f.service.care('a','play');await f.service.claim('a','play');const b=await f.service.claim('a','play');assert.equal(b.result.awarded,false);assert.equal(b.state.dust,10);});
test('care caps repeated farming, preserving bond',async()=>{const f=setup();await f.service.adopt('a','bolt','B');for(let i=0;i<12;i++)await f.service.care('a','play');const x=await f.service.load('a');assert.equal(x.bond,2);});
test('crate replays the original receipt and a new stale ID cannot reroll',async()=>{const f=setup();await f.service.adopt('a','mochi','M');await f.service.checkIn('a');const a=await f.service.load('a');const b=await f.service.open('a',a.revision,'crate_open_0001');assert.equal(b.state.crates,0);assert.deepEqual(await f.service.open('a',a.revision,'crate_open_0001'),b);assert.equal((await f.service.load('a')).revision,b.state.revision);await assert.rejects(f.service.open('a',a.revision,'crate_open_0002'),/Stale/);});
test('locked cosmetics cannot be equipped',async()=>{const f=setup();await f.service.adopt('a','mochi','M');await assert.rejects(f.service.equip('a','hat-3'),/not owned/);});
test('holidays do not permit minting',async()=>{const f=setup();await f.service.adopt('a','mochi','M');f.weekend();await assert.rejects(f.service.checkIn('a'),/school days/);await assert.rejects(f.service.care('a','play'),/school days/);});
test('daily quests reset without stripping collected items',async()=>{const f=setup();await f.service.adopt('a','mochi','M');await f.service.care('a','play');await f.service.claim('a','play');f.next();await assert.rejects(f.service.claim('a','play'),/incomplete/);assert.ok((await f.service.load('a')).owned.includes('eyes-0'));});


test('free essential care is available on a weekend with no reward or bond grants',async()=>{
 const f=setup();await f.service.adopt('a','mochi','M');
 f.weekend();
 for(const [action,vital] of [['meal','hunger'],['rest','energy'],['bath','clean']]){
   f.setVital('class-a',vital,2);
   const out=await f.service.care('a',action);
   assert.equal(out.result.applied,true,action);
   assert.equal(out.result.essential,true,action);
   assert.equal(out.state.vitals[vital],45,action);
   assert.equal(out.state.dust,0);assert.equal(out.state.crates,0);
   assert.equal(out.state.bond,0);
   assert.deepEqual(out.state.quests.completed,[]);
 }
 await assert.rejects(f.service.care('a','play'),/school days/);
});

test('daily activity caps never block emergency meals, rest or bathing',async()=>{
 const f=setup();await f.service.adopt('a','ember','Em');
 for(const action of ['play','study','treat','bath'])assert.equal((await f.service.care('a',action)).result.applied,true);
 const before=await f.service.load('a');
 for(const [action,vital] of [['meal','hunger'],['rest','energy'],['bath','clean']]){
  f.setVital('class-a',vital,0);
  const out=await f.service.care('a',action);
  assert.deepEqual(out.result,{applied:true,essential:true});
  assert.equal(out.state.vitals[vital],45);
  assert.equal(out.state.bond,before.bond);
  assert.deepEqual(out.state.quests.completed,before.quests.completed);
  assert.equal(out.state.dust,before.dust);
  assert.equal(out.state.crates,before.crates);
 }
 assert.equal((await f.service.care('a','play')).result.applied,false);
});

test('repeating free basic care above the recovery floor gives no advantage',async()=>{
 const f=setup();await f.service.adopt('a','zee','Z');
 f.weekend();f.setVital('class-a','hunger',0);
 const first=await f.service.care('a','meal');
 assert.equal(first.result.applied,true);assert.equal(first.state.vitals.hunger,45);
 const second=await f.service.care('a','meal');
 assert.equal(second.result.applied,false);assert.equal(second.result.essential,true);
 assert.equal(second.state.vitals.hunger,45);
 assert.equal(second.state.bond,0);assert.equal(second.state.crates,0);
});

test('free weekend care remains member-private; regular rewarded school care still works',async()=>{
 const f=setup();await f.service.adopt('a','bolt','B');await f.service.adopt('b','mochi','M');
 f.setVital('class-a','energy',1);f.weekend();
 const rescued=await f.service.care('a','rest');
 assert.equal(rescued.state.vitals.energy,45);
 assert.equal((await f.service.load('b')).vitals.energy,84);
 const f2=setup();await f2.service.adopt('a','bolt','B');
 const normal=await f2.service.care('a','meal');
 assert.equal(normal.result.essential,false);
 assert.ok(normal.state.quests.completed.includes('meal'));
 assert.equal(normal.state.bond,1);
});


test('crate opening needs valid member-scoped command ID and preserves exact retry receipt',async()=>{
 const f=setup();await f.service.adopt('a','zee','Z');await f.service.checkIn('a');
 const before=await f.service.load('a');
 await assert.rejects(f.service.open('a',before.revision),/command ID/);
 await assert.rejects(f.service.open('a',before.revision,'bad!'),/command ID/);
 const first=await f.service.open('a',before.revision,'crate_open_0003');
 const after=await f.service.load('a');
 assert.equal(after.crates,0);assert.equal(after.revision,before.revision+1);
 assert.deepEqual(await f.service.open('a',before.revision,'crate_open_0003'),first);
 assert.deepEqual(await f.service.load('a'),after);
 await assert.rejects(f.service.open('a',after.revision,'crate_open_0003'),/different revision/);
 await assert.rejects(f.service.open('a',before.revision,'crate_open_0004'),/Stale/);
});
test('two members may safely use the same opaque crate command ID',async()=>{
 const f=setup();await f.service.adopt('a','bolt','B');await f.service.adopt('b','mochi','M');
 await f.service.checkIn('a');await f.service.checkIn('b');
 const a=await f.service.load('a'),b=await f.service.load('b');
 const first=await f.service.open('a',a.revision,'shared_crate_001');
 const second=await f.service.open('b',b.revision,'shared_crate_001');
 assert.equal(first.state.crates,0);assert.equal(second.state.crates,0);
 assert.equal((await f.service.load('a')).crates,0);assert.equal((await f.service.load('b')).crates,0);
 assert.deepEqual(await f.service.open('a',a.revision,'shared_crate_001'),first);
 assert.deepEqual(await f.service.open('b',b.revision,'shared_crate_001'),second);
});

test('committed crate receipt can be recovered after school closes but fresh rolls stay blocked',async()=>{
 const f=setup();await f.service.adopt('a','ember','E');await f.service.checkIn('a');
 const before=await f.service.load('a');
 const result=await f.service.open('a',before.revision,'crate_before_closure_1');
 f.weekend();
 assert.deepEqual(await f.service.open('a',before.revision,'crate_before_closure_1'),result);
 assert.equal((await f.service.load('a')).revision,result.state.revision);
 await assert.rejects(f.service.open('a',result.state.revision,'crate_after_closure_1'),/school days/);
});
