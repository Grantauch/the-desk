export const staffRoleValues = ['TEACHER', 'SECURITY', 'ADMIN', 'SYSTEM'] as const;
export type StaffRole = (typeof staffRoleValues)[number];

export const capabilityValues = [
  'teacher.section.read',
  'teacher.section.live_state',
  'teacher.section.attendance_backup',
  'teacher.section.pass_start',
  'teacher.section.pass_return',
  'teacher.section.pass_review',
  'teacher.section.pass_correct',
  'teacher.section.student_access',
  'teacher.section.policy_override',
  'teacher.classroom.connect',
  'teacher.classroom.import',
  'teacher.classroom.sync',
  'security.live.read',
  'security.student.lookup_live',
  'security.destination.read',
  'admin.school.read_all_operational',
  'admin.staff.roles.manage',
  'admin.sections.manage',
  'admin.roster.review_manage',
  'admin.policies.manage',
  'admin.destinations.manage',
  'admin.calendar.manage',
  'admin.student_access.manage',
  'admin.pass.correct',
  'admin.audit.read_bounded',
  'admin.reports.read_export',
  'admin.integrations.review',
  'admin.classroom.domain_config',
  'admin.credentials.rotate_deliver'
] as const;

export type Capability = (typeof capabilityValues)[number];

export type VerifiedStaffIdentity = {
  provider: 'GOOGLE' | 'SYNTHETIC';
  subject: string;
  email?: string;
  displayName?: string;
};

export interface StaffIdentityProvider {
  verify(assertion: string): Promise<VerifiedStaffIdentity>;
}

export type SchoolRoleGrant = {
  schoolId: string;
  role: StaffRole;
};

export type StaffPrincipal = {
  sessionId: string;
  userId: string;
  organizationId: string;
  identityProvider: VerifiedStaffIdentity['provider'];
  identitySubject: string;
  roleGrants: readonly SchoolRoleGrant[];
};

export type CreatedStaffSession = {
  sessionId: string;
  token: string;
  expiresAt: string;
};

export class AuthenticationError extends Error {
  readonly statusCode = 401;

  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  readonly statusCode = 403;

  constructor(message = 'Not authorized for that Schoolwide resource.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}
