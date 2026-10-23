import {createHash, randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const {planLegacyImport} = createRequire(import.meta.url)('../checklings-foundation/migration.cjs');
const id = value => typeof value==='string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const insist = (value, code) => { if (!value) throw new Error(code); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const keys = (value, allowed) => value && Object.getPrototypeOf(value)===Object.prototype &&
  Object.keys(value).length===allowed.length && allowed.every(k=>Object.hasOwn(value,k));

/** Internal service only. No HTTP mutation route or usable school login exists yet. */
export function createGameStore({database, authorize, migrationKey}) {
  insist(database && typeof database.transaction==='function' && typeof authorize==='function', 'Missing trusted dependencies');
  async function owner(client, token) {
    const actor = await authorize(token);
    insist(actor && id(actor.tenantId) && id(actor.memberId) && id(actor.classId) && Number.isSafeInteger(actor.authEpoch), 'Unauthorized');
    const {rows} = await client.query('SELECT class_id, active, auth_epoch FROM ck_memberships WHERE tenant_id=$1 AND member_id=$2 FOR UPDATE', [actor.tenantId,actor.memberId]);
    insist(rows[0]?.active===true && rows[0].class_id===actor.classId && rows[0].auth_epoch===actor.authEpoch, 'Unauthorized');
    return actor;
  }
  async function command(token, commandId, payload, apply) {
    insist(id(commandId), 'Invalid command ID');
    // Payload consists only of strictly validated primitive command fields.
    const payloadHash=hash(payload);
    return database.transaction(async client => {
      const actor=await owner(client,token);
      const scope=[actor.tenantId,actor.memberId,commandId];
      const previous=await client.query('SELECT payload_hash,response FROM ck_command_receipts WHERE tenant_id=$1 AND member_id=$2 AND command_id=$3',scope);
      if (previous.rows.length) {
        insist(previous.rows[0].payload_hash===payloadHash, 'Command ID reused with different payload');
        return previous.rows[0].response;
      }
      const response=await apply(client,actor);
      await client.query('INSERT INTO ck_command_receipts (tenant_id,member_id,command_id,payload_hash,response) VALUES ($1,$2,$3,$4,$5)', [...scope,payloadHash,JSON.stringify(response)]);
      return response;
    });
  }
  async function journal(client,actor,commandId,creature,previousRevision,kind) {
    await client.query(`INSERT INTO ck_events (event_id,tenant_id,member_id,command_id,creature_id,previous_revision,next_revision,kind,rules_version,details)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'foundation-1',$9)`,
    [randomUUID(),actor.tenantId,actor.memberId,commandId,creature.id,previousRevision,creature.revision,kind,JSON.stringify({schemaVersion:creature.schemaVersion})]);
  }
  return {
    // trustedExport must come from a private school bridge, never a student POST.
    async importLegacy(token, commandId, trustedExport) {
      insist(keys(trustedExport,['raw','officialBestStreak','importedAt']), 'Invalid trusted export');
      insist(trustedExport.raw===null || (typeof trustedExport.raw==='string' && Buffer.byteLength(trustedExport.raw)<=9216), 'Invalid trusted export');
      const {raw,officialBestStreak,importedAt}=trustedExport;
      return command(token,commandId,['import',raw,officialBestStreak,importedAt], async (client,actor) => {
        const args={raw,officialBestStreak,importedAt,tenantId:actor.tenantId,membershipId:actor.memberId,migrationKey};
        const candidate=planLegacyImport(args);
        if (candidate.status==='no-pet') {
          const prior=await client.query('SELECT 1 FROM ck_creatures WHERE tenant_id=$1 AND member_id=$2',[actor.tenantId,actor.memberId]);
          insist(prior.rows.length===0,'Import requires review');
          return {status:'no-pet'};
        }
        insist(candidate.status==='ready','Import requires review');
        const prior=await client.query('SELECT member_id,state FROM ck_creatures WHERE tenant_id=$1 AND member_id=$2 AND source_slot IS NOT NULL FOR UPDATE',[actor.tenantId,actor.memberId]);
        insist(prior.rows.length<=1,'Import requires review');
        if (prior.rows.length) {
          insist(prior.rows[0].member_id===actor.memberId,'Import requires review');
          const replay=planLegacyImport({...args,existing:prior.rows[0].state});
          insist(replay.status==='already-imported','Import requires review');
          return {status:'already-imported',creature:prior.rows[0].state};
        }
        const creature={...candidate.creature,ownerMembershipId:actor.memberId};
        await client.query(`INSERT INTO ck_creatures (tenant_id,creature_id,member_id,source_slot,source_fingerprint,revision,lifecycle,state)
          VALUES ($1,$2,$3,$4,$5,0,'alive',$6)`,[actor.tenantId,creature.id,actor.memberId,creature.legacy.sourceSlot,creature.legacy.sourceFingerprint,JSON.stringify(creature)]);
        await journal(client,actor,commandId,creature,null,'legacy-import');
        return {status:'imported',creature};
      });
    },
    async rename(token, commandId, input) {
      insist(keys(input,['creatureId','expectedRevision','nickname']), 'Invalid rename command');
      const {creatureId,expectedRevision,nickname}=input;
      insist(id(creatureId) && Number.isSafeInteger(expectedRevision) && expectedRevision>=0,'Invalid rename command');
      insist(typeof nickname==='string' && nickname.trim().length>0 && nickname.length<=18 && !/[\x00-\x1f\x7f]/.test(nickname),'Invalid nickname');
      return command(token,commandId,['rename',creatureId,expectedRevision,nickname],async (client,actor) => {
        const {rows}=await client.query('SELECT state FROM ck_creatures WHERE tenant_id=$1 AND member_id=$2 AND creature_id=$3 FOR UPDATE',[actor.tenantId,actor.memberId,creatureId]);
        insist(rows.length===1,'Creature unavailable');
        const creature=rows[0].state;
        insist(creature.lifecycle!=='dead','Creature unavailable');
        insist(creature.revision===expectedRevision,'Stale creature revision');
        creature.nickname=nickname; creature.revision++;
        await client.query('UPDATE ck_creatures SET revision=$1,state=$2 WHERE tenant_id=$3 AND creature_id=$4',[creature.revision,JSON.stringify(creature),actor.tenantId,creatureId]);
        await journal(client,actor,commandId,creature,expectedRevision,'nickname-changed');
        return {status:'saved',creature};
      });
    },
    async load(token, creatureId) {
      insist(id(creatureId),'Invalid creature ID');
      return database.transaction(async client => {
        const actor=await owner(client,token);
        const {rows}=await client.query('SELECT state FROM ck_creatures WHERE tenant_id=$1 AND member_id=$2 AND creature_id=$3',[actor.tenantId,actor.memberId,creatureId]);
        return rows[0]?.state??null;
      });
    },
  };
}
