// Shared synthetic SQL contract, also run with 35 independent PostgreSQL clients.
import assert from 'node:assert/strict';
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {createAuthService} from './auth.mjs';
import {createSchoolService} from './school.mjs';
import {createGameStore} from './store.mjs';
const random=()=>randomBytes(32).toString('base64url');
const sign=(key,domain,p)=>{const b=Buffer.from(JSON.stringify(p)).toString('base64url');return b+'.'+createHmac('sha256',key).update(domain+'\n'+b).digest('base64url');};
export async function schoolContract(t,database) {
  async function fixture() {
    let now=Date.now(),advanceAfterClock=0;
    const config={database,issuer:'synthetic_school',audience:'synthetic_game',tenantId:'school_'+randomUUID().replaceAll('-',''),assertionKey:randomBytes(32),flowKey:randomBytes(32),schoolKey:randomBytes(32),clock:async()=>{const value=now;now+=advanceAfterClock;advanceAfterClock=0;return value;}};
    const auth=createAuthService(config),school=createSchoolService(config),actor={tenantId:config.tenantId,classId:'class_a',memberId:'member_a',authEpoch:0};
    const member={memberId:actor.memberId,credentialVersion:random(),active:true};
    const payload=(patch={})=>({v:1,iss:config.issuer,aud:config.audience,tenantId:config.tenantId,classId:actor.classId,revision:1,enabled:true,members:[member],iat:Math.floor(now/1000),exp:Math.floor(now/1000)+120,...patch});
    const signed=p=>sign(config.schoolKey,'checklings:school:v1',p);
    const sync=patch=>school.acceptSnapshot(signed(payload(patch)));
    async function login(identity=actor) {
      const launch=await auth.beginLaunch(),flow=JSON.parse(Buffer.from(launch.ticket.split('.')[0],'base64url'));
      const iat=Math.floor(now/1000);
      const {code}=await auth.acceptAssertion(sign(config.assertionKey,'checklings:bridge:v1',{v:1,iss:config.issuer,aud:config.audience,...identity,flowId:flow.flowId,challenge:flow.challenge,jti:random(),iat,exp:iat+30}));
      return auth.exchange({flowId:flow.flowId,flowCookie:launch.flowCookie,state:launch.state,code});
    }
    const authorize=token=>database.transaction(c=>auth.authorize(token,c));
    const rows=table=>database.transaction(async c=>(await c.query('SELECT * FROM '+table+' WHERE tenant_id=$1 ORDER BY 1,2',[config.tenantId])).rows);
    const store=createGameStore({database,authorize:auth.authorize,migrationKey:'synthetic-only-migration-key-at-least-32-characters'});
    return {config,actor,member,auth,school,store,payload,signed,sync,login,authorize,rows,now:()=>now,advance:ms=>{now+=ms;},advanceAfterClock:ms=>{advanceAfterClock=ms;}};
  }
  await t.test('school authorization defaults closed, then a signed snapshot provisions opaque membership',async()=>{
    const f=await fixture();await assert.rejects(f.login(),/Unauthorized/);
    assert.deepEqual(await f.sync(),{ok:true,authEpochs:{member_a:0}});
    const {token}=await f.login();assert.deepEqual(await f.authorize(token),f.actor);
    const rows=await f.rows('ck_memberships');assert.equal(rows[0].bridge_credential_version,f.member.credentialVersion);
  });
  await t.test('school signatures reject malformed, forged, oversized and wrong-domain envelopes',async()=>{
    const f=await fixture(),p=f.payload(),good=f.signed(p);
    for(const value of ['',null,'x'.repeat(7801),good+'.extra',sign(randomBytes(32),'checklings:school:v1',p),sign(f.config.schoolKey,'checklings:bridge:v1',p)])await assert.rejects(f.school.acceptSnapshot(value),/Unauthorized/);
    await f.sync();
  });
  await t.test('strict snapshot fields, identity scopes, duplicate members and bounds fail closed',async()=>{
    const f=await fixture();
    for(const patch of [{v:2},{iss:'other'},{aud:'other'},{tenantId:'other'},{classId:'../class'},{enabled:'yes'},{revision:0},{revision:1.5},{role:'teacher'},{members:[f.member,f.member]},{members:[{...f.member,pin:'not-allowed'}]},{members:Array.from({length:36},(_,i)=>({...f.member,memberId:'m'+i}))}])await assert.rejects(f.sync(patch),/Unauthorized/);
    assert.equal((await f.rows('ck_memberships')).length,0);
  });
  await t.test('future, expired and overlong school leases cannot authorize access',async()=>{
    const f=await fixture(),p=f.payload();
    for(const patch of [{iat:p.iat+2},{exp:p.iat},{exp:p.iat+121},{iat:p.iat-121,exp:p.iat-1}])await assert.rejects(f.sync(patch),/Unauthorized/);
  });
  await t.test('identical and out-of-order snapshots do not duplicate members or renew the lease',async()=>{
    const f=await fixture();await f.sync({revision:3});const before=await f.rows('ck_school_classes');
    f.advance(2000);await f.sync({revision:3});await f.sync({revision:2});
    assert.deepEqual(await f.rows('ck_school_classes'),before);assert.equal((await f.rows('ck_memberships')).length,1);
    assert.equal((await f.rows('ck_memberships'))[0].auth_epoch,0);
  });
  await t.test('old snapshots cannot restore permissions or credentials after a newer update',async()=>{
    const f=await fixture();await f.sync();await f.sync({revision:2,enabled:false});
    await assert.rejects(f.sync(),/Unauthorized/);await assert.rejects(f.sync({revision:2}),/Unauthorized/);
    assert.equal((await f.rows('ck_school_classes'))[0].enabled,false);
  });
  await t.test('PIN credential changes increment the epoch and permanently revoke existing sessions',async()=>{
    const f=await fixture();await f.sync();const {token}=await f.login();
    await f.sync({revision:2,members:[{...f.member,credentialVersion:random()}]});
    await assert.rejects(f.authorize(token),/Unauthorized/);await assert.rejects(f.login(),/Unauthorized/);
    assert.ok((await f.login({...f.actor,authEpoch:1})).token);
    assert.ok((await f.rows('ck_sessions')).some(r=>r.revoked_ms!==null));
  });
  await t.test('deactivation preserves pet, receipts and history and blocks receipt replay',async()=>{
    const f=await fixture();await f.sync();const {token}=await f.login();
    const original=await f.store.importLegacy(token,'import',{raw:JSON.stringify({v:1,species:'bolt',name:'Still here',habitat:'meadow'}),officialBestStreak:0,importedAt:'2026-10-23T16:00:00.000Z'});
    const before={};for(const table of ['ck_creatures','ck_events','ck_command_receipts'])before[table]=await f.rows(table);
    await f.sync({revision:2,members:[]});
    await assert.rejects(f.store.load(token,original.creature.id),/Unauthorized/);
    await assert.rejects(f.store.importLegacy(token,'import',{raw:'{}',officialBestStreak:0,importedAt:'2026-10-23T16:00:00.000Z'}),/Unauthorized/);
    for(const table of Object.keys(before))assert.deepEqual(await f.rows(table),before[table]);
  });
  await t.test('pause and reopen require a new epoch; paused sessions never become usable again',async()=>{
    const f=await fixture();await f.sync();const {token}=await f.login();
    await f.sync({revision:2,enabled:false});await assert.rejects(f.authorize(token),/Unauthorized/);
    await f.sync({revision:3});await assert.rejects(f.authorize(token),/Unauthorized/);
    assert.ok((await f.login({...f.actor,authEpoch:2})).token);
  });
  await t.test('expired school permissions stop active requests and shorten browser expiry',async()=>{
    const f=await fixture();await f.sync();const {token}=await f.login();f.advance(90000);
    assert.ok((await f.auth.sessionWindow(token)).remainingMs<=30000);
    await f.authorize(token);f.advance(30001);await assert.rejects(f.authorize(token),/Unauthorized/);
    await assert.rejects(f.sync({revision:1}),/Unauthorized/); // Cannot renew by replay.
    await f.sync({revision:2});assert.ok((await f.login()).token);
  });
  await t.test('school lease expiring while acquiring a membership lock cannot authorize a session',async()=>{
    const f=await fixture();await f.sync();const {token}=await f.login();
    const expiry=Number((await f.rows('ck_school_classes'))[0].valid_until_ms);
    f.advance(expiry-f.now()-100);
    let delayed=false;
    const delayedDatabase={transaction:work=>database.transaction(c=>work({query:async(sql,args)=>{
      const result=await c.query(sql,args);
      if(!delayed && sql.includes('FROM ck_memberships') && sql.includes('FOR UPDATE')){delayed=true;f.advance(200);}
      return result;
    }}))};
    const delayedAuth=createAuthService({...f.config,database:delayedDatabase});
    await assert.rejects(delayedDatabase.transaction(c=>delayedAuth.authorize(token,c)),/Unauthorized/);
    assert.equal(delayed,true);
  });
  await t.test('school lease expiring during a session lock wait cannot return a negative deadline or authorize work',async()=>{
    const f=await fixture();await f.sync();const {token}=await f.login();
    const expiry=Number((await f.rows('ck_school_classes'))[0].valid_until_ms),before=await f.rows('ck_sessions');
    f.advance(expiry-f.now()-100);f.advanceAfterClock(200);
    await assert.rejects(f.authorize(token),/Unauthorized/);
    assert.deepEqual(await f.rows('ck_sessions'),before);
  });
  await t.test('school lease expiring during an assertion flow lock wait issues no code',async()=>{
    const f=await fixture();await f.sync();const expiry=Number((await f.rows('ck_school_classes'))[0].valid_until_ms);
    f.advance(expiry-f.now()-100);
    const launch=await f.auth.beginLaunch(),flow=JSON.parse(Buffer.from(launch.ticket.split('.')[0],'base64url')),iat=Math.floor(f.now()/1000);
    const assertion=sign(f.config.assertionKey,'checklings:bridge:v1',{v:1,iss:f.config.issuer,aud:f.config.audience,...f.actor,flowId:flow.flowId,challenge:flow.challenge,jti:random(),iat,exp:iat+30});
    f.advanceAfterClock(200);await assert.rejects(f.auth.acceptAssertion(assertion),/Unauthorized/);
    assert.equal((await database.transaction(c=>c.query('SELECT code_hash FROM ck_launch_flows WHERE flow_id=$1',[flow.flowId]))).rows[0].code_hash,null);
  });
  await t.test('school lease expiring during a code exchange flow lock wait creates no session',async()=>{
    const f=await fixture();await f.sync();const expiry=Number((await f.rows('ck_school_classes'))[0].valid_until_ms);
    f.advance(expiry-f.now()-100);
    const launch=await f.auth.beginLaunch(),flow=JSON.parse(Buffer.from(launch.ticket.split('.')[0],'base64url')),iat=Math.floor(f.now()/1000);
    const assertion=sign(f.config.assertionKey,'checklings:bridge:v1',{v:1,iss:f.config.issuer,aud:f.config.audience,...f.actor,flowId:flow.flowId,challenge:flow.challenge,jti:random(),iat,exp:iat+30});
    const {code}=await f.auth.acceptAssertion(assertion);
    f.advanceAfterClock(200);await assert.rejects(f.auth.exchange({flowId:flow.flowId,flowCookie:launch.flowCookie,state:launch.state,code}),/Unauthorized/);
    assert.equal((await f.rows('ck_sessions')).length,0);assert.equal((await f.rows('ck_launch_flows'))[0].consumed_ms,null);
  });
  await t.test('cross-class member reassignment rolls back the entire snapshot',async()=>{
    const f=await fixture();await f.sync();
    await assert.rejects(f.sync({classId:'class_other',members:[{...f.member,memberId:'a_new_member'},f.member]}),/Unauthorized/);
    assert.equal((await f.rows('ck_school_classes')).length,1);assert.equal((await f.rows('ck_memberships')).length,1);
  });
  await t.test('35 simultaneous identical snapshots converge on one class and member',async()=>{
    const f=await fixture(),snapshot=f.signed(f.payload());
    const results=await Promise.allSettled(Array.from({length:35},()=>f.school.acceptSnapshot(snapshot)));
    assert.ok(results.every(r=>r.status==='fulfilled'),JSON.stringify(results.filter(r=>r.status==='rejected').map(r=>r.reason.message)));
    assert.equal((await f.rows('ck_school_classes')).length,1);assert.equal((await f.rows('ck_memberships')).length,1);
  });
  await t.test('session authorization and a class pause use a consistent lock order',async()=>{
    const f=await fixture();await f.sync();const {token}=await f.login();
    const results=await Promise.allSettled([f.sync({revision:2,enabled:false}),...Array.from({length:34},()=>f.authorize(token))]);
    assert.equal(results[0].status,'fulfilled');
    assert.ok(results.slice(1).every(r=>r.status==='fulfilled' || r.reason.message==='Unauthorized'));
    await assert.rejects(f.authorize(token),/Unauthorized/);
  });
  await t.test('consequential access changes have immutable audit events without credentials',async()=>{
    const f=await fixture();await f.sync();await f.sync({revision:2});await f.sync({revision:3,enabled:false});
    const events=await f.rows('ck_school_access_events');assert.equal(events.length,2);
    assert.ok(!JSON.stringify(events).includes(f.member.credentialVersion));
    await assert.rejects(database.transaction(c=>c.query('DELETE FROM ck_school_access_events WHERE tenant_id=$1',[f.config.tenantId])),/append-only/);
  });
  await t.test('one class pause leaves another class and its session usable',async()=>{
    const f=await fixture();await f.sync();const other={...f.actor,classId:'class_b',memberId:'member_b'};
    await f.sync({classId:'class_b',members:[{...f.member,memberId:'member_b'}]});
    const {token}=await f.login(other);await f.sync({revision:2,enabled:false});assert.deepEqual(await f.authorize(token),other);
  });
}
