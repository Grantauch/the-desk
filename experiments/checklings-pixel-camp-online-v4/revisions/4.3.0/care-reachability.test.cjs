const{test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const E=require(process.env.CARE_ENGINE||path.join(__dirname,'engine.js'));
function stuck(id='mochi'){let s=E.dispatch(E.initial(),{type:'select',id}).state;for(const type of ['feed','rest','clean','observe','discover','rest'])s=E.dispatch(s,{type}).state;return s;}
test('A legal care and trail route cannot permanently lock a first play at full mood',()=>{
 for(const id of E.IDS){const before=stuck(id),snapshot=JSON.stringify(before);assert.equal(before.pets[id].joy,100);assert.equal(before.pets[id].energy,100);assert.ok(!before.pets[id].care.includes('play'));const r=E.dispatch(before,{type:'play'});assert.equal(r.changed,true,id+' first play must remain reachable');assert.ok(r.state.pets[id].care.includes('play'));assert.equal(r.state.pets[id].energy,85);assert.equal(r.state.pets[id].bond,Math.min(100,before.pets[id].bond+5));assert.equal(JSON.stringify(before),snapshot);}
});
test('Completing first full-mood play does not allow repeat bond or care farming',()=>{
 for(const id of E.IDS){let r=E.dispatch(stuck(id),{type:'play'});assert.equal(r.changed,true);const snapshot=JSON.stringify(r.state);for(let n=0;n<100;n++){r=E.dispatch(r.state,{type:'play'});assert.equal(r.changed,false);assert.equal(JSON.stringify(r.state),snapshot);}}
});
test('First play still needs energy and becomes possible after free rest',()=>{
 for(const id of E.IDS){const seed=stuck(id);seed.pets[id].energy=0;let r=E.dispatch(seed,{type:'play'});assert.equal(r.changed,false);assert.match(r.message,/rest/i);r=E.dispatch(r.state,{type:'rest'});assert.equal(r.state.pets[id].energy,100);r=E.dispatch(r.state,{type:'play'});assert.equal(r.changed,true);assert.ok(r.state.pets[id].care.includes('play'));}
});
test('Old version1 saves preserve existing care, discoveries and memories through repaired play',()=>{
 for(const id of E.IDS){const s=E.hydrate(JSON.parse(JSON.stringify(stuck(id)))),p=s.pets[id],r=E.dispatch(s,{type:'play'});assert.equal(r.changed,true);assert.deepEqual(r.state.pets[id].memories,p.memories);assert.deepEqual(r.state.pets[id].discoveries,p.discoveries);assert.ok(p.care.every(x=>r.state.pets[id].care.includes(x)));assert.equal(r.state.format,s.format);assert.equal(r.state.version,s.version);}
});
