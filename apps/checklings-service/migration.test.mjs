import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {migrate,readiness} from './database.mjs';
import {createGameStore} from './store.mjs';
import {createAuthService} from './auth.mjs';

test('upgrade applied schema 1 without changing existing pets, receipts or history',async()=>{
  const db=await PGlite.create();
  const database={transaction:work=>db.transaction(work)};
  try {
    // Construct the committed Batch 02 schema, before migration 002 existed.
    const sql=await readFile(new URL('./migrations/001-foundation.sql',import.meta.url),'utf8');
    await db.exec(sql);
    await db.exec('CREATE TABLE ck_schema_migrations (version integer PRIMARY KEY,checksum text NOT NULL)');
    await db.query('INSERT INTO ck_schema_migrations VALUES (1,$1)',[createHash('sha256').update(sql).digest('hex')]);
    const actor={tenantId:'synthetic_tenant',memberId:'synthetic_member',classId:'synthetic_class',authEpoch:0};
    await db.query('INSERT INTO ck_memberships (tenant_id,member_id,class_id,active) VALUES ($1,$2,$3,true)',[actor.tenantId,actor.memberId,actor.classId]);
    const store=createGameStore({database,authorize:async()=>actor,migrationKey:'synthetic-only-migration-key-at-least-32-characters'});
    const original=await store.importLegacy('synthetic','import',{raw:JSON.stringify({v:1,species:'zee',name:'Keep me',habitat:'sky'}),officialBestStreak:14,importedAt:'2026-10-23T16:00:00.000Z'});
    const before={};
    for(const table of ['ck_memberships','ck_creatures','ck_events','ck_command_receipts'])before[table]=(await db.query(`SELECT * FROM ${table}`)).rows;
    assert.deepEqual(await readiness(database),{ready:false,schemaVersion:1});
    assert.deepEqual(await migrate(database),{applied:true,version:2});
    assert.deepEqual(await migrate(database),{applied:false,version:2});
    for(const table of Object.keys(before))assert.deepEqual((await db.query(`SELECT * FROM ${table}`)).rows,before[table]);
    assert.deepEqual(await store.load('synthetic',original.creature.id),original.creature);
    assert.deepEqual(await readiness(database),{ready:true,schemaVersion:2});
    // Exercise the production database clock path, rather than only injected clocks.
    const auth=createAuthService({database,...actor,issuer:'synthetic_school',audience:'synthetic_game',assertionKey:randomBytes(32),flowKey:randomBytes(32)});
    const start=Date.now();const launch=await auth.beginLaunch();
    const ticket=JSON.parse(Buffer.from(launch.ticket.split('.')[0],'base64url'));
    assert.ok(ticket.iat*1000>=start-1000 && ticket.iat*1000<=Date.now());
    // A valid latest checksum must not conceal drift in an older migration.
    await db.query("UPDATE ck_schema_migrations SET checksum='synthetic-drift' WHERE version=1");
    assert.equal((await readiness(database)).ready,false);
    await assert.rejects(migrate(database),/checksum mismatch/);
  } finally {await db.close();}
});
