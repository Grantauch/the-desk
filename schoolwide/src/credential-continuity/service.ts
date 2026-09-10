import { createHash } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { roleAllowsCapability } from '../auth/capabilities.js';
import type { Capability, StaffPrincipal } from '../auth/types.js';
import type { Database, QueryExecutor } from '../db/database.js';
import { supportsTransactions } from '../db/database.js';

export class CredentialContinuityError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;
  constructor(code: string, message: string, statusCode = 400, retryable = false) {
    super(message); this.name = 'CredentialContinuityError'; this.code = code; this.statusCode = statusCode; this.retryable = retryable;
  }
}

type CandidateRow = QueryResultRow & {
  identity_key_hash: string;
  student_id: string | null;
  legacy_credential_present: boolean | null;
  credential_id: string | null;
  credential_version: number | null;
  verifier_scheme: 'SCRYPT_PEPPER_V1' | 'LEGACY_SHA256_SALT_V1' | null;
};

type ContinuityRecord = {
  identityKeyHash: string;
  studentId: string | null;
  legacyCredentialPresent: boolean | null;
  schoolwideCredentialPresent: boolean;
  schoolwideCredentialVersion: number | null;
  schoolwideVerifierScheme: CandidateRow['verifier_scheme'];
  continuityAction: 'PRESERVE' | 'PROVISION_REQUIRED' | 'BLOCKED';
  rollbackAction: 'RECONCILE_LEGACY_AUTHORITY' | 'NO_LEGACY_CREDENTIAL_OBSERVED' | 'REVIEW_REQUIRED';
};

export type CredentialContinuityResult = {
  mode: 'CREDENTIAL_CONTINUITY_PLAN';
  continuityRunId: string;
  replayed: boolean;
  sourceSnapshotFingerprint: string;
  status: 'PASS' | 'REVIEW' | 'FAIL';
  counts: { preserve: number; provisionRequired: number; blocked: number };
  artifactDigest: string;
  legacyWrites: 0;
  credentialSecretWrites: 0;
  records: readonly ContinuityRecord[];
  recoveryArtifact: {
    version: 'SW160_RECOVERY_V1';
    sourceSnapshotFingerprint: string;
    legacyAuthority: 'UNCHANGED';
    schoolwideAuthority: 'NON_AUTHORITATIVE';
    legacyWriteExecutor: false;
    instructions: readonly { identityKeyHash: string; studentId: string | null; action: ContinuityRecord['rollbackAction'] }[];
  };
};

