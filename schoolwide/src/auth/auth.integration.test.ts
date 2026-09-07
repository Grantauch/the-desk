import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { buildApp } from '../app.js';
import type { AppConfig } from '../config.js';
import type { Database } from '../db/database.js';
import { seedTwoSchoolFixture, type TwoSchoolFixture } from '../db/test-fixtures.js';
import { hashOpaqueSessionToken } from './service.js';
import {
  AuthenticationError,
  type StaffIdentityProvider,
  type VerifiedStaffIdentity,
} from './types.js';

const databaseUrl = process.env.DATABASE_URL;

const config: AppConfig = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 8787,
  logLevel: 'silent',
  databaseUrl: 'postgresql://fixture.invalid/schoolwide',
  dbPoolMax: 2,
  instanceId: 'auth-test',
  legacyReadAdapterMode: 'disabled',
  legacyProductionWrites: 'forbidden',
};

class ClientDatabase implements Database {
  readonly #client: PoolClient;

  constructor(client: PoolClient) {
    this.#client = client;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    const result = await this.#client.query<T>(sql, [...parameters]);
    return result.rows;
  }

  async close(): Promise<void> {
    // The surrounding test transaction owns the PoolClient lifecycle.
  }
}

class FixtureIdentityProvider implements StaffIdentityProvider {
  readonly #identities: Readonly<Record<string, VerifiedStaffIdentity>>;

  constructor(identities: Readonly<Record<string, VerifiedStaffIdentity>>) {
    this.#identities = identities;
  }

  async verify(assertion: string): Promise<VerifiedStaffIdentity> {
    const identity = this.#identities[assertion];
    if (!identity) throw new AuthenticationError('Synthetic identity assertion rejected.');
    return identity;
  }
}

type AuthFixture = TwoSchoolFixture & {
  schoolA2: string;
  yearA2: string;
  sectionA3: string;
  securityA: string;
  adminA: string;
  orgOnlyA: string;
  coTeacherA: string;
};

const extraIds = {
  schoolA2: '00000000-0000-0000-0000-000000000103',
  yearA2: '00000000-0000-0000-0000-000000000203',
  sectionA3: '00000000-0000-0000-0000-000000000504',
  securityA: '00000000-0000-0000-0000-000000000303',
  adminA: '00000000-0000-0000-0000-000000000304',
  orgOnlyA: '00000000-0000-0000-0000-000000000305',
  coTeacherA: '00000000-0000-0000-0000-000000000306',
} as const;

async function seedAuthFixture(client: PoolClient): Promise<AuthFixture> {
  const base = await seedTwoSchoolFixture(client);

  await client.query(
    `INSERT INTO schools (id, organization_id, slug, name, primary_domain, timezone)
     VALUES ($1, $2, 'north-middle', 'North Middle', 'north-middle.example.invalid', 'America/Detroit')`,
    [extraIds.schoolA2, base.orgA],
  );

  await client.query(
    `INSERT INTO academic_years (id, school_id, label, starts_on, ends_on)
     VALUES ($1, $2, '2026-27', DATE '2026-08-20', DATE '2027-06-15')`,
    [extraIds.yearA2, extraIds.schoolA2],
  );

  await client.query(
    `INSERT INTO sections (id, school_id, academic_year_id, name, code, period_code, period_label, room)
     VALUES ($1, $2, $3, 'North Middle Section', 'NM-SEC-1', 'P1', '1', 'M101')`,
    [extraIds.sectionA3, extraIds.schoolA2, extraIds.yearA2],
  );

  await client.query(
    `INSERT INTO users (id, organization_id, primary_email, display_name, google_subject_id)
     VALUES
       ($1, $5, 'security-a@north.example.invalid', 'Security Alpha', 'google-security-alpha'),
       ($2, $5, 'admin-a@north.example.invalid', 'Admin Alpha', 'google-admin-alpha'),
       ($3, $5, 'org-only@north.example.invalid', 'Organization Only', 'google-org-only'),
       ($4, $5, 'coteacher-a@north.example.invalid', 'CoTeacher Alpha', 'google-coteacher-alpha')`,
    [extraIds.securityA, extraIds.adminA, extraIds.orgOnlyA, extraIds.coTeacherA, base.orgA],
  );

  await client.query(
    `INSERT INTO staff_profiles (user_id, organization_id, employee_external_id, title)
     VALUES
       ($1, $5, 'EMP-SEC-A', 'Security'),
       ($2, $5, 'EMP-ADM-A', 'Administrator'),
       ($3, $5, 'EMP-ORG-A', 'Staff'),
       ($4, $5, 'EMP-CO-A', 'Teacher')`,
    [extraIds.securityA, extraIds.adminA, extraIds.orgOnlyA, extraIds.coTeacherA, base.orgA],
  );

  await client.query(
    `INSERT INTO user_roles (organization_id, school_id, user_id, role)
     VALUES
       ($1, $2, $3, 'SECURITY'),
       ($1, $2, $4, 'ADMIN'),
       ($1, $2, $5, 'TEACHER')`,
    [base.orgA, base.schoolA, extraIds.securityA, extraIds.adminA, extraIds.coTeacherA],
  );

  await client.query(
    `INSERT INTO section_staff_assignments
       (organization_id, school_id, section_id, user_id, assignment_role)
     VALUES ($1, $2, $3, $4, 'CO_TEACHER')`,
    [base.orgA, base.schoolA, base.sectionA1, extraIds.coTeacherA],
  );

  return { ...base, ...extraIds };
}

