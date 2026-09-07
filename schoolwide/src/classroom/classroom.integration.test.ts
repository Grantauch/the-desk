import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { buildApp } from '../app.js';
import { AuthenticationError, type StaffIdentityProvider, type StaffPrincipal, type VerifiedStaffIdentity } from '../auth/types.js';
import type { AppConfig } from '../config.js';
import type { QueryExecutor, TransactionalDatabase } from '../db/database.js';
import { fixtureIds, seedTwoSchoolFixture, type TwoSchoolFixture } from '../db/test-fixtures.js';
import { ClassroomIntegrationService } from './service.js';
import {
  ClassroomProviderError,
  classroomApprovedScopes,
  type ClassroomApprovedScope,
  type ClassroomConnectionResult,
  type ClassroomCourse,
  type ClassroomPage,
  type ClassroomPerson,
  type ClassroomProvider,
} from './types.js';

const databaseUrl = process.env.DATABASE_URL;
const CALLBACK = 'https://schoolwide.example.invalid/oauth/classroom/callback';
const NOW = new Date('2026-09-08T13:00:00.000Z');

const config: AppConfig = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 8787,
  logLevel: 'silent',
  databaseUrl: 'postgresql://fixture.invalid/schoolwide',
  dbPoolMax: 2,
  instanceId: 'classroom-test',
  legacyReadAdapterMode: 'disabled',
  legacyProductionWrites: 'forbidden',
};

class SavepointDatabase implements TransactionalDatabase {
  readonly #client: PoolClient;
  #counter = 0;

  constructor(client: PoolClient) {
    this.#client = client;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    return (await this.#client.query<T>(sql, [...parameters])).rows;
  }

  async transaction<T>(work: (transaction: QueryExecutor) => Promise<T>): Promise<T> {
    const savepoint = `sw100_tx_${++this.#counter}`;
    await this.#client.query(`SAVEPOINT ${savepoint}`);
    try {
      const result = await work(this);
      await this.#client.query(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      await this.#client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      await this.#client.query(`RELEASE SAVEPOINT ${savepoint}`);
      throw error;
    }
  }

  async close(): Promise<void> {}
}

class FixtureIdentityProvider implements StaffIdentityProvider {
  async verify(assertion: string): Promise<VerifiedStaffIdentity> {
    if (assertion === 'teacher-alpha') {
      return {
        provider: 'SYNTHETIC',
        subject: 'google-teacher-alpha',
        email: 'teacher-a@north.example.invalid',
        displayName: 'Teacher Alpha',
      };
    }
    if (assertion === 'teacher-beta') {
      return {
        provider: 'SYNTHETIC',
        subject: 'google-teacher-beta',
        email: 'teacher-b@south.example.invalid',
        displayName: 'Teacher Beta',
      };
    }
    throw new AuthenticationError('Synthetic identity assertion rejected.');
  }
}

type ProviderFailure = 'NONE' | 'PARTIAL' | 'REVOKED';

class SyntheticClassroomProvider implements ClassroomProvider {
  requestedScopes: readonly ClassroomApprovedScope[] = [];
  beginRedirectUri = '';
  completedRedirectUri = '';
  completedPendingRef = '';
  coursePages: ClassroomCourse[][] = [[{
    id: 'course-a',
    name: 'US History',
    section: '1',
    room: 'N101',
    ownerId: 'google-teacher-alpha',
    courseState: 'ACTIVE',
  }]];
  studentPages = new Map<string, ClassroomPerson[][]>();
  teacherPages = new Map<string, ClassroomPerson[][]>();
  failure: ProviderFailure = 'NONE';
  listCourseCalls = 0;

  async beginAuthorization(input: {
    state: string;
    redirectUri: string;
    scopes: readonly ClassroomApprovedScope[];
  }): Promise<{ authorizationUrl: string; pendingRef: string }> {
    this.requestedScopes = input.scopes;
    this.beginRedirectUri = input.redirectUri;
    const url = new URL('https://accounts.example.invalid/oauth');
    url.searchParams.set('state', input.state);
    return { authorizationUrl: url.toString(), pendingRef: 'pending-classroom-fixture' };
  }

