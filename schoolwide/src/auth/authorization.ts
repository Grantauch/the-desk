import type { Database } from '../db/database.js';
import { roleAllowsCapability } from './capabilities.js';
import { AuthorizationError, type Capability, type StaffPrincipal } from './types.js';

interface SectionScopeRow {
  section_id: string;
  school_id: string;
  organization_id: string;
}

export type AuthorizedSectionScope = {
  sectionId: string;
  schoolId: string;
};

export class StaffAuthorizationService {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  requireSchoolCapability(principal: StaffPrincipal, schoolId: string, capability: Capability): void {
    const allowed = principal.roleGrants.some(
      (grant) => grant.schoolId === schoolId && roleAllowsCapability(grant.role, capability),
    );
    if (!allowed) throw new AuthorizationError();
  }

  async requireSectionCapability(
    principal: StaffPrincipal,
    sectionId: string,
    capability: Capability,
  ): Promise<AuthorizedSectionScope> {
    const sections = await this.#database.query<SectionScopeRow>(
      `SELECT sec.id AS section_id, sec.school_id, s.organization_id
         FROM sections sec
         JOIN schools s
           ON s.id = sec.school_id
          AND s.status = 'ACTIVE'
        WHERE sec.id = $1
          AND sec.status = 'ACTIVE'`,
      [sectionId],
    );

    const section = sections[0];
    if (!section || section.organization_id !== principal.organizationId) throw new AuthorizationError();

    const teacherRoleAllows = principal.roleGrants.some(
      (grant) => grant.schoolId === section.school_id && roleAllowsCapability(grant.role, capability),
    );
    if (!teacherRoleAllows) throw new AuthorizationError();

    const assignments = await this.#database.query<{ id: string }>(
      `SELECT id
         FROM section_staff_assignments
        WHERE organization_id = $1
          AND school_id = $2
          AND section_id = $3
          AND user_id = $4
          AND revoked_at IS NULL
          AND valid_from <= now()
          AND (valid_until IS NULL OR valid_until > now())
        LIMIT 1`,
      [principal.organizationId, section.school_id, section.section_id, principal.userId],
    );

    if (!assignments[0]) throw new AuthorizationError();

    return {
      sectionId: section.section_id,
      schoolId: section.school_id,
    };
  }
}
