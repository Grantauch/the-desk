'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {checkCanonical,checkBattleChart,checkProposalSpecies,parseAffinityUnion} = require('./audit.cjs');
const types="export type Affinity = 'growth' | 'tide' | 'stone' | 'spark' | 'flame' | 'frost' | 'gale' | 'shade' | 'alloy' | 'cosmic' | 'venom' | 'spirit';";
const plan=JSON.stringify({ecosystems:['forest','ocean'],slice:[{id:'mosswisp',ecosystem:'forest',affinity:'spirit'},{id:'brinebell',ecosystem:'ocean',affinity:'tide'}]});
const chart=`| Affinity ID | Domain | Assigned | Strong Against | Resisted By |\n| :--- | :--- | :--- | :--- | :--- |\n| \`CANOPY_FLORA\` | Forest | Mosswisp | \`TIDAL_BRINE\` | \`TIDAL_BRINE\` |\n| \`TIDAL_BRINE\` | Ocean | Brinebell | \`FROST_RIME\` | \`CANOPY_FLORA\` |`;
test('canonical affinities are 12 stable lowercase values',()=>{const a=parseAffinityUnion(types);assert.equal(a.length,12);assert.ok(a.includes('spirit'));assert.ok(a.includes('tide'));});
test('canonical plan is valid independently of proposal groups',()=>{const c=checkCanonical(plan,types);assert.deepEqual(c.errors,[]);assert.equal(c.species.mosswisp.affinity,'spirit');});
test('identifies undefined proposed battle target without mislabeling legacy species',()=>{const b=checkBattleChart(chart,checkCanonical(plan,types));assert.ok(b.errors.includes('Undefined battle group FROST_RIME referenced by TIDAL_BRINE'));assert.ok(b.errors.some(s=>s.includes('Nonreciprocal matchup')));assert.equal(b.declaredGroups.length,2);assert.equal(b.warnings.length,1);});
test('does not confuse a proposed ecological group with persisted Affinity',()=>{const b=checkBattleChart(chart,checkCanonical(plan,types));const s=checkProposalSpecies('- **Ecological Affinity**: `CANOPY_FLORA` (`CK-BATTLE-001`)',b);assert.equal(s.state,'proposed-ecological-group');assert.deepEqual(s.errors,[]);});
test('rejects unknown proposed ecological group',()=>{const b=checkBattleChart(chart,checkCanonical(plan,types));assert.deepEqual(checkProposalSpecies('**Ecological Affinity**: `UNKNOWN`',b).errors,['Undeclared proposed species group: UNKNOWN']);});
test('rejects unexpected canonical types and duplicate species IDs',()=>{let bad=JSON.stringify({ecosystems:['forest'],slice:[{id:'a',ecosystem:'forest',affinity:'CANOPY_FLORA'},{id:'a',ecosystem:'missing',affinity:'tide'}]});assert.equal(checkCanonical(bad,types).errors.length,3);});
test('fails malformed inputs rather than inferring approval',()=>{assert.throws(()=>parseAffinityUnion('type Affinity = string;'),/Cannot find/);assert.throws(()=>checkBattleChart('not a chart',checkCanonical(plan,types)),/No Affinity ID/);});

test('detects contradictory reverse type matchups and self-advantage',()=>{
  const chart=[
    '| Affinity ID | Domain | Assigned | Strong Against | Resisted By |',
    '| --- | --- | --- | --- | --- |',
    '| `ALPHA` | A | A | `BETA`, `ALPHA` | `ALPHA` |',
    '| `BETA` | B | B | `ALPHA` | - |'
  ].join('\n');
  const result=checkBattleChart(chart,checkCanonical(plan,types));
  assert.ok(result.errors.includes('Nonreciprocal matchup: ALPHA strong against BETA but BETA does not list ALPHA under Resisted By'));
  assert.ok(result.errors.includes('Self-advantage ALPHA needs a move-specific exception, not a blanket affinity multiplier'));
});
test('accepts a fully reciprocal two-group chart without type mistakes',()=>{
  const chart=[
    '| Affinity ID | Domain | Assigned | Strong Against | Resisted By |',
    '| --- | --- | --- | --- | --- |',
    '| `ALPHA` | A | A | `BETA` | - |',
    '| `BETA` | B | B | - | `ALPHA` |'
  ].join('\n');
  assert.deepEqual(checkBattleChart(chart,checkCanonical(plan,types)).errors,[]);
});
