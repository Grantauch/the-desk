import type { QueryResultRow } from 'pg';
import type { QueryExecutor } from '../db/database.js';
import { AuditCorrectionError, type EffectiveCountability, type PassHistoryItem } from './types.js';

export interface CorrectablePassRow extends QueryResultRow {
  id: string;
  organization_id: string;
  school_id: string;
  student_id: string;
  section_id: string;
  status: 'OUT' | 'RETURNED' | 'ROLLED_OVER';
  countability: 'PROVISIONAL' | EffectiveCountability;
  started_at: Date;
  returned_at: Date | null;
  duration_ms: number | null;
}

interface LatestCorrectionRow extends QueryResultRow {
  resulting_countability: EffectiveCountability;
}

export async function loadCorrectablePass(executor: QueryExecutor, passId: string, lock = false): Promise<CorrectablePassRow> {
  const rows = await executor.query<CorrectablePassRow>(
    `SELECT id, organization_id, school_id, student_id, section_id, status, countability,
            started_at, returned_at, duration_ms
       FROM passes
      WHERE id=$1
      ${lock ? 'FOR UPDATE' : ''}`,
    [passId],
  );
  const pass = rows[0];
  if (!pass) throw new AuditCorrectionError('PASS_NOT_FOUND', 'Pass was not found.', 404);
  return pass;
}

