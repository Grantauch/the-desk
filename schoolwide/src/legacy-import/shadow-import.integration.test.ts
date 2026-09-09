import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { buildApp } from '../app.js';
import { AuthenticationError, type StaffIdentityProvider, type VerifiedStaffIdentity } from '../auth/types.js';
import type { AppConfig } from '../config.js';
import type { QueryExecutor, TransactionalDatabase } from '../db/database.js';
import { seedHallPassFixture } from '../hall-pass/test-fixtures.js';
import { legacySurfaceNames, type LegacySurfaceName } from './types.js';

const databaseUrl=process.env.DATABASE_URL;
const adminId='00000000-0000-0000-0000-000000000562';
const config:AppConfig={nodeEnv:'test',host:'127.0.0.1',port:8787,logLevel:'silent',databaseUrl:'postgresql://fixture.invalid/schoolwide',dbPoolMax:2,instanceId:'sw150-shadow-test',legacyReadAdapterMode:'disabled',legacyProductionWrites:'forbidden'};

class SavepointDatabase implements TransactionalDatabase{
  readonly #client:PoolClient;#counter=0;
  constructor(client:PoolClient){this.#client=client;}
  async query<T extends QueryResultRow=QueryResultRow>(sql:string,parameters:readonly unknown[]=[]):Promise<readonly T[]>{return(await this.#client.query<T>(sql,[...parameters])).rows;}
  async transaction<T>(work:(transaction:QueryExecutor)=>Promise<T>):Promise<T>{const sp=`sw150_tx_${++this.#counter}`;await this.#client.query(`SAVEPOINT ${sp}`);try{const result=await work(this);await this.#client.query(`RELEASE SAVEPOINT ${sp}`);return result;}catch(error){await this.#client.query(`ROLLBACK TO SAVEPOINT ${sp}`);await this.#client.query(`RELEASE SAVEPOINT ${sp}`);throw error;}}
  async close():Promise<void>{}
}

class FixtureIdentityProvider implements StaffIdentityProvider{
  async verify(assertion:string):Promise<VerifiedStaffIdentity>{if(assertion==='admin-shadow')return{provider:'SYNTHETIC',subject:'google-sw150-admin'};if(assertion==='teacher-alpha')return{provider:'SYNTHETIC',subject:'google-teacher-alpha'};throw new AuthenticationError('Synthetic identity assertion rejected.');}
}

function emptySurfaces():Record<LegacySurfaceName,Record<string,unknown>[]>{return Object.fromEntries(legacySurfaceNames.map((name)=>[name,[]]))as unknown as Record<LegacySurfaceName,Record<string,unknown>[]>;}
function snapshot():Record<string,unknown>{
  const surfaces=emptySurfaces();
  surfaces.roster.push({studentKey:'sha256-student-a',sectionKey:'P1',active:true,passAccess:'STANDARD'},{studentKey:'sha256-student-a',sectionKey:'P2',active:true,passAccess:'STANDARD'},{studentKey:'sha256-student-b',sectionKey:'P1',active:true,passAccess:'UNLIMITED'});
  surfaces.bellSchedule.push({periodCode:'P1',scheduleKey:'NORMAL',start:'08:00',end:'09:00'});
  surfaces.schoolCalendar.push({date:'2026-09-09',isSchoolDay:true,scheduleKey:'NORMAL'});
  surfaces.settings.push({key:'MAX_ACTIVE_PASSES',value:'2'},{key:'DAILY_PASS_LIMIT',value:'1'});
  surfaces.checkins.push({checkinId:'ci-shadow-1',studentKey:'sha256-student-a',sectionKey:'P1',academicDate:'2026-09-09',status:'PRESENT'});
  surfaces.passLog.push({passId:'pass-shadow-1',studentKey:'sha256-student-a',sectionKey:'P1',status:'RETURNED',countability:'COUNTABLE'},{passId:'pass-shadow-2',studentKey:'sha256-student-b',sectionKey:'P1',status:'OUT',countability:'PROVISIONAL'});
  surfaces.passAudit.push({passId:'pass-shadow-1',studentKey:'sha256-student-a',sectionKey:'P1',status:'RETURNED',countability:'COUNTABLE'});
  surfaces.passQueue.push({requestId:'request-shadow-1',studentKey:'sha256-student-a',sectionKey:'P2',status:'WAITING'});
  surfaces.teacherActions.push({actionId:'action-shadow-1',studentKey:'sha256-student-b',sectionKey:'P1',actionType:'VOID_COUNTABILITY'});
  surfaces.credentialCoverage.push({studentKey:'sha256-student-a',hasCredential:true,algorithm:'LEGACY_GD_SHA256_V1',credentialVersion:1},{studentKey:'sha256-student-b',hasCredential:true,algorithm:'LEGACY_GD_SHA256_V1',credentialVersion:1});
  return{metadata:{sourceAlias:'approved-shadow-v18',schemaVersion:'2026-09-05-session-a',exportedAt:'2026-09-09T12:00:00.000Z',highWaterMark:'approved-shadow-hwm'},surfaces};
}

async function signIn(app:ReturnType<typeof buildApp>,assertion:string):Promise<string>{const response=await app.inject({method:'POST',url:'/auth/session',payload:{assertion}});assert.equal(response.statusCode,201,response.body);return response.json<{token:string}>().token;}
function auth(token:string):Record<string,string>{return{authorization:`Bearer ${token}`,'content-type':'application/json'};}
async function counts(client:PoolClient,tables:readonly string[]):Promise<Record<string,number>>{const result:Record<string,number>={};for(const table of tables){const rows=await client.query<{count:string}>(`SELECT count(*)::text AS count FROM ${table}`);result[table]=Number(rows.rows[0]?.count??0);}return result;}

if(!databaseUrl){test('SW-150 shadow migration tests require DATABASE_URL',{skip:true},()=>{});}else test('SW-150 Shadow Migration/Parity',async(t)=>{
  const pool=new Pool({connectionString:databaseUrl,max:1});const client=await pool.connect();await client.query('BEGIN');
  try{
    const fixture=await seedHallPassFixture(client);
    await client.query(`INSERT INTO users (id,organization_id,primary_email,display_name,google_subject_id) VALUES ($1,$2,'sw150-admin@north.example.invalid','SW150 Admin','google-sw150-admin')`,[adminId,fixture.orgA]);
    await client.query(`INSERT INTO staff_profiles (user_id,organization_id,title) VALUES ($1,$2,'Administrator')`,[adminId,fixture.orgA]);
    await client.query(`INSERT INTO user_roles (organization_id,school_id,user_id,role) VALUES ($1,$2,$3,'ADMIN')`,[fixture.orgA,fixture.schoolA,adminId]);
    const db=new SavepointDatabase(client),app=buildApp({config,database:db,identityProvider:new FixtureIdentityProvider()});await app.ready();
    const adminToken=await signIn(app,'admin-shadow'),teacherToken=await signIn(app,'teacher-alpha');
    const operational=['students','enrollments','passes','pass_requests','queue_entries','checkins','audit_events']as const;

    await t.test('Admin-only IMPORT_SHADOW requires exact validated fingerprint',async()=>{
      const source=snapshot();const validation=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/validate',headers:auth(adminToken),payload:{snapshot:source}});assert.equal(validation.statusCode,200,validation.body);const fingerprint=validation.json<{fingerprint:{value:string}}>().fingerprint.value;
      const denied=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/import-shadow',headers:auth(teacherToken),payload:{snapshot:source,sourceFingerprint:fingerprint}});assert.equal(denied.statusCode,403,denied.body);
      const mismatch=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/import-shadow',headers:auth(adminToken),payload:{snapshot:source,sourceFingerprint:'0'.repeat(64)}});assert.equal(mismatch.statusCode,409,mismatch.body);assert.match(mismatch.body,/LEGACY_FINGERPRINT_MISMATCH/);
    });

    await t.test('IMPORT_SHADOW writes isolated parity evidence only and exact source counts reconcile',async()=>{
      const source=snapshot();const validation=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/validate',headers:auth(adminToken),payload:{snapshot:source}});const fingerprint=validation.json<{fingerprint:{value:string}}>().fingerprint.value;const before=await counts(client,operational);
      const imported=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/import-shadow',headers:auth(adminToken),payload:{snapshot:source,sourceFingerprint:fingerprint}});assert.equal(imported.statusCode,200,imported.body);
      const body=imported.json<{importRunId:string;replayed:boolean;shadowRecordCount:number;legacyWrites:number;schoolwideOperationalWrites:number;report:{overallStatus:string;surfaceCounts:Record<string,number>}}>();
      assert.equal(body.replayed,false);assert.equal(body.legacyWrites,0);assert.equal(body.schoolwideOperationalWrites,0);assert.equal(body.report.overallStatus,'PASS');
      const expected=Object.values(body.report.surfaceCounts).reduce((sum,value)=>sum+value,0);assert.equal(body.shadowRecordCount,expected);
      assert.deepEqual(await counts(client,operational),before);
      const parity=await client.query<{discrepancy_count:number;overall_status:string}>(`SELECT discrepancy_count,overall_status FROM migration_shadow_parity_reports WHERE import_run_id=$1`,[body.importRunId]);assert.equal(parity.rows[0]?.discrepancy_count,0);assert.equal(parity.rows[0]?.overall_status,'PASS');
    });

    await t.test('same fingerprint replays one run without duplicate shadow rows',async()=>{
      const source=snapshot();const validation=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/validate',headers:auth(adminToken),payload:{snapshot:source}});const fingerprint=validation.json<{fingerprint:{value:string}}>().fingerprint.value;
      const first=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/import-shadow',headers:auth(adminToken),payload:{snapshot:source,sourceFingerprint:fingerprint}});const firstBody=first.json<{importRunId:string;shadowRecordCount:number}>();
      const second=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/import-shadow',headers:auth(adminToken),payload:{snapshot:source,sourceFingerprint:fingerprint}});assert.equal(second.statusCode,200,second.body);const secondBody=second.json<{importRunId:string;replayed:boolean;shadowRecordCount:number}>();
      assert.equal(secondBody.replayed,true);assert.equal(secondBody.importRunId,firstBody.importRunId);assert.equal(secondBody.shadowRecordCount,firstBody.shadowRecordCount);
      const runs=await client.query<{count:string}>(`SELECT count(*)::text AS count FROM migration_import_runs WHERE school_id=$1 AND source_snapshot_fingerprint=$2 AND mode='IMPORT_SHADOW'`,[fixture.schoolA,fingerprint]);assert.equal(runs.rows[0]?.count,'1');
    });

    await t.test('shadow projection stores identity hashes and excludes names/emails/settings values',async()=>{
      const source=snapshot();const validation=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/validate',headers:auth(adminToken),payload:{snapshot:source}});const fingerprint=validation.json<{fingerprint:{value:string}}>().fingerprint.value;const imported=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/import-shadow',headers:auth(adminToken),payload:{snapshot:source,sourceFingerprint:fingerprint}});const runId=imported.json<{importRunId:string}>().importRunId;
      const rows=await client.query<{identity_key_hash:string|null;state_json:Record<string,unknown>}>(`SELECT identity_key_hash,state_json FROM migration_shadow_records WHERE import_run_id=$1 ORDER BY source_surface,source_ordinal`,[runId]);
      assert.ok(rows.some((row)=>typeof row.identity_key_hash==='string'&&/^[0-9a-f]{64}$/.test(row.identity_key_hash)));
      const serialized=JSON.stringify(rows);assert.doesNotMatch(serialized,/example\.invalid|Synthetic Learner|studentEmail|displayName|PIN Hash|PIN_SALT/i);
      const settings=rows.map((row)=>row.state_json).filter((state)=>Object.hasOwn(state,'valueHash'));assert.ok(settings.length>0);assert.ok(settings.every((state)=>typeof state.valueHash==='string'&&/^[0-9a-f]{64}$/.test(String(state.valueHash))));
    });

    await app.close();
  }finally{await client.query('ROLLBACK');client.release();await pool.end();}
});