function identityProvider(): FixtureIdentityProvider {
  return new FixtureIdentityProvider({
    'teacher-a': {
      provider: 'SYNTHETIC',
      subject: 'google-teacher-alpha',
      // Deliberately wrong email proves authorization maps the immutable subject, not email.
      email: 'admin-a@north.example.invalid',
    },
    'security-a': { provider: 'SYNTHETIC', subject: 'google-security-alpha' },
    'admin-a': { provider: 'SYNTHETIC', subject: 'google-admin-alpha' },
    'org-only-a': { provider: 'SYNTHETIC', subject: 'google-org-only' },
    'coteacher-a': { provider: 'SYNTHETIC', subject: 'google-coteacher-alpha' },
  });
}

type FixtureContext = {
  client: PoolClient;
  app: ReturnType<typeof buildApp>;
  ids: AuthFixture;
};

async function withFixture(pool: Pool, fn: (context: FixtureContext) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  let app: ReturnType<typeof buildApp> | undefined;
  await client.query('BEGIN');
  try {
    const ids = await seedAuthFixture(client);
    app = buildApp({
      config,
      database: new ClientDatabase(client),
      identityProvider: identityProvider(),
      sessionTtlMs: 60_000,
    });
    await fn({ client, app, ids });
  } finally {
    if (app) await app.close();
    await client.query('ROLLBACK');
    client.release();
  }
}

async function signIn(app: ReturnType<typeof buildApp>, assertion: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/session',
    payload: { assertion },
  });
  assert.equal(response.statusCode, 201, response.body);
  const body = response.json() as { token?: string };
  assert.ok(body.token);
  return body.token;
}

function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

