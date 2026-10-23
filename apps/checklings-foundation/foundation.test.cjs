'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {planLegacyImport, mayCommitDeath, FOUNDERS, HOMES, MILESTONES} = require('./migration.cjs');
const {classroom, PEOPLE} = require('../../scripts/lib/hall-pass-fixtures.cjs');
const catalog = require('./species-plan.json');
const base = {tenantId:'synthetic-school', membershipId:'opaque-synthetic-membership', migrationKey:'synthetic-only-key-with-at-least-32-bytes', importedAt:'2026-10-23T15:00:00.000Z', officialBestStreak:30};
const raw = (species='bolt', habitat='sky') => JSON.stringify({v:1,species,name:'Original friend',habitat});
const plan = (overrides={}) => planLegacyImport({...base, raw:raw(), ...overrides});

test('all four founders and all five earned homes survive import exactly', () => {
  for (const species of FOUNDERS) for (const habitat of HOMES) {
    const p = plan({raw:raw(species,habitat)});
    assert.equal(p.status,'ready'); assert.equal(p.creature.speciesId,species);
    assert.equal(p.creature.nickname,'Original friend'); assert.equal(p.creature.habitatId,habitat);
    assert.equal(p.creature.bornAt,null,'Unknown adoption dates must not be invented');
    assert.equal(p.creature.lifecycle,'alive'); assert.deepEqual(p.creature.legacy.unlockedHabitatIds,HOMES);
  }
});
test('older three-field preferences migrate with a meadow and unchanged name', () => {
  const p=plan({raw:JSON.stringify({v:1,species:'mochi',name:'Original'})});
  assert.equal(p.creature.habitatId,'meadow'); assert.equal(p.creature.nickname,'Original');
});
test('sky remains sky; prototype cloud is never silently treated as an earned home', () => {
  assert.equal(plan().creature.habitatId,'sky');
  const p=plan({raw:raw('bolt','cloud')});
  assert.equal(p.creature.habitatId,'meadow'); assert.equal(p.creature.legacy.originalHabitat,'cloud');
  assert.equal(p.warnings.length,1);
});
test('unlocks follow every official milestone and cannot be supplied by pet JSON', () => {
  for (let i=0;i<HOMES.length;i++) {
    const p=plan({officialBestStreak:MILESTONES[i]});
    assert.deepEqual(p.creature.legacy.unlockedHabitatIds,HOMES.slice(0,i+1));
  }
  const p=plan({officialBestStreak:0,raw:JSON.stringify({v:1,species:'zee',name:'Comet',habitat:'cosmos',bestStreak:999})});
  assert.equal(p.creature.habitatId,'meadow'); assert.equal(p.creature.legacy.officialBestStreakAtImport,0);
});
test('no adopted pet stays unadopted', () => assert.deepEqual(plan({raw:null}),{status:'no-pet'}));
test('damaged, unknown-version and invalid species records require review, never replacement', () => {
  for (const value of ['{broken','null','{}',JSON.stringify({v:2,species:'bolt',name:'Old'}),JSON.stringify({v:1,species:'unknown',name:'Old'})])
    assert.equal(plan({raw:value}).status,'review');
});
test('18 UTF-16 code unit legacy names preserve their exact stored spelling', () => {
  for (const name of ['W'.repeat(18),'  My Friend  ','🌟'.repeat(9)]) {
    assert.equal(plan({raw:JSON.stringify({v:1,species:'zee',name})}).creature.nickname,name);
  }
  assert.equal(plan({raw:JSON.stringify({v:1,species:'zee',name:'W'.repeat(19)})}).status,'review');
});
test('retries never overwrite progress or resurrect a dead imported individual', () => {
  const first=plan().creature;
  first.lifecycle='dead'; first.revision=27; first.nickname='Later name';
  const before=JSON.stringify(first);
  assert.deepEqual(plan({existing:first}),{status:'already-imported',creatureId:first.id});
  assert.equal(JSON.stringify(first),before);
});
test('legacy writes after export and conflicting destination records block cutover', () => {
  const first=plan().creature;
  assert.equal(plan({existing:first,raw:raw('ember')}).reason,'import-conflict');
  assert.equal(plan({existing:{...first,id:'different'}}).reason,'import-conflict');
  assert.equal(plan({existing:first,raw:null}).reason,'source-missing-after-import');
});
test('class memberships and tenants never collapse even when PIN identity is shared', () => {
  const ids=[plan().creature.id,plan({membershipId:'another-class'}).creature.id,plan({tenantId:'another-school'}).creature.id];
  assert.equal(new Set(ids).size,3);
  assert.ok(ids.every(id=>!id.includes(base.membershipId)));
});
test('server context and private migration key are required', () => {
  for (const patch of [{officialBestStreak:-1},{officialBestStreak:'30'},{membershipId:''},{migrationKey:'weak'},{importedAt:'not-a-date'}])
    assert.throws(()=>plan(patch));
});
test('migration consumes actual synthetic Apps Script preferences without changing classroom facts', () => {
  const c=classroom({now:new Date('2026-09-10T11:30:00Z')});
  c.harness.signInAs(PEOPLE.ada.email);
  const visit=c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.ada),'migration-demo');
  const saved=c.harness.call('saveCheckling',visit.pinToken,'ember','AdaFriend','meadow');
  const key=`checkling-v1:${saved.student.key}`;
  const persisted=c.harness.properties.getProperty(key);
  const before=JSON.stringify([c.checkIns(),c.passLog(),persisted]);
  const p=plan({membershipId:saved.student.key,raw:persisted,officialBestStreak:saved.checkling.bestStreak});
  assert.equal(p.status,'ready'); assert.equal(p.creature.nickname,saved.checkling.pet.name);
  c.harness.newRequest();
  const reloaded=c.harness.call('identifyChecklingWithPin',c.pin(PEOPLE.ada),'second-device');
  assert.deepEqual(JSON.parse(JSON.stringify(reloaded.checkling.pet)),{species:'ember',name:'AdaFriend',habitat:'meadow'});
  assert.equal(JSON.stringify([c.checkIns(),c.passLog(),c.harness.properties.getProperty(key)]),before);
});
test('offline time, absence, disconnect and ordinary PvP cannot authorize death', () => {
  for (const trigger of ['offline','absence','disconnect','class-pvp','client-claim'])
    assert.equal(mayCommitDeath({lifecycle:'critical',trigger,enabled:true,warningDelivered:true,serverEvidence:true,rescueExhausted:true,activeCareOpportunity:true,riskConsent:true}),false);
});
const danger={lifecycle:'critical',trigger:'active-neglect',enabled:true,warningDelivered:true,serverEvidence:true,rescueExhausted:true,activeCareOpportunity:true};
test('active neglect requires a delivered warning, available rescue and server evidence', () => {
  assert.equal(mayCommitDeath(danger),true);
  for (const patch of [{warningDelivered:false},{serverEvidence:false},{rescueExhausted:false},{activeCareOpportunity:false},{enabled:false},{lifecycle:'dead'}])
    assert.equal(mayCommitDeath({...danger,...patch}),false);
});
test('lethal expedition requires specific consent and an available intervention', () => {
  assert.equal(mayCommitDeath({...danger,trigger:'lethal-expedition'}),false);
  assert.equal(mayCommitDeath({...danger,trigger:'lethal-expedition',riskConsent:true}),true);
  assert.equal(mayCommitDeath({...danger,trigger:'lethal-expedition',riskConsent:true,activeCareOpportunity:false}),false);
});
test('twelve distinct design entries cover twelve ecosystems and preserve four founder IDs', () => {
  assert.equal(catalog.status,'design-only-not-playable'); assert.equal(catalog.slice.length,12);
  for (const field of ['id','name','body','battleHook','keeperHook']) assert.equal(new Set(catalog.slice.map(s=>s[field])).size,12);
  assert.equal(new Set(catalog.slice.map(s=>s.ecosystem)).size,12);
  assert.deepEqual(catalog.slice.filter(s=>s.founder).map(s=>s.id).sort(),[...FOUNDERS].sort());
  assert.equal(catalog.ecosystems.length*catalog.baseSpeciesPerEcosystem,300);
  assert.ok(catalog.slice.every(s=>s.personality&&s.carePreference&&s.artStatus));
});
