'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseAffinityUnion,checkBattleChart,checkProposalSpecies}=require('./audit.cjs');
const chart=(strong='`BETA`')=>[
'| Affinity ID | Domain | Assigned | Strong Against | Resisted By |',
'| --- | --- | --- | --- | --- |',
'| `ALPHA` | a | a | '+strong+' | - |',
'| `BETA` | b | b | - | `ALPHA` |'
].join('\n');
test('reject widened or executable canonical Affinity union terms',()=>{
 for(const source of ["export type Affinity = 'growth' | string;", "export type Affinity = 'growth' | 123;", "export type Affinity = 'growth' | SomeOtherType;"])
  assert.throws(()=>parseAffinityUnion(source),/Invalid canonical affinity union term/);
});
test('reject undocumented raw matchup names instead of ignoring them',()=>{
 assert.throws(()=>checkBattleChart(chart('BETA'),{affinities:['growth','tide']}),/Unrecognized battle matchup token/);
 assert.deepEqual(checkBattleChart(chart(),{affinities:['growth','tide']}).errors,[]);
});
test('flag malformed species ecological affinity labels rather than skipping verification',()=>{
 const b=checkBattleChart(chart(),{affinities:['growth','tide']});
 const bad=checkProposalSpecies('**Ecological Affinity**: ALPHA',b);
 assert.deepEqual(bad.errors,['Malformed Ecological Affinity label']);
 assert.equal(checkProposalSpecies('No ecological group field',b).state,'not-specified');
});
