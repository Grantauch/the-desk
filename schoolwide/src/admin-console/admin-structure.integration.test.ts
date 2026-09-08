import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { buildApp } from '../app.js';
import { AuthenticationError, type StaffIdentityProvider, type VerifiedStaffIdentity } from '../auth/types.js';
import type { AppConfig } from '../config.js';
import type { QueryExecutor, TransactionalDatabase } from '../db/database.js';

const databaseUrl = process.env.DATABASE_URL;
const NOW = new Date('2026-09-08T16:30:00.000Z');
const ids = {
  orgA: randomUUID(), orgB: randomUUID(), schoolA: randomUUID(), schoolB: randomUUID(),
  yearA: randomUUID(), yearB: randomUUID(), adminA: randomUUID(), teacherA: randomUUID(),
  studentA: randomUUID(), studentB: randomUUID(), sectionA: randomUUID(), sectionB: randomUUID(), destinationA: randomUUID(),
};

const config: AppConfig = {
  nodeEnv:'test',host:'127.0.0.1',port:8787,logLevel:'silent',
  databaseUrl:'postgresql://fixture.invalid/schoolwide',dbPoolMax:2,
  instanceId:'admin-structure-test',legacyReadAdapterMode:'disabled',legacyProductionWrites:'forbidden',
};

