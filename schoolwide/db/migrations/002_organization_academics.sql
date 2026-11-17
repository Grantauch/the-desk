CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  google_domain text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organizations_google_domain_unique
  ON organizations (lower(google_domain))
  WHERE google_domain IS NOT NULL;

-- SW-010 was never provisioned outside disposable CI, so these new tenant keys are
-- intentionally NOT NULL from their first durable migration rather than carrying a
-- transitional nullable state into the real application model.
ALTER TABLE schools
  ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE schools
  ADD CONSTRAINT schools_organization_id_id_unique UNIQUE (organization_id, id);
CREATE INDEX schools_organization_status_idx ON schools (organization_id, status);

ALTER TABLE users
  ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD COLUMN google_subject_id text,
  ADD COLUMN last_login_at timestamptz;
ALTER TABLE users
  ADD CONSTRAINT users_organization_id_id_unique UNIQUE (organization_id, id);
DROP INDEX IF EXISTS users_primary_email_unique;
CREATE UNIQUE INDEX users_org_primary_email_unique
  ON users (organization_id, lower(primary_email));
CREATE UNIQUE INDEX users_google_subject_unique
  ON users (google_subject_id)
  WHERE google_subject_id IS NOT NULL;

CREATE TABLE staff_profiles (
  user_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  employee_external_id text,
  title text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT,
  UNIQUE (organization_id, employee_external_id)
);

ALTER TABLE user_roles
  ADD COLUMN organization_id uuid NOT NULL,
  ADD COLUMN granted_by_user_id uuid,
  ADD CONSTRAINT user_roles_org_school_fk
    FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT user_roles_org_user_fk
    FOREIGN KEY (organization_id, user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT user_roles_org_grantor_fk
    FOREIGN KEY (organization_id, granted_by_user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT;
CREATE INDEX user_roles_org_school_active_idx
  ON user_roles (organization_id, school_id, role, user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE students
  ADD COLUMN local_student_number text;
CREATE UNIQUE INDEX students_school_local_number_unique
  ON students (school_id, local_student_number)
  WHERE local_student_number IS NOT NULL;

ALTER TABLE student_identity_aliases
  ADD COLUMN external_subject_id text;
CREATE UNIQUE INDEX student_identity_aliases_external_subject_unique
  ON student_identity_aliases (school_id, kind, external_subject_id)
  WHERE external_subject_id IS NOT NULL;

CREATE TABLE academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  label text NOT NULL CHECK (length(trim(label)) > 0),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  UNIQUE (school_id, id),
  UNIQUE (school_id, label)
);
CREATE UNIQUE INDEX academic_years_one_active_per_school
  ON academic_years (school_id)
  WHERE status = 'ACTIVE';
CREATE INDEX academic_years_school_dates_idx
  ON academic_years (school_id, starts_on, ends_on);

CREATE TABLE academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  ordinal integer NOT NULL CHECK (ordinal > 0),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  type text NOT NULL DEFAULT 'MARKING_PERIOD'
    CHECK (type IN ('MARKING_PERIOD', 'SEMESTER', 'TRIMESTER', 'QUARTER', 'OTHER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  FOREIGN KEY (school_id, academic_year_id)
    REFERENCES academic_years(school_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, id),
  UNIQUE (academic_year_id, ordinal),
  UNIQUE (academic_year_id, name)
);
CREATE INDEX academic_terms_school_dates_idx
  ON academic_terms (school_id, starts_on, ends_on);

ALTER TABLE sections
  ADD COLUMN academic_year_id uuid NOT NULL,
  ADD COLUMN code text,
  ADD COLUMN period_code text,
  ADD CONSTRAINT sections_school_academic_year_fk
    FOREIGN KEY (school_id, academic_year_id)
    REFERENCES academic_years(school_id, id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX sections_school_year_code_unique
  ON sections (school_id, academic_year_id, code)
  WHERE code IS NOT NULL;
CREATE INDEX sections_school_year_status_idx
  ON sections (school_id, academic_year_id, status);

ALTER TABLE section_staff_assignments
  ADD COLUMN organization_id uuid NOT NULL,
  DROP CONSTRAINT section_staff_assignments_assignment_role_check,
  ADD CONSTRAINT section_staff_assignments_assignment_role_check
    CHECK (assignment_role IN ('PRIMARY_TEACHER', 'CO_TEACHER', 'SUPPORT', 'SUBSTITUTE')),
  ADD CONSTRAINT section_staff_org_school_fk
    FOREIGN KEY (organization_id, school_id)
    REFERENCES schools(organization_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT section_staff_org_user_fk
    FOREIGN KEY (organization_id, user_id)
    REFERENCES users(organization_id, id) ON DELETE RESTRICT;
CREATE INDEX section_staff_current_lookup_idx
  ON section_staff_assignments (school_id, section_id, user_id, valid_from)
  WHERE revoked_at IS NULL;

ALTER TABLE enrollments
  DROP CONSTRAINT enrollments_status_check,
  DROP CONSTRAINT enrollments_check,
  ADD CONSTRAINT enrollments_status_check
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING_REVIEW')),
  ADD CONSTRAINT enrollments_lifecycle_check
    CHECK (
      (status = 'ACTIVE' AND left_at IS NULL)
      OR (status = 'INACTIVE' AND left_at IS NOT NULL)
      OR (status = 'PENDING_REVIEW' AND left_at IS NULL)
    );
CREATE INDEX enrollments_current_section_student_idx
  ON enrollments (school_id, section_id, student_id)
  WHERE status = 'ACTIVE';
