'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {checkBattleChart,checkCanonical}=require('./audit.cjs');
const canonical={affinities:['growth','tide']};
const head='| Affinity ID | Domain | Assigned | Strong Against | Resisted By |';
const alpha='| `ALPHA` | zone | creature | - | - |';
const beta='| `BETA` | zone | creature | - | - |';
test('missing Markdown separator must not silently skip the first battle group',()=>{
 const malformed=[head,alpha,beta].join('\n');
 assert.throws(()=>checkBattleChart(malformed,canonical),/separator|malformed/i);
});
test('extra unescaped battle table column must not be silently ignored',()=>{
 const malformed=[head,'| --- | --- | --- | --- | --- |',alpha+' extra-column |',beta].join('\n');
 assert.throws(()=>checkBattleChart(malformed,canonical),/columns|malformed/i);
});
test('missing canonical species must fail rather than certify an empty catalog',()=>{
 const empty=JSON.stringify({ecosystems:['forest'],slice:[]});
 const types="export type Affinity = 'growth' | 'tide';";
 const res=checkCanonical(empty,types);
 assert.ok(res.errors.length>0);
});
test('valid aligned Markdown chart still parses cleanly',()=>{
 const good=[head,'| :--- | :--- | :--- | :--- | :--- |',alpha,beta].join('\n');
 assert.deepEqual(checkBattleChart(good,canonical).errors,[]);
});

test('actual six-column tactical chart with declared terrain synergy is supported',()=>{
 const head6='| Affinity ID | Ecological Domain | First-12 Species Assigned | Strong Against (`1.25x` DMG) | Resisted By (`0.80x` DMG) | Terrain Synergy Bonus (`+10%` Role Effect) |';
 const sep6='| :--- | :--- | :--- | :--- | :--- | :--- |';
 const alpha6='| `ALPHA` | meadow | `a` | `BETA` | - | `MEADOW`: `+10%` |';
 const beta6='| `BETA` | ocean | `b` | - | `ALPHA` | `OCEAN`: `+10%` |';
 assert.deepEqual(checkBattleChart([head6,sep6,alpha6,beta6].join('\n'),canonical).errors,[]);
 assert.throws(()=>checkBattleChart([head6,sep6,alpha6.replace(' | `MEADOW`', ' | junk | `MEADOW`'),beta6].join('\n'),canonical),/column/i);
});

test('battle annotation after code-quoted type remains reviewable without ignoring raw group names',()=>{
 const good=[head,'| --- | --- | --- | --- | --- |', '| `ALPHA` | zone | a | `BETA` (Feint pierce) | - |', '| `BETA` | zone | b | - | `ALPHA` |'].join('\n');
 assert.deepEqual(checkBattleChart(good,canonical).errors,[]);
 const invalid=good.replace('`BETA` (Feint pierce)','`BETA` RAW_NAME');
 assert.throws(()=>checkBattleChart(invalid,canonical),/Unrecognized/);
});
