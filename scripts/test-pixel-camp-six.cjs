const test=require('node:test'),assert=require('node:assert/strict');
require('../public/hubs/checkling/camp/engine.js');require('../public/hubs/checkling/camp/camp-goals.js');
const E=globalThis.FirstTrail,G=globalThis.CampGoals,plain=x=>JSON.parse(JSON.stringify(x));
const {classroom,PEOPLE}=require('./lib/hall-pass-fixtures.cjs');
const act=(s,a)=>E.dispatch(s,a).state;
function ready(s,id,chapter){s=act(s,{type:'select',id});s=act(s,{type:'stop',value:chapter});s=act(s,{type:'rest'});s=act(s,{type:'discover'});return s;}
function gather(s,stop,times=1){s=act(s,{type:'stop',value:stop});for(let i=0;i<times;i++){s=act(s,{type:'rest'});s=act(s,{type:'gather'});}return s;}
function craft(s,id){const r=E.RECIPES.find(r=>r.id===id);for(const [m,n] of Object.entries(r.cost))s=gather(s,E.MATERIALS.find(x=>x.id===m).stop,Math.ceil(Math.max(0,n-s.materials[m])/3));return act(s,{type:'craft',id});}
function story(s,id){for(let chapter=0;chapter<3;chapter++){s=ready(s,id,chapter);if(chapter===1)s=craft(s,E.JOURNEYS[id].recipe);s=ready(s,id,chapter);assert.equal(E.journeyStatus(s).ready,true);s=act(s,{type:'journey',chapter,choice:chapter%2});}return s;}
test('v1 and v2 saves keep founders/progress and gain no invented journeys or supplies',()=>{
 let s=E.initial();s.pets.ember.discoveries=[0,2];s.pets.ember.nickname='Cinder';s.curios=['key'];
 for(const old of [E.toV1(s),E.toV2(s)]){const h=E.hydrate(old);assert.equal(h.version,3);assert.deepEqual(h.pets.ember,old.pets.ember);assert.deepEqual(h.journeys,{mochi:0,bolt:0,zee:0,ember:0});assert.deepEqual(h.materials,{wood:0,stone:0,fiber:0});assert.deepEqual(h.crafted,[]);}
 assert.throws(()=>E.hydrate({...s,version:4}));
});
test('gathering costs energy, supplies cap at 99, a free rest always rescues a tired friend',()=>{
 let s=E.initial();s.pets.mochi.energy=14;assert.equal(E.dispatch(s,{type:'gather'}).changed,false);
 s=act(s,{type:'rest'});const before=s.pets.mochi.energy;s=act(s,{type:'gather'});assert.equal(s.materials.wood,3);assert.equal(s.pets.mochi.energy,before-15);
 s.materials.wood=98;s=act(s,{type:'gather'});assert.equal(s.materials.wood,99);assert.equal(E.dispatch(s,{type:'gather'}).changed,false);
});
test('workshop deducts exact supplies once and never lets forged recipes spend them',()=>{
 let s=gather(gather(E.initial(),0),2);const r=E.dispatch(s,{type:'craft',id:'seedbox'});assert.equal(r.changed,true);assert.equal(r.state.materials.wood,0);assert.equal(r.state.materials.fiber,0);
 for(const id of ['seedbox','__proto__','constructor','gardenbench'])assert.equal(E.dispatch(r.state,{type:'craft',id}).changed,false);
 assert.deepEqual(r.state.crafted,['seedbox']);assert.equal(r.state.equippedCraft,'seedbox');
});
test('chapters enforce location, discovery, crafting and choice, with replay-safe rewards',()=>{
 let s=E.initial();assert.equal(E.dispatch(s,{type:'journey',chapter:0,choice:0}).changed,false);
 s=ready(s,'mochi',0);assert.equal(E.dispatch(s,{type:'journey',chapter:0,choice:2}).changed,false);
 const a=E.dispatch(s,{type:'journey',chapter:0,choice:0}),b=E.dispatch(s,{type:'journey',chapter:0,choice:1});assert.notEqual(a.message,b.message);assert.equal(a.state.journeys.mochi,1);
 assert.equal(E.dispatch(a.state,{type:'journey',chapter:0,choice:0}).changed,false);
 s=ready(a.state,'mochi',1);assert.equal(E.journeyStatus(s).next.kind,'craft');assert.equal(E.dispatch(s,{type:'journey',chapter:1,choice:0}).changed,false);
});
test('all twelve chapters and all eight keepsakes are reachable through ordinary play without combat',()=>{
 let s=E.initial();for(const id of E.IDS)s=story(s,id);assert.equal(Object.values(s.journeys).reduce((a,b)=>a+b),12);
 for(const r of E.RECIPES)s=craft(s,r.id);assert.equal(s.crafted.length,8);for(const id of E.IDS){assert.equal(s.pets[id].battles,0);assert.equal(s.pets[id].memories.filter(m=>m.id.startsWith('journey-')).length,3);}
 const goals=G.read(s,{full:true,adventures:true,today:'2026-10-28'});assert.equal(goals.tracks.length,7);assert.equal(goals.tracks.find(t=>t.id==='maker').next,null);assert.equal(goals.tracks.find(t=>t.id==='storyteller').next,null);
 assert.deepEqual(E.hydrate(plain(s)),s);
});
test('downgrades preserve original progress and exclude unsupported journey data',()=>{
 const s=story(E.initial(),'bolt');for(const [version,old] of [[1,E.toV1(s)],[2,E.toV2(s)]]){assert.equal(old.version,version);assert.equal('journeys'in old,false);assert.equal('materials'in old,false);assert.equal(old.pets.bolt.discoveries.length,3);}
});
test('server v3 bounds match portable saves, including recipe prerequisites and unsafe names',()=>{
 const c=classroom();const s=E.initial();s.journeys={mochi:999,bolt:-2,zee:1.6,ember:'3'};s.materials={wood:Infinity,stone:500,fiber:-20};s.crafted=['seedbox','seedbox','__proto__','constructor','gardenbench','waterclock'];s.equippedCraft='waterclock';
 assert.deepEqual(plain(c.harness.call('sanitizePixelCamp_',s)),E.hydrate(s));
 assert.throws(()=>c.harness.call('sanitizePixelCamp_',{...s,version:4}));
});
test('school saves round-trip completed journeys with idempotency, stale-write protection and membership privacy',()=>{
 const c=classroom({now:new Date('2026-09-10T11:30:00Z')});c.harness.signInAs(PEOPLE.ada.email);const login=c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.ada),'six');c.harness.call('saveCheckling',login.pinToken,'bolt','Sprocket');
 let s=story(E.hydrate(c.harness.call('getPixelCamp',login.pinToken).camp),'bolt');s=craft(s,'waterclock');const id='6'.repeat(32);
 const save=()=>c.harness.call('savePixelCamp',login.pinToken,0,id,s);assert.equal(save().revision,1);assert.equal(save().revision,1);
 const loaded=c.harness.call('getPixelCamp',login.pinToken);assert.deepEqual(plain(loaded.formats),[1,2,3]);assert.equal(loaded.camp.journeys.bolt,3);assert.equal(loaded.camp.equippedCraft,'waterclock');assert.equal(loaded.camp.pets.bolt.nickname,'Sprocket');
 assert.throws(()=>c.harness.call('savePixelCamp',login.pinToken,0,'7'.repeat(32),E.initial()),/another screen/);
 c.harness.signInAs(PEOPLE.alan.email);c.harness.newRequest();const other=c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.alan),'other');c.harness.call('saveCheckling',other.pinToken,'zee','Other');assert.equal(c.harness.call('getPixelCamp',other.pinToken).camp.version,1);
 assert.equal(c.checkIns().length,0);assert.equal(c.passLog().length,0);
});
