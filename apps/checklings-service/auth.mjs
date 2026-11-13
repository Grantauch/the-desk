import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const opaque = value => typeof value==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const secret = value => typeof value==='string' && /^[A-Za-z0-9_-]{43}$/.test(value) && Buffer.from(value,'base64url').toString('base64url')===value;
const exact = (value,fields) => value && Object.getPrototypeOf(value)===Object.prototype && Object.keys(value).length===fields.length && fields.every(k=>Object.hasOwn(value,k));
const insist = condition => {if(!condition) throw new Error('Unauthorized');};
const random = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest('hex');
const challenge = value => createHash('sha256').update(value).digest('base64url');
const equal = (a,b) => {
  if(typeof a!=='string' || typeof b!=='string')return false;
  const left=Buffer.from(a),right=Buffer.from(b);
  return left.length===right.length && timingSafeEqual(left,right);
};
const mac = (key,domain,body) => createHmac('sha256',key).update(domain+'\n'+body).digest('base64url');
const envelope = (key,domain,payload) => {
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body+'.'+mac(key,domain,body);
};
const assertionFields=['v','iss','aud','tenantId','memberId','classId','authEpoch','flowId','challenge','jti','iat','exp'];
const dbClock = async client => Number((await client.query('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::text AS now_ms')).rows[0].now_ms);

/** Internal broker, NOT a public router or a replacement for school verification.
 * Configure exactly one trusted school issuer/tenant per broker instance.
 * Inject clock only for synthetic tests; production uses the database clock.
 */