  async completeAuthorization(input: {
    pendingRef: string;
    code: string;
    redirectUri: string;
  }): Promise<ClassroomConnectionResult> {
    assert.equal(input.code, 'synthetic-code');
    this.completedPendingRef = input.pendingRef;
    this.completedRedirectUri = input.redirectUri;
    return { connectionRef: 'synthetic-connection-ref', scopesGranted: [...classroomApprovedScopes] };
  }

  async listCourses(_connectionRef: string, pageToken?: string): Promise<ClassroomPage<ClassroomCourse>> {
    this.listCourseCalls++;
    if (this.failure === 'REVOKED') {
      throw new ClassroomProviderError('EXTERNAL_AUTH_REVOKED', 'Synthetic Classroom authorization revoked.');
    }
    if (this.failure === 'PARTIAL') {
      throw new ClassroomProviderError('SYNC_INCOMPLETE', 'Synthetic Classroom course pagination failed.');
    }
    return page(this.coursePages, pageToken);
  }

  async listStudents(_connectionRef: string, courseId: string, pageToken?: string): Promise<ClassroomPage<ClassroomPerson>> {
    if (this.failure === 'REVOKED') {
      throw new ClassroomProviderError('EXTERNAL_AUTH_REVOKED', 'Synthetic Classroom authorization revoked.');
    }
    if (this.failure === 'PARTIAL') {
      throw new ClassroomProviderError('SYNC_INCOMPLETE', 'Synthetic Classroom student pagination failed.');
    }
    return page(this.studentPages.get(courseId) ?? [[]], pageToken);
  }

  async listTeachers(_connectionRef: string, courseId: string, pageToken?: string): Promise<ClassroomPage<ClassroomPerson>> {
    if (this.failure === 'REVOKED') {
      throw new ClassroomProviderError('EXTERNAL_AUTH_REVOKED', 'Synthetic Classroom authorization revoked.');
    }
    if (this.failure === 'PARTIAL') {
      throw new ClassroomProviderError('SYNC_INCOMPLETE', 'Synthetic Classroom teacher pagination failed.');
    }
    return page(this.teacherPages.get(courseId) ?? [[{
      id: 'google-teacher-alpha',
      displayName: 'Teacher Alpha',
      email: 'teacher-a@north.example.invalid',
    }]], pageToken);
  }
}

function page<T>(pages: T[][], pageToken?: string): ClassroomPage<T> {
  const index = pageToken ? Number(pageToken.slice(1)) : 0;
  const items = pages[index] ?? [];
  return {
    items,
    ...(index + 1 < pages.length ? { nextPageToken: `p${index + 1}` } : {}),
  };
}

type FixtureContext = {
  client: PoolClient;
  app: ReturnType<typeof buildApp>;
  provider: SyntheticClassroomProvider;
  ids: TwoSchoolFixture;
  token: string;
};

async function signIn(app: ReturnType<typeof buildApp>, assertion = 'teacher-alpha'): Promise<string> {
  const response = await app.inject({ method: 'POST', url: '/auth/session', payload: { assertion } });
  assert.equal(response.statusCode, 201, response.body);
  const token = response.json<{ token: string }>().token;
  assert.ok(token);
  return token;
}

function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

async function withFixture(pool: Pool, work: (context: FixtureContext) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  await client.query('BEGIN');
  let app: ReturnType<typeof buildApp> | null = null;
  try {
    const ids = await seedTwoSchoolFixture(client);
    const provider = new SyntheticClassroomProvider();
    const database = new SavepointDatabase(client);
    app = buildApp({
      config,
      database,
      identityProvider: new FixtureIdentityProvider(),
      classroomProvider: provider,
      classroomOptions: {
        now: () => NOW,
        allowedRedirectUris: [CALLBACK],
        scheduledPollMs: 60_000,
      },
    });
    const token = await signIn(app);
    await work({ client, app, provider, ids, token });
  } finally {
    if (app) await app.close();
    await client.query('ROLLBACK');
    client.release();
  }
}

