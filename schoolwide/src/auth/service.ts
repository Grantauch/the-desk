import { createHash, randomBytes } from 'node:crypto';
import type { Database } from '../db/database.js';
import {
  AuthenticationError,
  type CreatedStaffSession,
  type SchoolRoleGrant,
  type StaffIdentityProvider,
  type StaffPrincipal,
  type StaffRole,
} from './types.js';

const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MIN_SESSION_TTL_MS = 60 * 1000;
const MAX_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface StaffUserRow {
  id: string;
  organization_id: string;
}

interface SessionRow {
  id: string;
  organization_id: string;
  user_id: string;
  identity_provider: 'GOOGLE' | 'SYNTHETIC';
  identity_subject: string;
  expires_at: Date;
}

interface RoleRow {
  school_id: string;
  role: StaffRole;
}

export type StaffAuthenticationOptions = {
  sessionTtlMs?: number;
};

export function hashOpaqueSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function createOpaqueSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export class StaffAuthenticationService {
  readonly #database: Database;
  readonly #identityProvider: StaffIdentityProvider;
  readonly #sessionTtlMs: number;

  constructor(
    database: Database,
    identityProvider: StaffIdentityProvider,
    options: StaffAuthenticationOptions = {},
  ) {
    const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    if (!Number.isFinite(sessionTtlMs) || sessionTtlMs < MIN_SESSION_TTL_MS || sessionTtlMs > MAX_SESSION_TTL_MS) {
      throw new Error('Schoolwide staff session TTL must be between 1 minute and 24 hours.');
    }
    this.#database = database;
    this.#identityProvider = identityProvider;
    this.#sessionTtlMs = sessionTtlMs;
  }

  async signIn(assertion: string, correlationId: string): Promise<CreatedStaffSession> {
    if (!assertion.trim()) throw new AuthenticationError('Identity assertion is required.');

    const identity = await this.#identityProvider.verify(assertion);
    if (!identity.subject.trim()) throw new AuthenticationError('Verified identity subject is missing.');

    const users = await this.#database.query<StaffUserRow>(
      `SELECT u.id, u.organization_id
         FROM users u
         JOIN organizations o ON o.id = u.organization_id AND o.status = 'ACTIVE'
         JOIN staff_profiles sp
           ON sp.organization_id = u.organization_id
          AND sp.user_id = u.id
          AND sp.active = true
        WHERE u.google_subject_id = $1
          AND u.status = 'ACTIVE'`,
      [identity.subject],
    );

    const user = users[0];
    if (users.length !== 1 || !user) {
      throw new AuthenticationError('Verified staff identity is not active in Schoolwide.');
    }

    const token = createOpaqueSessionToken();
    const tokenHash = hashOpaqueSessionToken(token);
    const expiresAt = new Date(Date.now() + this.#sessionTtlMs);

    const sessions = await this.#database.query<{ id: string; expires_at: Date }>(
      `WITH touched_user AS (
         UPDATE users
            SET last_login_at = now(), updated_at = now()
          WHERE id = $1 AND organization_id = $2 AND status = 'ACTIVE'
          RETURNING id
       )
       INSERT INTO staff_sessions
         (organization_id, user_id, identity_provider, identity_subject, token_hash, expires_at, correlation_id)
       SELECT $2, $1, $3, $4, $5, $6, $7
         FROM touched_user
       RETURNING id, expires_at`,
      [user.id, user.organization_id, identity.provider, identity.subject, tokenHash, expiresAt, correlationId],
    );

    const session = sessions[0];
    if (!session) throw new AuthenticationError('Unable to create staff session.');

    return {
      sessionId: session.id,
      token,
      expiresAt: session.expires_at.toISOString(),
    };
  }

  async authenticate(token: string): Promise<StaffPrincipal> {
    if (!token.trim()) throw new AuthenticationError();
    const tokenHash = hashOpaqueSessionToken(token);

    const sessions = await this.#database.query<SessionRow>(
      `SELECT ss.id, ss.organization_id, ss.user_id, ss.identity_provider, ss.identity_subject, ss.expires_at
         FROM staff_sessions ss
         JOIN users u
           ON u.organization_id = ss.organization_id
          AND u.id = ss.user_id
          AND u.status = 'ACTIVE'
         JOIN organizations o
           ON o.id = ss.organization_id
          AND o.status = 'ACTIVE'
         JOIN staff_profiles sp
           ON sp.organization_id = ss.organization_id
          AND sp.user_id = ss.user_id
          AND sp.active = true
        WHERE ss.token_hash = $1
          AND ss.revoked_at IS NULL
          AND ss.expires_at > now()`,
      [tokenHash],
    );

    const session = sessions[0];
    if (sessions.length !== 1 || !session) {
      throw new AuthenticationError('Staff session is invalid or expired.');
    }

    const roleRows = await this.#database.query<RoleRow>(
      `SELECT ur.school_id, ur.role
         FROM user_roles ur
         JOIN schools s
           ON s.organization_id = ur.organization_id
          AND s.id = ur.school_id
          AND s.status = 'ACTIVE'
        WHERE ur.organization_id = $1
          AND ur.user_id = $2
          AND ur.revoked_at IS NULL
          AND ur.valid_from <= now()
          AND (ur.valid_until IS NULL OR ur.valid_until > now())
        ORDER BY ur.school_id, ur.role`,
      [session.organization_id, session.user_id],
    );

    await this.#database.query(
      'UPDATE staff_sessions SET last_used_at = now() WHERE id = $1 AND revoked_at IS NULL',
      [session.id],
    );

    const roleGrants: SchoolRoleGrant[] = roleRows.map((row) => ({
      schoolId: row.school_id,
      role: row.role,
    }));

    return {
      sessionId: session.id,
      userId: session.user_id,
      organizationId: session.organization_id,
      identityProvider: session.identity_provider,
      identitySubject: session.identity_subject,
      roleGrants,
    };
  }

  async rotate(token: string, correlationId: string): Promise<CreatedStaffSession> {
    if (!token.trim()) throw new AuthenticationError();
    const oldTokenHash = hashOpaqueSessionToken(token);
    const newToken = createOpaqueSessionToken();
    const newTokenHash = hashOpaqueSessionToken(newToken);
    const expiresAt = new Date(Date.now() + this.#sessionTtlMs);

    const sessions = await this.#database.query<{ id: string; expires_at: Date }>(
      `WITH current_session AS (
         SELECT ss.id, ss.organization_id, ss.user_id, ss.identity_provider, ss.identity_subject
           FROM staff_sessions ss
           JOIN users u
             ON u.organization_id = ss.organization_id
            AND u.id = ss.user_id
            AND u.status = 'ACTIVE'
           JOIN organizations o
             ON o.id = ss.organization_id
            AND o.status = 'ACTIVE'
           JOIN staff_profiles sp
             ON sp.organization_id = ss.organization_id
            AND sp.user_id = ss.user_id
            AND sp.active = true
          WHERE ss.token_hash = $1
            AND ss.revoked_at IS NULL
            AND ss.expires_at > now()
          FOR UPDATE OF ss
       ), revoked AS (
         UPDATE staff_sessions existing
            SET revoked_at = now()
           FROM current_session current
          WHERE existing.id = current.id
          RETURNING current.id AS old_id,
                    current.organization_id,
                    current.user_id,
                    current.identity_provider,
                    current.identity_subject
       )
       INSERT INTO staff_sessions
         (organization_id, user_id, identity_provider, identity_subject, token_hash, expires_at,
          rotated_from_session_id, correlation_id)
       SELECT organization_id, user_id, identity_provider, identity_subject, $2, $3, old_id, $4
         FROM revoked
       RETURNING id, expires_at`,
      [oldTokenHash, newTokenHash, expiresAt, correlationId],
    );

    const session = sessions[0];
    if (!session) throw new AuthenticationError('Staff session is invalid or expired.');

    return {
      sessionId: session.id,
      token: newToken,
      expiresAt: session.expires_at.toISOString(),
    };
  }

  async signOut(token: string): Promise<void> {
    if (!token.trim()) return;
    await this.#database.query(
      `UPDATE staff_sessions
          SET revoked_at = COALESCE(revoked_at, now())
        WHERE token_hash = $1`,
      [hashOpaqueSessionToken(token)],
    );
  }
}
