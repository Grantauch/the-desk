CREATE TABLE schedule_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  key text NOT NULL CHECK (key = upper(key) AND key ~ '^[A-Z0-9_]+$'),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, id),
  UNIQUE (school_id, key)
);
CREATE INDEX schedule_profiles_school_status_idx
  ON schedule_profiles (school_id, status);

CREATE TABLE schedule_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  schedule_profile_id uuid NOT NULL,
  period_code text NOT NULL CHECK (length(trim(period_code)) > 0),
  starts_at_local time NOT NULL,
  ends_at_local time NOT NULL,
  ordinal_by_time integer NOT NULL CHECK (ordinal_by_time > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at_local > starts_at_local),
  FOREIGN KEY (school_id, schedule_profile_id)
    REFERENCES schedule_profiles(school_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, id),
  UNIQUE (schedule_profile_id, period_code),
  UNIQUE (schedule_profile_id, ordinal_by_time)
);
CREATE INDEX schedule_periods_profile_time_idx
  ON schedule_periods (school_id, schedule_profile_id, ordinal_by_time);

CREATE TABLE school_calendar_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  academic_date date NOT NULL,
  is_school_day boolean NOT NULL,
  schedule_profile_id uuid,
  label text,
  source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'DISTRICT_CALENDAR', 'LEGACY_IMPORT')),
  source_revision text,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (school_id, schedule_profile_id)
    REFERENCES schedule_profiles(school_id, id) ON DELETE RESTRICT,
  CHECK (is_school_day OR schedule_profile_id IS NULL),
  UNIQUE (school_id, academic_date)
);
CREATE INDEX school_calendar_days_lookup_idx
  ON school_calendar_days (school_id, academic_date, is_school_day);

CREATE TABLE destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  category text NOT NULL CHECK (category IN ('RESTROOM', 'OFFICE', 'NURSE', 'COUNSELOR', 'OTHER')),
  active boolean NOT NULL DEFAULT true,
  security_visible boolean NOT NULL DEFAULT true,
  student_selectable boolean NOT NULL DEFAULT true,
  default_expected_minutes integer CHECK (default_expected_minutes IS NULL OR default_expected_minutes > 0),
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, id),
  UNIQUE (school_id, name)
);
CREATE INDEX destinations_school_active_idx
  ON destinations (school_id, active, category);

CREATE TABLE school_policy_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  effective_from date NOT NULL,
  effective_until date,
  active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_until IS NULL OR effective_until >= effective_from),
  FOREIGN KEY (school_id, academic_year_id)
    REFERENCES academic_years(school_id, id) ON DELETE RESTRICT,
  UNIQUE (school_id, id),
  UNIQUE (school_id, academic_year_id, name, effective_from)
);
CREATE INDEX school_policy_sets_effective_idx
  ON school_policy_sets (school_id, academic_year_id, effective_from, effective_until)
  WHERE active = true;

CREATE TABLE policy_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  policy_set_id uuid NOT NULL,
  policy_key text NOT NULL CHECK (policy_key = upper(policy_key) AND policy_key ~ '^[A-Z0-9_]+$'),
  typed_value_json jsonb NOT NULL,
  teacher_override_allowed boolean NOT NULL DEFAULT false,
  validation_schema_version integer NOT NULL DEFAULT 1 CHECK (validation_schema_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (school_id, policy_set_id)
    REFERENCES school_policy_sets(school_id, id) ON DELETE RESTRICT,
  UNIQUE (policy_set_id, policy_key)
);
CREATE INDEX policy_values_school_key_idx
  ON policy_values (school_id, policy_key);

CREATE TABLE section_policy_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  section_id uuid NOT NULL,
  policy_key text NOT NULL CHECK (policy_key = upper(policy_key) AND policy_key ~ '^[A-Z0-9_]+$'),
  typed_value_json jsonb NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  set_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  FOREIGN KEY (school_id, section_id)
    REFERENCES sections(school_id, id) ON DELETE RESTRICT
);
CREATE INDEX section_policy_overrides_effective_idx
  ON section_policy_overrides (school_id, section_id, policy_key, valid_from, valid_until);

CREATE TABLE student_access_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  section_id uuid,
  access_mode text NOT NULL CHECK (access_mode IN ('STANDARD', 'UNLIMITED', 'ESCORT_ONLY')),
  reason_private text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  set_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  FOREIGN KEY (school_id, student_id)
    REFERENCES students(school_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (school_id, section_id)
    REFERENCES sections(school_id, id) ON DELETE RESTRICT
);
CREATE INDEX student_access_rules_effective_idx
  ON student_access_rules (school_id, student_id, section_id, valid_from, valid_until)
  WHERE status = 'ACTIVE';