async function connectClassroom(context: FixtureContext): Promise<string> {
  const start = await context.app.inject({
    method: 'POST',
    url: '/api/v1/integrations/classroom/connect/start',
    headers: auth(context.token),
    payload: { schoolId: context.ids.schoolA, redirectUri: CALLBACK },
  });
  assert.equal(start.statusCode, 200, start.body);
  const authorizationUrl = start.json<{ authorizationUrl: string }>().authorizationUrl;
  const state = new URL(authorizationUrl).searchParams.get('state');
  assert.ok(state);

  const callback = await context.app.inject({
    method: 'GET',
    url: `/api/v1/integrations/classroom/connect/callback?state=${encodeURIComponent(state)}&code=synthetic-code`,
  });
  assert.equal(callback.statusCode, 200, callback.body);
  return callback.json<{ connectionId: string }>().connectionId;
}

async function preview(
  context: FixtureContext,
  sectionId = context.ids.sectionA1,
): Promise<{ fingerprint: string; courses: Array<{ existingMatches: number; newStudents: number; reviewsRequired: number }> }> {
  const response = await context.app.inject({
    method: 'POST',
    url: '/api/v1/integrations/classroom/import/preview',
    headers: auth(context.token),
    payload: {
      schoolId: context.ids.schoolA,
      selections: [{ courseId: 'course-a', sectionId }],
    },
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}

async function commit(
  context: FixtureContext,
  fingerprint: string,
  key: string,
  sectionId = context.ids.sectionA1,
): Promise<{ links: Array<{ linkId: string; sectionId: string; syncRun: { id: string } }> }> {
  const response = await context.app.inject({
    method: 'POST',
    url: '/api/v1/integrations/classroom/import/commit',
    headers: { ...auth(context.token), 'idempotency-key': key },
    payload: {
      schoolId: context.ids.schoolA,
      selections: [{ courseId: 'course-a', sectionId }],
      expectedFingerprint: fingerprint,
    },
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}

async function sync(
  context: FixtureContext,
  linkId: string,
  key: string,
): Promise<{ status: string; snapshotComplete: boolean; deactivations: number; pendingRemovals: number; id: string; errorCategory?: string }> {
  const response = await context.app.inject({
    method: 'POST',
    url: `/api/v1/integrations/classroom/links/${linkId}/sync`,
    headers: { ...auth(context.token), 'idempotency-key': key },
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}

test('SW-100 Google Classroom integration', { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 8, application_name: 'grantdesk-schoolwide:classroom-test' });
  try {
    await t.test('T-GC-001/002 approved read-only scopes, redirect allowlist, one-use state, and server-bound callback redirect', async () => {
      await withFixture(pool, async (context) => {
        const denied = await context.app.inject({
          method: 'POST',
          url: '/api/v1/integrations/classroom/connect/start',
          headers: auth(context.token),
          payload: { schoolId: context.ids.schoolA, redirectUri: 'https://evil.example.invalid/callback' },
        });
        assert.equal(denied.statusCode, 403, denied.body);

        const start = await context.app.inject({
          method: 'POST',
          url: '/api/v1/integrations/classroom/connect/start',
          headers: auth(context.token),
          payload: { schoolId: context.ids.schoolA, redirectUri: CALLBACK },
        });
        assert.equal(start.statusCode, 200, start.body);
        assert.deepEqual(context.provider.requestedScopes, classroomApprovedScopes);
        assert.equal(context.provider.beginRedirectUri, CALLBACK);
        const state = new URL(start.json<{ authorizationUrl: string }>().authorizationUrl).searchParams.get('state');
        assert.ok(state);

        const callback = await context.app.inject({
          method: 'GET',
          url: `/api/v1/integrations/classroom/connect/callback?state=${encodeURIComponent(state)}&code=synthetic-code`,
        });
        assert.equal(callback.statusCode, 200, callback.body);
        assert.equal(context.provider.completedRedirectUri, CALLBACK);
        assert.equal(context.provider.completedPendingRef, 'pending-classroom-fixture');

        const replay = await context.app.inject({
          method: 'GET',
          url: `/api/v1/integrations/classroom/connect/callback?state=${encodeURIComponent(state)}&code=synthetic-code`,
        });
        assert.equal(replay.statusCode, 400, replay.body);
        assert.equal(replay.json<{ code: string }>().code, 'CLASSROOM_OAUTH_STATE_INVALID');

        const stored = await context.client.query<{ state_hash: string; redirect_uri: string; scopes_granted: string[] }>(
          `SELECT s.state_hash,s.redirect_uri,c.scopes_granted
             FROM classroom_oauth_states s
             JOIN classroom_connections c ON c.school_id=s.school_id AND c.user_id=s.user_id
            WHERE s.school_id=$1`,
          [context.ids.schoolA],
        );
        assert.match(stored.rows[0]!.state_hash, /^[0-9a-f]{64}$/);
        assert.notEqual(stored.rows[0]!.state_hash, state);
        assert.equal(stored.rows[0]!.redirect_uri, CALLBACK);
        assert.deepEqual([...stored.rows[0]!.scopes_granted].sort(), [...classroomApprovedScopes].sort());
      });
    });

    await t.test('T-GC-003/004 course discovery is teacher-owned and fully paginated', async () => {
      await withFixture(pool, async (context) => {
        await connectClassroom(context);
        context.provider.coursePages = [
          [{ id: 'course-a', name: 'US History', courseState: 'ACTIVE' }],
          [{ id: 'course-b', name: 'Civics', courseState: 'ACTIVE' }],
        ];
        const response = await context.app.inject({
          method: 'GET',
          url: `/api/v1/integrations/classroom/courses?schoolId=${context.ids.schoolA}`,
          headers: auth(context.token),
        });
        assert.equal(response.statusCode, 200, response.body);
        const courses = response.json<{ courses: ClassroomCourse[] }>().courses;
        assert.deepEqual(courses.map((course) => course.id), ['course-a', 'course-b']);
        assert.equal(context.provider.listCourseCalls, 2);

        const betaToken = await signIn(context.app, 'teacher-beta');
        const forged = await context.app.inject({
          method: 'GET',
          url: `/api/v1/integrations/classroom/courses?schoolId=${context.ids.schoolA}`,
          headers: auth(betaToken),
        });
        assert.equal(forged.statusCode, 403, forged.body);
      });
    });

    await t.test('T-GC-005/008 complete import is idempotent, preserves one canonical identity, and never name-only merges', async () => {
      await withFixture(pool, async (context) => {
        await connectClassroom(context);
        await context.client.query(
          `INSERT INTO student_identity_aliases
             (school_id,student_id,kind,value,normalized_value,source,verified_at)
           VALUES ($1,$2,'EMAIL',$3,$3,'MANUAL',$4::timestamptz)`,
          [context.ids.schoolA, context.ids.studentA, 'matched@north.example.invalid', NOW.toISOString()],
        );
        context.provider.studentPages.set('course-a', [[
          { id: 'google-student-matched', displayName: 'Student Same', email: 'matched@north.example.invalid' },
          { id: 'google-student-name-only', displayName: 'Student Same' },
        ]]);

        const plan = await preview(context);
        assert.equal(plan.courses[0]?.existingMatches, 1);
        assert.equal(plan.courses[0]?.newStudents, 1);
        assert.equal(plan.courses[0]?.reviewsRequired, 0);

        const first = await commit(context, plan.fingerprint, 'import-idempotent-1');
        const second = await commit(context, plan.fingerprint, 'import-idempotent-1');
        assert.equal(second.links[0]?.linkId, first.links[0]?.linkId);
        assert.equal(second.links[0]?.syncRun.id, first.links[0]?.syncRun.id);

        const sameNames = await context.client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM students WHERE school_id=$1 AND display_name='Student Same'`,
          [context.ids.schoolA],
        );
        assert.equal(sameNames.rows[0]?.count, '3');

        const matched = await context.client.query<{ student_id: string }>(
          `SELECT student_id FROM student_identity_aliases
            WHERE school_id=$1 AND kind='GOOGLE_CLASSROOM_USER_ID' AND normalized_value='google-student-matched'`,
          [context.ids.schoolA],
        );
        assert.equal(matched.rows[0]?.student_id, context.ids.studentA);

        const runs = await context.client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM classroom_sync_runs WHERE section_external_link_id=$1`,
          [first.links[0]?.linkId],
        );
        assert.equal(runs.rows[0]?.count, '1');
      });
    });

    await t.test('T-GC-009 conflicting verified identity signals create review and do not auto-merge', async () => {
      await withFixture(pool, async (context) => {
        await connectClassroom(context);
        await context.client.query(
          `INSERT INTO student_identity_aliases
             (school_id,student_id,kind,value,normalized_value,external_subject_id,source,verified_at)
           VALUES ($1,$2,'GOOGLE_CLASSROOM_USER_ID',$3,$3,$3,'GOOGLE_CLASSROOM',$5::timestamptz),
                  ($1,$4,'EMAIL',$6,$6,NULL,'MANUAL',$5::timestamptz)`,
          [context.ids.schoolA, context.ids.studentA, 'google-conflict', context.ids.studentA2, NOW.toISOString(), 'conflict@north.example.invalid'],
        );
        context.provider.studentPages.set('course-a', [[{
          id: 'google-conflict',
          displayName: 'Student Same',
          email: 'conflict@north.example.invalid',
        }]]);
        const plan = await preview(context);
        assert.equal(plan.courses[0]?.reviewsRequired, 1);
        assert.equal(plan.courses[0]?.existingMatches, 0);
        assert.equal(plan.courses[0]?.newStudents, 0);

        const imported = await commit(context, plan.fingerprint, 'ambiguous-import-1');
        const reviews = await context.client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM integration_review_items
            WHERE section_external_link_id=$1 AND review_type='AMBIGUOUS_IDENTITY' AND status='OPEN'`,
          [imported.links[0]?.linkId],
        );
        assert.equal(reviews.rows[0]?.count, '1');
        const enrollment = await context.client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM enrollments WHERE section_id=$1`,
          [context.ids.sectionA1],
        );
        assert.equal(enrollment.rows[0]?.count, '0');
      });
    });

    await t.test('T-GC-006 deactivation requires two consecutive complete absences and retains enrollment history', async () => {
      await withFixture(pool, async (context) => {
        await connectClassroom(context);
        context.provider.studentPages.set('course-a', [[{
          id: 'google-remove-me',
          displayName: 'Roster Student',
          email: 'remove-me@north.example.invalid',
        }]]);
        const plan = await preview(context);
        const imported = await commit(context, plan.fingerprint, 'remove-import-1');
        const linkId = imported.links[0]!.linkId;
        const enrollment = await context.client.query<{ id: string }>(
          `SELECT id FROM enrollments WHERE section_id=$1 AND source_external_id='google-remove-me'`,
          [context.ids.sectionA1],
        );
        const enrollmentId = enrollment.rows[0]?.id;
        assert.ok(enrollmentId);

        context.provider.studentPages.set('course-a', [[]]);
        const firstMissing = await sync(context, linkId, 'remove-sync-1');
        assert.equal(firstMissing.status, 'SUCCESS');
        assert.equal(firstMissing.snapshotComplete, true);
        assert.equal(firstMissing.pendingRemovals, 1);
        assert.equal(firstMissing.deactivations, 0);
        let state = await context.client.query<{ status: string }>('SELECT status FROM enrollments WHERE id=$1', [enrollmentId]);
        assert.equal(state.rows[0]?.status, 'ACTIVE');

        const secondMissing = await sync(context, linkId, 'remove-sync-2');
        assert.equal(secondMissing.status, 'SUCCESS');
        assert.equal(secondMissing.deactivations, 1);
        state = await context.client.query<{ status: string }>('SELECT status FROM enrollments WHERE id=$1', [enrollmentId]);
        assert.equal(state.rows[0]?.status, 'INACTIVE');
        const stillExists = await context.client.query<{ count: string }>('SELECT count(*)::text AS count FROM enrollments WHERE id=$1', [enrollmentId]);
        assert.equal(stillExists.rows[0]?.count, '1');
      });
    });

    await t.test('T-GC-007 partial Classroom failure records incomplete run and removes nobody', async () => {
      await withFixture(pool, async (context) => {
        await connectClassroom(context);
        context.provider.studentPages.set('course-a', [[{ id: 'google-safe', displayName: 'Safe Student' }]]);
        const plan = await preview(context);
        const imported = await commit(context, plan.fingerprint, 'partial-import-1');
        const linkId = imported.links[0]!.linkId;
        context.provider.failure = 'PARTIAL';

        const failed = await sync(context, linkId, 'partial-sync-1');
        assert.equal(failed.status, 'PARTIAL');
        assert.equal(failed.snapshotComplete, false);
        assert.equal(failed.deactivations, 0);
        assert.equal(failed.errorCategory, 'SYNC_INCOMPLETE');
        const active = await context.client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM enrollments
            WHERE section_id=$1 AND source='GOOGLE_CLASSROOM' AND status='ACTIVE'`,
          [context.ids.sectionA1],
        );
        assert.equal(active.rows[0]?.count, '1');
      });
    });

    await t.test('T-GC-010 revoked authorization becomes unhealthy without converting roster to empty', async () => {
      await withFixture(pool, async (context) => {
        const connectionId = await connectClassroom(context);
        context.provider.studentPages.set('course-a', [[{ id: 'google-revoked-safe', displayName: 'Safe Student' }]]);
        const plan = await preview(context);
        const imported = await commit(context, plan.fingerprint, 'revoked-import-1');
        context.provider.failure = 'REVOKED';

        const failed = await sync(context, imported.links[0]!.linkId, 'revoked-sync-1');
        assert.equal(failed.status, 'FAILED');
        assert.equal(failed.snapshotComplete, false);
        assert.equal(failed.deactivations, 0);
        assert.equal(failed.errorCategory, 'EXTERNAL_AUTH_REVOKED');
        const connection = await context.client.query<{ status: string }>('SELECT status FROM classroom_connections WHERE id=$1', [connectionId]);
        assert.equal(connection.rows[0]?.status, 'REVOKED');
        const active = await context.client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM enrollments
            WHERE section_id=$1 AND source='GOOGLE_CLASSROOM' AND status='ACTIVE'`,
          [context.ids.sectionA1],
        );
        assert.equal(active.rows[0]?.count, '1');
      });
    });

    await t.test('T-GC-011 sync retry is idempotent and current section assignment revocation is immediate', async () => {
      await withFixture(pool, async (context) => {
        await connectClassroom(context);
        context.provider.studentPages.set('course-a', [[{ id: 'google-idem-sync', displayName: 'Sync Student' }]]);
        const plan = await preview(context);
        const imported = await commit(context, plan.fingerprint, 'sync-idem-import-1');
        const linkId = imported.links[0]!.linkId;

        const first = await sync(context, linkId, 'sync-idempotency-fixed');
        const second = await sync(context, linkId, 'sync-idempotency-fixed');
        assert.equal(second.id, first.id);
        const count = await context.client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM classroom_sync_runs WHERE section_external_link_id=$1`,
          [linkId],
        );
        assert.equal(count.rows[0]?.count, '2');

        await context.client.query(
          `UPDATE section_staff_assignments SET revoked_at=$2::timestamptz
            WHERE school_id=$1 AND section_id=$3 AND user_id=$4 AND revoked_at IS NULL`,
          [context.ids.schoolA, NOW.toISOString(), context.ids.sectionA1, context.ids.teacherA],
        );
        const denied = await context.app.inject({
          method: 'POST',
          url: `/api/v1/integrations/classroom/links/${linkId}/sync`,
          headers: { ...auth(context.token), 'idempotency-key': 'after-revoke' },
        });
        assert.equal(denied.statusCode, 403, denied.body);
      });
    });
  } finally {
    await pool.end();
  }
});

class ObservationDatabase implements TransactionalDatabase {
  transactionCalls = 0;
  readonly linkId = '00000000-0000-0000-0000-000000009001';
  readonly connectionId = '00000000-0000-0000-0000-000000009002';
  readonly schoolId = fixtureIds.schoolA;
  readonly sectionId = fixtureIds.sectionA1;
  readonly userId = fixtureIds.teacherA;
  readonly orgId = fixtureIds.orgA;

  async query<T extends QueryResultRow = QueryResultRow>(sql: string): Promise<readonly T[]> {
    if (sql.includes('FROM section_external_links l') && sql.includes('JOIN classroom_connections c')) {
      return [{
        id: this.linkId,
        organization_id: this.orgId,
        school_id: this.schoolId,
        section_id: this.sectionId,
        classroom_connection_id: this.connectionId,
        external_course_id: 'course-a',
        connection_user_id: this.userId,
        provider_connection_ref: 'connection-ref',
      }] as unknown as readonly T[];
    }
    if (sql.includes('SELECT status,request_fingerprint,response_json_sanitized FROM idempotency_keys')) return [];
    if (sql.includes('FROM classroom_connections WHERE id=$1')) {
      return [{
        id: this.connectionId,
        organization_id: this.orgId,
        school_id: this.schoolId,
        user_id: this.userId,
        google_account_subject: 'google-teacher-alpha',
        scopes_granted: [...classroomApprovedScopes],
        provider_connection_ref: 'connection-ref',
        status: 'ACTIVE',
      }] as unknown as readonly T[];
    }
    if (sql.includes('INSERT INTO classroom_sync_runs')) {
      return [{ id: '00000000-0000-0000-0000-000000009003' }] as unknown as readonly T[];
    }
    return [];
  }

  async transaction<T>(work: (transaction: QueryExecutor) => Promise<T>): Promise<T> {
    this.transactionCalls++;
    return work(this);
  }

  async close(): Promise<void> {}
}

class BlockingProvider extends SyntheticClassroomProvider {
  entered!: () => void;
  release!: () => void;
  readonly enteredPromise: Promise<void>;
  readonly releasePromise: Promise<void>;

  constructor() {
    super();
    this.enteredPromise = new Promise((resolve) => { this.entered = resolve; });
    this.releasePromise = new Promise((resolve) => { this.release = resolve; });
  }

  override async listCourses(): Promise<ClassroomPage<ClassroomCourse>> {
    this.entered();
    await this.releasePromise;
    throw new ClassroomProviderError('SYNC_INCOMPLETE', 'Synthetic delayed provider failure.');
  }
}

test('T-PERF-005 external Classroom latency does not open the roster-apply database transaction', async () => {
  const database = new ObservationDatabase();
  const provider = new BlockingProvider();
  const service = new ClassroomIntegrationService(database, provider, { now: () => NOW });
  const principal: StaffPrincipal = {
    sessionId: randomUUID(),
    userId: database.userId,
    organizationId: database.orgId,
    identityProvider: 'SYNTHETIC',
    identitySubject: 'google-teacher-alpha',
    roleGrants: [{ schoolId: database.schoolId, role: 'TEACHER' }],
  };

  const operation = service.syncLink({
    principal,
    linkId: database.linkId,
    idempotencyKey: 'perf-no-open-tx',
    correlationId: randomUUID(),
  });
  await provider.enteredPromise;
  assert.equal(database.transactionCalls, 0, 'No database transaction should remain open while waiting on Google Classroom.');
  provider.release();
  const result = await operation;
  assert.equal(result.status, 'PARTIAL');
  assert.equal(database.transactionCalls, 0);
});