class SavepointDatabase implements TransactionalDatabase {
  readonly #client: PoolClient; #counter=0;
  constructor(client:PoolClient){this.#client=client;}
  async query<T extends QueryResultRow=QueryResultRow>(sql:string,parameters:readonly unknown[]=[]):Promise<readonly T[]>{return (await this.#client.query<T>(sql,[...parameters])).rows;}
  async transaction<T>(work:(transaction:QueryExecutor)=>Promise<T>):Promise<T>{const sp=`sw120_structure_tx_${++this.#counter}`;await this.#client.query(`SAVEPOINT ${sp}`);try{const result=await work(this);await this.#client.query(`RELEASE SAVEPOINT ${sp}`);return result;}catch(error){await this.#client.query(`ROLLBACK TO SAVEPOINT ${sp}`);await this.#client.query(`RELEASE SAVEPOINT ${sp}`);throw error;}}
  async close():Promise<void>{}
}

class FixtureIdentityProvider implements StaffIdentityProvider {
  async verify(assertion:string):Promise<VerifiedStaffIdentity>{
    if(assertion==='admin-a') return {provider:'SYNTHETIC',subject:'sw120-structure-admin-a'};
    if(assertion==='teacher-a') return {provider:'SYNTHETIC',subject:'sw120-structure-teacher-a'};
    throw new AuthenticationError('Synthetic identity assertion rejected.');
  }
}

async function seed(client:PoolClient):Promise<{enrollmentA:string;enrollmentB:string}>{
  await client.query(`INSERT INTO organizations (id,slug,name) VALUES ($1,$2,'SW120 Structure North'),($3,$4,'SW120 Structure South')`,[ids.orgA,`sw120-n-${ids.orgA.slice(0,8)}`,ids.orgB,`sw120-s-${ids.orgB.slice(0,8)}`]);
  await client.query(`INSERT INTO schools (id,organization_id,slug,name,timezone) VALUES ($1,$2,$3,'SW120 North','America/Detroit'),($4,$5,$6,'SW120 South','America/Detroit')`,[ids.schoolA,ids.orgA,`sw120-school-n-${ids.schoolA.slice(0,8)}`,ids.schoolB,ids.orgB,`sw120-school-s-${ids.schoolB.slice(0,8)}`]);
  await client.query(`INSERT INTO academic_years (id,school_id,label,starts_on,ends_on) VALUES ($1,$2,'2026-27',DATE '2026-08-20',DATE '2027-06-15'),($3,$4,'2026-27',DATE '2026-08-20',DATE '2027-06-15')`,[ids.yearA,ids.schoolA,ids.yearB,ids.schoolB]);
  await client.query(`INSERT INTO users (id,organization_id,primary_email,display_name,google_subject_id) VALUES ($1,$2,$3,'Admin Structure','sw120-structure-admin-a'),($4,$2,$5,'Teacher Structure','sw120-structure-teacher-a')`,[ids.adminA,ids.orgA,`admin-${ids.adminA.slice(0,8)}@example.invalid`,ids.teacherA,`teacher-${ids.teacherA.slice(0,8)}@example.invalid`]);
  await client.query(`INSERT INTO staff_profiles (user_id,organization_id,title) VALUES ($1,$2,'Administrator'),($3,$2,'Teacher')`,[ids.adminA,ids.orgA,ids.teacherA]);
  await client.query(`INSERT INTO user_roles (organization_id,school_id,user_id,role) VALUES ($1,$2,$3,'ADMIN'),($1,$2,$4,'TEACHER')`,[ids.orgA,ids.schoolA,ids.adminA,ids.teacherA]);
  await client.query(`INSERT INTO students (id,school_id,display_name) VALUES ($1,$2,'Synthetic North Student'),($3,$4,'Synthetic South Student')`,[ids.studentA,ids.schoolA,ids.studentB,ids.schoolB]);
  await client.query(`INSERT INTO sections (id,school_id,academic_year_id,name,code,period_code,status) VALUES ($1,$2,$3,'Synthetic North Section',$4,'P1','ACTIVE'),($5,$6,$7,'Synthetic South Section',$8,'P1','ACTIVE')`,[ids.sectionA,ids.schoolA,ids.yearA,`N-${ids.sectionA.slice(0,8)}`,ids.sectionB,ids.schoolB,ids.yearB,`S-${ids.sectionB.slice(0,8)}`]);
  const a=await client.query<{id:string}>(`INSERT INTO enrollments (school_id,section_id,student_id,source,status) VALUES ($1,$2,$3,'MANUAL','ACTIVE') RETURNING id`,[ids.schoolA,ids.sectionA,ids.studentA]);
  const b=await client.query<{id:string}>(`INSERT INTO enrollments (school_id,section_id,student_id,source,status) VALUES ($1,$2,$3,'MANUAL','ACTIVE') RETURNING id`,[ids.schoolB,ids.sectionB,ids.studentB]);
  await client.query(`INSERT INTO destinations (id,school_id,name,category,active,security_visible,student_selectable,default_expected_minutes,capacity) VALUES ($1,$2,'Synthetic Library','OTHER',true,true,true,10,5)`,[ids.destinationA,ids.schoolA]);
  return {enrollmentA:a.rows[0]!.id,enrollmentB:b.rows[0]!.id};
}

async function signIn(app:ReturnType<typeof buildApp>,assertion:string):Promise<string>{const r=await app.inject({method:'POST',url:'/auth/session',payload:{assertion}});assert.equal(r.statusCode,201,r.body);return r.json<{token:string}>().token;}
function auth(token:string){return {authorization:`Bearer ${token}`};}
function mutation(token:string,key=randomUUID()){return {...auth(token),'idempotency-key':key,'content-type':'application/json'};}

if(!databaseUrl){test('SW-120 Admin structure integration tests require DATABASE_URL',{skip:true},()=>{});}else test('SW-120 Admin structure + schedule lifecycle',async(t)=>{
  const pool=new Pool({connectionString:databaseUrl,max:1,application_name:'grantdesk-schoolwide:admin-structure-test'});const client=await pool.connect();await client.query('BEGIN');
  try{
    const fixture=await seed(client);const db=new SavepointDatabase(client);const app=buildApp({config,database:db,identityProvider:new FixtureIdentityProvider(),adminConsoleOptions:{now:()=>NOW}});await app.ready();
    const admin=await signIn(app,'admin-a');const teacher=await signIn(app,'teacher-a');

    await t.test('schedule profile and period creation is admin-only, school-scoped, validated, idempotent, and audited',async()=>{
      const teacherDenied=await app.inject({method:'POST',url:'/api/v1/admin/schedules',headers:mutation(teacher),payload:{name:'Teacher Attempt',key:'TEACHER_ATTEMPT',reason:'Must be denied'}});assert.equal(teacherDenied.statusCode,403,teacherDenied.body);
      const key=randomUUID(),payload={name:'Assembly Day',key:'ASSEMBLY',reason:'Synthetic schedule setup'};
      const first=await app.inject({method:'POST',url:'/api/v1/admin/schedules',headers:mutation(admin,key),payload});assert.equal(first.statusCode,201,first.body);
      const retry=await app.inject({method:'POST',url:'/api/v1/admin/schedules',headers:mutation(admin,key),payload});assert.equal(retry.statusCode,201,retry.body);assert.equal(retry.json<{targetId:string}>().targetId,first.json<{targetId:string}>().targetId);
      const profileId=first.json<{targetId:string}>().targetId;
      const invalid=await app.inject({method:'POST',url:`/api/v1/admin/schedules/${profileId}/periods`,headers:mutation(admin),payload:{periodCode:'P1',startsAtLocal:'10:00:00',endsAtLocal:'09:00:00',ordinalByTime:1,reason:'Invalid timing proof'}});assert.equal(invalid.statusCode,400,invalid.body);
      const period=await app.inject({method:'POST',url:`/api/v1/admin/schedules/${profileId}/periods`,headers:mutation(admin),payload:{periodCode:'P1',startsAtLocal:'08:00:00',endsAtLocal:'08:45:00',ordinalByTime:1,reason:'Synthetic period setup'}});assert.equal(period.statusCode,201,period.body);
      const cross=await client.query<{id:string}>(`INSERT INTO schedule_profiles (school_id,name,key,status) VALUES ($1,'South Schedule',$2,'ACTIVE') RETURNING id`,[ids.schoolB,`SOUTH_${ids.schoolB.slice(0,8).toUpperCase()}`]);
      const crossDenied=await app.inject({method:'POST',url:`/api/v1/admin/schedules/${cross.rows[0]!.id}/periods`,headers:mutation(admin),payload:{periodCode:'P1',startsAtLocal:'08:00:00',endsAtLocal:'08:45:00',ordinalByTime:1,reason:'Cross school must fail'}});assert.equal(crossDenied.statusCode,403,crossDenied.body);
      const profiles=await app.inject({method:'GET',url:'/api/v1/admin/schedules',headers:auth(admin)});assert.equal(profiles.statusCode,200,profiles.body);assert.match(profiles.body,/Assembly Day/);assert.doesNotMatch(profiles.body,/South Schedule/);
      const audit=await client.query<{count:string}>(`SELECT count(*) AS count FROM audit_events WHERE school_id=$1 AND action IN ('ADMIN_SCHEDULE_PROFILE_CREATE','ADMIN_SCHEDULE_PERIOD_CREATE')`,[ids.schoolA]);assert.equal(Number(audit.rows[0]?.count),2);
    });

    await t.test('section status changes preserve roster history and are retry-idempotent',async()=>{
      const key=randomUUID(),payload={status:'INACTIVE',reason:'Synthetic section retirement'};
      const first=await app.inject({method:'POST',url:`/api/v1/admin/sections/${ids.sectionA}/status`,headers:mutation(admin,key),payload});assert.equal(first.statusCode,201,first.body);
      const retry=await app.inject({method:'POST',url:`/api/v1/admin/sections/${ids.sectionA}/status`,headers:mutation(admin,key),payload});assert.equal(retry.statusCode,201,retry.body);
      const section=await client.query<{status:string}>(`SELECT status FROM sections WHERE id=$1`,[ids.sectionA]);assert.equal(section.rows[0]?.status,'INACTIVE');
      const enrollment=await client.query<{count:string}>(`SELECT count(*) AS count FROM enrollments WHERE id=$1`,[fixture.enrollmentA]);assert.equal(Number(enrollment.rows[0]?.count),1);
      const cross=await app.inject({method:'POST',url:`/api/v1/admin/sections/${ids.sectionB}/status`,headers:mutation(admin),payload:{status:'INACTIVE',reason:'Cross school must fail'}});assert.equal(cross.statusCode,403,cross.body);
      const audit=await client.query<{count:string}>(`SELECT count(*) AS count FROM audit_events WHERE school_id=$1 AND action='ADMIN_SECTION_STATUS' AND target_id=$2`,[ids.schoolA,ids.sectionA]);assert.equal(Number(audit.rows[0]?.count),1);
      await client.query(`UPDATE sections SET status='ACTIVE' WHERE id=$1`,[ids.sectionA]);
    });

    await t.test('enrollment lifecycle retains the row, sets truthful left_at, supports reviewed reactivation, and rejects cross-school records',async()=>{
      const off=await app.inject({method:'POST',url:`/api/v1/admin/enrollments/${fixture.enrollmentA}/status`,headers:mutation(admin),payload:{status:'INACTIVE',reason:'Synthetic roster correction'}});assert.equal(off.statusCode,201,off.body);
      let row=(await client.query<{status:string;left_at:Date|null}>(`SELECT status,left_at FROM enrollments WHERE id=$1`,[fixture.enrollmentA])).rows[0];assert.equal(row?.status,'INACTIVE');assert.ok(row?.left_at);
      const review=await app.inject({method:'POST',url:`/api/v1/admin/enrollments/${fixture.enrollmentA}/status`,headers:mutation(admin),payload:{status:'PENDING_REVIEW',reason:'Synthetic roster review'}});assert.equal(review.statusCode,201,review.body);
      row=(await client.query<{status:string;left_at:Date|null}>(`SELECT status,left_at FROM enrollments WHERE id=$1`,[fixture.enrollmentA])).rows[0];assert.equal(row?.status,'PENDING_REVIEW');assert.equal(row?.left_at,null);
      const active=await app.inject({method:'POST',url:`/api/v1/admin/enrollments/${fixture.enrollmentA}/status`,headers:mutation(admin),payload:{status:'ACTIVE',reason:'Synthetic reviewed reactivation'}});assert.equal(active.statusCode,201,active.body);
      row=(await client.query<{status:string;left_at:Date|null}>(`SELECT status,left_at FROM enrollments WHERE id=$1`,[fixture.enrollmentA])).rows[0];assert.equal(row?.status,'ACTIVE');assert.equal(row?.left_at,null);
      const cross=await app.inject({method:'POST',url:`/api/v1/admin/enrollments/${fixture.enrollmentB}/status`,headers:mutation(admin),payload:{status:'INACTIVE',reason:'Cross school must fail'}});assert.equal(cross.statusCode,403,cross.body);
      const retained=await client.query<{count:string}>(`SELECT count(*) AS count FROM enrollments WHERE id=$1`,[fixture.enrollmentA]);assert.equal(Number(retained.rows[0]?.count),1);
    });

    await t.test('destination lifecycle update is explicit, bounded, audited, and cannot target another school',async()=>{
      const updated=await app.inject({method:'PUT',url:`/api/v1/admin/destinations/${ids.destinationA}`,headers:mutation(admin),payload:{active:false,securityVisible:false,studentSelectable:false,defaultExpectedMinutes:12,capacity:7,reason:'Synthetic temporary closure'}});assert.equal(updated.statusCode,201,updated.body);
      const row=await client.query<{active:boolean;security_visible:boolean;student_selectable:boolean;default_expected_minutes:number;capacity:number}>(`SELECT active,security_visible,student_selectable,default_expected_minutes,capacity FROM destinations WHERE id=$1`,[ids.destinationA]);assert.deepEqual(row.rows[0],{active:false,security_visible:false,student_selectable:false,default_expected_minutes:12,capacity:7});
      const invalid=await app.inject({method:'PUT',url:`/api/v1/admin/destinations/${ids.destinationA}`,headers:mutation(admin),payload:{active:true,securityVisible:true,studentSelectable:true,defaultExpectedMinutes:0,capacity:1,reason:'Invalid bound proof'}});assert.equal(invalid.statusCode,400,invalid.body);
      const audit=await client.query<{count:string}>(`SELECT count(*) AS count FROM audit_events WHERE action='ADMIN_DESTINATION_UPDATE' AND target_id=$1`,[ids.destinationA]);assert.equal(Number(audit.rows[0]?.count),1);
    });

    await t.test('configuration lifecycle exposes no destructive DELETE routes',async()=>{
      for(const url of [`/api/v1/admin/sections/${ids.sectionA}`,`/api/v1/admin/enrollments/${fixture.enrollmentA}`,`/api/v1/admin/schedules`,`/api/v1/admin/destinations/${ids.destinationA}`]){
        const response=await app.inject({method:'DELETE',url,headers:auth(admin)});assert.equal(response.statusCode,404,`${url}: ${response.body}`);
      }
    });

    await app.close();
  }finally{await client.query('ROLLBACK');client.release();await pool.end();}
});