export function createAuthService({database,issuer,tenantId,audience,assertionKey,flowKey,clock=dbClock}) {
  if(!database || typeof database.transaction!=='function' || !opaque(issuer) || !opaque(tenantId) || !opaque(audience) ||
    !Buffer.isBuffer(assertionKey) || assertionKey.length<32 || !Buffer.isBuffer(flowKey) || flowKey.length<32 || assertionKey.equals(flowKey))
    throw new Error('Invalid private auth configuration');
  // Copy configuration so a caller cannot mutate active keys through a Buffer.
  assertionKey=Buffer.from(assertionKey);flowKey=Buffer.from(flowKey);
  async function time(c) {const now=await clock(c);insist(Number.isSafeInteger(now) && now>=0);return now;}
  async function member(c,actor) {
    const {rows}=await c.query('SELECT class_id,auth_epoch,active FROM ck_memberships WHERE tenant_id=$1 AND member_id=$2 FOR UPDATE',[actor.tenantId,actor.memberId]);
    insist(rows[0]?.active===true && rows[0].class_id===actor.classId && rows[0].auth_epoch===actor.authEpoch);
  }
  function verify(assertion) {
    insist(typeof assertion==='string' && assertion.length<=4096);
    const [body,signature,...rest]=assertion.split('.');
    insist(rest.length===0 && /^[A-Za-z0-9_-]+$/.test(body) && secret(signature));
    insist(equal(mac(assertionKey,'checklings:bridge:v1',body),signature));
    let claims;
    try {claims=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));} catch {throw new Error('Unauthorized');}
    insist(exact(claims,assertionFields));
    insist(claims.v===1 && claims.iss===issuer && claims.aud===audience && claims.tenantId===tenantId && opaque(claims.memberId) && opaque(claims.classId));
    insist(Number.isSafeInteger(claims.authEpoch) && claims.authEpoch>=0 && opaque(claims.flowId) && secret(claims.challenge) && secret(claims.jti));
    insist(Number.isSafeInteger(claims.iat) && Number.isSafeInteger(claims.exp) && claims.exp>claims.iat && claims.exp-claims.iat<=30);
    return claims;
  }
  // Global lock order for authenticated work: membership, then flow/session.
  // First session lookup is an unlocked hint only; recheck after the owner lock.
  async function session(c,token,{touch=true}={}) {
    insist(secret(token));
    const tokenHash=digest(token);
    const hint=(await c.query('SELECT issuer,audience,tenant_id,member_id,class_id,auth_epoch FROM ck_sessions WHERE token_hash=$1',[tokenHash])).rows[0];
    insist(hint && hint.tenant_id===tenantId && hint.issuer===issuer && hint.audience===audience);
    const actor={tenantId:hint.tenant_id,memberId:hint.member_id,classId:hint.class_id,authEpoch:hint.auth_epoch};
    await member(c,actor);
    const row=(await c.query('SELECT * FROM ck_sessions WHERE token_hash=$1 FOR UPDATE',[tokenHash])).rows[0];
    const now=await time(c);
    insist(row && row.issuer===issuer && row.audience===audience && row.tenant_id===tenantId && row.member_id===actor.memberId && row.class_id===actor.classId && row.auth_epoch===actor.authEpoch);
    insist(row && row.revoked_ms===null && now<Number(row.idle_expires_ms) && now<Number(row.absolute_expires_ms));
    const expiry=Math.min(touch?now+120000:Number(row.idle_expires_ms),Number(row.absolute_expires_ms));
    if(touch)await c.query('UPDATE ck_sessions SET idle_expires_ms=$1 WHERE token_hash=$2',[expiry,tokenHash]);
    return {actor,tokenHash,now,remainingMs:expiry-now};
  }
  return {
    async beginLaunch() {
      const flowId=random(),flowCookie=random(),state=random();
      return database.transaction(async c=>{
        const now=await time(c),iat=Math.floor(now/1000),exp=iat+60;
        const proof=challenge(flowCookie);
        await c.query('INSERT INTO ck_launch_flows (flow_id,issuer,audience,cookie_hash,state_hash,challenge,expires_ms) VALUES ($1,$2,$3,$4,$5,$6,$7)',[flowId,issuer,audience,digest(flowCookie),digest(state),proof,exp*1000]);
        const ticket=envelope(flowKey,'checklings:launch:v1',{v:1,iss:audience,aud:issuer,flowId,challenge:proof,state,iat,exp});
        return {flowCookie,state,ticket};
      });
    },
    // Only a private, school-signed assertion enters this method. No PIN input.
    async acceptAssertion(assertion) {
      const claims=verify(assertion);
      return database.transaction(async c=>{
        await member(c,claims);
        const flow=(await c.query('SELECT * FROM ck_launch_flows WHERE flow_id=$1 FOR UPDATE',[claims.flowId])).rows[0];
        const now=await time(c);
        insist(claims.iat*1000<=now && claims.exp*1000>now);
        insist(flow && flow.cancelled_ms===null && flow.issuer===issuer && flow.audience===audience && flow.code_hash===null && now<Number(flow.expires_ms) && equal(flow.challenge,claims.challenge));
        const used=await c.query('INSERT INTO ck_launch_assertions (issuer,assertion_id,flow_id,expires_ms) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING assertion_id',[issuer,claims.jti,claims.flowId,claims.exp*1000]);
        insist(used.rows.length===1);
        const code=random();
        await c.query('UPDATE ck_launch_flows SET tenant_id=$1,member_id=$2,class_id=$3,auth_epoch=$4,code_hash=$5,code_expires_ms=$6 WHERE flow_id=$7',
          [tenantId,claims.memberId,claims.classId,claims.authEpoch,digest(code),Math.min(Number(flow.expires_ms),claims.exp*1000),claims.flowId]);
        return {code};
      });
    },
    async exchange(input) {
      insist(exact(input,['flowId','flowCookie','state','code']));
      const {flowId,flowCookie,state,code}=input;
      insist(opaque(flowId) && secret(flowCookie) && secret(state) && secret(code));
      return database.transaction(async c=>{
        const hint=(await c.query('SELECT tenant_id,member_id,class_id,auth_epoch FROM ck_launch_flows WHERE flow_id=$1',[flowId])).rows[0];
        insist(hint && hint.tenant_id===tenantId);
        const actor={tenantId,memberId:hint.member_id,classId:hint.class_id,authEpoch:hint.auth_epoch};
        await member(c,actor);
        const flow=(await c.query('SELECT * FROM ck_launch_flows WHERE flow_id=$1 FOR UPDATE',[flowId])).rows[0];
        const now=await time(c);
        insist(flow && flow.tenant_id===tenantId && flow.member_id===actor.memberId && flow.class_id===actor.classId && flow.auth_epoch===actor.authEpoch);
        insist(flow && flow.cancelled_ms===null && flow.issuer===issuer && flow.audience===audience && flow.consumed_ms===null && now<Number(flow.expires_ms) && now<Number(flow.code_expires_ms));
        insist(equal(flow.cookie_hash,digest(flowCookie)) && equal(flow.state_hash,digest(state)) && equal(flow.code_hash,digest(code)) && equal(flow.challenge,challenge(flowCookie)));
        const token=random();
        await c.query('INSERT INTO ck_sessions (token_hash,issuer,audience,tenant_id,member_id,class_id,auth_epoch,created_ms,idle_expires_ms,absolute_expires_ms,launch_flow_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[digest(token),issuer,audience,tenantId,actor.memberId,actor.classId,actor.authEpoch,now,now+120000,now+900000,flowId]);
        await c.query('UPDATE ck_launch_flows SET consumed_ms=$1 WHERE flow_id=$2',[now,flowId]);
        return {token};
      });
    },
    // Pass directly as createGameStore.authorize. Never nests transactions.
    async authorize(token,client) {
      insist(client && typeof client.query==='function');
      return (await session(client,token)).actor;
    },
    async sessionWindow(token) {
      return database.transaction(async c=>({remainingMs:(await session(c,token,{touch:false})).remainingMs}));
    },
    async cancelLaunch(flowCookie) {
      if(!secret(flowCookie))return;
      await database.transaction(async c=>{
        // Cancellation takes flow -> session locks and NEVER a membership lock.
        // No session operation later requests a flow lock. An in-flight exchange
        // either sees cancellation or commits first and has its session revoked.
        const {rows}=await c.query('SELECT flow_id FROM ck_launch_flows WHERE cookie_hash=$1 AND issuer=$2 AND audience=$3 FOR UPDATE',[digest(flowCookie),issuer,audience]);
        if(!rows.length)return;
        const now=await time(c),flowId=rows[0].flow_id;
        await c.query('UPDATE ck_launch_flows SET cancelled_ms=COALESCE(cancelled_ms,$1) WHERE flow_id=$2',[now,flowId]);
        await c.query('UPDATE ck_sessions SET revoked_ms=COALESCE(revoked_ms,$1) WHERE launch_flow_id=$2',[now,flowId]);
      });
    },
    async logout(token) {
      // Idempotent even after expiry/revocation. Unknown/malformed tokens are no-op.
      if(!secret(token)) return;
      await database.transaction(async c=>{
        const hint=(await c.query('SELECT issuer,audience,tenant_id,member_id FROM ck_sessions WHERE token_hash=$1',[digest(token)])).rows[0];
        if(!hint || hint.tenant_id!==tenantId || hint.issuer!==issuer || hint.audience!==audience)return;
        await c.query('SELECT 1 FROM ck_memberships WHERE tenant_id=$1 AND member_id=$2 FOR UPDATE',[tenantId,hint.member_id]);
        await c.query('UPDATE ck_sessions SET revoked_ms=COALESCE(revoked_ms,$1) WHERE token_hash=$2',[await time(c),digest(token)]);
      });
    },
  };
}
