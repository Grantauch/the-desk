CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  primary_domain text,
  timezone text NOT NULL DEFAULT 'America/Detroit',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_email text NOT NULL CHECK (primary_email = lower(primary_email) AND position('@' in primary_email) > 1),
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_primary_email_unique ON users (lower(primary_email));

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('TEACHER', 'SECURITY', 'ADMIN', 'SYSTEM')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);
CREATE INDEX user_roles_school_user_idx ON user_roles (school_id, user_id);
CREATE INDEX user_roles_school_role_idx ON user_roles (school_id, role) WHERE revoked_at IS NULL;

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, id)
);
CREATE INDEX students_school_status_idx ON students (school_id, status);

CREATE TABLE student_identity_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('EMAIL', 'GOOGLE_CLASSROOM_USER_ID', 'LEGACY_EMAIL', 'LEGACY_STUDENT_KEY')),
  value text NOT NULL CHECK (length(trim(value)) > 0),
  normalized_value text NOT NULL CHECK (length(trim(normalized_value)) > 0),
  source text NOT NULL DEFAULT 'MANUAL',
  verified_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (school_id, student_id) REFERENCES students(school_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, kind, normalized_value)
);
CREATE INDEX student_identity_aliases_student_idx ON student_identity_aliases (school_id, student_id);

CREATE TABLE sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  period_label text,
  room text,
  source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'GOOGLE_CLASSROOM', 'LEGACY_IMPORT')),
  source_external_id text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, id)
);
CREATE UNIQUE INDEX sections_source_identity_unique
  ON sections (school_id, source, source_external_id)
  WHERE source_external_id IS NOT NULL;
CREATE INDEX sections_school_status_idx ON sections (school_id, status);

CREATE TABLE section_staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  section_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assignment_role text NOT NULL CHECK (assignment_role IN ('TEACHER', 'SUBSTITUTE')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (school_id, section_id) REFERENCES sections(school_id, id) ON DELETE RESTRICT,
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);
CREATE INDEX section_staff_assignments_lookup_idx
  ON section_staff_assignments (school_id, user_id, section_id)
  WHERE revoked_at IS NULL;

CREATE TABLE enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  section_id uuid NOT NULL,
  student_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'GOOGLE_CLASSROOM', 'LEGACY_IMPORT')),
  source_external_id text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (school_id, section_id) REFERENCES sections(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, student_id) REFERENCES students(school_id, id) ON DELETE RESTRICT,
  UNIQUE (section_id, student_id),
  CHECK ((status = 'ACTIVE' AND left_at IS NULL) OR status = 'INACTIVE')
);
CREATE INDEX enrollments_school_section_status_idx ON enrollments (school_id, section_id, status);
CREATE INDEX enrollments_school_student_status_idx ON enrollments (school_id, student_id, status);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  actor_kind text NOT NULL CHECK (actor_kind IN ('USER', 'STUDENT', 'SYSTEM', 'MIGRATION')),
  action text NOT NULL CHECK (length(trim(action)) > 0),
  target_type text NOT NULL CHECK (length(trim(target_type)) > 0),
  target_id text,
  reason text,
  request_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_school_time_idx ON audit_events (school_id, occurred_at DESC);
CREATE INDEX audit_events_request_idx ON audit_events (request_id) WHERE request_id IS NOT NULL;
