import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {migrate,readiness} from './database.mjs';
import {createGameStore} from './store.mjs';
const key='synthetic-only-migration-key-at-least-32-characters';
const exported={raw:JSON.stringify({v:1,species:'bolt',name:'Old friend',habitat:'sky'}),officialBestStreak:14,importedAt:'2026-10-23T16:00:00.000Z'};

/** The same assertions run on embedded SQL and optional independent PG clients. */
export async function storageContract(t,database) {
  async function fixture() {
    const tenantId='test_'+randomUUID().replaceAll('-','');
    const actors={a:{tenantId,memberId:'member_a',classId:'class_a',authEpoch:0},b:{tenantId,memberId:'member_b',classId:'class_a',authEpoch:0},foreign:{tenantId:'another_'+tenantId,memberId:'member_a',classId:'class_a',authEpoch:0}};
    await database.transaction(async c=>{
      for(const a of Object.values(actors)) await c.query('INSERT INTO ck_memberships (tenant_id,member_id,class_id,active) VALUES ($1,$2,$3,true)',[a.tenantId,a.memberId,a.classId]);
    });
    const authorize=async token=>actors[token];
    return {actors,authorize,store:createGameStore({database,authorize,migrationKey:key}),
      count:async table=>(await database.transaction(c=>c.query(`SELECT count(*)::int AS n FROM ${table} WHERE tenant_id=$1`,[tenantId]))).rows[0].n};
  }
  await t.test('migration is repeatable and readiness fails closed before schema',async()=>{
    assert.equal((await readiness(database)).ready,false);
    assert.deepEqual(await migrate(database),{applied:true,version:3});
    assert.deepEqual(await migrate(database),{applied:false,version:3});
    assert.equal((await readiness(database)).ready,true);
  });
  await t.test('import preserves founder, name, earned sky home and unlocks across service instances',async()=>{
    const f=await fixture(); const r=await f.store.importLegacy('a','import',exported);
    assert.equal(r.creature.speciesId,'bolt'); assert.equal(r.creature.nickname,'Old friend');
    assert.equal(r.creature.habitatId,'sky'); assert.deepEqual(r.creature.legacy.unlockedHabitatIds,['meadow','grove','cove','sky']);
    const second=createGameStore({database,authorize:f.authorize,migrationKey:key});
    assert.deepEqual(await second.load('a',r.creature.id),r.creature);
    assert.equal(await f.count('ck_events'),1);
  });
  await t.test('35 repeated deliveries converge on one creature, receipt and event',async()=>{
    const f=await fixture(); const results=await Promise.all(Array.from({length:35},()=>f.store.importLegacy('a','same-command',exported)));
    results.forEach(r=>assert.deepEqual(r,results[0]));
    for(const table of ['ck_creatures','ck_command_receipts','ck_events']) assert.equal(await f.count(table),1);
  });
  await t.test('reusing an idempotency key with a changed payload fails without a write',async()=>{
    const f=await fixture();await f.store.importLegacy('a','import',exported);
    await assert.rejects(f.store.importLegacy('a','import',{...exported,officialBestStreak:30}),/different payload/);
    assert.equal(await f.count('ck_events'),1);
  });
  await t.test('another import command never resets a renamed individual',async()=>{
    const f=await fixture();const r=await f.store.importLegacy('a','import',exported);
    await f.store.rename('a','rename',{creatureId:r.creature.id,expectedRevision:0,nickname:'Later friend'});
    const again=await f.store.importLegacy('a','import-again',exported);
    assert.equal(again.creature.nickname,'Later friend');assert.equal(again.creature.revision,1);
    assert.equal(await f.count('ck_creatures'),1);assert.equal(await f.count('ck_events'),2);
  });
  await t.test('a changed migration key cannot create a second founder for an existing owner',async()=>{
    const f=await fixture();await f.store.importLegacy('a','import',exported);
    const changed=createGameStore({database,authorize:f.authorize,migrationKey:'another-synthetic-only-key-at-least-32-characters'});
    await assert.rejects(changed.importLegacy('a','rotated',exported),/review/);
    assert.equal(await f.count('ck_creatures'),1);assert.equal(await f.count('ck_events'),1);
  });
  await t.test('changed legacy source is quarantined rather than overwriting imported state',async()=>{
    const f=await fixture();await f.store.importLegacy('a','import',exported);
    await assert.rejects(f.store.importLegacy('a','changed',{...exported,raw:exported.raw.replace('Old friend','Changed')}),/review/);
    assert.equal(await f.count('ck_events'),1);
  });
  await t.test('missing preferences stay unadopted but missing source after import requires review',async()=>{
    const f=await fixture();
    assert.deepEqual(await f.store.importLegacy('a','empty',{...exported,raw:null}),{status:'no-pet'});
    assert.equal(await f.count('ck_creatures'),0);
    await f.store.importLegacy('a','import',exported);
    await assert.rejects(f.store.importLegacy('a','lost-source',{...exported,raw:null}),/review/);
    assert.equal(await f.count('ck_creatures'),1);
  });
  await t.test('member, tenant, class, inactive account and auth epoch boundaries are enforced',async()=>{
    const f=await fixture();const r=await f.store.importLegacy('a','import',exported);
    assert.equal(await f.store.load('b',r.creature.id),null);assert.equal(await f.store.load('foreign',r.creature.id),null);
    await assert.rejects(f.store.load('unknown',r.creature.id),/Unauthorized/);
    await assert.rejects(f.store.rename('b','rename',{creatureId:r.creature.id,expectedRevision:0,nickname:'Stolen'}),/unavailable/);
    f.actors.a.classId='wrong_class';await assert.rejects(f.store.load('a',r.creature.id),/Unauthorized/);f.actors.a.classId='class_a';
    f.actors.a.authEpoch=1;await assert.rejects(f.store.load('a',r.creature.id),/Unauthorized/);f.actors.a.authEpoch=0;
    await database.transaction(c=>c.query('UPDATE ck_memberships SET active=false WHERE tenant_id=$1 AND member_id=$2',[f.actors.a.tenantId,'member_a']));
    await assert.rejects(f.store.load('a',r.creature.id),/Unauthorized/);
  });
  await t.test('35 competing writes at one revision produce exactly one successful change',async()=>{
    const f=await fixture();const r=await f.store.importLegacy('a','import',exported);
    const results=await Promise.allSettled(Array.from({length:35},(_,i)=>f.store.rename('a','rename_'+i,{creatureId:r.creature.id,expectedRevision:0,nickname:'Name '+i})));
    assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
    assert.ok(results.filter(x=>x.status==='rejected').every(x=>/Stale/.test(x.reason.message)));
    assert.equal((await f.store.load('a',r.creature.id)).revision,1);
    assert.equal(await f.count('ck_events'),2);assert.equal(await f.count('ck_command_receipts'),2);
  });
  await t.test('failure after creature update but before journal rolls back every change',async()=>{
    const f=await fixture();const r=await f.store.importLegacy('a','import',exported);
    const broken={transaction:work=>database.transaction(c=>work({query:(sql,args)=>{if(sql.includes('INSERT INTO ck_events'))throw new Error('synthetic failure');return c.query(sql,args);}}))};
    const store=createGameStore({database:broken,authorize:f.authorize,migrationKey:key});
    await assert.rejects(store.rename('a','bad-rename',{creatureId:r.creature.id,expectedRevision:0,nickname:'Not committed'}),/synthetic failure/);
    assert.deepEqual(await f.store.load('a',r.creature.id),r.creature);
    assert.equal(await f.count('ck_events'),1);assert.equal(await f.count('ck_command_receipts'),1);
  });
  await t.test('lost acknowledgement after commit returns the stored response on retry',async()=>{
    const f=await fixture();let lose=true;
    const flaky={transaction:async work=>{const result=await database.transaction(work);if(lose){lose=false;throw new Error('synthetic lost acknowledgement');}return result;}};
    const store=createGameStore({database:flaky,authorize:f.authorize,migrationKey:key});
    await assert.rejects(store.importLegacy('a','import',exported),/acknowledgement/);
    assert.equal((await store.importLegacy('a','import',exported)).status,'imported');
    assert.equal(await f.count('ck_creatures'),1);assert.equal(await f.count('ck_events'),1);
  });
  await t.test('dead individuals remain dead across reimport and cannot be renamed',async()=>{
    const f=await fixture();const r=await f.store.importLegacy('a','import',exported);
    // Direct synthetic fixture injection; no gameplay death/repair API is exposed.
    const dead={...r.creature,lifecycle:'dead'};
    await database.transaction(c=>c.query("UPDATE ck_creatures SET lifecycle='dead',state=$1 WHERE tenant_id=$2 AND creature_id=$3",[JSON.stringify(dead),f.actors.a.tenantId,dead.id]));
    assert.equal((await f.store.importLegacy('a','again',exported)).creature.lifecycle,'dead');
    await assert.rejects(f.store.rename('a','rename',{creatureId:dead.id,expectedRevision:0,nickname:'Returned'}),/unavailable/);
  });
  await t.test('unlogged journal writes and state/revision drift fail database constraints',async()=>{
    const f=await fixture();const r=await f.store.importLegacy('a','import',exported);
    await assert.rejects(database.transaction(c=>c.query('UPDATE ck_creatures SET revision=99 WHERE tenant_id=$1',[f.actors.a.tenantId])),/constraint/);
    await assert.rejects(database.transaction(c=>c.query(`INSERT INTO ck_events (event_id,tenant_id,member_id,command_id,creature_id,next_revision,kind,rules_version,details)
      VALUES ($1,$2,'member_a','missing-receipt',$3,55,'unlogged','test','{}')`,[randomUUID(),f.actors.a.tenantId,r.creature.id])),/foreign key/);
  });
  await t.test('event history and command receipts cannot be rewritten or deleted',async()=>{
    const f=await fixture();await f.store.importLegacy('a','import',exported);
    for(const table of ['ck_events','ck_command_receipts']) await assert.rejects(database.transaction(c=>c.query(`DELETE FROM ${table} WHERE tenant_id=$1`,[f.actors.a.tenantId])),/append-only/);
    await assert.rejects(database.transaction(c=>c.query("UPDATE ck_events SET kind='rewritten' WHERE tenant_id=$1",[f.actors.a.tenantId])),/append-only/);
    await assert.rejects(database.transaction(c=>c.query('TRUNCATE ck_events')),/append-only/);
  });
  await t.test('malformed input and extra client state are rejected, not persisted',async()=>{
    const f=await fixture();const r=await f.store.importLegacy('a','import',exported);
    for(const extra of [{nickname:''},{nickname:'x'.repeat(19)},{nickname:'bad\u0000name'},{expectedRevision:-1},{weight:999},{lifecycle:'dead'}])
      await assert.rejects(f.store.rename('a','bad',{creatureId:r.creature.id,expectedRevision:0,nickname:'Valid',...extra}),/Invalid/);
    assert.equal(await f.count('ck_events'),1);
  });
  await t.test('migration checksum drift fails closed',async()=>{
    const {rows}=await database.transaction(c=>c.query('SELECT checksum FROM ck_schema_migrations WHERE version=1'));
    try {
      await database.transaction(c=>c.query("UPDATE ck_schema_migrations SET checksum='synthetic-drift' WHERE version=1"));
      await assert.rejects(migrate(database),/checksum mismatch/);
      assert.equal((await readiness(database)).ready,false);
    } finally {await database.transaction(c=>c.query('UPDATE ck_schema_migrations SET checksum=$1 WHERE version=1',[rows[0].checksum]));}
  });
}
