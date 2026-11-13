import assert from 'node:assert/strict';
import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {createAuthService} from './auth.mjs';
import {createGameStore} from './store.mjs';
import {createRateLimiter} from './rate-limit.mjs';
const random=()=>randomBytes(32).toString('base64url');
const hash=value=>createHash('sha256').update(value).digest('hex');
const exportPet={raw:JSON.stringify({v:1,species:'mochi',name:'Survivor',habitat:'grove'}),officialBestStreak:3,importedAt:'2026-10-23T16:00:00.000Z'};

// A synthetic school issuer, only in test code; no signing route is shipped.
function sign(payload,key,domain='checklings:bridge:v1') {
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body+'.'+createHmac('sha256',key).update(domain+'\n'+body).digest('base64url');
}

/** Same negative/auth/contention scenarios on embedded and native PostgreSQL. */
export async function authContract(t,database) {
  async function fixture() {
    const tenantId='auth_'+randomUUID().replaceAll('-','');
    const actor={tenantId,memberId:'member_a',classId:'class_a',authEpoch:0};
    const keys={assertionKey:randomBytes(32),flowKey:randomBytes(32)};
    let now=Date.parse('2026-10-23T16:00:00Z');
    await database.transaction(c=>c.query("INSERT INTO ck_school_classes (tenant_id,class_id,issuer,audience,revision,enabled,valid_until_ms,content_hash) VALUES ($1,$2,'synthetic_school','synthetic_game',1,true,$3,'synthetic-only')",[tenantId,actor.classId,now+3600000]));
    await database.transaction(c=>c.query('INSERT INTO ck_memberships (tenant_id,member_id,class_id,active) VALUES ($1,$2,$3,true)',[tenantId,actor.memberId,actor.classId]));
    const config={database,tenantId,issuer:'synthetic_school',audience:'synthetic_game',...keys,clock:async()=>now};
    const auth=createAuthService(config);
    const store=createGameStore({database,authorize:auth.authorize,migrationKey:'synthetic-only-migration-key-at-least-32-characters'});
    async function launch() {
      const started=await auth.beginLaunch();
      const ticket=JSON.parse(Buffer.from(started.ticket.split('.')[0],'base64url'));
      const claims={v:1,iss:config.issuer,aud:config.audience,...actor,flowId:ticket.flowId,challenge:ticket.challenge,jti:random(),iat:Math.floor(now/1000),exp:Math.floor(now/1000)+30};
      return {...started,signedTicket:started.ticket,ticket,claims,exchange:{flowId:ticket.flowId,flowCookie:started.flowCookie,state:started.state}};
    }
    async function login() {const l=await launch();const {code}=await auth.acceptAssertion(sign(l.claims,keys.assertionKey));return {...l,code,...await auth.exchange({...l.exchange,code})};}
    return {auth,store,config,keys,actor,launch,login,now:()=>now,advance:ms=>{now+=ms;},
      sign:claims=>sign(claims,keys.assertionKey),
      authorize:token=>database.transaction(c=>auth.authorize(token,c)),
      update:(column,value)=>database.transaction(c=>c.query(`UPDATE ck_memberships SET ${column}=$1 WHERE tenant_id=$2 AND member_id=$3`,[value,tenantId,actor.memberId]))};
  }
  await t.test('launch ticket is signed, identity-free and bound to a private cookie and state',async()=>{
    const f=await fixture(),l=await f.launch();
    assert.equal(l.ticket.exp-l.ticket.iat,60);
    assert.equal(l.ticket.challenge,createHash('sha256').update(l.flowCookie).digest('base64url'));
    assert.equal(l.ticket.state,l.state);assert.equal(l.ticket.aud,'synthetic_school');
    assert.equal(l.ticket.tenantId,undefined);assert.equal(l.ticket.memberId,undefined);
    assert.equal(l.signedTicket,sign(l.ticket,f.keys.flowKey,'checklings:launch:v1'));
    const row=(await database.transaction(c=>c.query('SELECT * FROM ck_launch_flows WHERE flow_id=$1',[l.ticket.flowId]))).rows[0];
    assert.equal(row.cookie_hash,hash(l.flowCookie));assert.equal(row.state_hash,hash(l.state));
    assert.ok(!JSON.stringify(row).includes(l.flowCookie));
  });
  await t.test('real session verifier authorizes pet import/rename in the SAME transaction',async()=>{
    const f=await fixture(),l=await f.login();
    const imported=await f.store.importLegacy(l.token,'import',exportPet);
    const named=await f.store.rename(l.token,'rename',{creatureId:imported.creature.id,expectedRevision:0,nickname:'Still here'});
    assert.equal(named.creature.nickname,'Still here');
    const second=createAuthService(f.config);
    assert.deepEqual(await database.transaction(c=>second.authorize(l.token,c)),f.actor);
    const row=(await database.transaction(c=>c.query('SELECT * FROM ck_sessions WHERE token_hash=$1',[hash(l.token)]))).rows[0];
    assert.equal(Number(row.absolute_expires_ms)-Number(row.created_ms),900000);
    assert.equal(Number(row.idle_expires_ms)-Number(row.created_ms),120000);
    assert.ok(!JSON.stringify(row).includes(l.token));
    await assert.rejects(second.authorize(l.token),/^Error: Unauthorized$/);
  });
  await t.test('tampered, malformed, oversized and wrong-key assertions fail closed',async()=>{
    const f=await fixture(),l=await f.launch(),valid=f.sign(l.claims);
    for(const bad of [null,'',valid+'.extra','!.'+random(),'x'.repeat(4097),valid.slice(0,-2)+'!!',sign(l.claims,randomBytes(32)),sign(l.claims,f.keys.flowKey,'checklings:launch:v1')])
      await assert.rejects(f.auth.acceptAssertion(bad),/^Error: Unauthorized$/);
    assert.ok((await f.auth.acceptAssertion(valid)).code);
  });
  await t.test('issuer/audience/tenant/class/epoch/role/PIN claims cannot be supplied by a client',async()=>{
    const f=await fixture(),l=await f.launch();
    for(const change of [{v:2},{iss:'wrong'},{aud:'wrong'},{tenantId:'wrong'},{classId:'wrong'},{memberId:'missing'},{authEpoch:1},{authEpoch:-1},{role:'teacher'},{pin:'synthetic-only'},{jti:'short'},{iat:1.5}])
      await assert.rejects(f.auth.acceptAssertion(f.sign({...l.claims,...change})),/^Error: Unauthorized$/);
    assert.ok((await f.auth.acceptAssertion(f.sign(l.claims))).code);
  });
  await t.test('future/expired/overlong assertions and expired flows are rejected',async()=>{
    const f=await fixture(),l=await f.launch();
    for(const change of [{iat:l.claims.iat+1},{exp:l.claims.iat},{exp:l.claims.iat+31},{iat:l.claims.iat-31,exp:l.claims.iat}])
      await assert.rejects(f.auth.acceptAssertion(f.sign({...l.claims,...change})),/Unauthorized/);
    f.advance(60000);
    await assert.rejects(f.auth.acceptAssertion(f.sign({...l.claims,iat:l.claims.iat+60,exp:l.claims.exp+60})),/Unauthorized/);
  });
  await t.test('assertion ID cannot be replayed on the same or a different flow',async()=>{
    const f=await fixture(),a=await f.launch(),b=await f.launch();
    await f.auth.acceptAssertion(f.sign(a.claims));
    await assert.rejects(f.auth.acceptAssertion(f.sign(a.claims)),/Unauthorized/);
    await assert.rejects(f.auth.acceptAssertion(f.sign({...b.claims,jti:a.claims.jti})),/Unauthorized/);
    assert.ok((await f.auth.acceptAssertion(f.sign(b.claims))).code);
  });
  await t.test('35 concurrent deliveries of one assertion issue exactly one code',async()=>{
    const f=await fixture(),l=await f.launch(),signed=f.sign(l.claims);
    const results=await Promise.allSettled(Array.from({length:35},()=>f.auth.acceptAssertion(signed)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.message==='Unauthorized'));
  });
  await t.test('stolen code without correct cookie, state, challenge or flow cannot log in',async()=>{
    const f=await fixture(),a=await f.launch(),b=await f.launch();
    await assert.rejects(f.auth.acceptAssertion(f.sign({...a.claims,challenge:b.ticket.challenge})),/Unauthorized/);
    const {code}=await f.auth.acceptAssertion(f.sign(a.claims));
    for(const change of [{flowCookie:random()},{state:random()},{flowId:b.ticket.flowId},{code:random()},{flowCookie:''},{role:'teacher'}])
      await assert.rejects(f.auth.exchange({...a.exchange,code,...change}),/Unauthorized/);
    assert.ok((await f.auth.exchange({...a.exchange,code})).token);
  });
  await t.test('35 concurrent code exchanges create exactly one session; replay fails',async()=>{
    const f=await fixture(),l=await f.launch(),{code}=await f.auth.acceptAssertion(f.sign(l.claims));
    const input={...l.exchange,code};
    const results=await Promise.allSettled(Array.from({length:35},()=>f.auth.exchange(input)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.message==='Unauthorized'));
    await assert.rejects(f.auth.exchange(input),/Unauthorized/);
    const rows=(await database.transaction(c=>c.query('SELECT token_hash FROM ck_sessions WHERE tenant_id=$1',[f.actor.tenantId]))).rows;
    assert.equal(rows.length,1);
  });
  await t.test('code expires with the signed assertion even while launch flow is valid',async()=>{
    const f=await fixture(),l=await f.launch(),{code}=await f.auth.acceptAssertion(f.sign(l.claims));
    f.advance(30000);
    await assert.rejects(f.auth.exchange({...l.exchange,code}),/Unauthorized/);
  });
  await t.test('idle expires at two minutes; activity never extends the absolute fifteen minutes',async()=>{
    const f=await fixture(),idle=await f.login();
    f.advance(120000);await assert.rejects(f.authorize(idle.token),/Unauthorized/);
    const active=await f.login();
    for(let i=0;i<14;i++){f.advance(60000);assert.deepEqual(await f.authorize(active.token),f.actor);}
    f.advance(60000);await assert.rejects(f.authorize(active.token),/Unauthorized/);
  });
  await t.test('membership deactivation, class change and PIN epoch rotation block sessions and pending exchange',async()=>{
    const f=await fixture(),l=await f.login();
    for(const [column,value,restore] of [['active',false,true],['class_id','class_b','class_a'],['auth_epoch',1,0]]) {
      const pending=await f.launch(),{code}=await f.auth.acceptAssertion(f.sign(pending.claims));
      await f.update(column,value);
      await assert.rejects(f.authorize(l.token),/Unauthorized/);
      await assert.rejects(f.auth.exchange({...pending.exchange,code}),/Unauthorized/);
      await assert.rejects(f.auth.acceptAssertion(f.sign((await f.launch()).claims)),/Unauthorized/);
      await f.update(column,restore);
    }
  });
  await t.test('logout is durable, idempotent and blocks writes and receipt replay in two tabs',async()=>{
    const f=await fixture(),l=await f.login(),r=await f.store.importLegacy(l.token,'import',exportPet);
    await f.auth.logout(l.token);await f.auth.logout(l.token);await f.auth.logout('malformed');
    const second=createGameStore({database,authorize:createAuthService(f.config).authorize,migrationKey:'synthetic-only-migration-key-at-least-32-characters'});
    await assert.rejects(second.load(l.token,r.creature.id),/Unauthorized/);
    await assert.rejects(f.store.importLegacy(l.token,'import',exportPet),/Unauthorized/);
    await assert.rejects(second.rename(l.token,'rename',{creatureId:r.creature.id,expectedRevision:0,nickname:'Late tab'}),/Unauthorized/);
    const fresh=await f.login();assert.notEqual(fresh.token,l.token);assert.equal((await second.load(fresh.token,r.creature.id)).revision,0);
  });
  await t.test('concurrent logout and writes serialize; no write starts after logout resolves',async()=>{
    const f=await fixture(),l=await f.login(),r=await f.store.importLegacy(l.token,'import',exportPet);
    await Promise.allSettled([f.auth.logout(l.token),...Array.from({length:12},(_,i)=>f.store.rename(l.token,'race_'+i,{creatureId:r.creature.id,expectedRevision:0,nickname:'Race '+i}))]);
    await assert.rejects(f.store.rename(l.token,'after',{creatureId:r.creature.id,expectedRevision:1,nickname:'After logout'}),/Unauthorized/);
  });
  await t.test('session and flow insert failure roll back consumption; loss after commit requires fresh launch',async()=>{
    const f=await fixture(),l=await f.launch(),{code}=await f.auth.acceptAssertion(f.sign(l.claims));
    const input={...l.exchange,code};
    const broken={transaction:work=>database.transaction(c=>work({query:(sql,args)=>{if(sql.includes('UPDATE ck_launch_flows SET consumed_ms'))throw new Error('synthetic failure');return c.query(sql,args);}}))};
    await assert.rejects(createAuthService({...f.config,database:broken}).exchange(input),/synthetic failure/);
    const count=(await database.transaction(c=>c.query('SELECT count(*)::int AS n FROM ck_sessions WHERE tenant_id=$1',[f.actor.tenantId]))).rows[0].n;
    assert.equal(count,0);
    const lost={transaction:async work=>{await database.transaction(work);throw new Error('synthetic lost acknowledgement');}};
    await assert.rejects(createAuthService({...f.config,database:lost}).exchange(input),/lost acknowledgement/);
    await assert.rejects(f.auth.exchange(input),/Unauthorized/);
    assert.ok((await f.login()).token);
  });
  await t.test('unknown, wrong-tenant and malformed sessions cannot authorize private state',async()=>{
    const f=await fixture(),g=await fixture(),l=await f.login();
    for(const token of [random(),'',null,{tenantId:f.actor.tenantId},l.token+'suffix'])await assert.rejects(f.authorize(token),/Unauthorized/);
    await assert.rejects(g.authorize(l.token),/Unauthorized/);
    assert.throws(()=>createAuthService({...f.config,flowKey:f.keys.assertionKey}),/configuration/);
  });
  await t.test('issuer and audience remain bound to flows and sessions in a shared database',async()=>{
    const f=await fixture(),l=await f.login(),pending=await f.launch();
    for(const change of [{audience:'another_game'},{issuer:'another_school'}]) {
      const other=createAuthService({...f.config,...change});
      await assert.rejects(database.transaction(c=>other.authorize(l.token,c)),/Unauthorized/);
      const claims={...pending.claims,aud:change.audience??f.config.audience,iss:change.issuer??f.config.issuer};
      await assert.rejects(other.acceptAssertion(f.sign(claims)),/Unauthorized/);
      await other.logout(l.token);
      assert.deepEqual(await f.authorize(l.token),f.actor);
    }
  });
  await t.test('Done cancels unapproved and approved login flows and is repeatable',async()=>{
    const f=await fixture(),a=await f.launch(),b=await f.launch();
    await f.auth.cancelLaunch(a.flowCookie);await f.auth.cancelLaunch(a.flowCookie);
    await assert.rejects(f.auth.acceptAssertion(f.sign(a.claims)),/Unauthorized/);
    const {code}=await f.auth.acceptAssertion(f.sign(b.claims));
    await f.auth.cancelLaunch(b.flowCookie);
    await assert.rejects(f.auth.exchange({...b.exchange,code}),/Unauthorized/);
    await f.auth.cancelLaunch('malformed');
  });
  await t.test('Done revokes a committed exchange even before its token reaches the browser',async()=>{
    const f=await fixture(),l=await f.login();
    await f.auth.cancelLaunch(l.flowCookie);
    await assert.rejects(f.authorize(l.token),/Unauthorized/);
    const fresh=await f.login();assert.deepEqual(await f.authorize(fresh.token),f.actor);
    await createAuthService({...f.config,audience:'another_game'}).cancelLaunch(fresh.flowCookie);
    assert.deepEqual(await f.authorize(fresh.token),f.actor);
  });
  await t.test('35 exchanges racing cancellation leave no usable session after Done',async()=>{
    const f=await fixture(),l=await f.launch(),{code}=await f.auth.acceptAssertion(f.sign(l.claims));
    const exchanges=Array.from({length:35},()=>f.auth.exchange({...l.exchange,code}));
    const results=await Promise.allSettled([...exchanges,f.auth.cancelLaunch(l.flowCookie)]);
    assert.equal(results.at(-1).status,'fulfilled');
    for(const r of results.slice(0,-1))if(r.status==='fulfilled')await assert.rejects(f.authorize(r.value.token),/Unauthorized/);
    await assert.rejects(f.auth.exchange({...l.exchange,code}),/Unauthorized/);
  });
  await t.test('shared SQL rate budget admits exactly five of 35 concurrent requests',async()=>{
    const key=randomBytes(32),limits={launch:5,exchange:5,logout:5,bridge:5,command:5};
    const a=createRateLimiter({database,key,limits}),b=createRateLimiter({database,key,limits});
    const results=await Promise.all(Array.from({length:35},(_,i)=>(i%2?a:b).take('launch','192.0.2.1')));
    assert.equal(results.filter(Boolean).length,5);
    assert.equal(await a.take('exchange','192.0.2.1'),true);
    assert.equal(await a.take('launch','192.0.2.2'),true);
    const bucket=createHmac('sha256',key).update('launch\n192.0.2.1').digest('hex');
    const row=(await database.transaction(c=>c.query('SELECT * FROM ck_request_limits WHERE bucket_hash=$1',[bucket]))).rows[0];
    assert.equal(row.hits,6);assert.ok(!JSON.stringify(row).includes('192.0.2.1'));
    await assert.rejects(a.take('launch','browser-supplied-text'),/trusted request address/);
  });
  await t.test('rate windows expire using trusted server time; absent database fails closed',async()=>{
    let now=60000;
    const config={database,key:randomBytes(32),limits:{launch:1,exchange:1,logout:1,bridge:1,command:1},clock:async()=>now};
    const limiter=createRateLimiter(config);
    assert.equal(await limiter.take('launch','192.0.2.3'),true);
    assert.equal(await limiter.take('launch','192.0.2.3'),false);
    now=120000;assert.equal(await limiter.take('launch','192.0.2.3'),true);
    await assert.rejects(createRateLimiter({...config,database:{transaction:async()=>{throw new Error('synthetic unavailable');}}}).take('launch','192.0.2.3'),/unavailable/);
  });
  await t.test('session deadline inspection never refreshes idle expiry',async()=>{
    const f=await fixture(),l=await f.login();
    f.advance(60000);assert.deepEqual(await f.auth.sessionWindow(l.token),{remainingMs:60000});
    f.advance(60000);await assert.rejects(f.auth.sessionWindow(l.token),/Unauthorized/);
  });
}
