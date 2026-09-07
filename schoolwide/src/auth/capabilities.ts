import type { Capability, StaffRole } from './types.js';

const teacherCapabilities: readonly Capability[] = [
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
  'teacher.classroom.sync'
];

const securityCapabilities: readonly Capability[] = [
  'security.live.read',
  'security.student.lookup_live',
  'security.destination.read'
];

const adminCapabilities: readonly Capability[] = [
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
];

const roleCapabilities: Readonly<Record<StaffRole, readonly Capability[]>> = {
  TEACHER: teacherCapabilities,
  SECURITY: securityCapabilities,
  ADMIN: adminCapabilities,
  SYSTEM: []
};

export function capabilitiesForRole(role: StaffRole): readonly Capability[] {
  return roleCapabilities[role];
}

export function roleAllowsCapability(role: StaffRole, capability: Capability): boolean {
  return roleCapabilities[role].includes(capability);
}
