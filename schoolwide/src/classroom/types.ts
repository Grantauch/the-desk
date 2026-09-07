import type { StaffPrincipal } from '../auth/types.js';

export const classroomApprovedScopes = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
] as const;

export type ClassroomApprovedScope = (typeof classroomApprovedScopes)[number];

export type ClassroomCourse = {
  id: string;
  name: string;
  section?: string | undefined;
  room?: string | undefined;
  ownerId?: string | undefined;
  courseState: string;
};

export type ClassroomPerson = {
  id: string;
  displayName: string;
  email?: string | undefined;
};

export type ClassroomPage<T> = {
  items: readonly T[];
  nextPageToken?: string;
};

export type ClassroomConnectionResult = {
  connectionRef: string;
  scopesGranted: readonly string[];
};

export interface ClassroomProvider {
  beginAuthorization(input: {
    state: string;
    redirectUri: string;
    scopes: readonly ClassroomApprovedScope[];
  }): Promise<{ authorizationUrl: string; pendingRef: string }>;
  completeAuthorization(input: {
    pendingRef: string;
    code: string;
    redirectUri: string;
  }): Promise<ClassroomConnectionResult>;
  listCourses(connectionRef: string, pageToken?: string): Promise<ClassroomPage<ClassroomCourse>>;
  listStudents(connectionRef: string, courseId: string, pageToken?: string): Promise<ClassroomPage<ClassroomPerson>>;
  listTeachers(connectionRef: string, courseId: string, pageToken?: string): Promise<ClassroomPage<ClassroomPerson>>;
}

export class ClassroomProviderError extends Error {
  readonly code: 'EXTERNAL_AUTH_REVOKED' | 'SYNC_INCOMPLETE' | 'EXTERNAL_PROVIDER_ERROR';
  readonly retryable: boolean;

  constructor(
    code: ClassroomProviderError['code'],
    message: string,
    retryable = code !== 'EXTERNAL_AUTH_REVOKED',
  ) {
    super(message);
    this.name = 'ClassroomProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}

export class ClassroomIntegrationError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, statusCode = 400, retryable = false) {
    super(message);
    this.name = 'ClassroomIntegrationError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export type CourseSelection = {
  courseId: string;
  sectionId?: string | undefined;
};

export type ImportPreview = {
  fingerprint: string;
  courses: Array<{
    courseId: string;
    courseName: string;
    sectionId?: string | undefined;
    rosterCount: number;
    teacherCount: number;
    existingMatches: number;
    newStudents: number;
    reviewsRequired: number;
  }>;
};

export type ClassroomLinkScope = {
  linkId: string;
  schoolId: string;
  sectionId: string;
  connectionId: string;
  connectionUserId: string;
};

export type SyncRunSummary = {
  id: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  snapshotComplete: boolean;
  studentsSeen: number;
  teachersSeen: number;
  adds: number;
  reactivations: number;
  deactivations: number;
  pendingRemovals: number;
  reviewsRequired: number;
  errorCategory?: string | undefined;
};

export type ClassroomServicePrincipal = Pick<StaffPrincipal, 'userId' | 'organizationId'>;