test('SW-030 staff authentication and RBAC boundary', { skip: !databaseUrl }, async (t) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 4, application_name: 'grantdesk-schoolwide:auth-test' });

  try {
    await t.test('unauthenticated staff resource requests fail closed', async () => {
      await withFixture(pool, async ({ app, ids }) => {
        const response = await app.inject({ method: 'GET', url: `/api/sections/${ids.sectionA1}/teacher-context` });
        assert.equal(response.statusCode, 401);
      });
    });

    await t.test('verified subject, not asserted email, selects the canonical staff user', async () => {
      await withFixture(pool, async ({ app, ids }) => {
        const token = await signIn(app, 'teacher-a');
        const response = await app.inject({ method: 'GET', url: '/api/me', headers: bearer(token) });
        assert.equal(response.statusCode, 200, response.body);
        const body = response.json() as { userId: string; organizationId: string };
        assert.equal(body.userId, ids.teacherA);
        assert.equal(body.organizationId, ids.orgA);
      });
    });

    await t.test('opaque session tokens are stored only as hashes', async () => {
      await withFixture(pool, async ({ app, client, ids }) => {
        const token = await signIn(app, 'teacher-a');
        const result = await client.query<{ token_hash: string }>(
          'SELECT token_hash FROM staff_sessions WHERE user_id = $1',
          [ids.teacherA],
        );
        assert.equal(result.rows.length, 1);
        assert.equal(result.rows[0]?.token_hash, hashOpaqueSessionToken(token));
        assert.notEqual(result.rows[0]?.token_hash, token);
      });
    });

    await t.test('disabled user is denied even with an existing unexpired session', async () => {
      await withFixture(pool, async ({ app, client, ids }) => {
        const token = await signIn(app, 'teacher-a');
        await client.query(`UPDATE users SET status = 'INACTIVE' WHERE id = $1`, [ids.teacherA]);
        const response = await app.inject({ method: 'GET', url: '/api/me', headers: bearer(token) });
        assert.equal(response.statusCode, 401);
      });
    });

    await t.test('revoked and expired role grants are re-evaluated after sign-in', async () => {
      await withFixture(pool, async ({ app, client, ids }) => {
        const token = await signIn(app, 'teacher-a');
        await client.query(
          `UPDATE user_roles SET revoked_at = now()
            WHERE user_id = $1 AND school_id = $2 AND role = 'TEACHER'`,
          [ids.teacherA, ids.schoolA],
        );
        const revoked = await app.inject({
          method: 'GET',
          url: `/api/sections/${ids.sectionA1}/teacher-context`,
          headers: bearer(token),
        });
        assert.equal(revoked.statusCode, 403);

        await client.query(
          `UPDATE user_roles
              SET revoked_at = NULL,
                  valid_from = now() - interval '2 hours',
                  valid_until = now() - interval '1 hour'
            WHERE user_id = $1 AND school_id = $2 AND role = 'TEACHER'`,
          [ids.teacherA, ids.schoolA],
        );
        const expired = await app.inject({
          method: 'GET',
          url: `/api/sections/${ids.sectionA1}/teacher-context`,
          headers: bearer(token),
        });
        assert.equal(expired.statusCode, 403);
      });
    });

    await t.test('teacher cannot escape section or school scope by changing the URL', async () => {
      await withFixture(pool, async ({ app, ids }) => {
        const token = await signIn(app, 'teacher-a');
        const own = await app.inject({
          method: 'GET',
          url: `/api/sections/${ids.sectionA1}/teacher-context`,
          headers: bearer(token),
        });
        assert.equal(own.statusCode, 200, own.body);

        const sameSchoolOtherSection = await app.inject({
          method: 'GET',
          url: `/api/sections/${ids.sectionA2}/teacher-context`,
          headers: bearer(token),
        });
        assert.equal(sameSchoolOtherSection.statusCode, 403);

        const sameOrganizationOtherSchool = await app.inject({
          method: 'GET',
          url: `/api/sections/${ids.sectionA3}/teacher-context`,
          headers: bearer(token),
        });
        assert.equal(sameOrganizationOtherSchool.statusCode, 403);

        const otherOrganization = await app.inject({
          method: 'GET',
          url: `/api/sections/${ids.sectionB1}/teacher-context`,
          headers: bearer(token),
        });
        assert.equal(otherOrganization.statusCode, 403);
      });
    });

    await t.test('organization membership without a school role grants no school access', async () => {
      await withFixture(pool, async ({ app, ids }) => {
        const token = await signIn(app, 'org-only-a');
        const me = await app.inject({ method: 'GET', url: '/api/me', headers: bearer(token) });
        assert.equal(me.statusCode, 200, me.body);
        assert.deepEqual((me.json() as { roleGrants: unknown[] }).roleGrants, []);

        const admin = await app.inject({
          method: 'GET',
          url: `/api/schools/${ids.schoolA}/admin-context`,
          headers: bearer(token),
        });
        assert.equal(admin.statusCode, 403);
      });
    });

    await t.test('security receives only school-scoped security capability', async () => {
      await withFixture(pool, async ({ app, ids }) => {
        const token = await signIn(app, 'security-a');
        const security = await app.inject({
          method: 'GET',
          url: `/api/schools/${ids.schoolA}/security-context`,
          headers: bearer(token),
        });
        assert.equal(security.statusCode, 200, security.body);

        const teacher = await app.inject({
          method: 'GET',
          url: `/api/sections/${ids.sectionA1}/teacher-context`,
          headers: bearer(token),
        });
        assert.equal(teacher.statusCode, 403);

        const admin = await app.inject({
          method: 'GET',
          url: `/api/schools/${ids.schoolA}/admin-context`,
          headers: bearer(token),
        });
        assert.equal(admin.statusCode, 403);
      });
    });

    await t.test('administrator scope is limited to explicitly assigned school', async () => {
      await withFixture(pool, async ({ app, ids }) => {
        const token = await signIn(app, 'admin-a');
        const own = await app.inject({
          method: 'GET',
          url: `/api/schools/${ids.schoolA}/admin-context`,
          headers: bearer(token),
        });
        assert.equal(own.statusCode, 200, own.body);

        const otherSchool = await app.inject({
          method: 'GET',
          url: `/api/schools/${ids.schoolA2}/admin-context`,
          headers: bearer(token),
        });
        assert.equal(otherSchool.statusCode, 403);
      });
    });

    await t.test('current co-teacher assignment works while expired or revoked assignment fails', async () => {
      await withFixture(pool, async ({ app, client, ids }) => {
        const token = await signIn(app, 'coteacher-a');
        const current = await app.inject({
          method: 'GET',
          url: `/api/sections/${ids.sectionA1}/teacher-context`,
          headers: bearer(token),
        });
        assert.equal(current.statusCode, 200, current.body);

        await client.query(
          `UPDATE section_staff_assignments
              SET valid_from = now() - interval '2 hours',
                  valid_until = now() - interval '1 hour'
            WHERE user_id = $1 AND section_id = $2`,
          [ids.coTeacherA, ids.sectionA1],
        );
        const expired = await app.inject({
          method: 'GET',
          url: `/api/sections/${ids.sectionA1}/teacher-context`,
          headers: bearer(token),
        });
        assert.equal(expired.statusCode, 403);

        await client.query(
          `UPDATE section_staff_assignments
              SET valid_from = now() - interval '2 hours',
                  valid_until = NULL,
                  revoked_at = now()
            WHERE user_id = $1 AND section_id = $2`,
          [ids.coTeacherA, ids.sectionA1],
        );
        const revoked = await app.inject({
          method: 'GET',
          url: `/api/sections/${ids.sectionA1}/teacher-context`,
          headers: bearer(token),
        });
        assert.equal(revoked.statusCode, 403);
      });
    });

    await t.test('client-supplied role, capability, school and section claims do not grant access', async () => {
      await withFixture(pool, async ({ app, ids }) => {
        const token = await signIn(app, 'teacher-a');
        const response = await app.inject({
          method: 'GET',
          url: `/api/sections/${ids.sectionA2}/teacher-context?role=ADMIN&capability=teacher.section.read&schoolId=${ids.schoolA}`,
          headers: {
            ...bearer(token),
            'x-role': 'ADMIN',
            'x-school-id': ids.schoolA,
            'x-section-id': ids.sectionA1,
          },
        });
        assert.equal(response.statusCode, 403);
      });
    });

    await t.test('session rotation invalidates the old token and sign-out invalidates the replacement', async () => {
      await withFixture(pool, async ({ app }) => {
        const original = await signIn(app, 'teacher-a');
        const rotatedResponse = await app.inject({
          method: 'POST',
          url: '/auth/session/rotate',
          headers: bearer(original),
        });
        assert.equal(rotatedResponse.statusCode, 200, rotatedResponse.body);
        const rotated = (rotatedResponse.json() as { token?: string }).token;
        assert.ok(rotated);
        assert.notEqual(rotated, original);

        const oldToken = await app.inject({ method: 'GET', url: '/api/me', headers: bearer(original) });
        assert.equal(oldToken.statusCode, 401);

        const newToken = await app.inject({ method: 'GET', url: '/api/me', headers: bearer(rotated) });
        assert.equal(newToken.statusCode, 200, newToken.body);

        const signOut = await app.inject({ method: 'DELETE', url: '/auth/session', headers: bearer(rotated) });
        assert.equal(signOut.statusCode, 204, signOut.body);

        const afterSignOut = await app.inject({ method: 'GET', url: '/api/me', headers: bearer(rotated) });
        assert.equal(afterSignOut.statusCode, 401);
      });
    });

    await t.test('expired server-side session fails closed', async () => {
      await withFixture(pool, async ({ app, client, ids }) => {
        const token = await signIn(app, 'teacher-a');
        await client.query(
          `UPDATE staff_sessions
              SET created_at = now() - interval '2 hours',
                  expires_at = now() - interval '1 hour'
            WHERE user_id = $1`,
          [ids.teacherA],
        );
        const response = await app.inject({ method: 'GET', url: '/api/me', headers: bearer(token) });
        assert.equal(response.statusCode, 401);
      });
    });
  } finally {
    await pool.end();
  }
});
