import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
const opaque=v=>typeof v==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const secret=v=>typeof v==='string' && /^[A-Za-z0-9_-]{43}$/.test(v) && Buffer.from(v,'base64url').toString('base64url')===v;
const exact=(v,fields)=>v && Object.getPrototypeOf(v)===Object.prototype && Object.keys(v).length===fields.length && fields.every(k=>Object.hasOwn(v,k));
const insist=v=>{if(!v)throw new Error('Unauthorized');};
const hash=v=>createHash('sha256').update(v).digest('hex');
const dbClock=async c=>Number((await c.query('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::text AS now_ms')).rows[0].now_ms);

/** Private, complete PER-CLASS roster/policy snapshots, never browser identity.
 * Revision is school-durable; a repeated unchanged snapshot cannot extend its
 * lease. Class -> sorted memberships -> sessions is the global lock order.
 */
export function createSchoolService({database,issuer,tenantId,audience,schoolKey,clock=dbClock}) {
  if(!database || typeof database.transaction!=='function' || !opaque(issuer) || !opaque(tenantId) || !opaque(audience) || !Buffer.isBuffer(schoolKey) || schoolKey.length<32)
    throw new Error('Invalid private school configuration');
  schoolKey=Buffer.from(schoolKey);
  function verify(snapshot) {
    insist(typeof snapshot==='string' && snapshot.length<=7800);
    const [body,signature,...rest]=snapshot.split('.');
    insist(rest.length===0 && /^[A-Za-z0-9_-]+$/.test(body) && secret(signature));
    const expected=createHmac('sha256',schoolKey).update('checklings:school:v1\n'+body).digest();
    insist(timingSafeEqual(expected,Buffer.from(signature,'base64url')));
    let p;try {p=JSON.parse(Buffer.from(body,'base64url'));} catch {throw new Error('Unauthorized');}
    insist(exact(p,['v','iss','aud','tenantId','classId','revision','enabled','members','iat','exp']));
    insist(p.v===1 && p.iss===issuer && p.aud===audience && p.tenantId===tenantId && opaque(p.classId));
    insist(Number.isSafeInteger(p.revision) && p.revision>0 && typeof p.enabled==='boolean');
    insist(Number.isSafeInteger(p.iat) && Number.isSafeInteger(p.exp) && p.exp>p.iat && p.exp-p.iat<=120);
    insist(Array.isArray(p.members) && p.members.length<=35);
    const seen=new Set();
    for(const m of p.members) {
      insist(exact(m,['memberId','credentialVersion','active']) && opaque(m.memberId) && secret(m.credentialVersion) && typeof m.active==='boolean' && !seen.has(m.memberId));
      seen.add(m.memberId);
    }
    // Locale-independent order must match every transaction worker.
    p.members.sort((a,b)=>a.memberId<b.memberId?-1:a.memberId>b.memberId?1:0);
    return p;
  }
  return {async acceptSnapshot(snapshot) {
    const p=verify(snapshot),contentHash=hash(JSON.stringify({enabled:p.enabled,members:p.members}));
    return database.transaction(async c=>{
      const now=await clock(c);insist(Number.isSafeInteger(now) && now>=0 && p.iat*1000<=now && p.exp*1000>now);
      // The initial insert also serializes two first snapshots for one class.
      const inserted=await c.query('INSERT INTO ck_school_classes (tenant_id,class_id,issuer,audience,revision,enabled,valid_until_ms,content_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING class_id',
        [tenantId,p.classId,issuer,audience,p.revision,p.enabled,p.exp*1000,contentHash]);
      const prior=(await c.query('SELECT * FROM ck_school_classes WHERE tenant_id=$1 AND class_id=$2 FOR UPDATE',[tenantId,p.classId])).rows[0];
      insist(prior.issuer===issuer && prior.audience===audience);
      const newer=inserted.rows.length===1 || p.revision>Number(prior.revision);
      // Out-of-order parallel logins may acknowledge identical current facts.
      // They cannot restore old permissions, change credentials or renew a lease.
      insist(newer || (prior.content_hash===contentHash && now<Number(prior.valid_until_ms)));
      if(newer) {
        let changedMembers=0;
        const existing=(await c.query('SELECT * FROM ck_memberships WHERE tenant_id=$1 AND class_id=$2 ORDER BY member_id FOR UPDATE',[tenantId,p.classId])).rows;
        const byId=new Map(existing.map(m=>[m.member_id,m]));
        for(const m of p.members) {
          const old=byId.get(m.memberId),active=p.enabled && m.active;
          if(!old) {
            // A member ID may never be reassigned across classes.
            const added=await c.query('INSERT INTO ck_memberships (tenant_id,member_id,class_id,active,auth_epoch,bridge_credential_version) VALUES ($1,$2,$3,$4,0,$5) ON CONFLICT DO NOTHING RETURNING member_id',[tenantId,m.memberId,p.classId,active,m.credentialVersion]);
            insist(added.rows.length===1);
            changedMembers++;
          } else {
            const changed=old.active!==active || old.bridge_credential_version!==m.credentialVersion || prior.enabled!==p.enabled;
            if(changed)changedMembers++;
            insist(!changed || old.auth_epoch<2147483647);
            await c.query('UPDATE ck_memberships SET active=$1,auth_epoch=auth_epoch+$2,bridge_credential_version=$3 WHERE tenant_id=$4 AND member_id=$5',[active,changed?1:0,m.credentialVersion,tenantId,m.memberId]);
            if(changed)await c.query('UPDATE ck_sessions SET revoked_ms=COALESCE(revoked_ms,$1) WHERE tenant_id=$2 AND member_id=$3',[now,tenantId,m.memberId]);
            byId.delete(m.memberId);
          }
        }
        // Omitted/deleted roster rows lose access; creature/history rows remain.
        for(const old of byId.values()) {
          if(old.active)changedMembers++;
          insist(!old.active || old.auth_epoch<2147483647);
          await c.query('UPDATE ck_memberships SET active=false,auth_epoch=auth_epoch+$1 WHERE tenant_id=$2 AND member_id=$3',[old.active?1:0,tenantId,old.member_id]);
          await c.query('UPDATE ck_sessions SET revoked_ms=COALESCE(revoked_ms,$1) WHERE tenant_id=$2 AND member_id=$3',[now,tenantId,old.member_id]);
        }
        await c.query('UPDATE ck_school_classes SET revision=$1,enabled=$2,valid_until_ms=$3,content_hash=$4 WHERE tenant_id=$5 AND class_id=$6',[p.revision,p.enabled,p.exp*1000,contentHash,tenantId,p.classId]);
        if(inserted.rows.length || prior.enabled!==p.enabled || changedMembers)await c.query('INSERT INTO ck_school_access_events (tenant_id,class_id,revision,issuer,enabled,changed_members,content_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',[tenantId,p.classId,p.revision,issuer,p.enabled,changedMembers,contentHash]);
      }
      const rows=(await c.query('SELECT member_id,auth_epoch FROM ck_memberships WHERE tenant_id=$1 AND class_id=$2 AND active=true ORDER BY member_id',[tenantId,p.classId])).rows;
      return {ok:true,authEpochs:Object.fromEntries(rows.map(m=>[m.member_id,m.auth_epoch]))};
    });
  }};
}
