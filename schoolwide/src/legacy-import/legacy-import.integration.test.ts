import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { buildApp } from '../app.js';
import { AuthenticationError, type StaffIdentityProvider, type VerifiedStaffIdentity } from '../auth/types.js';
import type { AppConfig } from '../config.js';
import type { QueryExecutor, TransactionalDatabase } from '../db/database.js';
import { seedHallPassFixture } from '../hall-pass/test-fixtures.js';
import { LegacyReadOnlyImporterService } from './service.js';
import { LegacyImportError, legacySurfaceNames, type LegacySurfaceName } from './types.js';

const databaseUrl = process.env.DATABASE_URL;
const adminId = '00000000-0000-0000-0000-000000000461';

const config: AppConfig = {
  nodeEnv:'test',host:'127.0.0.1',port:8787,logLevel:'silent',
  databaseUrl:'postgresql://fixture.invalid/schoolwide',dbPoolMax:2,
  instanceId:'legacy-import-test',legacyReadAdapterMode:'disabled',legacyProductionWrites:'forbidden',
};

class SavepointDatabase implements TransactionalDatabase {
  readonly #client:PoolClient; #counter=0;
  constructor(client:PoolClient){this.#client=client;}
  async query<T extends QueryResultRow=QueryResultRow>(sql:string,parameters:readonly unknown[]=[]):Promise<readonly T[]>{return (await this.#client.query<T>(sql,[...parameters])).rows;}
  async transaction<T>(work:(transaction:QueryExecutor)=>Promise<T>):Promise<T>{const sp=`sw140_tx_${++this.#counter}`;await this.#client.query(`SAVEPOINT ${sp}`);try{const result=await work(this);await this.#client.query(`RELEASE SAVEPOINT ${sp}`);return result;}catch(error){await this.#client.query(`ROLLBACK TO SAVEPOINT ${sp}`);await this.#client.query(`RELEASE SAVEPOINT ${sp}`);throw error;}}
  async close():Promise<void>{}
}

class FixtureIdentityProvider implements StaffIdentityProvider {
  async verify(assertion:string):Promise<VerifiedStaffIdentity>{
    if(assertion==='admin-north')return{provider:'SYNTHETIC',subject:'google-sw140-admin'};
    if(assertion==='teacher-alpha')return{provider:'SYNTHETIC',subject:'google-teacher-alpha'};
    throw new AuthenticationError('Synthetic identity assertion rejected.');
  }
}

function emptySurfaces():Record<LegacySurfaceName,Record<string,unknown>[]> {
  return Object.fromEntries(legacySurfaceNames.map((name)=>[name,[]])) as unknown as Record<LegacySurfaceName,Record<string,unknown>[]>;
}

function validSnapshot():Record<string,unknown>{
  const surfaces=emptySurfaces();
  surfaces.roster.push(
    {studentKey:'student-a',sectionKey:'section-1',displayName:'Synthetic Learner A',email:'learner-a@example.invalid'},
    {studentKey:'student-a',sectionKey:'section-2',displayName:'Synthetic Learner A',email:'learner-a@example.invalid'},
    {studentKey:'student-b',sectionKey:'section-1',displayName:'Synthetic Learner B',email:'learner-b@example.invalid'},
  );
  surfaces.bellSchedule.push({id:'period-1',periodCode:'P1',start:'08:00',end:'09:00'});
  surfaces.schoolCalendar.push({date:'2026-09-08',isSchoolDay:true,scheduleProfile:'NORMAL'});
  surfaces.settings.push({key:'MAX_ACTIVE_PER_SECTION',value:2},{key:'DAILY_LIMIT',value:2});
  surfaces.checkins.push({checkinId:'ci-1',studentKey:'student-a',sectionKey:'section-1',academicDate:'2026-09-08',status:'PRESENT',timestamp:'2026-09-08T12:00:00.000Z'});
  surfaces.passLog.push(
    {passId:'pass-1',studentKey:'student-a',sectionKey:'section-1',status:'RETURNED',countability:'COUNTABLE',startedAt:'2026-09-08T13:00:00.000Z',returnedAt:'2026-09-08T13:05:00.000Z'},
    {passId:'pass-2',studentKey:'student-b',sectionKey:'section-1',status:'OUT',countability:'PROVISIONAL',startedAt:'2026-09-08T13:10:00.000Z'},
  );
  surfaces.passAudit.push({passId:'pass-1',studentKey:'student-a',sectionKey:'section-1',status:'RETURNED',countability:'COUNTABLE',event:'RETURN'});
  surfaces.passQueue.push({requestId:'request-1',studentKey:'student-a',sectionKey:'section-2',status:'WAITING',requestedAt:'2026-09-08T13:12:00.000Z'});
  surfaces.teacherActions.push({actionId:'action-1',studentKey:'student-b',sectionKey:'section-1',actionType:'VOID_COUNTABILITY',occurredAt:'2026-09-08T13:15:00.000Z'});
  surfaces.credentialCoverage.push({studentKey:'student-a',hasCredential:true,algorithm:'LEGACY_GD_SHA256_V1',credentialVersion:1},{studentKey:'student-b',hasCredential:true,algorithm:'LEGACY_GD_SHA256_V1',credentialVersion:1});
  return {metadata:{sourceAlias:'synthetic-v18-fixture',schemaVersion:'2026-09-05-session-a',exportedAt:'2026-09-08T20:00:00.000Z',highWaterMark:'synthetic-row-42'},surfaces};
}

async function signIn(app:ReturnType<typeof buildApp>,assertion:string):Promise<string>{const response=await app.inject({method:'POST',url:'/auth/session',payload:{assertion}});assert.equal(response.statusCode,201,response.body);return response.json<{token:string}>().token;}
function auth(token:string):Record<string,string>{return{authorization:`Bearer ${token}`,'content-type':'application/json'};}

async function stateCounts(client:PoolClient):Promise<Record<string,number>>{
  const tables=['students','enrollments','passes','pass_requests','queue_entries','checkins','audit_events','migration_import_runs','legacy_id_mappings','migration_reconciliation_findings'];
  const result:Record<string,number>={};
  for(const table of tables){const row=await client.query<{count:string}>(`SELECT count(*) AS count FROM ${table}`);result[table]=Number(row.rows[0]?.count??0);}
  return result;
}

if(!databaseUrl){test('SW-140 legacy importer integration tests require DATABASE_URL',{skip:true},()=>{});}else test('SW-140 legacy read-only importer',async(t)=>{
  const importer=new LegacyReadOnlyImporterService();

  await t.test('T-MIG-001/002 VALIDATE is deterministic and reports zero writes',()=>{
    const first=importer.validate(validSnapshot()),second=importer.validate(validSnapshot());
    assert.equal(first.fingerprint.value,second.fingerprint.value);
    assert.match(first.fingerprint.value,/^[0-9a-f]{64}$/);
    assert.equal(first.legacyWrites,0);assert.equal(first.schoolwideOperationalWrites,0);
    assert.equal(first.report.overallStatus,'PASS');assert.equal(first.report.uniqueStudents,2);assert.equal(first.report.memberships,3);
    assert.deepEqual(first.report.rosterBySection,{'section-1':2,'section-2':1});assert.equal(first.report.credentialCoverageCount,2);
  });

  await t.test('T-MIG-003/004 Pass Audit dedupes against Pass Log while stable IDs remain in the plan',()=>{
    const validate=importer.validate(validSnapshot());
    assert.equal(validate.report.passesByClassStatusCountability['section-1|RETURNED|COUNTABLE'],1);
    assert.equal(validate.report.activePassCount,1);assert.equal(validate.report.queuedRequestCount,1);
    const plan=importer.dryRun(validSnapshot());
    assert.equal(plan.proposedMappings.filter((mapping)=>mapping.legacyEntityType==='PASS'&&mapping.legacyIdOrKey==='pass-1').length,1);
    assert.ok(plan.proposedMappings.some((mapping)=>mapping.legacyEntityType==='CHECKIN'&&mapping.legacyIdOrKey==='ci-1'));
    assert.equal(plan.proposedOperationalWrites,0);assert.equal(plan.legacyWrites,0);
  });

  await t.test('T-MIG-005 exported Settings are mandatory and code defaults are never substituted',()=>{
    const snapshot=validSnapshot();const surfaces=(snapshot.surfaces as Record<LegacySurfaceName,Record<string,unknown>[]>);surfaces.settings=[];
    const result=importer.validate(snapshot);assert.equal(result.report.settingsPresent,false);assert.equal(result.report.overallStatus,'FAIL');
    assert.ok(result.report.findings.some((finding)=>finding.invariant==='T-MIG-005'&&finding.status==='FAIL'));
  });

  await t.test('T-MIG-006/010 ambiguous identity fails reconciliation instead of name-only guessing',()=>{
    const snapshot=validSnapshot();const surfaces=(snapshot.surfaces as Record<LegacySurfaceName,Record<string,unknown>[]>);surfaces.roster.push({sectionKey:'section-1',displayName:'Synthetic Learner A'});
    const result=importer.dryRun(snapshot);assert.equal(result.report.overallStatus,'FAIL');assert.equal(result.report.ambiguousIdentityCount,1);
    assert.equal(result.proposedMappings.filter((mapping)=>mapping.legacyEntityType==='STUDENT').length,2);
  });

  await t.test('secret PIN/hash/salt/action-proof material is rejected from the general snapshot',()=>{
    for(const forbidden of ['pin','pinSalt','credentialHash','actionProof','accessToken']){
      const snapshot=validSnapshot();const surfaces=(snapshot.surfaces as Record<LegacySurfaceName,Record<string,unknown>[]>);surfaces.roster[0]![forbidden]='synthetic-secret-that-must-not-be-accepted';
      assert.throws(()=>importer.validate(snapshot),(error:unknown)=>error instanceof LegacyImportError&&error.code==='LEGACY_SECRET_MATERIAL_FORBIDDEN');
    }
  });

  await t.test('internal routes require current Admin migration scope + exact validated fingerprint and perform zero data writes',async()=>{
    const pool=new Pool({connectionString:databaseUrl,max:1});const client=await pool.connect();await client.query('BEGIN');
    try{
      const fixture=await seedHallPassFixture(client);
      await client.query(`INSERT INTO users (id,organization_id,primary_email,display_name,google_subject_id) VALUES ($1,$2,'sw140-admin@north.example.invalid','SW140 Admin','google-sw140-admin')`,[adminId,fixture.orgA]);
      await client.query(`INSERT INTO staff_profiles (user_id,organization_id,title) VALUES ($1,$2,'Administrator')`,[adminId,fixture.orgA]);
      await client.query(`INSERT INTO user_roles (organization_id,school_id,user_id,role) VALUES ($1,$2,$3,'ADMIN')`,[fixture.orgA,fixture.schoolA,adminId]);
      const db=new SavepointDatabase(client),app=buildApp({config,database:db,identityProvider:new FixtureIdentityProvider()});await app.ready();
      const adminToken=await signIn(app,'admin-north'),teacherToken=await signIn(app,'teacher-alpha');const before=await stateCounts(client),snapshot=validSnapshot();
      const denied=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/validate',headers:auth(teacherToken),payload:{snapshot}});assert.equal(denied.statusCode,403,denied.body);
      const validated=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/validate',headers:auth(adminToken),payload:{snapshot}});assert.equal(validated.statusCode,200,validated.body);const fingerprint=validated.json<{fingerprint:{value:string}}>().fingerprint.value;
      const mismatch=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/dry-run',headers:auth(adminToken),payload:{snapshot,sourceFingerprint:'0'.repeat(64)}});assert.equal(mismatch.statusCode,409,mismatch.body);assert.match(mismatch.body,/LEGACY_FINGERPRINT_MISMATCH/);
      const dryRun=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/dry-run',headers:auth(adminToken),payload:{snapshot,sourceFingerprint:fingerprint}});assert.equal(dryRun.statusCode,200,dryRun.body);assert.equal(dryRun.json<{legacyWrites:number}>().legacyWrites,0);assert.equal(dryRun.json<{proposedOperationalWrites:number}>().proposedOperationalWrites,0);
      const commit=await app.inject({method:'POST',url:'/api/v1/internal/migration/legacy/commit',headers:auth(adminToken),payload:{snapshot,sourceFingerprint:fingerprint}});assert.equal(commit.statusCode,404,commit.body);
      const after=await stateCounts(client);assert.deepEqual(after,before);
      await app.close();
    }finally{await client.query('ROLLBACK');client.release();await pool.end();}
  });
});
