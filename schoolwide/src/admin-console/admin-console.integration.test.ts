import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { buildApp } from '../app.js';
import { AuthenticationError, type StaffIdentityProvider, type VerifiedStaffIdentity } from '../auth/types.js';
import type { AppConfig } from '../config.js';
import type { QueryExecutor, TransactionalDatabase } from '../db/database.js';
import { seedHallPassFixture, type HallPassFixture } from '../hall-pass/test-fixtures.js';
import { adminConsoleHtml } from './ui.js';

const databaseUrl = process.env.DATABASE_URL;
const NOW = new Date('2026-09-08T16:00:00.000Z');
const adminA = '00000000-0000-0000-0000-000000000361';
const adminB = '00000000-0000-0000-0000-000000000362';
const securityA = '00000000-0000-0000-0000-000000000363';

const config: AppConfig = {
  nodeEnv:'test',host:'127.0.0.1',port:8787,logLevel:'silent',
  databaseUrl:'postgresql://fixture.invalid/schoolwide',dbPoolMax:2,
  instanceId:'admin-console-test',legacyReadAdapterMode:'disabled',legacyProductionWrites:'forbidden',
};

class SavepointDatabase implements TransactionalDatabase {
  readonly #client: PoolClient; #counter=0;
  constructor(client:PoolClient){this.#client=client;}
  async query<T extends QueryResultRow=QueryResultRow>(sql:string,parameters:readonly unknown[]=[]):Promise<readonly T[]>{return (await this.#client.query<T>(sql,[...parameters])).rows;}
  async transaction<T>(work:(transaction:QueryExecutor)=>Promise<T>):Promise<T>{const sp=`sw120_tx_${++this.#counter}`;await this.#client.query(`SAVEPOINT ${sp}`);try{const result=await work(this);await this.#client.query(`RELEASE SAVEPOINT ${sp}`);return result;}catch(error){await this.#client.query(`ROLLBACK TO SAVEPOINT ${sp}`);await this.#client.query(`RELEASE SAVEPOINT ${sp}`);throw error;}}
  async close():Promise<void>{}
}

class FixtureIdentityProvider implements StaffIdentityProvider {
  async verify(assertion:string):Promise<VerifiedStaffIdentity>{
    if(assertion==='admin-north')return{provider:'SYNTHETIC',subject:'google-admin-north'};
    if(assertion==='admin-south')return{provider:'SYNTHETIC',subject:'google-admin-south'};
    if(assertion==='teacher-alpha')return{provider:'SYNTHETIC',subject:'google-teacher-alpha'};
    if(assertion==='security-north')return{provider:'SYNTHETIC',subject:'google-security-admin-test'};
    throw new AuthenticationError('Synthetic identity assertion rejected.');
  }
}

async function seedAdminStaff(client:PoolClient,fixture:HallPassFixture):Promise<{adminRoleA:string;adminRoleB:string}>{
  await client.query(`INSERT INTO users (id,organization_id,primary_email,display_name,google_subject_id) VALUES ($1,$2,'admin@north.example.invalid','Admin North','google-admin-north'),($3,$4,'admin@south.example.invalid','Admin South','google-admin-south'),($5,$2,'security-admin-test@north.example.invalid','Security North','google-security-admin-test')`,[adminA,fixture.orgA,adminB,fixture.orgB,securityA]);
  await client.query(`INSERT INTO staff_profiles (user_id,organization_id,title) VALUES ($1,$2,'Administrator'),($3,$4,'Administrator'),($5,$2,'Security')`,[adminA,fixture.orgA,adminB,fixture.orgB,securityA]);
  const roleA=await client.query<{id:string}>(`INSERT INTO user_roles (organization_id,school_id,user_id,role) VALUES ($1,$2,$3,'ADMIN') RETURNING id`,[fixture.orgA,fixture.schoolA,adminA]);
  const roleB=await client.query<{id:string}>(`INSERT INTO user_roles (organization_id,school_id,user_id,role) VALUES ($1,$2,$3,'ADMIN') RETURNING id`,[fixture.orgB,fixture.schoolB,adminB]);
  await client.query(`INSERT INTO user_roles (organization_id,school_id,user_id,role) VALUES ($1,$2,$3,'SECURITY')`,[fixture.orgA,fixture.schoolA,securityA]);
  await client.query(`INSERT INTO enrollments (school_id,section_id,student_id,source) VALUES ($1,$2,$3,'MANUAL'),($1,$2,$4,'MANUAL') ON CONFLICT DO NOTHING`,[fixture.schoolA,fixture.sectionA1,fixture.studentA,fixture.studentA2]);
  return{adminRoleA:roleA.rows[0]!.id,adminRoleB:roleB.rows[0]!.id};
}

async function signIn(app:ReturnType<typeof buildApp>,assertion:string):Promise<string>{const response=await app.inject({method:'POST',url:'/auth/session',payload:{assertion}});assert.equal(response.statusCode,201,response.body);return response.json<{token:string}>().token;}
function auth(token:string):Record<string,string>{return{authorization:`Bearer ${token}`};}
function mutateHeaders(token:string,key=randomUUID()):Record<string,string>{return{...auth(token),'idempotency-key':key,'content-type':'application/json'};}
async function withSavepoint(client:PoolClient,label:string,work:()=>Promise<void>):Promise<void>{const sp=`sw120_case_${label.replaceAll(/[^a-z0-9]/gi,'_')}`;await client.query(`SAVEPOINT ${sp}`);try{await work();}finally{await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);await client.query(`RELEASE SAVEPOINT ${sp}`);}}

if(!databaseUrl){test('SW-120 Admin Console integration tests require DATABASE_URL',{skip:true},()=>{});}else test('SW-120 Admin Console',async(t)=>{
  const pool=new Pool({connectionString:databaseUrl,max:1});const client=await pool.connect();await client.query('BEGIN');
  try{
    const fixture=await seedHallPassFixture(client);const seeded=await seedAdminStaff(client,fixture);const db=new SavepointDatabase(client);
    const app=buildApp({config,database:db,identityProvider:new FixtureIdentityProvider(),adminConsoleOptions:{now:()=>NOW}});await app.ready();

    await t.test('T-AX-001..006 admin shell is keyboard/focus/live-region/responsive and exposes no unsafe governance surfaces',()=>{
      const html=adminConsoleHtml();assert.match(html,/role="tablist"/);assert.match(html,/focus-visible/);assert.match(html,/aria-live="polite"/);assert.match(html,/@media\(max-width:/);assert.match(html,/private administrative reason/i);assert.doesNotMatch(html,/force close/i);assert.doesNotMatch(html,/export all/i);assert.doesNotMatch(html,/show pin/i);assert.doesNotMatch(html,/oauth token/i);
    });

    await t.test('T-AUTH-006/012 administrator reads only its current school and teacher/security cannot enter admin APIs',async()=>withSavepoint(client,'scope',async()=>{
      const adminToken=await signIn(app,'admin-north');const overview=await app.inject({method:'GET',url:'/api/v1/admin/overview',headers:auth(adminToken)});assert.equal(overview.statusCode,200,overview.body);assert.equal(overview.json<{schoolId:string}>().schoolId,fixture.schoolA);assert.doesNotMatch(overview.body,new RegExp(fixture.schoolB));
      const teacherToken=await signIn(app,'teacher-alpha');const teacherDenied=await app.inject({method:'GET',url:'/api/v1/admin/overview',headers:auth(teacherToken)});assert.equal(teacherDenied.statusCode,403,teacherDenied.body);
      const securityToken=await signIn(app,'security-north');const securityDenied=await app.inject({method:'GET',url:'/api/v1/admin/audit?limit=10',headers:auth(securityToken)});assert.equal(securityDenied.statusCode,403,securityDenied.body);
      const cross=await app.inject({method:'POST',url:`/api/v1/admin/roles/${seeded.adminRoleB}/revoke`,headers:mutateHeaders(adminToken),payload:{reason:'Synthetic cross-school denial proof'}});assert.equal(cross.statusCode,403,cross.body);
    }));

    await t.test('role escalation cannot self-authorize and admin role change is idempotent/audited',async()=>withSavepoint(client,'roles',async()=>{
      const teacherToken=await signIn(app,'teacher-alpha');const denied=await app.inject({method:'POST',url:`/api/v1/admin/staff/${fixture.teacherA}/roles`,headers:mutateHeaders(teacherToken),payload:{role:'ADMIN',reason:'Should never authorize'}});assert.equal(denied.statusCode,403,denied.body);
      const adminToken=await signIn(app,'admin-north'),idem=randomUUID();const first=await app.inject({method:'POST',url:`/api/v1/admin/staff/${fixture.teacherA}/roles`,headers:mutateHeaders(adminToken,idem),payload:{role:'SECURITY',reason:'Synthetic delegated hallway coverage'}});assert.equal(first.statusCode,201,first.body);const second=await app.inject({method:'POST',url:`/api/v1/admin/staff/${fixture.teacherA}/roles`,headers:mutateHeaders(adminToken,idem),payload:{role:'SECURITY',reason:'Synthetic delegated hallway coverage'}});assert.equal(second.statusCode,201,second.body);assert.equal(second.json<{targetId:string}>().targetId,first.json<{targetId:string}>().targetId);
      const roleCount=await client.query<{count:string}>(`SELECT count(*) AS count FROM user_roles WHERE school_id=$1 AND user_id=$2 AND role='SECURITY' AND revoked_at IS NULL`,[fixture.schoolA,fixture.teacherA]);assert.equal(Number(roleCount.rows[0]?.count),1);
      const audit=await client.query<{count:string}>(`SELECT count(*) AS count FROM audit_events WHERE school_id=$1 AND action='ADMIN_ROLE_GRANT' AND target_id=$2`,[fixture.schoolA,first.json<{targetId:string}>().targetId]);assert.equal(Number(audit.rows[0]?.count),1);
      const outbox=await client.query<{count:string}>(`SELECT count(*) AS count FROM transactional_outbox WHERE school_id=$1 AND event_type='ADMIN_ROLE_GRANT'`,[fixture.schoolA]);assert.equal(Number(outbox.rows[0]?.count),1);
    }));

    await t.test('T-AUTH-010 administrator role revocation removes access immediately without session expiry',async()=>withSavepoint(client,'revoke',async()=>{
      const token=await signIn(app,'admin-north');const revoke=await app.inject({method:'POST',url:`/api/v1/admin/roles/${seeded.adminRoleA}/revoke`,headers:mutateHeaders(token),payload:{reason:'Synthetic immediate revocation proof'}});assert.equal(revoke.statusCode,201,revoke.body);const denied=await app.inject({method:'GET',url:'/api/v1/admin/overview',headers:auth(token)});assert.equal(denied.statusCode,403,denied.body);
    }));

    await t.test('policy mutation is school-bound, idempotent, explicit, and retains audit reason without exposing credentials',async()=>withSavepoint(client,'policy',async()=>{
      const token=await signIn(app,'admin-north');const policy=await client.query<{id:string}>(`SELECT id FROM policy_values WHERE school_id=$1 AND policy_key='DAILY_LIMIT' LIMIT 1`,[fixture.schoolA]);assert.ok(policy.rows[0]);const idem=randomUUID();const payload={typedValue:3,teacherOverrideAllowed:false,reason:'Synthetic policy calibration'};const first=await app.inject({method:'PUT',url:`/api/v1/admin/policies/${policy.rows[0]!.id}`,headers:mutateHeaders(token,idem),payload});assert.equal(first.statusCode,201,first.body);const retry=await app.inject({method:'PUT',url:`/api/v1/admin/policies/${policy.rows[0]!.id}`,headers:mutateHeaders(token,idem),payload});assert.equal(retry.statusCode,201,retry.body);const stored=await client.query<{typed_value_json:unknown}>(`SELECT typed_value_json FROM policy_values WHERE id=$1`,[policy.rows[0]!.id]);assert.equal(stored.rows[0]?.typed_value_json,3);const audit=await client.query<{reason:string|null}>(`SELECT reason FROM audit_events WHERE action='ADMIN_POLICY_VALUE_UPDATE' AND target_id=$1`,[policy.rows[0]!.id]);assert.equal(audit.rows.length,1);assert.equal(audit.rows[0]?.reason,payload.reason);assert.doesNotMatch(first.body,/secret_hash|pin_salt|provider_connection_ref/i);
    }));

    await t.test('calendar and destination validation fail before unsafe state and successful changes are audited',async()=>withSavepoint(client,'config',async()=>{
      const token=await signIn(app,'admin-north');const invalid=await app.inject({method:'PUT',url:'/api/v1/admin/calendar/day',headers:mutateHeaders(token),payload:{academicDate:'2026-09-12',isSchoolDay:false,scheduleProfileId:'00000000-0000-0000-0000-000000000901',label:'Invalid',reason:'Should fail'}});assert.equal(invalid.statusCode,400,invalid.body);
      const created=await app.inject({method:'POST',url:'/api/v1/admin/destinations',headers:mutateHeaders(token),payload:{name:'Library',category:'OTHER',securityVisible:true,studentSelectable:true,defaultExpectedMinutes:10,capacity:6,reason:'Synthetic destination setup'}});assert.equal(created.statusCode,201,created.body);const destinationId=created.json<{targetId:string}>().targetId;const row=await client.query<{name:string}>(`SELECT name FROM destinations WHERE id=$1 AND school_id=$2`,[destinationId,fixture.schoolA]);assert.equal(row.rows[0]?.name,'Library');const audit=await client.query<{count:string}>(`SELECT count(*) AS count FROM audit_events WHERE action='ADMIN_DESTINATION_CREATE' AND target_id=$1`,[destinationId]);assert.equal(Number(audit.rows[0]?.count),1);
    }));

    await t.test('student-access private reason is admin-only and cross-school section IDs are rejected',async()=>withSavepoint(client,'access',async()=>{
      const token=await signIn(app,'admin-north');const invalid=await app.inject({method:'POST',url:'/api/v1/admin/student-access',headers:mutateHeaders(token),payload:{studentId:fixture.studentA,sectionId:fixture.sectionB1,accessMode:'ESCORT_ONLY',reasonPrivate:'Private synthetic accommodation',validFrom:'2026-09-08T16:00:00.000Z',validUntil:'2026-10-01T16:00:00.000Z',reason:'Synthetic admin access rule'}});assert.equal(invalid.statusCode,404,invalid.body);
      const ok=await app.inject({method:'POST',url:'/api/v1/admin/student-access',headers:mutateHeaders(token),payload:{studentId:fixture.studentA,sectionId:fixture.sectionA1,accessMode:'ESCORT_ONLY',reasonPrivate:'Private synthetic accommodation',validFrom:'2026-09-08T16:00:00.000Z',validUntil:'2026-10-01T16:00:00.000Z',reason:'Synthetic admin access rule'}});assert.equal(ok.statusCode,201,ok.body);const list=await app.inject({method:'GET',url:'/api/v1/admin/student-access?limit=10',headers:auth(token)});assert.equal(list.statusCode,200,list.body);assert.match(list.body,/Private synthetic accommodation/);const teacherToken=await signIn(app,'teacher-alpha');const teacherDenied=await app.inject({method:'GET',url:'/api/v1/admin/student-access?limit=10',headers:auth(teacherToken)});assert.equal(teacherDenied.statusCode,403,teacherDenied.body);
    }));

    await t.test('integration review is bounded/school-scoped and resolution is idempotent without roster mutation',async()=>withSavepoint(client,'review',async()=>{
      const review=await client.query<{id:string}>(`INSERT INTO integration_review_items (organization_id,school_id,review_type,external_key,reason) VALUES ($1,$2,'AMBIGUOUS_IDENTITY','synthetic-user','Conflicting verified identity signals') RETURNING id`,[fixture.orgA,fixture.schoolA]);const token=await signIn(app,'admin-north');const list=await app.inject({method:'GET',url:'/api/v1/admin/integrations/reviews?limit=10',headers:auth(token)});assert.equal(list.statusCode,200,list.body);assert.match(list.body,/Conflicting verified identity signals/);const enrollmentBefore=await client.query<{count:string}>(`SELECT count(*) AS count FROM enrollments WHERE school_id=$1`,[fixture.schoolA]);const idem=randomUUID();const first=await app.inject({method:'POST',url:`/api/v1/admin/integrations/reviews/${review.rows[0]!.id}/resolve`,headers:mutateHeaders(token,idem),payload:{resolution:'DISMISSED',reason:'Synthetic review dismissal'}});assert.equal(first.statusCode,201,first.body);const retry=await app.inject({method:'POST',url:`/api/v1/admin/integrations/reviews/${review.rows[0]!.id}/resolve`,headers:mutateHeaders(token,idem),payload:{resolution:'DISMISSED',reason:'Synthetic review dismissal'}});assert.equal(retry.statusCode,201,retry.body);const enrollmentAfter=await client.query<{count:string}>(`SELECT count(*) AS count FROM enrollments WHERE school_id=$1`,[fixture.schoolA]);assert.equal(enrollmentAfter.rows[0]?.count,enrollmentBefore.rows[0]?.count);
    }));

    await t.test('T-PERF bounded audit rejects oversized windows and no export/credential/force-close APIs exist',async()=>withSavepoint(client,'audit',async()=>{
      const token=await signIn(app,'admin-north');for(let i=0;i<120;i++)await client.query(`INSERT INTO audit_events (organization_id,school_id,actor_user_id,actor_kind,action,target_type,target_id,source,occurred_at) VALUES ($1,$2,$3,'USER','SYNTHETIC_ADMIN_AUDIT','TEST',$4,'APPLICATION',$5::timestamptz)`,[fixture.orgA,fixture.schoolA,adminA,String(i),new Date(NOW.getTime()-i*1000).toISOString()]);const bounded=await app.inject({method:'GET',url:'/api/v1/admin/audit?limit=100',headers:auth(token)});assert.equal(bounded.statusCode,200,bounded.body);assert.equal(bounded.json<{rows:unknown[]}>().rows.length,100);const tooWide=await app.inject({method:'GET',url:'/api/v1/admin/audit?limit=10&from=2026-01-01T00%3A00%3A00.000Z&before=2026-09-08T16%3A00%3A00.000Z',headers:auth(token)});assert.equal(tooWide.statusCode,400,tooWide.body);for(const url of ['/api/v1/admin/export','/api/v1/admin/credentials/reveal','/api/v1/admin/security/force-close']){const response=await app.inject({method:'POST',url,headers:mutateHeaders(token),payload:{}});assert.equal(response.statusCode,404,response.body);}
    }));

    await app.close();
  } finally {await client.query('ROLLBACK');client.release();await pool.end();}
});
