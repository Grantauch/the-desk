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
