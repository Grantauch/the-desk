import { z } from 'zod';

export const roleValues = ['STUDENT', 'TEACHER', 'SECURITY', 'ADMIN', 'SYSTEM'] as const;
export type Role = (typeof roleValues)[number];

const uuidSchema = z.uuid();

export type SchoolPrincipal = {
  principalId: string;
  schoolId: string;
  roles: readonly Role[];
};

export class AuthorizationError extends Error {
  constructor(message = 'Not authorized for that school resource.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function assertSchoolScope(principal: SchoolPrincipal, requestedSchoolId: string): void {
  const principalSchool = uuidSchema.parse(principal.schoolId);
  const requestedSchool = uuidSchema.parse(requestedSchoolId);
  if (principalSchool !== requestedSchool) throw new AuthorizationError();
}

export function hasRole(principal: SchoolPrincipal, role: Role): boolean {
  return principal.roles.includes(role);
}

export function requireAnyRole(principal: SchoolPrincipal, roles: readonly Role[]): void {
  if (!roles.some((role) => hasRole(principal, role))) {
    throw new AuthorizationError('Your GrantDesk role does not allow that action.');
  }
}