function sha256(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex'); }
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function actionFor(row: CandidateRow): ContinuityRecord['continuityAction'] {
  if (!row.student_id || row.legacy_credential_present === null) return 'BLOCKED';
  return row.credential_id ? 'PRESERVE' : 'PROVISION_REQUIRED';
}
function rollbackFor(row: CandidateRow): ContinuityRecord['rollbackAction'] {
  if (!row.student_id || row.legacy_credential_present === null) return 'REVIEW_REQUIRED';
  return row.legacy_credential_present ? 'RECONCILE_LEGACY_AUTHORITY' : 'NO_LEGACY_CREDENTIAL_OBSERVED';
}
function statusFor(records: readonly ContinuityRecord[]): CredentialContinuityResult['status'] {
  return records.some((record) => record.continuityAction === 'BLOCKED') ? 'REVIEW' : 'PASS';
}
function resultFromRows(run: QueryResultRow & { id:string; source_snapshot_fingerprint:string; status:'PASS'|'REVIEW'|'FAIL'; preserve_count:number; provision_required_count:number; blocked_count:number; artifact_digest:string }, records: readonly ContinuityRecord[], artifact: CredentialContinuityResult['recoveryArtifact'], replayed: boolean): CredentialContinuityResult {
  return { mode:'CREDENTIAL_CONTINUITY_PLAN', continuityRunId:run.id, replayed, sourceSnapshotFingerprint:run.source_snapshot_fingerprint, status:run.status, counts:{preserve:Number(run.preserve_count),provisionRequired:Number(run.provision_required_count),blocked:Number(run.blocked_count)}, artifactDigest:run.artifact_digest, legacyWrites:0, credentialSecretWrites:0, records, recoveryArtifact:artifact };
}

export class CredentialContinuityService {
  readonly #database: Database;
  constructor(database: Database) { this.#database = database; }

  resolveSchoolId(principal: StaffPrincipal, capability: Capability): string {
    const schoolIds = [...new Set(principal.roleGrants.filter((grant) => grant.role === 'ADMIN' && roleAllowsCapability(grant.role, capability)).map((grant) => grant.schoolId))];
    if (schoolIds.length === 0) throw new CredentialContinuityError('CREDENTIAL_CONTINUITY_SCOPE_DENIED','No current administrator credential-continuity scope is available.',403);
    if (schoolIds.length !== 1) throw new CredentialContinuityError('CREDENTIAL_CONTINUITY_SCOPE_AMBIGUOUS','Credential continuity requires exactly one current authorized school scope.',409);
    return schoolIds[0]!;
  }

  async plan(principal: StaffPrincipal, schoolId: string, shadowImportRunId: string): Promise<CredentialContinuityResult> {
    if (!supportsTransactions(this.#database)) throw new CredentialContinuityError('CREDENTIAL_CONTINUITY_TRANSACTION_REQUIRED','Credential continuity planning requires transactional Schoolwide storage.',503,true);
    const existing = await this.#existing(this.#database, schoolId, shadowImportRunId);
    if (existing) return existing;
    return this.#database.transaction(async (tx) => {
      const shadowRows = await tx.query<QueryResultRow & { id:string; source_snapshot_fingerprint:string; status:string }>(`SELECT mir.id,mir.source_snapshot_fingerprint,mir.status FROM migration_import_runs mir JOIN migration_shadow_parity_reports pr ON pr.import_run_id=mir.id AND pr.school_id=mir.school_id WHERE mir.organization_id=$1 AND mir.school_id=$2 AND mir.id=$3 AND mir.mode='IMPORT_SHADOW' AND mir.status='PASS' AND pr.overall_status='PASS' LIMIT 1 FOR UPDATE`,[principal.organizationId,schoolId,shadowImportRunId]);
      const shadow = shadowRows[0];
      if (!shadow) throw new CredentialContinuityError('CREDENTIAL_CONTINUITY_SHADOW_NOT_CERTIFIED','A completed PASS shadow migration/parity run is required before credential continuity planning.',409);
      const candidates = await tx.query<CandidateRow>(`WITH identities AS (SELECT DISTINCT msr.identity_key_hash FROM migration_shadow_records msr WHERE msr.import_run_id=$1 AND msr.school_id=$2 AND msr.identity_key_hash IS NOT NULL), coverage AS (SELECT msr.identity_key_hash, CASE WHEN count(*) FILTER (WHERE (msr.state_json->>'hasCredential')='true')>0 THEN true WHEN count(*) FILTER (WHERE (msr.state_json->>'hasCredential')='false')>0 THEN false ELSE NULL END AS legacy_credential_present FROM migration_shadow_records msr WHERE msr.import_run_id=$1 AND msr.school_id=$2 AND msr.record_type='CREDENTIAL_COVERAGE' AND msr.identity_key_hash IS NOT NULL GROUP BY msr.identity_key_hash), aliases AS (SELECT encode(digest(lower(trim(sia.normalized_value)),'sha256'),'hex') AS identity_key_hash,sia.student_id FROM student_identity_aliases sia WHERE sia.school_id=$2 AND sia.kind='LEGACY_STUDENT_KEY' AND sia.retired_at IS NULL) SELECT i.identity_key_hash,a.student_id,c.legacy_credential_present,sc.id AS credential_id,sc.credential_version,sc.verifier_scheme FROM identities i LEFT JOIN aliases a ON a.identity_key_hash=i.identity_key_hash LEFT JOIN coverage c ON c.identity_key_hash=i.identity_key_hash LEFT JOIN student_credentials sc ON sc.school_id=$2 AND sc.student_id=a.student_id AND sc.credential_type='PIN' AND sc.status='ACTIVE' ORDER BY i.identity_key_hash`,[shadowImportRunId,schoolId]);
      const records: ContinuityRecord[] = candidates.map((row) => ({ identityKeyHash:row.identity_key_hash,studentId:row.student_id,legacyCredentialPresent:row.legacy_credential_present,schoolwideCredentialPresent:row.credential_id!==null,schoolwideCredentialVersion:row.credential_version,schoolwideVerifierScheme:row.verifier_scheme,continuityAction:actionFor(row),rollbackAction:rollbackFor(row) }));
      const preserve=records.filter((record)=>record.continuityAction==='PRESERVE').length, provisionRequired=records.filter((record)=>record.continuityAction==='PROVISION_REQUIRED').length, blocked=records.filter((record)=>record.continuityAction==='BLOCKED').length;
      const recoveryArtifact: CredentialContinuityResult['recoveryArtifact'] = { version:'SW160_RECOVERY_V1', sourceSnapshotFingerprint:shadow.source_snapshot_fingerprint, legacyAuthority:'UNCHANGED', schoolwideAuthority:'NON_AUTHORITATIVE', legacyWriteExecutor:false, instructions:records.map((record)=>({identityKeyHash:record.identityKeyHash,studentId:record.studentId,action:record.rollbackAction})) };
      const artifactDigest=sha256(stable(recoveryArtifact)); const status=statusFor(records);
      const runRows=await tx.query<QueryResultRow & { id:string }>(`INSERT INTO migration_credential_continuity_runs (organization_id,school_id,shadow_import_run_id,source_snapshot_fingerprint,status,preserve_count,provision_required_count,blocked_count,artifact_digest,created_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[principal.organizationId,schoolId,shadowImportRunId,shadow.source_snapshot_fingerprint,status,preserve,provisionRequired,blocked,artifactDigest,principal.userId]);
      const runId=runRows[0]?.id; if(!runId) throw new CredentialContinuityError('CREDENTIAL_CONTINUITY_FAILED','Could not create credential continuity run.',500,true);
      for(const record of records) await tx.query(`INSERT INTO migration_credential_continuity_records (organization_id,school_id,continuity_run_id,identity_key_hash,student_id,legacy_credential_present,schoolwide_credential_present,schoolwide_credential_version,schoolwide_verifier_scheme,continuity_action,rollback_action) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[principal.organizationId,schoolId,runId,record.identityKeyHash,record.studentId,record.legacyCredentialPresent,record.schoolwideCredentialPresent,record.schoolwideCredentialVersion,record.schoolwideVerifierScheme,record.continuityAction,record.rollbackAction]);
      await tx.query(`INSERT INTO migration_recovery_artifacts (organization_id,school_id,continuity_run_id,source_snapshot_fingerprint,artifact_digest,artifact_json) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,[principal.organizationId,schoolId,runId,shadow.source_snapshot_fingerprint,artifactDigest,JSON.stringify(recoveryArtifact)]);
      return { mode:'CREDENTIAL_CONTINUITY_PLAN',continuityRunId:runId,replayed:false,sourceSnapshotFingerprint:shadow.source_snapshot_fingerprint,status,counts:{preserve,provisionRequired,blocked},artifactDigest,legacyWrites:0,credentialSecretWrites:0,records,recoveryArtifact };
    });
  }

  async #existing(executor: QueryExecutor, schoolId: string, shadowImportRunId: string): Promise<CredentialContinuityResult | null> {
    const runs=await executor.query<QueryResultRow & {id:string;source_snapshot_fingerprint:string;status:'PASS'|'REVIEW'|'FAIL';preserve_count:number;provision_required_count:number;blocked_count:number;artifact_digest:string}>(`SELECT id,source_snapshot_fingerprint,status,preserve_count,provision_required_count,blocked_count,artifact_digest FROM migration_credential_continuity_runs WHERE school_id=$1 AND shadow_import_run_id=$2 LIMIT 1`,[schoolId,shadowImportRunId]); const run=runs[0]; if(!run)return null;
    const rows=await executor.query<QueryResultRow & {identity_key_hash:string;student_id:string|null;legacy_credential_present:boolean|null;schoolwide_credential_present:boolean;schoolwide_credential_version:number|null;schoolwide_verifier_scheme:CandidateRow['verifier_scheme'];continuity_action:ContinuityRecord['continuityAction'];rollback_action:ContinuityRecord['rollbackAction']}>(`SELECT identity_key_hash,student_id,legacy_credential_present,schoolwide_credential_present,schoolwide_credential_version,schoolwide_verifier_scheme,continuity_action,rollback_action FROM migration_credential_continuity_records WHERE continuity_run_id=$1 ORDER BY identity_key_hash`,[run.id]);
    const records=rows.map((row)=>({identityKeyHash:row.identity_key_hash,studentId:row.student_id,legacyCredentialPresent:row.legacy_credential_present,schoolwideCredentialPresent:row.schoolwide_credential_present,schoolwideCredentialVersion:row.schoolwide_credential_version,schoolwideVerifierScheme:row.schoolwide_verifier_scheme,continuityAction:row.continuity_action,rollbackAction:row.rollback_action}));
    const artifacts=await executor.query<QueryResultRow & {artifact_json:CredentialContinuityResult['recoveryArtifact']}>(`SELECT artifact_json FROM migration_recovery_artifacts WHERE continuity_run_id=$1 LIMIT 1`,[run.id]); const artifact=artifacts[0]?.artifact_json; if(!artifact)throw new CredentialContinuityError('CREDENTIAL_CONTINUITY_EVIDENCE_INCOMPLETE','Credential continuity evidence is incomplete.',503,true);
    return resultFromRows(run,records,artifact,true);
  }
}