export async function effectiveCountability(executor: QueryExecutor, pass: CorrectablePassRow): Promise<EffectiveCountability | 'PROVISIONAL'> {
  if (pass.status === 'OUT' || pass.countability === 'PROVISIONAL') return 'PROVISIONAL';
  if (!['COUNTABLE', 'NON_COUNTABLE', 'UNKNOWN_REVIEW'].includes(pass.countability)) {
    throw new AuditCorrectionError('PASS_EVIDENCE_REVIEW_REQUIRED', 'Pass countability cannot be trusted without review.', 409);
  }
  const rows = await executor.query<LatestCorrectionRow>(
    `SELECT resulting_countability
       FROM pass_corrections
      WHERE school_id=$1 AND pass_id=$2
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [pass.school_id, pass.id],
  );
  return rows[0]?.resulting_countability ?? pass.countability;
}

export async function writeCorrectionEvidence(
  executor: QueryExecutor,
  input: {
    organizationId: string;
    schoolId: string;
    actorUserId: string;
    studentId: string;
    sectionId: string;
    passId: string;
    correctionType: 'VOID_COUNTABILITY' | 'RESTORE_COUNTABILITY';
    reasonPrivate: string;
    priorCountability: EffectiveCountability;
    resultingCountability: EffectiveCountability;
    correlationId: string;
    occurredAt: Date;
  },
): Promise<string> {
  const corrections = await executor.query<{ id: string } & QueryResultRow>(
    `INSERT INTO pass_corrections
       (organization_id,school_id,pass_id,correction_type,actor_user_id,reason_private,
        prior_countability,resulting_countability,created_at,correlation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10)
     RETURNING id`,
    [input.organizationId,input.schoolId,input.passId,input.correctionType,input.actorUserId,input.reasonPrivate,input.priorCountability,input.resultingCountability,input.occurredAt.toISOString(),input.correlationId],
  );
  const correction = corrections[0];
  if (!correction) throw new Error('Pass correction insert failed.');

  await executor.query(
    `INSERT INTO staff_actions
       (organization_id,school_id,actor_user_id,action_type,student_id,section_id,pass_id,
        restrictions_bypassed_json,reason_private,occurred_at,correlation_id)
     VALUES ($1,$2,$3,'PASS_CORRECTION',$4,$5,$6,'[]'::jsonb,$7,$8::timestamptz,$9)`,
    [input.organizationId,input.schoolId,input.actorUserId,input.studentId,input.sectionId,input.passId,input.reasonPrivate,input.occurredAt.toISOString(),input.correlationId],
  );

  const metadata = {
    correctionId: correction.id,
    correctionType: input.correctionType,
    sectionId: input.sectionId,
    priorCountability: input.priorCountability,
    resultingCountability: input.resultingCountability,
  };
  await executor.query(
    `INSERT INTO audit_events
       (organization_id,school_id,actor_user_id,actor_student_id,actor_kind,action,target_type,target_id,
        request_id,correlation_id,source,metadata)
     VALUES ($1,$2,$3,NULL,'USER','PASS_CORRECTED','PASS',$4,$5,$5,'APPLICATION',$6::jsonb)`,
    [input.organizationId,input.schoolId,input.actorUserId,input.passId,input.correlationId,JSON.stringify(metadata)],
  );
  await executor.query(
    `INSERT INTO pass_events
       (organization_id,school_id,event_type,resource_type,resource_id,student_id,actor_kind,actor_user_id,
        occurred_at,correlation_id,metadata_json_sanitized)
     VALUES ($1,$2,'PASS_CORRECTED','PASS',$3,$4,'USER',$5,$6::timestamptz,$7,$8::jsonb)`,
    [input.organizationId,input.schoolId,input.passId,input.studentId,input.actorUserId,input.occurredAt.toISOString(),input.correlationId,JSON.stringify(metadata)],
  );
  await executor.query(
    `INSERT INTO transactional_outbox
       (organization_id,school_id,topic,event_type,aggregate_type,aggregate_id,correlation_id,payload_json_sanitized)
     VALUES ($1,$2,'schoolwide.passes','PASS_CORRECTED','PASS',$3,$4,$5::jsonb)`,
    [input.organizationId,input.schoolId,input.passId,input.correlationId,JSON.stringify({ passId: input.passId, studentId: input.studentId, sectionId: input.sectionId, correctionId: correction.id, correctionType: input.correctionType, resultingCountability: input.resultingCountability, correctedAt: input.occurredAt.toISOString() })],
  );
  return correction.id;
}

export async function writeStaffOverrideEvidence(
  executor: QueryExecutor,
  input: {
    organizationId: string;
    schoolId: string;
    actorUserId: string;
    studentId?: string;
    sectionId?: string;
    passId?: string;
    actionType: string;
    restrictionsBypassed: readonly string[];
    reasonPrivate: string;
    correlationId: string;
    occurredAt: Date;
  },
): Promise<string> {
  const rows = await executor.query<{ id: string } & QueryResultRow>(
    `INSERT INTO staff_actions
       (organization_id,school_id,actor_user_id,action_type,student_id,section_id,pass_id,
        restrictions_bypassed_json,reason_private,occurred_at,correlation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::timestamptz,$11)
     RETURNING id`,
    [input.organizationId,input.schoolId,input.actorUserId,input.actionType,input.studentId ?? null,input.sectionId ?? null,input.passId ?? null,JSON.stringify(input.restrictionsBypassed),input.reasonPrivate,input.occurredAt.toISOString(),input.correlationId],
  );
  const action = rows[0]; if (!action) throw new Error('Staff action insert failed.');
  const metadata = { actionId: action.id, actionType: input.actionType, restrictionsBypassed: input.restrictionsBypassed, sectionId: input.sectionId ?? null, passId: input.passId ?? null };
  await executor.query(
    `INSERT INTO audit_events
       (organization_id,school_id,actor_user_id,actor_student_id,actor_kind,action,target_type,target_id,request_id,correlation_id,source,metadata)
     VALUES ($1,$2,$3,NULL,'USER','STAFF_OVERRIDE_RECORDED','STAFF_ACTION',$4,$5,$5,'APPLICATION',$6::jsonb)`,
    [input.organizationId,input.schoolId,input.actorUserId,action.id,input.correlationId,JSON.stringify(metadata)],
  );
  await executor.query(
    `INSERT INTO pass_events
       (organization_id,school_id,event_type,resource_type,resource_id,student_id,actor_kind,actor_user_id,occurred_at,correlation_id,metadata_json_sanitized)
     VALUES ($1,$2,'STAFF_OVERRIDE_RECORDED','STAFF_ACTION',$3,$4,'USER',$5,$6::timestamptz,$7,$8::jsonb)`,
    [input.organizationId,input.schoolId,action.id,input.studentId ?? null,input.actorUserId,input.occurredAt.toISOString(),input.correlationId,JSON.stringify(metadata)],
  );
  await executor.query(
    `INSERT INTO transactional_outbox
       (organization_id,school_id,topic,event_type,aggregate_type,aggregate_id,correlation_id,payload_json_sanitized)
     VALUES ($1,$2,'schoolwide.staff-actions','STAFF_OVERRIDE_RECORDED','STAFF_ACTION',$3,$4,$5::jsonb)`,
    [input.organizationId,input.schoolId,action.id,input.correlationId,JSON.stringify(metadata)],
  );
  return action.id;
}

export async function loadPassHistory(executor: QueryExecutor, pass: CorrectablePassRow, limit: number): Promise<readonly PassHistoryItem[]> {
  const rows = await executor.query<{
    kind: 'EVENT' | 'CORRECTION' | 'STAFF_ACTION'; id: string; occurred_at: Date; action: string;
    actor_user_id: string | null; reason_private: string | null; metadata: unknown;
  } & QueryResultRow>(
    `SELECT * FROM (
       SELECT 'EVENT'::text AS kind, pe.id, pe.occurred_at, pe.event_type AS action,
              pe.actor_user_id, NULL::text AS reason_private, pe.metadata_json_sanitized AS metadata
         FROM pass_events pe
        WHERE pe.school_id=$1 AND pe.resource_type='PASS' AND pe.resource_id=$2
       UNION ALL
       SELECT 'CORRECTION'::text AS kind, pc.id, pc.created_at AS occurred_at, pc.correction_type AS action,
              pc.actor_user_id, pc.reason_private,
              jsonb_build_object('priorCountability',pc.prior_countability,'resultingCountability',pc.resulting_countability) AS metadata
         FROM pass_corrections pc
        WHERE pc.school_id=$1 AND pc.pass_id=$2
       UNION ALL
       SELECT 'STAFF_ACTION'::text AS kind, sa.id, sa.occurred_at, sa.action_type AS action,
              sa.actor_user_id, sa.reason_private,
              jsonb_build_object('restrictionsBypassed',sa.restrictions_bypassed_json) AS metadata
         FROM staff_actions sa
        WHERE sa.school_id=$1 AND sa.pass_id=$2
     ) history
     ORDER BY occurred_at DESC, id DESC
     LIMIT $3`,
    [pass.school_id,pass.id,limit],
  );
  return rows.map((row) => ({
    kind: row.kind,
    id: row.id,
    occurredAt: row.occurred_at.toISOString(),
    action: row.action,
    actorUserId: row.actor_user_id,
    ...(row.reason_private === null ? {} : { reasonPrivate: row.reason_private }),
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
  }));
}
