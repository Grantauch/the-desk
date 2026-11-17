-- Harden staff-actor provenance so configuration rows cannot name a user from
-- another organization even through raw SQL. Cross-school actors inside the
-- same organization remain possible for future district/school administrators.

ALTER TABLE school_calendar_days ADD COLUMN organization_id uuid;
UPDATE school_calendar_days d
SET organization_id = s.organization_id
FROM schools s
WHERE s.id = d.school_id;
ALTER TABLE school_calendar_days ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE school_calendar_days
  ADD CONSTRAINT school_calendar_days_org_school_fk
    FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT school_calendar_days_org_updater_fk
    FOREIGN KEY (organization_id, updated_by_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE school_policy_sets ADD COLUMN organization_id uuid;
UPDATE school_policy_sets p
SET organization_id = s.organization_id
FROM schools s
WHERE s.id = p.school_id;
ALTER TABLE school_policy_sets ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE school_policy_sets
  ADD CONSTRAINT school_policy_sets_org_school_fk
    FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT school_policy_sets_org_creator_fk
    FOREIGN KEY (organization_id, created_by_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE section_policy_overrides ADD COLUMN organization_id uuid;
UPDATE section_policy_overrides o
SET organization_id = s.organization_id
FROM schools s
WHERE s.id = o.school_id;
ALTER TABLE section_policy_overrides ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE section_policy_overrides
  ADD CONSTRAINT section_policy_overrides_org_school_fk
    FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT section_policy_overrides_org_setter_fk
    FOREIGN KEY (organization_id, set_by_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT;

ALTER TABLE student_access_rules ADD COLUMN organization_id uuid;
UPDATE student_access_rules r
SET organization_id = s.organization_id
FROM schools s
WHERE s.id = r.school_id;
ALTER TABLE student_access_rules ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE student_access_rules
  ADD CONSTRAINT student_access_rules_org_school_fk
    FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT student_access_rules_org_setter_fk
    FOREIGN KEY (organization_id, set_by_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT;
