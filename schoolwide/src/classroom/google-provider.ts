import { createHash, randomBytes } from 'node:crypto';
import {
  ClassroomProviderError,
  type ClassroomConnectionResult,
  type ClassroomCourse,
  type ClassroomPage,
  type ClassroomPerson,
  type ClassroomProvider,
} from './types.js';

export type GoogleClassroomSecret =
  | { kind: 'PKCE'; codeVerifier: string }
  | { kind: 'TOKENS'; accessToken: string; refreshToken?: string; expiresAt: number };

export interface GoogleClassroomSecretVault {
  put(reference: string, secret: GoogleClassroomSecret): Promise<void>;
  get(reference: string): Promise<GoogleClassroomSecret | null>;
  delete(reference: string): Promise<void>;
}

export type GoogleClassroomProviderOptions = {
  clientId: string;
  clientSecret?: string;
  vault: GoogleClassroomSecretVault;
  fetchImplementation?: typeof fetch;
  now?: () => number;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function challenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export class GoogleClassroomProvider implements ClassroomProvider {
  readonly #clientId: string;
  readonly #clientSecret?: string;
  readonly #vault: GoogleClassroomSecretVault;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;

  constructor(options: GoogleClassroomProviderOptions) {
    this.#clientId = options.clientId;
    this.#clientSecret = options.clientSecret;
    this.#vault = options.vault;
    this.#fetch = options.fetchImplementation ?? fetch;
    this.#now = options.now ?? Date.now;
  }

  async beginAuthorization(input: { state: string; redirectUri: string; scopes: readonly string[] }): Promise<{ authorizationUrl: string; pendingRef: string }> {
    const verifier = base64Url(randomBytes(48));
    const pendingRef = `pkce_${base64Url(randomBytes(24))}`;
    await this.#vault.put(pendingRef, { kind: 'PKCE', codeVerifier: verifier });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', this.#clientId);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('scope', input.scopes.join(' '));
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', challenge(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
    return { authorizationUrl: url.toString(), pendingRef };
  }

  async completeAuthorization(input: { pendingRef: string; code: string; redirectUri: string }): Promise<ClassroomConnectionResult> {
    const pending = await this.#vault.get(input.pendingRef);
    if (!pending || pending.kind !== 'PKCE') throw new ClassroomProviderError('EXTERNAL_PROVIDER_ERROR', 'Classroom OAuth PKCE state is unavailable.', false);
    const body = new URLSearchParams({
      client_id: this.#clientId,
      code: input.code,
      code_verifier: pending.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
    });
    if (this.#clientSecret) body.set('client_secret', this.#clientSecret);
    const response = await this.#fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
    });
    const payload = await response.json() as TokenResponse;
    if (!response.ok || !payload.access_token) {
      await this.#vault.delete(input.pendingRef);
      throw new ClassroomProviderError('EXTERNAL_PROVIDER_ERROR', 'Google OAuth code exchange failed.', false);
    }
    const connectionRef = `gclass_${base64Url(randomBytes(24))}`;
    await this.#vault.put(connectionRef, {
      kind: 'TOKENS', accessToken: payload.access_token, refreshToken: payload.refresh_token,
      expiresAt: this.#now() + Math.max(1, payload.expires_in ?? 3600) * 1000,
    });
    await this.#vault.delete(input.pendingRef);
    return { connectionRef, scopesGranted: (payload.scope ?? '').split(/\s+/).filter(Boolean) };
  }

  async #accessToken(connectionRef: string): Promise<string> {
    const stored = await this.#vault.get(connectionRef);
    if (!stored || stored.kind !== 'TOKENS') throw new ClassroomProviderError('EXTERNAL_AUTH_REVOKED', 'Classroom authorization is unavailable.');
    if (stored.expiresAt > this.#now() + 30_000) return stored.accessToken;
    if (!stored.refreshToken) throw new ClassroomProviderError('EXTERNAL_AUTH_REVOKED', 'Classroom authorization has expired.');
    const body = new URLSearchParams({ client_id: this.#clientId, grant_type: 'refresh_token', refresh_token: stored.refreshToken });
    if (this.#clientSecret) body.set('client_secret', this.#clientSecret);
    const response = await this.#fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
    });
    const payload = await response.json() as TokenResponse;
    if (!response.ok || !payload.access_token) throw new ClassroomProviderError('EXTERNAL_AUTH_REVOKED', 'Classroom authorization was revoked.');
    await this.#vault.put(connectionRef, {
      kind: 'TOKENS', accessToken: payload.access_token, refreshToken: stored.refreshToken,
      expiresAt: this.#now() + Math.max(1, payload.expires_in ?? 3600) * 1000,
    });
    return payload.access_token;
  }

  async #getJson<T>(connectionRef: string, url: URL): Promise<T> {
    const token = await this.#accessToken(connectionRef);
    const response = await this.#fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (response.status === 401 || response.status === 403) throw new ClassroomProviderError('EXTERNAL_AUTH_REVOKED', 'Google Classroom authorization is no longer valid.');
    if (!response.ok) throw new ClassroomProviderError('SYNC_INCOMPLETE', 'Google Classroom returned an incomplete roster response.');
    return response.json() as Promise<T>;
  }

  async listCourses(connectionRef: string, pageToken?: string): Promise<ClassroomPage<ClassroomCourse>> {
    const url = new URL('https://classroom.googleapis.com/v1/courses');
    url.searchParams.set('teacherId', 'me');
    url.searchParams.append('courseStates', 'ACTIVE');
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await this.#getJson<{ courses?: Array<{ id: string; name: string; section?: string; room?: string; ownerId?: string; courseState?: string }>; nextPageToken?: string }>(connectionRef, url);
    return {
      items: (data.courses ?? []).map((course) => ({ id: course.id, name: course.name, section: course.section, room: course.room, ownerId: course.ownerId, courseState: course.courseState ?? 'UNKNOWN' })),
      nextPageToken: data.nextPageToken,
    };
  }

  async listStudents(connectionRef: string, courseId: string, pageToken?: string): Promise<ClassroomPage<ClassroomPerson>> {
    const url = new URL(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/students`);
    url.searchParams.set('pageSize', '100'); if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await this.#getJson<{ students?: Array<{ userId: string; profile?: { name?: { fullName?: string }; emailAddress?: string } }>; nextPageToken?: string }>(connectionRef, url);
    return { items: (data.students ?? []).map((student) => ({ id: student.userId, displayName: student.profile?.name?.fullName ?? `Classroom user ${student.userId}`, email: student.profile?.emailAddress })), nextPageToken: data.nextPageToken };
  }

  async listTeachers(connectionRef: string, courseId: string, pageToken?: string): Promise<ClassroomPage<ClassroomPerson>> {
    const url = new URL(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/teachers`);
    url.searchParams.set('pageSize', '100'); if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await this.#getJson<{ teachers?: Array<{ userId: string; profile?: { name?: { fullName?: string }; emailAddress?: string } }>; nextPageToken?: string }>(connectionRef, url);
    return { items: (data.teachers ?? []).map((teacher) => ({ id: teacher.userId, displayName: teacher.profile?.name?.fullName ?? `Classroom user ${teacher.userId}`, email: teacher.profile?.emailAddress })), nextPageToken: data.nextPageToken };
  }
}
